// Screens as still images, made by the dev server (only local, never committed): Flow's thumbnails, App Store Assets'
// devices. Each is the site in real mode in a headless Chrome, its taps and scroll put back, captured once to a PNG kept
// in node_modules/.cache/hc-screens. The canvas shows the picture instead of the app running in every thumbnail.
// (The deployed site has its own, made in the build: scripts/flow/prerender.mjs.)
//
// A picture is named by what it shows (its route and query, size, taps, scroll) and the app's code: a change to the
// app (app/, src/ but App Store Assets' own, public/ but its uploads) makes new ones, and the canvas is told
// (`hc:screens-stale`) to ask again.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, utimesSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import type { ViteDevServer } from 'vite';
import { launch, newPage, type ShotPage } from '../shot/chrome.mjs';

export interface ScreenSpec {
  /** The site's hash: route and query (real mode, its system, theme, language). */
  hash: string;
  /** The viewport, in points, and its pixels per point. */
  w: number;
  h: number;
  scale: number;
  taps?: unknown[];
  scroll?: unknown[];
}

/** Folders whose files change what a screen shows, and what in them doesn't. */
const WATCHED = ['app', 'src', 'public'];
const IGNORED = ['src/store/', 'app/store-assets.json', 'public/assets/store/'];
/** Pages open at once in the headless Chrome. */
const PAGES = 3;
/** A picture that takes longer than this: its Chrome is taken for gone. */
const DRAW_MS = 45_000;
/** Chrome closes after this long with nothing to draw. */
const IDLE_MS = 120_000;
/**
 * In the page: resolves once the screen has stopped changing for a moment (what comes a moment after it draws: a
 * reply, a chart, an image), or after a while for one that never does (a message that keeps rotating).
 */
const QUIET = `new Promise((done) => {
  let timer = setTimeout(end, 600);
  const cap = setTimeout(end, 5000);
  const mo = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(end, 600); });
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  function end() { mo.disconnect(); clearTimeout(timer); clearTimeout(cap); done(true); }
})`;

const KEY = /^[0-9a-f]{40}$/;

/** Pictures kept (about a third of a megabyte each): past that, the ones not shown for longest go. */
const MAX_PICTURES = 1500;
/** Pictures drawn between two clean-ups. */
const CLEAN_EVERY = 100;

type Chrome = Awaited<ReturnType<typeof launch>>;
type Page = ShotPage;

