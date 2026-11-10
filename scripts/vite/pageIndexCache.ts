// Where each component shows (the where-used index, src/sim/pageIndex.tsx), built by the dev server instead of the
// designer's own tab: drawing every page takes seconds of a browser's main thread, so it's a headless Chrome's here,
// and the canvas only asks how far it is. The page is the app itself, which scans as it would in a tab
// (window.__hcPageIndex); what it finds is kept in node_modules/.cache/hc-index with the code it was made from.
//
// A proposal's is made from Live's (only the pages it can change are drawn), so Live's comes first when it's missing
// or from older code. An index from older code is still given, as `stale`, while the new one is made: the canvas has
// something to show at once after a reload.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ViteDevServer } from 'vite';
import { launch, newPage } from '../shot/chrome.mjs';

/** A design: `live`, or a proposal's code or folder. */
const DESIGN = /^[\w.-]{1,80}$/;
const LIVE = 'live';
/** A scan that takes longer than this: its Chrome is taken for gone. */
const SCAN_MS = 180_000;
/** Chrome closes after this long with nothing to scan. */
const IDLE_MS = 60_000;
/** How much of a proposal's scan is Live's, when Live's is made first (as the tab's own scan counts it). */
const LIVE_SHARE = 0.9;

type Index = Record<string, unknown[]>;
interface Kept {
  /** The code it was made from (scripts/vite/screenCache.ts' stamp). */
  stamp: string;
  at: number;
  index: Index;
}
export interface IndexAnswer {
  index?: Index;
  at?: number;
  /** `index` is from older code (or there's none yet): a new one is being made, `progress` (0–1) along. */
  stale?: boolean;
  progress?: number;
  /** It couldn't be made here for the code as it is: the canvas scans by itself. */
  failed?: boolean;
}

export function pageIndexCache(server: ViteDevServer, root: string, project: string, codeStamp: () => string) {
  const dir = resolve(root, 'node_modules/.cache/hc-index');
  mkdirSync(dir, { recursive: true });
  const fileOf = (design: string) => join(dir, `${project}.${design}.json`);
  const read = (design: string): Kept | null => {
    try {
      return existsSync(fileOf(design)) ? (JSON.parse(readFileSync(fileOf(design), 'utf8')) as Kept) : null;
    } catch {
      return null;
    }
  };

  // One Chrome with one page, opened on the first scan and closed when idle; one scan at a time.
  let chrome: Promise<{ close: () => Promise<void>; page: Awaited<ReturnType<typeof newPage>> }> | null = null;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const open = () =>
    (chrome ??= (async () => {
      const browser = await launch();
      const page = await newPage(browser.cdp);
      await page.viewport(1280, 800, 1);
      return { close: () => browser.close(), page };
    })());
  const close = async () => {
    const c = chrome;
    chrome = null;
    if (c) await (await c).close().catch(() => {});
  };
  server.httpServer?.on('close', () => void close());

  /** The scans under way, by design: how far each is. */
  const jobs = new Map<string, { progress: number }>();
  /** The designs whose scan failed, with the code it failed for: not tried again until the code changes. */
  const failed = new Map<string, string>();
  let queue: Promise<unknown> = Promise.resolve();

  /**
   * Draws `design`'s pages in the headless page and keeps what it finds. `whole`: every page, none read from Live's.
   * `from`, `span`: its part of the job's progress.
   */
  const scan = async (design: string, base: string, whole: boolean, job: { progress: number }, from = 0, span = 1): Promise<Kept> => {
    const stamp = codeStamp();
    let live: Kept | null = null;
    if (design !== LIVE && !whole) {
      live = read(LIVE);
      if (live?.stamp !== stamp) {
        live = await scan(LIVE, base, false, job, 0, LIVE_SHARE);
        [from, span] = [LIVE_SHARE, 1 - LIVE_SHARE];
      }
    }
    const { page } = await open();
    // `hcscan`: the page scans by itself, never asking back here.
    await page.goto(`${base}#/?${design === LIVE ? '' : `proposal=${encodeURIComponent(design)}&`}hcscan=1`);
    await page.waitFor('window.__hcPageIndex', 30000, 'the designer');
    let running = true;
    const watch = (async () => {
      while (running) {
        const at = await page.eval('window.__hcPageIndex.progress()').catch(() => null);
        if (typeof at === 'number') job.progress = from + span * at;
        await new Promise((r) => setTimeout(r, 250));
      }
    })();
    let late: ReturnType<typeof setTimeout> | undefined;
    try {
      const index = (await Promise.race([
        page.eval(`window.__hcPageIndex.build(${JSON.stringify(design)}, ${JSON.stringify(live?.index ?? null)}, ${whole})`),
        new Promise<never>((_, fail) => (late = setTimeout(() => fail(new Error('the scan took too long')), SCAN_MS))),
      ])) as Index;
      const kept: Kept = { stamp, at: Date.now(), index };
      writeFileSync(fileOf(design), JSON.stringify(kept));
      return kept;
    } finally {
      clearTimeout(late);
      running = false;
      await watch;
    }
  };

  const start = (design: string, base: string, whole: boolean) => {
    if (jobs.has(design)) return;
    const job = { progress: 0 };
    const stamp = codeStamp();
    jobs.set(design, job);
    clearTimeout(idle);
    queue = queue
      .then(() => {
        // Made meanwhile (Live's, on the way to a proposal's): nothing to do.
        const kept = read(design);
        return !whole && kept?.stamp === codeStamp() ? kept : scan(design, base, whole, job);
      })
      .catch(async (e) => {
        server.config.logger.warn(`[hc] page index (${design}): ${e}`, { timestamp: true });
        // A Chrome gone, or a page that never answered: not again for this code. (A page reloaded under the scan,
        // the code having changed, fails for the code before: the next ask starts over.)
        failed.set(design, stamp);
        await close();
      })
      .finally(() => {
        jobs.delete(design);
        if (!jobs.size) idle = setTimeout(() => void close(), IDLE_MS);
      });
  };

  return {
    /**
     * What the canvas asks: `design`'s index if it's the code's; else the one before (`stale`) and how far the new
     * one is, started if it isn't under way. `again`: scanned whole anew, whatever is kept.
     */
    get(design: string, base: string, again = false): IndexAnswer | null {
      if (!DESIGN.test(design)) return null;
      const kept = read(design);
      if (again) {
        failed.delete(design);
        start(design, base, true);
      } else if (failed.get(design) === codeStamp()) return { index: kept?.index, at: kept?.at, failed: true };
      else if (kept?.stamp === codeStamp() && !jobs.has(design)) return { index: kept.index, at: kept.at };
      else start(design, base, false);
      return { index: kept?.index, at: kept?.at, stale: true, progress: jobs.get(design)?.progress ?? 0 };
    },
  };
}
