// iOS's bounce at a scroller's ends (Flutter's BouncingScrollPhysics, every iOS list): scrolled past its end, the
// content follows with growing resistance, and springs back when let go. Only moved, never stretched: the scroller's
// children are translated (`translate`, on the compositor), its sticky parts held where they are. The wheel and the
// trackpad (DeviceScreen) and the fingertip's drag and fling (TouchPointer) feed it. On iPhone and iPad screens (`data-bounce`);
// a scroller opts out with `overscroll-behavior: none` on its axis.

export type Axis = 'x' | 'y';

/** How far the content can go at most (points): a slight bounce. */
const REACH = 80;
/** Back to rest. */
const BACK = 'translate 420ms cubic-bezier(0.25, 0.9, 0.3, 1)';
/** A fling arriving at the end: out, then back. */
const OUT_MS = 110;
/** Wheel and trackpad: no event for this long and it's let go. */
const IDLE_MS = 90;

interface Pull {
  axis: Axis;
  /** Distance asked past the end (points, signed: + past the bottom or right). */
  raw: number;
  /** What moves (+1) and what's held (-1: sticky parts inside what moves), with their own `translate` before. */
  moved: { el: HTMLElement; sign: 1 | -1; before: string; beforeT: string }[];
  timer: number;
}

const pulls = new WeakMap<HTMLElement, Pull>();
/** Springing back: what was moved, until it's restored (a new pull meanwhile takes it over). */
const backs = new WeakMap<HTMLElement, { moved: Pull['moved']; timer: number }>();

/** Whether `el` scrolls along `axis` (its overflow lets it, and its content is longer). */
export function canScroll(el: HTMLElement, axis: Axis): boolean {
  const s = getComputedStyle(el);
  const ov = axis === 'y' ? s.overflowY : s.overflowX;
  if (ov !== 'auto' && ov !== 'scroll') return false;
  return axis === 'y' ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1;
}

/** Nearest ancestor of `from` (inside `root`) that scrolls along `axis`. */
export function scrollerFor(from: Element | null, root: Element, axis: Axis): HTMLElement | null {
  for (let n = from as HTMLElement | null; n && root.contains(n); n = n.parentElement) if (canScroll(n, axis)) return n;
  return null;
}

/**
 * The wheel and the trackpad over `screen`: a scroller already at its end (and every one around it, which would take
 * the scroll instead) bounces. Passive: the scroll itself is the browser's.
 */
export function bounceWheel(screen: HTMLElement): () => void {
  const onWheel = (e: WheelEvent) => {
    // A pinch zooms the canvas.
    if (e.ctrlKey) return;
    const axis: Axis = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? 'y' : 'x';
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const delta = (axis === 'y' ? e.deltaY : e.deltaX) * unit;
    if (!delta) return;
    const el = scrollerFor(e.target as Element, screen, axis);
    if (!el) return;
    if (pulled(el)) return pullWheel(el, axis, delta);
    for (let n: HTMLElement | null = el; n && screen.contains(n); n = n.parentElement) if (canScroll(n, axis) && canMove(n, axis, delta)) return;
    pullWheel(el, axis, delta);
  };
  screen.addEventListener('wheel', onWheel, { passive: true });
  return () => screen.removeEventListener('wheel', onWheel);
}

/** Whether `el` bounces along `axis` (not when its overscroll-behavior says none). */
export function bounces(el: HTMLElement, axis: Axis): boolean {
  // Only on a screen that bounces (DeviceScreen's `data-bounce`: iPhone and iPad, not the device in hand, which has its own).
  if (!el.closest('[data-bounce]')) return false;
  const s = getComputedStyle(el);
  return (axis === 'y' ? s.overscrollBehaviorY : s.overscrollBehaviorX) !== 'none';
}

/** Whether `el` can still scroll by `delta` along `axis` (+ toward the bottom or right). */
export function canMove(el: HTMLElement, axis: Axis, delta: number): boolean {
  const pos = axis === 'y' ? el.scrollTop : el.scrollLeft;
  const max = axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
  return delta > 0 ? pos < max - 0.5 : pos > 0.5;
}

