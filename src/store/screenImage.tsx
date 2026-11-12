// A device's screen on the canvas as a still picture: the dev server draws it once (scripts/vite/screenCache.ts, a
// headless Chrome in real mode, its taps and scroll put back) and the canvas shows the image. The app runs only in
// Interact with the screen. Where there's no dev server to draw it (a static deploy), the screen is the app, live.
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { Display } from '../devices/devices';
import { buildPath, type Manifest } from '../nav/stack';
import { canWrite } from '../persist/devApi';
import { BASE_LANGUAGE, LANG_PARAM, type Language } from '../sim/language';
import { BARE_PARAM, REAL_PARAM, SYSTEM_PARAM } from '../sim/realDevice';
import { modelsFor } from './Device3D';
import type { DeviceLayer } from './shots';
import styles from './StoreAssets.module.css';

export interface ScreenSpec {
  /** The site's hash: the layer's route and query, in real mode with its device's system. */
  hash: string;
  /** Its device's display, in points, and the picture's pixels per point. */
  w: number;
  h: number;
  scale: number;
  taps?: DeviceLayer['taps'];
  scroll?: DeviceLayer['scroll'];
  /** Texts put another way before the picture's taken (DeviceLayer.replace, in its language). */
  replace?: { from: string; to: string }[];
  /** Colors put another way before the picture's taken (DeviceLayer.recolor). */
  recolor?: { from: string; to: string }[];
}

/** Pixels per point: a phone at its own 3×, a tablet at 2× (the stores' sizes, at most). */
const scaleFor = (d: Display) => (Math.min(d.w, d.h) >= 600 ? 2 : 3);

/**
 * What a device layer shows, as the site draws it alone: its page and query, the set's language, its light or dark,
 * the system of its device (the one picked, or the first of this size), and without the device's camera when it has
 * no frame. Interact with the screen opens the same.
 */
export function screenSpec(pages: Manifest, layer: DeviceLayer, display: Display, language: Language): ScreenSpec {
  const models = modelsFor(display);
  const model = models.find((m) => m.device.id === layer.model) ?? models[0];
  const shown = model?.display ?? display;
  const q = new URLSearchParams(layer.query);
  if (language !== BASE_LANGUAGE) q.set(LANG_PARAM, language);
  q.set('theme', layer.theme ?? 'light');
  q.set(REAL_PARAM, '1');
  if (model) q.set(SYSTEM_PARAM, model.device.id);
  if (!layer.frame) q.set(BARE_PARAM, '1');
  const replace = layer.replace?.[language] ?? layer.replace?.[BASE_LANGUAGE];
  return { hash: `${buildPath(pages, layer.page)}?${q}`, w: shown.w, h: shown.h, scale: scaleFor(shown), taps: layer.taps, scroll: layer.scroll, ...(replace?.length && { replace }), ...(layer.recolor?.length && { recolor: layer.recolor }) };
}

// Whether the dev server draws them: known once, the same for every screen.
let drawn: boolean | null = null;
const drawnListeners = new Set<() => void>();
void canWrite().then((v) => {
  drawn = v;
  for (const l of drawnListeners) l();
});
const subscribeDrawn = (l: () => void) => {
  drawnListeners.add(l);
  return () => drawnListeners.delete(l);
};

/** Whether screens are pictures (true), the app live (false), or not known yet (null). */
export const useStillScreens = (): boolean | null => useSyncExternalStore(subscribeDrawn, () => drawn);

// The app's code changed (the dev server says so): every picture is asked for again.
let generation = 0;
const genListeners = new Set<() => void>();
const asked = new Map<string, Promise<string>>();
if (import.meta.hot)
  import.meta.hot.on('hc:screens-stale', () => {
    asked.clear();
    ready.clear();
    generation++;
    for (const l of genListeners) l();
  });
const subscribeGen = (l: () => void) => {
  genListeners.add(l);
  return () => genListeners.delete(l);
};

// A few at a time: the browser's connections are the page's too (its modules, the file saves). The screens on show
// first; the other languages' after them (`later`), so switching language finds them drawn.
const AT_ONCE = 6;
let running = 0;
type Turn = { key: string; go: () => void };
const now: Turn[] = [];
const later: Turn[] = [];
/** Ahead-of-time ones (another language) at once at most: what's on show always has room. */
const LOW_AT_ONCE = 2;
let runningLow = 0;
/** Whether one drawn ahead can start: nothing on show waiting, and few of its kind going. */
const lowMayStart = () => !now.length && running < AT_ONCE && runningLow < LOW_AT_ONCE && performance.now() - lastShownAsk > SETTLE_MS;
/** How long after the last screen on show was asked for before any drawn ahead starts (more may come as it scrolls). */
const SETTLE_MS = 1500;
let lastShownAsk = -Infinity;
async function inTurn<T>(key: string, fn: () => Promise<T>, low: boolean): Promise<T> {
  if (!low) lastShownAsk = performance.now();
  // Ahead of time: behind everything on show, even with a slot free (the first screens shown ask a moment later).
  if (low ? !lowMayStart() : running >= AT_ONCE) await new Promise<void>((go) => (low ? later : now).push({ key, go }));
  running++;
  if (low) runningLow++;
  try {
    return await fn();
  } finally {
    running--;
    if (low) runningLow--;
    next();
  }
}
/** The next to start: one on show, else one drawn ahead when it may. */
function next() {
  if (now.length && running < AT_ONCE) return now.shift()!.go();
  if (later.length && lowMayStart()) later.shift()!.go();
}
// Ahead-of-time ones asked while the first screens are still being asked for: given a moment, then started if they may.
setInterval(() => later.length && next(), 1000);
/** One waiting behind the others that's now on show: ahead of them; `first`: in view, ahead of every other. */
function hurry(key: string, first = false) {
  const i = later.findIndex((x) => x.key === key);
  const j = now.findIndex((x) => x.key === key);
  const turn = i >= 0 ? later.splice(i, 1)[0] : first && j >= 0 ? now.splice(j, 1)[0] : null;
  if (turn) (first ? now.unshift(turn) : now.push(turn));
  next();
}

