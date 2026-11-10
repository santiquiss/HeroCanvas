// Where each component shows up: every page in every variant (a detail page for each item of a list…), as it renders on
// load, on a phone.
// Built once per proposal per session, when asked (the changes popover, the rail) or ahead, in idle time, once a
// proposal is on: the scanner renders the pages off screen, like Flow's thumbnails, one at a time — mounts it, reads
// its instances (data-hc), unmounts it, then the next (two at once blocked a click twice as long, and the whole scan
// took the same). Each step is the same small cost (keeping the pages
// mounted made every step re-render all the ones before it: seconds of blocked main thread), runs when the browser is
// idle and as a transition (React can stop it for a click), and reports its progress (useScanProgress). It can't move
// to a worker: rendering the pages needs the DOM. A page counts what's on it, not the pages under it (a cover's); then
// each sheet it declares (useSheetLink: the sheets a link can open again) is opened in turn and what's in it is counted
// as that sheet's, on that page (`sheet`). Other things that only appear after an interaction (a dialog, a state, an
// undeclared sheet) aren't found.
// With a dev server, it's the server's work, in a Chrome of its own (scripts/vite/pageIndexCache.ts): this tab only
// asks how far it is, so nothing here slows down, and what the server kept is here at once after a reload. The scan
// below is then that Chrome's (`hcscan`), and a published site's.
// A proposal draws only what it can change: its new and changed pages, and the pages where a component it replaces
// shows in Live. Every other page is as Live's, read from Live's index (built first, once per build, when there's
// none): a proposal's scan is a few pages, not the whole app again. `rescan` draws them all.
// Cached: a finished index is kept in the browser (localStorage) for this build (__BUILD_ID__: each build, each dev
// server start), so it's there at once on the next load; `rescan` builds it again (after editing pages in dev).
// Isolated: the pages read a fixed copy of the URL (they can't write it) and shared state of their own, so nothing a
// page does on mount (open a sheet) reaches the live screens. The scanner lives in the canvas (it needs the sim
// providers); the popover and the rail read the index through a small store.
import { startTransition, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { componentInstance } from '../design/component';
import { findDevice } from '../devices/devices';
import { PreviewScreen } from '../flow/PreviewScreen';
import { DesignOverride } from '../design/overridable';
import { VARIANT_PARAM } from '../design/overridableRegistry';
import { NavCtx, useNavRoot } from '../nav/context';
import { liveNav } from '../nav/manifest';
import { BASE_PAGES } from '../nav/pages';
import { proposalChanges } from '../proposals';
import type { Proposal } from '../proposals/types';
import type { PageRef } from '../nav/types';
import { computeLayout } from './layout';
import { whenIdle } from './idle';
import { liveSearch, SharedSimProvider } from './SimContext';
import { SHEET_ATTR, SheetLinkScopeCtx, sheetLinkScope } from './sheetLinks';
import { projectKey } from '../project';
import { canWrite, serverPageIndex } from '../persist/devApi';

/** A page in one of its variants (its label: "Inbox"), where a component is. */
export interface PagePlace extends PageRef {
  label?: string;
  /** A variant by state: the state params it shows. */
  state?: Record<string, string>;
  /** How many instances of the component it has there. */
  count?: number;
  /** Of those, how many are inside another component, by that component's name (the rest are on the page itself). */
  inside?: Record<string, number>;
  /** In this sheet of the page (its id, sim/sheetLinks), not on the page itself. */
  sheet?: string;
}

/** Each component instance in `root`: how many of each component, and how many of those inside each other one. */
function countIn(root: Element): Map<string, { count: number; inside: Record<string, number> }> {
  const counts = new Map<string, { count: number; inside: Record<string, number> }>();
  for (const m of root.querySelectorAll<HTMLElement>('[data-hc]')) {
    const n = componentInstance(m.dataset.hc)?.name;
    if (!n) continue;
    const c = counts.get(n) ?? { count: 0, inside: {} };
    c.count++;
    // The component it's directly inside (its nearest instrumented ancestor there), if any.
    const parent = m.parentElement?.closest<HTMLElement>('[data-hc]');
    const p = parent && root.contains(parent) ? componentInstance(parent.dataset.hc)?.name : undefined;
    if (p) c.inside[p] = (c.inside[p] ?? 0) + 1;
    counts.set(n, c);
  }
  return counts;
}

/** Pages mounted at a time while scanning: one, so the longest the scan holds a click back is one page's mount. */
const PER_BATCH = 1;
/** After a step mounts, how long its pages' effects get to settle before they're read. */
const SETTLE_MS = 40;

/** Component name → the places it's on. */
export type PageIndex = Record<string, PagePlace[]>;

/** Of a component's instances in these places: how many are on the page itself, and how many inside each other one. */
export function nesting(list: PagePlace[]): { own: number; inside: [string, number][] } {
  const inside = new Map<string, number>();
  let own = 0;
  for (const p of list) {
    const nested = Object.entries(p.inside ?? {});
    for (const [parent, n] of nested) inside.set(parent, (inside.get(parent) ?? 0) + n);
    own += (p.count ?? 1) - nested.reduce((sum, [, n]) => sum + n, 0);
  }
  return { own, inside: [...inside].sort((a, b) => b[1] - a[1]) };
}

/** Live's index (a proposal's is its own code). */
const LIVE = 'live';
const AS_LIVE = { proposal: null, variant: null };

/**
 * The pages a proposal can draw otherwise than Live: those it adds or changes (any version's), and those where a
 * component it replaces shows in Live.
 */
export function pagesToDraw(p: Proposal, live: PageIndex): Set<string> {
  const ids = new Set<string>();
  for (const v of [null, ...p.variants.map((x) => x.id)]) {
    const c = proposalChanges(p, v, BASE_PAGES);
    for (const pg of c.pages) if (pg.kind !== 'removed') ids.add(pg.id);
    for (const cm of c.components) for (const pl of live[cm.name] ?? []) ids.add(pl.id);
  }
  return ids;
}

/**
 * A proposal's index from Live's: Live's places on the pages it has and didn't draw again, and its own on those it
 * did (`drawn`), in the pages' order.
 */
export function mergeIndex(live: PageIndex, own: PageIndex, drawn: Set<string>, pages: Record<string, unknown>): PageIndex {
  const order = new Map(Object.keys(pages).map((id, i) => [id, i]));
  const out: PageIndex = {};
  for (const name of new Set([...Object.keys(live), ...Object.keys(own)])) {
    const kept = (live[name] ?? []).filter((pl) => !drawn.has(pl.id) && order.has(pl.id));
    const places = [...kept, ...(own[name] ?? [])];
    // Stable: a page's places (its variants, then its sheets) stay as they were found.
    if (places.length) out[name] = places.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
  return out;
}

let wanted: string | null = null;
/** Designs asked to be drawn whole (`rescan`): no page read from Live's index. */
const whole = new Set<string>();
const done = new Map<string, PageIndex>();
/** When each design's index was built (ms), cached or now. */
const builtAt = new Map<string, number>();

const CACHE = (key: string) => projectKey(`hc.pageIndex.${__BUILD_ID__}.${key}`);
/** The design's index from the browser's cache, if this build has one. */
function cached(key: string): PageIndex | null {
  if (done.has(key)) return done.get(key)!;
  try {
    const raw = localStorage.getItem(CACHE(key));
    if (!raw) return null;
    const { at, index } = JSON.parse(raw) as { at: number; index: PageIndex };
    done.set(key, index);
    builtAt.set(key, at);
    return index;
  } catch {
    return null;
  }
}
function store(key: string, index: PageIndex) {
  done.set(key, index);
  builtAt.set(key, Date.now());
  try {
    // One build's indexes at a time: older builds' go.
    for (const k of Object.keys(localStorage)) if (k.startsWith(projectKey('hc.pageIndex.')) && !k.startsWith(CACHE(''))) localStorage.removeItem(k);
    localStorage.setItem(CACHE(key), JSON.stringify({ at: builtAt.get(key), index }));
  } catch {
    /* storage unavailable or full: it's kept for the session */
  }
}

/** Builds a design's index again (the pages changed). */
export function rescan(key: string) {
  done.delete(key);
  builtAt.delete(key);
  try {
    localStorage.removeItem(CACHE(key));
  } catch {
    /* storage unavailable */
  }
  wanted = null;
  whole.add(key);
  ask(key, true);
}

/** When a design's index was built (ms since epoch), or null while it's being built. */
export function useIndexBuiltAt(key: string): number | null {
  return useSyncExternalStore(subscribe, () => builtAt.get(key) ?? null);
}
/** The scan under way: its design and how far along it is (0–1). */
let progress: { key: string; at: number } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** The scan in this tab (PageScanner draws the pages). */
const askHere = (key: string) => {
  if (cached(key) || wanted === key) return;
  wanted = key;
  emit();
};

/** This page is the dev server's own (scripts/vite/pageIndexCache.ts): it scans when the server says, and only then. */
const SERVERS_PAGE = typeof window !== 'undefined' && liveSearch().has('hcscan');
/** After asking the dev server how far an index is, how long until asking again. */
const ASK_MS = 400;
/** The designs being asked of the dev server. */
const asked = new Set<string>();

/**
 * A design's index from the dev server, asked until it's the code's: the one it kept shows meanwhile, with how far
 * the new one is. False when there's no dev server, or it can't make it: the scan is this tab's then.
 */
async function fromServer(key: string, again: boolean): Promise<boolean> {
  if (!(await canWrite())) return false;
  for (;;) {
    const a = await serverPageIndex<PageIndex>(key, again);
    again = false;
    if (a?.index && a.at !== builtAt.get(key)) {
      done.set(key, a.index);
      builtAt.set(key, a.at ?? Date.now());
    }
    if (!a || a.failed || !a.stale) {
      if (progress?.key === key) progress = null;
      emit();
      // Something to show (even from older code) is enough not to draw every page here.
      if (done.has(key)) whole.delete(key);
      return done.has(key);
    }
    progress = { key, at: a.progress ?? 0 };
    emit();
    await new Promise((r) => setTimeout(r, ASK_MS));
  }
}

/** Asks for a design's index: of the dev server when there's one, else scanned here. `again`: whatever is kept. */
const ask = (key: string, again = false) => {
  if (SERVERS_PAGE || asked.has(key) || (!again && cached(key))) return;
  asked.add(key);
  void fromServer(key, again).then((ok) => {
    asked.delete(key);
    if (!ok) askHere(key);
  });
};

// The dev server's page: scans `key` when told (with Live's index, for a proposal to read the pages it leaves alone),
// and says how far it is.
if (SERVERS_PAGE)
  (window as unknown as { __hcPageIndex: unknown }).__hcPageIndex = {
    progress: () => progress?.at ?? 0,
    build: (key: string, live: PageIndex | null, all: boolean) =>
      new Promise<PageIndex>((ok) => {
        if (live) done.set(LIVE, live);
        if (all) {
          // Whatever this Chrome kept of it goes: every page is drawn.
          whole.add(key);
          done.delete(key);
          try {
            localStorage.removeItem(CACHE(key));
          } catch {
            /* storage unavailable */
          }
        }
        // Kept by this Chrome from a scan before (the same build's): that one.
        const kept = cached(key);
        if (kept) return ok(kept);
        const off = subscribe(() => {
          const index = done.get(key);
          if (!index) return;
          off();
          ok(index);
        });
        askHere(key);
      }),
  };

/**
 * The index for a design (`live` or a proposal id): null while it's being built. `enabled` asks for it now; `'idle'`
 * asks once the browser is idle, so it's usually ready by the time it's needed.
 */
export function usePageIndex(key: string, enabled: boolean | 'idle'): PageIndex | null {
  useEffect(() => {
    if (!enabled) return;
    if (enabled === true) return ask(key);
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(() => ask(key), { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(() => ask(key), 1500);
    return () => window.clearTimeout(t);
  }, [key, enabled]);
  return useSyncExternalStore(subscribe, () => done.get(key) ?? cached(key));
}

/** How far the scan for a design is (0–1) while it runs, else null. */
export function useScanProgress(key: string): number | null {
  return useSyncExternalStore(subscribe, () => (progress?.key === key ? progress.at : null));
}

/** Renders the pages off screen when an index is asked for, then stores it. Mount once, inside the sim providers. */
export function PageScanner({ design }: { design: string }) {
  const request = useSyncExternalStore(subscribe, () => wanted);
  return request && request === design && !done.has(request) ? <Scan key={request} design={request} /> : null;
}

/** How much of a proposal's scan is Live's, when Live's index is built first (its progress bar's share). */
const LIVE_SHARE = 0.9;

/** A design's scan: for a proposal, Live's first when this build has no index of it, then the proposal's own pages. */
function Scan({ design }: { design: string }) {
  const { proposal } = useNavRoot();
  const [liveFirst, setLiveFirst] = useState(() => !!proposal && !whole.has(design) && !cached(LIVE));
  const [afterLive] = useState(liveFirst);
  const liveDone = useCallback(() => setLiveFirst(false), []);
  if (liveFirst) return <Pass key={LIVE} design={design} asLive from={0} span={LIVE_SHARE} onDone={liveDone} />;
  return <Pass key={design} design={design} from={afterLive ? LIVE_SHARE : 0} span={afterLive ? 1 - LIVE_SHARE : 1} />;
}

/**
 * One pass over the pages, for `design`'s scan: Live's own (`asLive`: drawn without the proposal, stored as Live's), or
 * the design's. `from`, `span`: its part of the scan's progress.
 */
function Pass({ design, asLive = false, from, span, onDone }: { design: string; asLive?: boolean; from: number; span: number; onDone?: () => void }) {
  const root = useNavRoot();
  const nav = useMemo(() => (asLive ? liveNav(root) : root), [asLive, root]);
  const box = useRef<HTMLDivElement>(null);
  // The URL as it is (proposal, version, persona…), read-only for the scanned pages; Live's without the proposal.
  const query = useMemo(() => {
    const q = liveSearch();
    if (asLive) for (const k of ['proposal', VARIANT_PARAM]) q.delete(k);
    return q;
  }, [asLive]);
  // A proposal with Live's index at hand draws only the pages it can change (`drawn`); the rest are read from Live's.
  const [live, drawn] = useMemo<[PageIndex, Set<string>] | [null, null]>(() => {
    const base = !asLive && nav.proposal && !whole.has(design) ? cached(LIVE) : null;
    return base ? [base, pagesToDraw(nav.proposal!, base)] : [null, null];
  }, [asLive, nav.proposal, design]);
  const refs = useMemo<PagePlace[]>(
    () =>
      Object.entries(nav.pages)
        .filter(([id]) => !drawn || drawn.has(id))
        .flatMap(([id, def]) => {
          const variants = def.variants?.() ?? [];
          return variants.length ? variants.map((v) => ({ id, params: v.params ?? {}, label: v.label, state: v.state })) : [{ id, params: {} }];
        }),
    [nav.pages, drawn],
  );
  // A phone in portrait: the layout every page has.
  const makeLayout = useMemo(() => {
    const display = findDevice(null).displays[0];
    return (detailOpen: boolean) => computeLayout({ display, land: false, supported: false, detailOpen, video: false });
  }, []);

  // Where the scan is: the first page of the step mounted now. What's found so far.
  const [at, setAt] = useState(0);
  const found = useRef<PageIndex>({});
  const step = refs.slice(at, at + PER_BATCH);
  // Each page's own scope for the sheets it declares.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scopes = useMemo(() => step.map(() => sheetLinkScope()), [at]);
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let cancel = () => {};
    const wait = (then: () => void) => (timer = window.setTimeout(() => !cancelled && then(), SETTLE_MS));
    const record = (place: PagePlace, root: Element) => {
      for (const [n, { count, inside }] of countIn(root)) (found.current[n] ??= []).push({ ...place, count, ...(Object.keys(inside).length ? { inside } : {}) });
    };
    const els = [...(box.current?.querySelectorAll<HTMLElement>('[data-scan-page]') ?? [])];
    // Then each page's sheets, one at a time: opened, given time to render, read.
    const sheets = els.flatMap((el, i) => [...(scopes[i]?.openers.get(step[i].id) ?? [])].map(([id, open]) => ({ el, i, id, open })));
    const nextSheet = (k: number) => {
      if (k >= sheets.length) return nextStep();
      const s = sheets[k];
      s.open();
      wait(() => {
        const root = s.el.querySelector(`[${SHEET_ATTR}="${CSS.escape(s.id)}"]`);
        if (root) record({ ...step[s.i], sheet: s.id }, root);
        nextSheet(k + 1);
      });
    };
    const nextStep = () => {
      const next = at + PER_BATCH;
      if (next >= refs.length) {
        if (asLive) {
          // Live's, on the way to the proposal's: kept, and the proposal's own pass follows.
          store(LIVE, found.current);
          emit();
          return void onDone?.();
        }
        store(design, live && drawn ? mergeIndex(live, found.current, drawn, nav.pages) : found.current);
        whole.delete(design);
        if (wanted === design) wanted = null;
        progress = null;
        emit();
        return;
      }
      progress = { key: design, at: from + (span * next) / refs.length };
      emit();
      cancel = whenIdle(() => startTransition(() => setAt(next)));
    };
    // Once the step's pages have rendered and their effects settled: read them (the page on top of each preview's
    // stack, the last one drawn, not the ones under it), then their sheets, then the next step when idle.
    wait(() => {
      els.forEach((el, i) => {
        const pages = el.querySelectorAll<HTMLElement>('[data-hc-page]');
        record(step[i], pages[pages.length - 1] ?? el);
      });
      nextSheet(0);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancel();
    };
    // One step per `at` (the list is read as it was when the step mounted).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);
  useEffect(() => {
    progress = { key: design, at: from };
    emit();
    return () => {
      // Live's pass hands the progress on to the proposal's own.
      if (!asLive && progress?.key === design) progress = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design]);

  return (
    <div ref={box} aria-hidden style={{ position: 'fixed', left: -100000, top: 0, width: 1, height: 1, overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none', contain: 'strict' }}>
      <NavCtx.Provider value={nav}>
      <DesignOverride.Provider value={asLive ? AS_LIVE : null}>
      <SharedSimProvider>
        {step.map((ref, i) => (
          <div key={`${ref.id} ${ref.label ?? ''}`} data-scan-page>
            <ErrorBoundary label={`Scan ${ref.id}`}>
              {/* With its overlays, for its sheets to open in; they register in the page's own scope. */}
              <SheetLinkScopeCtx.Provider value={scopes[i]}>
                <PreviewScreen page={ref} query={query} state={ref.state} makeLayout={makeLayout} overlays />
              </SheetLinkScopeCtx.Provider>
            </ErrorBoundary>
          </div>
        ))}
      </SharedSimProvider>
      </DesignOverride.Provider>
      </NavCtx.Provider>
    </div>
  );
}