/** The distance shown for `raw` asked: less and less, up to REACH (iOS's rubber band). */
const shown = (raw: number) => Math.sign(raw) * REACH * (1 - 1 / ((Math.abs(raw) * 0.55) / REACH + 1));

function start(el: HTMLElement, axis: Axis): Pull {
  const back = backs.get(el);
  if (back) {
    window.clearTimeout(back.timer);
    backs.delete(el);
  }
  const moved: Pull['moved'] = [];
  for (const child of Array.from(el.children)) {
    if (!(child instanceof HTMLElement) || getComputedStyle(child).position === 'sticky') continue;
    moved.push({ el: child, sign: 1, before: child.style.translate, beforeT: child.style.transition });
    // A sticky header inside what moves stays where it is.
    for (const d of Array.from(child.querySelectorAll<HTMLElement>('*')))
      if (getComputedStyle(d).position === 'sticky') moved.push({ el: d, sign: -1, before: d.style.translate, beforeT: d.style.transition });
  }
  // Still springing back: the same parts, with what they had before the first pull.
  if (back)
    for (const m of moved) {
      const was = back.moved.find((b) => b.el === m.el);
      if (was) Object.assign(m, { before: was.before, beforeT: was.beforeT });
    }
  const p: Pull = { axis, raw: 0, moved, timer: 0 };
  pulls.set(el, p);
  return p;
}

function show(p: Pull, transition: string, raw: number) {
  const o = -shown(raw);
  for (const m of p.moved) {
    // Its own transitions kept, the translate's added.
    m.el.style.transition = m.beforeT ? `${m.beforeT}, ${transition}` : transition;
    m.el.style.translate = p.axis === 'y' ? `0 ${m.sign * o}px` : `${m.sign * o}px 0`;
  }
}

/** `el` pulled `delta` more past its end (points, signed as scrolling: + past the bottom or right). */
export function pull(el: HTMLElement, axis: Axis, delta: number) {
  if (!bounces(el, axis)) return;
  const p = pulls.get(el) ?? start(el, axis);
  window.clearTimeout(p.timer);
  // Back the other way past where it rests: let go.
  if (p.raw && Math.sign(p.raw + delta) !== Math.sign(p.raw)) return release(el);
  p.raw += delta;
  show(p, 'translate 0s', p.raw);
}

/** Let go: back to rest, the moved parts' own `translate` restored after. */
export function release(el: HTMLElement) {
  const p = pulls.get(el);
  if (!p) return;
  pulls.delete(el);
  window.clearTimeout(p.timer);
  show(p, BACK, 0);
  const timer = window.setTimeout(() => {
    backs.delete(el);
    for (const m of p.moved) {
      m.el.style.translate = m.before;
      m.el.style.transition = m.beforeT;
    }
  }, 440);
  backs.set(el, { moved: p.moved, timer });
}

/** Wheel or trackpad: pulled, and let go when the events stop (a trackpad's momentum keeps them coming a while). */
export function pullWheel(el: HTMLElement, axis: Axis, delta: number) {
  pull(el, axis, delta);
  const p = pulls.get(el);
  if (p) p.timer = window.setTimeout(() => release(el), IDLE_MS);
}

/** Whether `el` is past its end now (the other way, scrolling back, lets it go first). */
export const pulled = (el: HTMLElement) => pulls.has(el);

/** A fling reaching the end at `velocity` (points per ms, signed as scrolling): out a little, then back. */
export function kick(el: HTMLElement, axis: Axis, velocity: number) {
  if (!bounces(el, axis) || pulls.has(el)) return;
  const p = start(el, axis);
  show(p, `translate ${OUT_MS}ms cubic-bezier(0.2, 0.8, 0.4, 1)`, velocity * 120);
  p.timer = window.setTimeout(() => release(el), OUT_MS);
}