export function screenCache(server: ViteDevServer, root: string) {
  const dir = resolve(root, 'node_modules/.cache/hc-screens');
  mkdirSync(dir, { recursive: true });
  // The cache kept to its size: the pictures shown longest ago go (each one shown is touched, so it's recent).
  const clean = () => {
    try {
      const pics = readdirSync(dir)
        .filter((f) => f.endsWith('.png'))
        .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
      for (const { f } of pics.slice(MAX_PICTURES)) {
        unlinkSync(join(dir, f));
        const spec = join(dir, f.replace(/\.png$/, '.json'));
        if (existsSync(spec)) unlinkSync(spec);
      }
    } catch (e) {
      server.config.logger.warn(`[hc] screens cache: ${e}`, { timestamp: true });
    }
  };
  clean();
  let drawn = 0;
  const ignored = (abs: string) => {
    const rel = relative(root, abs).split(sep).join('/');
    return !WATCHED.some((w) => rel.startsWith(w + '/')) || IGNORED.some((i) => rel.startsWith(i));
  };

  // The app's code, as one hash of its files' sizes and times: worked out again only after a change.
  let stamp: string | null = null;
  const codeStamp = () => {
    if (stamp) return stamp;
    const h = createHash('sha1');
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const abs = join(d, e.name);
        if (e.isDirectory()) walk(abs);
        else if (!ignored(abs)) {
          const st = statSync(abs);
          h.update(`${abs}:${st.size}:${st.mtimeMs}\n`);
        }
      }
    };
    for (const w of WATCHED) if (existsSync(resolve(root, w))) walk(resolve(root, w));
    return (stamp = h.digest('hex'));
  };
  let staleTimer: ReturnType<typeof setTimeout> | undefined;
  const onChange = (file: string) => {
    if (ignored(file)) return;
    stamp = null;
    clearTimeout(staleTimer);
    staleTimer = setTimeout(() => server.ws.send({ type: 'custom', event: 'hc:screens-stale' }), 300);
  };
  server.watcher.on('change', onChange);
  server.watcher.on('add', onChange);
  server.watcher.on('unlink', onChange);

  // One Chrome, opened on the first picture and closed when idle; a few pages taking turns.
  let chrome: Promise<{ browser: Chrome; free: Page[] }> | null = null;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let busy = 0;
  const waiting: (() => void)[] = [];
  const open = () =>
    (chrome ??= (async () => {
      const browser = await launch();
      const free: Page[] = [];
      for (let i = 0; i < PAGES; i++) {
        const p = await newPage(browser.cdp);
        await p.reducedMotion();
        free.push(p);
      }
      return { browser, free };
    })());
  const close = async () => {
    const c = chrome;
    chrome = null;
    if (c) await (await c).browser.close().catch(() => {});
  };
  server.httpServer?.on('close', () => void close());

  const withPage = async <T>(fn: (p: Page) => Promise<T>): Promise<T> => {
    clearTimeout(idle);
    while (busy >= PAGES) await new Promise<void>((r) => waiting.push(r));
    busy++;
    try {
      const { free } = await open();
      const page = free.pop()!;
      try {
        // A Chrome gone (closed from outside, crashed) never answers: past this, it's dropped and the next one opens.
        return await Promise.race([fn(page), new Promise<never>((_, fail) => setTimeout(() => fail(new Error('the screen took too long')), DRAW_MS))]);
      } catch (e) {
        await close();
        throw e;
      } finally {
        free.push(page);
      }
    } finally {
      busy--;
      waiting.shift()?.();
      if (!busy) idle = setTimeout(() => void close(), IDLE_MS);
    }
  };

  const draw = (spec: ScreenSpec, base: string, file: string) =>
    withPage(async (page) => {
      await page.viewport(spec.w, spec.h, spec.scale);
      await page.goto(`${base}#${spec.hash}`);
      await page.waitFor("document.querySelector('[data-hc-screen]')", 20000, 'the screen');
      await page.eval('document.fonts.ready.then(() => true)');
      if (spec.taps?.length || spec.scroll?.length) {
        // The canvas's own replay (src/store/replay.ts), loaded alone from the dev server; what a tap opens may come a
        // moment later (a reply after its "Thinking..."): the lists are scrolled once the screen is still.
        await page.eval(`import('/src/store/replay.ts').then(async (m) => {
          await new Promise((r) => setTimeout(r, 200));
          await m.replayTaps(document, ${JSON.stringify(spec.taps ?? [])});
          await (${QUIET});
          for (let i = 0; i < 60 && !m.applyScroll(document, ${JSON.stringify(spec.scroll ?? [])}); i++) await new Promise((r) => requestAnimationFrame(r));
          return true;
        })`);
      }
      await page.eval(`Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))
        .then(() => ${QUIET}).then(() => true)`);
      await writeFile(file, await page.png({ x: 0, y: 0, width: spec.w, height: spec.h }, { inView: true }));
      // What it shows, beside it: to tell which screen a picture is.
      await writeFile(file.replace(/\.png$/, '.json'), JSON.stringify(spec, null, 2));
      if (++drawn % CLEAN_EVERY === 0) clean();
    });

  // The same picture asked twice while it's drawn: drawn once.
  const drawing = new Map<string, Promise<void>>();
  // Refresh: every picture drawn again, whatever's in the cache (a screen whose data isn't in its code: a date, an
  // image fetched).
  let salt = 0;

  return {
    /** The picture of `spec`, drawn if it isn't yet: its key. */
    async screen(spec: ScreenSpec, base: string): Promise<string> {
      const key = createHash('sha1')
        .update(JSON.stringify([spec.hash, spec.w, spec.h, spec.scale, spec.taps ?? [], spec.scroll ?? [], codeStamp(), salt]))
        .digest('hex');
      const file = join(dir, `${key}.png`);
      if (existsSync(file)) {
        // Shown again: recent, kept by the clean-up.
        const now = new Date();
        utimesSync(file, now, now);
        return key;
      }
      let job = drawing.get(key);
      if (!job) {
        job = draw(spec, base, file).finally(() => drawing.delete(key));
        drawing.set(key, job);
      }
      await job;
      return key;
    },
    /** Every picture drawn again: the canvases are told to ask anew. */
    refresh() {
      salt++;
      server.ws.send({ type: 'custom', event: 'hc:screens-stale' });
    },
    /** A picture drawn before, by its key. */
    read: (key: string) => (KEY.test(key) ? readFile(join(dir, `${key}.png`)).catch(() => null) : Promise.resolve(null)),
  };
}
