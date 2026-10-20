// Touch emulation for the prototype (like the iOS Simulator): the mouse becomes a fingertip — a translucent circle —
// and dragging scrolls whatever is under it, with axis lock, momentum and paging for scroll-snap carousels.
// A drag cancels the tap, as on a phone. Clicks without movement go through untouched. Mouse only; real touch and the
// wheel keep their native behavior. Horizontal drags on `[data-swipe-x]` (a swipeable row) are left to it, and drags
// down on `[data-drag-down]` (a sheet at its top, which they close).
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './SimulatorShell.module.css';

/** Movement (screen px) before a press becomes a drag. */
const SLOP = 6;
/** Fingertip diameter in device points. */
const TIP = 38;
/** Velocity decay per 16ms frame of momentum scrolling. */
const FRICTION = 0.95;

type Axis = 'x' | 'y';

function canScroll(el: HTMLElement, axis: Axis): boolean {
  const s = getComputedStyle(el);
  const ov = axis === 'y' ? s.overflowY : s.overflowX;
  if (ov !== 'auto' && ov !== 'scroll') return false;
  return axis === 'y' ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1;
}

/** Nearest ancestor of `from` (inside `root`) that scrolls along `axis`. */
function scrollerFor(from: Element | null, root: Element, axis: Axis): HTMLElement | null {
  for (let n = from as HTMLElement | null; n && root.contains(n); n = n.parentElement) if (canScroll(n, axis)) return n;
  return null;
}

/**
 * `frame`: the scaled device frame; its first child is the screen. `scale` and `rotated` (rotation-locked frame,
 * turned 90°) map mouse movement to device points.
 */
