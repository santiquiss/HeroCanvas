// Where each component shows up: every page in every variant (a detail page for each item of a list…), as it renders on
// load, on a phone.
// Built once per proposal per session, when asked (the changes popover, the rail) or ahead, in idle time, once a
// proposal is on: the scanner renders the pages off screen, like Flow's thumbnails, two at a time — mounts them, reads
// their instances (data-hc), unmounts them, then the next two. Each step is the same small cost (keeping the pages
// mounted made every step re-render all the ones before it: seconds of blocked main thread), runs when the browser is
// idle and as a transition (React can stop it for a click), and reports its progress (useScanProgress). It can't move
// to a worker: rendering the pages needs the DOM. A page counts what's on it, not the pages under it (a cover's); then
// each sheet it declares (useSheetLink: the sheets a link can open again) is opened in turn and what's in it is counted
// as that sheet's, on that page (`sheet`). Other things that only appear after an interaction (a dialog, a state, an
// undeclared sheet) aren't found.
// Cached: a finished index is kept in the browser (localStorage) for this build (__BUILD_ID__: each build, each dev
// server start), so it's there at once on the next load; `rescan` builds it again (after editing pages in dev).
// Isolated: the pages read a fixed copy of the URL (they can't write it) and shared state of their own, so nothing a
// page does on mount (open a sheet) reaches the live screens. The scanner lives in the canvas (it needs the sim
// providers); the popover and the rail read the index through a small store.
import { startTransition, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { componentInstance } from '../design/component';
import { findDevice } from '../devices/devices';
import { PreviewScreen } from '../flow/PreviewScreen';
import { useNavRoot } from '../nav/context';
import type { PageRef } from '../nav/types';
import { computeLayout } from './layout';
import { whenIdle } from './idle';
import { liveSearch, SharedSimProvider } from './SimContext';
import { SHEET_ATTR, SheetLinkScopeCtx, sheetLinkScope } from './sheetLinks';

/** A page in one of its variants (its label: "Inbox"), where a component is. */
export interface PagePlace extends PageRef {
  label?: string;
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

/** Pages mounted at a time while scanning. */
const PER_BATCH = 2;
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

let wanted: string | null = null;
const done = new Map<string, PageIndex>();
/** When each design's index was built (ms), cached or now. */
const builtAt = new Map<string, number>();

const CACHE = (key: string) => `hc.pageIndex.${__BUILD_ID__}.${key}`;
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
    for (const k of Object.keys(localStorage)) if (k.startsWith('hc.pageIndex.') && !k.startsWith(`hc.pageIndex.${__BUILD_ID__}.`)) localStorage.removeItem(k);
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
  ask(key);
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

const ask = (key: string) => {
  if (cached(key) || wanted === key) return;
  wanted = key;
  emit();
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

function Scan({ design }: { design: string }) {
  const nav = useNavRoot();
  const box = useRef<HTMLDivElement>(null);
  // The URL as it is (proposal, version, persona…), read-only for the scanned pages.
  const query = useMemo(() => liveSearch(), []);
  const refs = useMemo<PagePlace[]>(
    () =>
      Object.entries(nav.pages).flatMap(([id, def]) => {
        const variants = def.variants?.() ?? [];
        return variants.length ? variants.map((v) => ({ id, params: v.params, label: v.label })) : [{ id, params: {} }];
      }),
    [nav.pages],
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
        store(design, found.current);
        if (wanted === design) wanted = null;
        progress = null;
        emit();
        return;
      }
      progress = { key: design, at: next / refs.length };
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
    progress = { key: design, at: 0 };
    emit();
    return () => {
      if (progress?.key === design) progress = null;
    };
  }, [design]);

  return (
    <div ref={box} aria-hidden style={{ position: 'fixed', left: -100000, top: 0, width: 1, height: 1, overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none', contain: 'strict' }}>
      <SharedSimProvider>
        {step.map((ref, i) => (
          <div key={`${ref.id} ${ref.label ?? ''}`} data-scan-page>
            <ErrorBoundary label={`Scan ${ref.id}`}>
              {/* With its overlays, for its sheets to open in; they register in the page's own scope. */}
              <SheetLinkScopeCtx.Provider value={scopes[i]}>
                <PreviewScreen page={ref} query={query} makeLayout={makeLayout} overlays />
              </SheetLinkScopeCtx.Provider>
            </ErrorBoundary>
          </div>
        ))}
      </SharedSimProvider>
    </div>
  );
}
