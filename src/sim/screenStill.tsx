// A screen as a still picture instead of the app running: Flow's thumbnails. Locally the dev server draws each one once
// (scripts/vite/screenCache.ts, a headless Chrome in real mode); a deployed site has them made in its build
// (scripts/flow/prerender.mjs, flow-shots/). Where there's no picture (another device, persona or language than the
// build's), the screen is the app, live, as before.
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { findDevice, findDisplay } from '../devices/devices';
import { buildPath, SIM_PARAMS, type Manifest } from '../nav/stack';
import type { PageRef, Params } from '../nav/types';
import { SHOT_PARAMS } from '../capture/shot/params';
import { canWrite } from '../persist/devApi';
import type { Layout } from './layout';
import { BARE_PARAM, REAL_PARAM, SYSTEM_PARAM } from './realDevice';
import { liveSearch } from './SimContext';

export interface ScreenSpec {
  /** The site's hash: the page's route and query, in real mode with its device's system. */
  hash: string;
  /** The viewport, in points, and the picture's pixels per point. */
  w: number;
  h: number;
  scale: number;
}

/** The designer's own params: they change the canvas, not what a screen shows. */
const DESIGNER_ONLY = new Set<string>(['device', 'devices', 'display', 'arrange', 'sort', 'compare', 'zoom', 'land', 'rail', 'changes', 'where', 'capture', REAL_PARAM, SYSTEM_PARAM, BARE_PARAM, ...SHOT_PARAMS]);

/**
 * What a thumbnail shows, as the site draws it alone: its page with its params, the scenario on the URL now (persona,
 * proposal, language, the app's controls), its own state over that, light or dark, on its device's system. Null where
 * a picture can't stand for it (a device not in the catalog, a turned or split screen).
 */
export function screenSpec(pages: Manifest, page: PageRef, layout: Layout, theme: 'light' | 'dark', over?: URLSearchParams | Params): ScreenSpec | null {
  const now = liveSearch();
  // The device the canvas draws (`?device=`, `?display=`): its system in real mode. One the layout isn't (a set of
  // devices side by side) draws live.
  const device = findDevice(now.get('device'));
  const display = findDisplay(device, now.get('display'));
  const fits = Math.min(layout.vw, layout.vh) <= Math.min(display.w, display.h) && Math.max(layout.vw, layout.vh) <= Math.max(display.w, display.h);
  if (!fits || layout.rotLocked || layout.videoH) return null;
  const q = new URLSearchParams();
  for (const k of SIM_PARAMS) if (!DESIGNER_ONLY.has(k) && now.get(k) != null) q.set(k, now.get(k)!);
  for (const [k, v] of over instanceof URLSearchParams ? over : Object.entries(over ?? {})) q.set(k, v);
  q.set('theme', theme);
  q.set(REAL_PARAM, '1');
  q.set(SYSTEM_PARAM, device.id);
  q.set(BARE_PARAM, '1');
  q.sort();
  // One pixel a point: a thumbnail is a third of the device, so sharp on a Retina screen up to 150% zoom.
  return { hash: `${buildPath(pages, page)}?${q}`, w: layout.vw, h: layout.vh, scale: 1 };
}

const keyOf = (spec: ScreenSpec) => JSON.stringify(spec);

