// Where a dragged scroll-snap scroller comes to rest (TouchPointer): the snap positions of its items, read from the
// layout, and the one a release at a given velocity lands on. A pager's pages and a row's cards go through the same
// rule, so a card that is narrower than the screen snaps to its own start, not to a screen width.

/** Release velocity (px/ms) from which a drag is a flick: it moves on to the next item, however short the drag. */
export const FLICK_VELOCITY = 0.3;

type Axis = 'x' | 'y';

/** `child`'s start inside `scroller`'s scrolled content, in layout px (transforms such as the canvas zoom do not count). */
function offsetWithin(child: HTMLElement, scroller: HTMLElement, axis: Axis): number {
  const walk = (from: HTMLElement, stop: (parent: HTMLElement) => boolean) => {
    let sum = 0;
    let n: HTMLElement | null = from;
    while (n) {
      const parent = n.offsetParent as HTMLElement | null;
      sum += axis === 'y' ? n.offsetTop : n.offsetLeft;
      if (!parent || stop(parent)) return { sum, parent };
      n = parent;
    }
    return { sum, parent: null };
  };
  const toChild = walk(child, (p) => p === scroller || p.contains(scroller));
  if (toChild.parent === scroller) return toChild.sum;
  // The scroller is not positioned: both offsets are measured from the same ancestor.
  const toScroller = walk(scroller, (p) => p === toChild.parent);
  return toChild.sum - toScroller.sum - (axis === 'y' ? scroller.clientTop : scroller.clientLeft);
}

/** The scroll positions `scroller` can rest at along `axis`, ascending: one per item that declares `scroll-snap-align`. */
export function snapPoints(scroller: HTMLElement, axis: Axis): number[] {
  const style = getComputedStyle(scroller);
  const px = (value: string) => Number.parseFloat(value) || 0;
  const size = axis === 'y' ? scroller.clientHeight : scroller.clientWidth;
  const max = (axis === 'y' ? scroller.scrollHeight : scroller.scrollWidth) - size;
  const padStart = px(axis === 'y' ? style.scrollPaddingTop : style.scrollPaddingLeft);
  const padEnd = px(axis === 'y' ? style.scrollPaddingBottom : style.scrollPaddingRight);
  const points = new Set<number>();
  for (const child of scroller.children) {
    if (!(child instanceof HTMLElement)) continue;
    // "start", "none center"…: the last keyword is the inline axis', the first the block axis'.
    const align = getComputedStyle(child).scrollSnapAlign.split(' ');
    const mode = axis === 'y' ? align[0] : align[align.length - 1];
    if (mode === 'none') continue;
    const start = offsetWithin(child, scroller, axis);
    const length = axis === 'y' ? child.offsetHeight : child.offsetWidth;
    const at = mode === 'center' ? start + length / 2 - (padStart + size - padEnd) / 2 : mode === 'end' ? start + length - size + padEnd : start - padStart;
    points.add(Math.round(Math.max(0, Math.min(max, at))));
  }
  return [...points].sort((a, b) => a - b);
}

/**
 * The snap position a release lands on. Released without speed, the nearest one. A flick moves on to the next item
 * in its direction from where the content is — one item per gesture, like turning a page, however fast the flick —
 * so a row of cards never runs to its end and never rests between two.
 * @param from where the drag started (the position it rested at)
 * @param position where it was released
 * @param velocity px/ms of scroll position at release (positive = towards the end)
 */
export function snapTarget(points: number[], from: number, position: number, velocity: number): number | null {
  if (!points.length) return null;
  const nearest = (to: number) => points.reduce((best, p) => (Math.abs(p - to) < Math.abs(best - to) ? p : best), points[0]);
  let index = points.indexOf(nearest(position));
  if (Math.abs(velocity) >= FLICK_VELOCITY) {
    const dir = Math.sign(velocity);
    const origin = points.indexOf(nearest(from));
    // Not past the item it started on yet: the next one. Dragged further: the item the content is already heading into.
    if ((index - origin) * dir <= 0) index = origin + dir;
    else if ((position - points[index]) * dir > 0) index += dir;
  }
  return points[Math.max(0, Math.min(points.length - 1, index))];
}
