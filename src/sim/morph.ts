// Shared-element moves: a control that changes place (a button from the rail to a search's bar, the
// search pill from the page to that bar, and back) flies from where it was to where it is, so it reads as the same
// control moving, not one leaving and another arriving.
//
// Tag both places with useMorph(key). When one mounts, its source is another element with that key still on the
// screen (one leaving: an exiting page keeps its DOM while it animates out) or one that just unmounted (its box and a
// copy are recorded on the way out). Two copies fly over the screen, old fading into new, following the target's
// live position (its page may still be sliding in); the real one shows when they land.
import { useLayoutEffect, useRef } from 'react';
import { EASE_OUT, reducedMotion } from '../kit/motion';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What just left, per screen and key. */
const left = new WeakMap<Element, Map<string, { box: Box; copy: HTMLElement; t: number; el: HTMLElement }>>();
/** Elements flying in now (a remount of the same element, as React's strict mode does, doesn't start another). */
const flying = new WeakSet<HTMLElement>();

const MS = 460;
/** How long a departure stays a source: the navigation that removed it mounts its new place in the same commit. */
const FRESH_MS = 300;

/** An element's box in its screen's own px (the device frame is drawn scaled). */
function boxIn(el: Element, screen: HTMLElement): Box {
  const s = screen.getBoundingClientRect();
  const k = s.width / screen.offsetWidth || 1;
  const r = el.getBoundingClientRect();
  return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
}

function copyOf(el: HTMLElement): HTMLElement {
  const c = el.cloneNode(true) as HTMLElement;
  c.removeAttribute('data-morph');
  c.removeAttribute('data-hc');
  return c;
}

function place(c: HTMLElement, b: Box, opacity: number) {
  Object.assign(c.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px`, opacity: String(opacity) });
}

function fly(screen: HTMLElement, el: HTMLElement, from: { box: Box; copy: HTMLElement }, source?: HTMLElement) {
  const to = copyOf(el);
  const copies = [from.copy, to];
  for (const c of copies) {
    Object.assign(c.style, {
      position: 'absolute',
      margin: '0',
      boxSizing: 'border-box',
      flex: 'none',
      maxWidth: 'none',
      transform: 'none',
      transition: 'none',
      pointerEvents: 'none',
      visibility: 'visible',
      zIndex: '95',
    });
    screen.appendChild(c);
  }
  el.style.visibility = 'hidden';
  flying.add(el);
  const t0 = performance.now();
  const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
  const step = () => {
    const t = Math.min(1, (performance.now() - t0) / MS);
    const p = EASE_OUT(t);
    // Toward where the target is now: it may be on a page that's still sliding in.
    const target = boxIn(el, screen);
    const b = { x: lerp(from.box.x, target.x, p), y: lerp(from.box.y, target.y, p), w: lerp(from.box.w, target.w, p), h: lerp(from.box.h, target.h, p) };
    place(from.copy, b, 1 - Math.min(1, t / 0.5));
    place(to, b, Math.min(1, t / 0.6));
    if (t < 1 && el.isConnected) return void requestAnimationFrame(step);
    copies.forEach((c) => c.remove());
    el.style.visibility = '';
    // A source still on the screen when it lands wasn't leaving (a bar opening under a page that stays, the nav
    // staying): it shows again. One that was leaving is gone by now (pages animate out in PAGE_MS, shorter than MS).
    if (source?.isConnected) source.style.visibility = '';
    flying.delete(el);
  };
  requestAnimationFrame(step);
}

/**
 * Tags a control that changes place (spread the result on it): it flies in from its other place (see the header).
 * `null`: this one stays put (the same control on a page it doesn't move to: the Kitchen's + isn't the nav's).
 */
export function useMorph<T extends HTMLElement>(key: string | null) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    if (!key) return;
    const el = ref.current;
    const screen = el?.closest<HTMLElement>('[data-theme]');
    if (!el || !screen) return;
    if (!reducedMotion() && !flying.has(el)) {
      const other = [...screen.querySelectorAll<HTMLElement>(`[data-morph="${key}"]`)].find(
        (o) => o !== el && o.getClientRects().length > 0 && getComputedStyle(o).visibility !== 'hidden',
      );
      const recent = left.get(screen)?.get(key);
      if (other) {
        const from = { box: boxIn(other, screen), copy: copyOf(other) };
        // It's leaving (its page animates out): the copy takes its place.
        other.style.visibility = 'hidden';
        fly(screen, el, from, other);
      } else if (recent && recent.el !== el && performance.now() - recent.t < FRESH_MS) {
        left.get(screen)!.delete(key);
        fly(screen, el, recent);
      }
    }
    return () => {
      // Mid-flight it isn't where it shows (the copies are): nothing to record.
      if (!el.getClientRects().length || flying.has(el)) return;
      const map = left.get(screen) ?? new Map();
      map.set(key, { box: boxIn(el, screen), copy: copyOf(el), t: performance.now(), el });
      left.set(screen, map);
    };
  }, [key]);
  return { ref, 'data-morph': key ?? undefined };
}
