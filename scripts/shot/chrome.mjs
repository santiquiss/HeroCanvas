// A headless Chrome driven over the DevTools protocol, for `npm run shot`: our own few lines instead of Playwright or
// Puppeteer (AGENTS.md: no new dependency). Node's WebSocket talks to the browser; one page, flat sessions.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

/** The Chrome to use: `CHROME_PATH`, the installed Chrome or Chromium, or the one Playwright downloaded. */
export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  // Playwright's own (any version): ~/Library/Caches/ms-playwright on macOS, ~/.cache/ms-playwright on Linux.
  for (const cache of [join(homedir(), 'Library/Caches/ms-playwright'), join(homedir(), '.cache/ms-playwright')]) {
    if (!existsSync(cache)) continue;
    for (const dir of readdirSync(cache).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
      candidates.push(
        join(cache, dir, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
        join(cache, dir, 'chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
        join(cache, dir, 'chrome-linux64/chrome'),
        join(cache, dir, 'chrome-linux/chrome'),
      );
    }
  }
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("Can't find Chrome: install it or set its path in CHROME_PATH");
  return found;
}

/**
 * Starts a headless Chrome and connects to it. `close()` ends it and removes its profile. A mock keychain: a new
 * profile would otherwise ask macOS's keychain for its cookie key (a password prompt for the person).
 */
export async function launch() {
  const profile = await mkdtemp(join(tmpdir(), 'hc-shot-'));
  const proc = spawn(
    findChrome(),
    ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--use-mock-keychain', '--password-store=basic', '--hide-scrollbars', '--force-color-profile=srgb', '--mute-audio', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const wsUrl = await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error("Chrome didn't start in time")), 20000);
    proc.stderr.on('data', (d) => {
      log += d;
      const m = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome quit (${code}): ${log.slice(-400)}`));
    });
  });
  const cdp = await connect(wsUrl);
  return {
    cdp,
    async close() {
      cdp.close();
      proc.kill();
      await new Promise((r) => (proc.exitCode != null ? r() : proc.once('exit', r)));
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/** A DevTools connection: `send(method, params, session)` and `once(event, session)`. */
function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(String(e.data));
    if (msg.id != null) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p?.reject(new Error(`${p.method}: ${msg.error.message}`));
      else p?.resolve(msg.result);
      return;
    }
    const hits = waiters.filter((w) => w.method === msg.method && w.session === msg.sessionId);
    for (const w of hits) {
      waiters.splice(waiters.indexOf(w), 1);
      w.resolve(msg.params);
    }
  };
  const api = {
    send(method, params = {}, session) {
      return new Promise((resolve, reject) => {
        pending.set(++id, { resolve, reject, method });
        ws.send(JSON.stringify({ id, method, params, ...(session && { sessionId: session }) }));
      });
    },
    once(method, session) {
      return new Promise((resolve) => waiters.push({ method, session, resolve }));
    },
    close: () => ws.close(),
  };
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve(api);
    ws.onerror = () => reject(new Error("Couldn't connect to Chrome"));
  });
}

/**
 * A page of its own (a session on a new target), in a window of its own: a tab behind another gets no animation frames,
 * and a screen that waits for one (a page sliding in) is never drawn. Several pages at once each stay in front.
 */
export async function newPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', newWindow: true });
  const { sessionId: s } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, s);
  await cdp.send('Runtime.enable', {}, s);
  const page = {
    /** Evaluates `expr` in the page (awaiting a promise) and returns its value; a thrown error rejects with its message. */
    async eval(expr) {
      const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, s);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] ?? r.exceptionDetails.text);
      return r.result.value;
    },
    async goto(url) {
      // A fresh document for every shot: the app keeps state across hash changes.
      const blank = cdp.once('Page.loadEventFired', s);
      await cdp.send('Page.navigate', { url: 'about:blank' }, s);
      await blank;
      const loaded = cdp.once('Page.loadEventFired', s);
      const nav = await cdp.send('Page.navigate', { url }, s);
      if (nav.errorText) throw new Error(`Couldn't open ${url}: ${nav.errorText}`);
      await loaded;
    },
    /** Waits until `expr` is truthy, polling. */
    async waitFor(expr, timeout = 20000, what = expr) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if (await page.eval(`!!(${expr})`).catch(() => false)) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`Timed out waiting for ${what}`);
    },
    viewport: (width, height, scale) => cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false }, s),
    transparent: () => cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }, s),
    reducedMotion: () => cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, s),
    /**
     * A PNG of `clip` (CSS pixels of the page), at the viewport's scale. `inView`: a clip inside the viewport, taken as
     * it's shown (beyond it, Chrome lays the page out again for the picture, and may take it before it's painted).
     */
    async png(clip, { inView = false } = {}) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: !inView, fromSurface: true }, s);
      return Buffer.from(data, 'base64');
    },
  };
  return page;
}