/** Pictures ready, by spec: shown in the first frame, with no loading in between. */
const ready = new Map<string, string>();

/** The picture's address, drawn first if it isn't yet; once per spec. `low`: after every one asked for on show. */
function picture(spec: ScreenSpec, low = false): Promise<string> {
  const key = JSON.stringify(spec);
  let p = asked.get(key);
  if (p && !low) hurry(key);
  if (!p) {
    p = inTurn(key, async () => {
      const r = await fetch(import.meta.env.BASE_URL + '__hc/screen', { method: 'POST', headers: { 'x-hc': '1', 'content-type': 'application/json' }, body: key });
      if (!r.ok) throw new Error(`screen: ${r.status}`);
      const { src } = (await r.json()) as { src: string };
      // Decoded before it's shown: the old picture stays until the new one can take its place at once.
      const img = new Image();
      img.src = src;
      await img.decode().catch(() => {});
      ready.set(key, src);
      return src;
    }, low);
    p.catch(() => asked.delete(key));
    asked.set(key, p);
  }
  return p;
}

/** Draws these ahead, after the screens on show (a device's other languages). */
export function usePrefetchScreens(specs: ScreenSpec[] | null) {
  const keys = specs ? JSON.stringify(specs) : null;
  const gen = useSyncExternalStore(subscribeGen, () => generation);
  useEffect(() => {
    if (!keys) return;
    for (const spec of JSON.parse(keys) as ScreenSpec[]) void picture(spec, true).catch(() => {});
  }, [keys, gen]);
}

/**
 * The screen as its picture, at `w` × `h` points with the screen's corners: the one before stays while a new one is
 * drawn, under a sweep that says it's coming. One that can't be drawn shows `live` (the app) instead.
 */
export function ScreenStill({ spec, others, w, h, radius, dark, live }: { spec: ScreenSpec; others?: ScreenSpec[] | null; w: number; h: number; radius: string | number; dark: boolean; live: () => ReactNode }) {
  const gen = useSyncExternalStore(subscribeGen, () => generation);
  const key = JSON.stringify(spec);
  const [shown, setShown] = useState<{ key: string; src: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Drawn only once it's on the canvas or near it: a long listing's other sizes wait until they're scrolled to, and
  // the one just changed isn't behind all of them.
  const box = useRef<HTMLDivElement>(null);
  const near = useNear(box);
  const inView = useInView(box);
  // One drawn already (another language, back from elsewhere): at once.
  const cached = ready.get(key);
  useEffect(() => {
    if (!near || ready.has(key)) return;
    let alive = true;
    picture(JSON.parse(key) as ScreenSpec).then(
      (src) => alive && (setShown({ key, src }), setFailed(null)),
      () => alive && setFailed(key),
    );
    return () => {
      alive = false;
    };
  }, [key, gen, near]);
  // In view (not only near it): first in line, ahead of the nearby rows' and the other languages'.
  useEffect(() => {
    if (inView && !ready.has(key)) hurry(key, true);
  }, [inView, key]);
  // Its other languages, drawn ahead while it's on the canvas: switching language finds them ready.
  usePrefetchScreens(near ? (others ?? null) : null);
  if (failed === key && !cached) return <>{live()}</>;
  const src = cached ?? shown?.src;
  const loading = !cached && shown?.key !== key;
  const style: CSSProperties = { width: w, height: h, borderRadius: radius };
  return (
    <div ref={box} className={`${styles.screenStill} ${loading ? styles.screenLoading : ''}`} data-dark={dark || undefined} style={style} aria-busy={loading || undefined}>
      {src && <img src={src} alt="" draggable={false} decoding="async" />}
    </div>
  );
}

/** Whether an element is on the screen or within half a screen of it; once it has been, it stays so. */
/** Whether it's in the canvas's view now (no margin), as it scrolls in and out. */
function useInView(el: RefObject<HTMLElement | null>): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const io = new IntersectionObserver((entries) => setOn(entries.some((e) => e.isIntersecting)));
    io.observe(node);
    return () => io.disconnect();
  }, [el]);
  return on;
}

function useNear(el: RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = el.current;
    if (!node || near) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '50%' });
    io.observe(node);
    return () => io.disconnect();
  }, [el, near]);
  return near;
}