// Where pictures come from: the dev server (it draws any), the build's (only those it made), or none.
type Source = { kind: 'dev' } | { kind: 'built'; files: Record<string, string> } | { kind: 'none' };
let source: Source | null = null;
const sourceListeners = new Set<() => void>();
void (async () => {
  if (await canWrite()) source = { kind: 'dev' };
  else
    source = await fetch(`${import.meta.env.BASE_URL}flow-shots/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((files: Record<string, string> | null) => (files ? ({ kind: 'built', files } as const) : ({ kind: 'none' } as const)))
      .catch(() => ({ kind: 'none' }) as const);
  for (const l of sourceListeners) l();
})();
const useSource = () =>
  useSyncExternalStore(
    (l) => (sourceListeners.add(l), () => sourceListeners.delete(l)),
    () => source,
  );

// The app's code changed, or Refresh: every picture is asked for again.
let generation = 0;
const genListeners = new Set<() => void>();
const asked = new Map<string, Promise<string>>();
const ready = new Map<string, string>();
const stale = () => {
  asked.clear();
  ready.clear();
  generation++;
  for (const l of genListeners) l();
};
if (import.meta.hot) import.meta.hot.on('hc:screens-stale', stale);
const useGeneration = () =>
  useSyncExternalStore(
    (l) => (genListeners.add(l), () => genListeners.delete(l)),
    () => generation,
  );

/** Whether pictures can be drawn again here (the dev server): Refresh is offered. */
export const useCanRefreshScreens = () => useSource()?.kind === 'dev';

/** Every picture drawn again by the dev server (one whose data isn't in its code: a date, a fetched image). */
export async function refreshScreens() {
  await fetch('/__hc/screens/refresh', { method: 'POST', headers: { 'x-hc': '1' } }).catch(() => {});
}

// A few at a time: the browser's connections are the page's too.
const AT_ONCE = 3;
let running = 0;
const waiting: (() => void)[] = [];
async function inTurn<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= AT_ONCE) await new Promise<void>((go) => waiting.push(go));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** The dev server's picture of `spec`, drawn first if it isn't yet; once per spec. */
function drawn(spec: ScreenSpec): Promise<string> {
  const key = keyOf(spec);
  let p = asked.get(key);
  if (!p) {
    p = inTurn(async () => {
      const r = await fetch('/__hc/screen', { method: 'POST', headers: { 'x-hc': '1', 'content-type': 'application/json' }, body: key });
      if (!r.ok) throw new Error(`screen: ${r.status}`);
      const { src } = (await r.json()) as { src: string };
      const img = new Image();
      img.src = src;
      await img.decode().catch(() => {});
      ready.set(key, src);
      return src;
    });
    p.catch(() => asked.delete(key));
    asked.set(key, p);
  }
  return p;
}

/**
 * A screen as its picture, filling its box; `live` (the app) where there's none: no spec, a deployed site whose build
 * didn't make this one, or one the dev server couldn't draw. Drawn only once it's near the view.
 */
export function ScreenStill({ spec, live, root }: { spec: ScreenSpec | null; live: () => ReactNode; /** What it pans inside (Flow's canvas): near is measured against it. */ root?: RefObject<Element | null> }) {
  const src0 = useSource();
  const gen = useGeneration();
  const key = spec ? keyOf(spec) : null;
  const box = useRef<HTMLDivElement>(null);
  const near = useNear(box, root);
  const [shown, setShown] = useState<{ key: string; src: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!near || !spec || !key || src0?.kind !== 'dev' || ready.has(key)) return;
    let alive = true;
    drawn(spec).then(
      (src) => alive && (setShown({ key, src }), setFailed(null)),
      () => alive && setFailed(key),
    );
    return () => {
      alive = false;
    };
  }, [key, gen, near, src0]); // eslint-disable-line react-hooks/exhaustive-deps
  const built = key && src0?.kind === 'built' ? src0.files[key] : undefined;
  // Not known yet where pictures come from: blank, not the app (it would start only to be replaced).
  const live_ = !!src0 && (!spec || src0.kind === 'none' || (src0.kind === 'built' && !built) || failed === key);
  const src = !src0 || live_ ? undefined : built ? `${import.meta.env.BASE_URL}flow-shots/${built}` : (ready.get(key!) ?? shown?.src);
  return (
    <div ref={box} data-screen-spec={key ?? undefined} data-near={near || undefined} data-source={src0?.kind} style={{ width: '100%', height: '100%', background: live_ ? undefined : 'var(--pg)' }} aria-busy={(!live_ && !src) || undefined}>
      {live_ ? live() : src && <img src={src} alt="" draggable={false} decoding="async" style={{ display: 'block', width: '100%', height: '100%' }} />}
    </div>
  );
}

/** Whether an element is within 400px of what it's shown in (`root`, else the window); once it has been, it stays so. */
function useNear(el: RefObject<HTMLElement | null>, root?: RefObject<Element | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = el.current;
    if (!node || near) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { root: root?.current ?? null, rootMargin: '400px' });
    io.observe(node);
    return () => io.disconnect();
  }, [el, near, root]);
  return near;
}