export function TouchPointer({ frame, enabled, scale, rotated }: { frame: HTMLElement | null; enabled: boolean; scale: number; rotated: boolean }) {
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = tip.current;
    if (!frame || !dot || !enabled) return;
    // The screen is looked up on every event: it can be replaced while the frame stays (e.g. the iPhone Duo video
    // layout wraps it), and a remembered element would go stale.
    const screenOf = () => frame.firstElementChild as HTMLElement | null;
    if (!screenOf()) return;
    frame.dataset.touch = '';

    /** Screen px → device points (undoing scale and the 90° turn of a rotation-locked frame). */
    const toDevice = (dx: number, dy: number) => (rotated ? { x: dy / scale, y: -dx / scale } : { x: dx / scale, y: dy / scale });

    let press: { x: number; y: number; target: Element; id: number } | null = null;
    let drag: { el: HTMLElement | null; axis: Axis; snap: string | null; last: { x: number; y: number }; samples: { t: number; v: number }[] } | null = null;
    let momentum = 0;

    // Writes only what changed: with many frames (All devices) most pointers stay hidden and touch nothing.
    let visible = false;
    const show = (e: PointerEvent, on: boolean) => {
      if (on !== visible) {
        visible = on;
        dot.style.opacity = on ? '1' : '0';
      }
      if (on) dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%) scale(${press ? 0.86 : 1})`;
    };

    const inScreen = (t: EventTarget | null) => t instanceof Node && !!screenOf()?.contains(t);
    // One scroll write per frame, however many pointer events arrive (high-rate mice, Firefox): no layout thrash.
    let pending = 0;
    let flushRaf = 0;
    const flush = (el: HTMLElement, axis: Axis) => {
      if (axis === 'y') el.scrollTop -= pending;
      else el.scrollLeft -= pending;
      pending = 0;
      flushRaf = 0;
    };
    const queueScroll = (el: HTMLElement | null, axis: Axis, delta: number) => {
      if (!el) return;
      pending += delta;
      if (!flushRaf) flushRaf = requestAnimationFrame(() => flush(el, axis));
    };
    const stopMomentum = () => cancelAnimationFrame(momentum);

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const target = e.target as Element;
      if (!inScreen(target) || target.closest('input, textarea, select, [contenteditable], [data-no-drag]')) return;
      stopMomentum();
      press = { x: e.clientX, y: e.clientY, target, id: e.pointerId };
      dot.classList.add(styles.touchDown);
      show(e, true);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      show(e, inScreen(e.target) || !!press);
      if (!press) return;
      const dx = e.clientX - press.x;
      const dy = e.clientY - press.y;
      if (!drag) {
        if (Math.hypot(dx, dy) < SLOP) return;
        const d = toDevice(dx, dy);
        const axis: Axis = Math.abs(d.x) > Math.abs(d.y) ? 'x' : 'y';
        // A row that swipes sideways (a dismissible) takes horizontal drags itself; a sheet at its top, drags down (they
        // close it), while a drag up scrolls its content like any other.
        if ((axis === 'x' && press.target.closest('[data-swipe-x]')) || (axis === 'y' && d.y > 0 && press.target.closest('[data-drag-down]'))) {
          press = null;
          dot.classList.remove(styles.touchDown);
          return;
        }
        const screen = screenOf();
        const el = screen ? scrollerFor(press.target, screen, axis) : null;
        // Paging carousels scroll freely while dragged; they settle on a page when released.
        const snap = el && getComputedStyle(el).scrollSnapType !== 'none' ? el.style.scrollSnapType : null;
        if (el && snap !== null) el.style.scrollSnapType = 'none';
        // The content follows the finger from where it went down.
        drag = { el, axis, snap, last: { x: press.x, y: press.y }, samples: [{ t: performance.now(), v: 0 }] };
        frame.setPointerCapture(press.id);
        document.body.style.userSelect = 'none';
      }
      const step = toDevice(e.clientX - drag.last.x, e.clientY - drag.last.y);
      drag.last = { x: e.clientX, y: e.clientY };
      const delta = drag.axis === 'y' ? step.y : step.x;
      queueScroll(drag.el, drag.axis, delta);
      const now = performance.now();
      drag.samples.push({ t: now, v: delta });
      while (drag.samples.length && now - drag.samples[0].t > 90) drag.samples.shift();
    };

    const settle = (el: HTMLElement, axis: Axis, v: number, snap: string | null) => {
      if (snap !== null) {
        // Page by where a flick would carry it, then restore snapping once there.
        const size = axis === 'y' ? el.clientHeight : el.clientWidth;
        const pos = axis === 'y' ? el.scrollTop : el.scrollLeft;
        const max = Math.round((axis === 'y' ? el.scrollHeight : el.scrollWidth) / size) - 1;
        const page = Math.max(0, Math.min(max, Math.round((pos - v * 160) / size)));
        let done = false;
        const restore = () => {
          if (done) return;
          done = true;
          el.style.scrollSnapType = snap;
        };
        el.addEventListener('scrollend', restore, { once: true });
        window.setTimeout(restore, 1000);
        el.scrollTo({ [axis === 'y' ? 'top' : 'left']: page * size, behavior: 'smooth' });
        return;
      }
      let vel = v;
      let t0 = performance.now();
      const tick = (now: number) => {
        const dt = Math.min(32, now - t0);
        t0 = now;
        vel *= FRICTION ** (dt / 16);
        if (axis === 'y') el.scrollTop -= vel * dt;
        else el.scrollLeft -= vel * dt;
        if (Math.abs(vel) > 0.02) momentum = requestAnimationFrame(tick);
      };
      momentum = requestAnimationFrame(tick);
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !press) return;
      dot.classList.remove(styles.touchDown);
      if (drag) {
        const { el, axis, samples, snap } = drag;
        if (flushRaf && el) {
          cancelAnimationFrame(flushRaf);
          flush(el, axis);
        }
        const span = samples.length > 1 ? samples[samples.length - 1].t - samples[0].t : 0;
        const v = span > 0 ? samples.slice(1).reduce((t, s) => t + s.v, 0) / span : 0;
        if (el) settle(el, axis, v, snap);
        // The drag cancels the tap.
        window.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
        if (frame.hasPointerCapture(press.id)) frame.releasePointerCapture(press.id);
        document.body.style.userSelect = '';
      }
      press = null;
      drag = null;
      show(e, inScreen(e.target));
    };

    const swallow = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onLeave = () => {
      if (press) return;
      visible = false;
      dot.style.opacity = '0';
    };
    // Images and links would start a native drag instead.
    const noNativeDrag = (e: DragEvent) => e.preventDefault();

    frame.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    frame.addEventListener('pointerleave', onLeave);
    frame.addEventListener('dragstart', noNativeDrag);
    return () => {
      stopMomentum();
      cancelAnimationFrame(flushRaf);
      delete frame.dataset.touch;
      dot.style.opacity = '0';
      document.body.style.userSelect = '';
      frame.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      frame.removeEventListener('pointerleave', onLeave);
      frame.removeEventListener('dragstart', noNativeDrag);
    };
  }, [frame, enabled, scale, rotated]);

  const size = TIP * scale;
  // In document.body: a containing ancestor (contain / content-visibility, transforms) would offset and clip it.
  return createPortal(<div ref={tip} className={styles.touch} style={{ width: size, height: size }} aria-hidden />, document.body);
}
