// Colors a device's screen paints, put another way in one screenshot alone (DeviceLayer.recolor): every element painted
// `from` (its fill, stroke, text or background) is painted `to`. The app's screen stays as it is. Shared by the canvas's
// live screen (ShotImage) and the dev server's picture of it (scripts/vite/screenCache.ts), so both show the same.

export interface ColorSwap {
  /** Any CSS color, the app's tokens too (`var(--background-accent-expenditure)`), with its alpha when it has one. */
  from: string;
  to: string;
}

/** What may carry a color, as getComputedStyle and the inline style name it. */
const PROPS = ['fill', 'stroke', 'color', 'background-color', 'border-color'] as const;
/** How far apart two colors may be, per channel (0–255), and still be the same: a computed color rounds. */
const TOLERANCE = 3;

let ctx: CanvasRenderingContext2D | null = null;

/** A computed color as [r, g, b, a] (0–255), or null when it isn't one (`none`, a gradient, a url). */
function rgba(css: string): number[] | null {
  if (!css || css === 'none' || css.startsWith('url(')) return null;
  ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // A color the canvas doesn't take leaves fillStyle as it was.
  ctx.fillStyle = '#010203';
  ctx.fillStyle = css;
  if (ctx.fillStyle === '#010203' && !/^#010203$/i.test(css)) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data];
}

const same = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) <= TOLERANCE);

/**
 * Paints each `from` found under `root` as its `to`. The colors are read as the screen has them (a probe inside it,
 * so its tokens resolve), then compared as pixels: `#0A6CFF66` finds the same color written as a `color-mix`.
 */
export function recolor(root: Element, pairs: ColorSwap[]): void {
  if (!pairs.length) return;
  const probe = document.createElement('i');
  probe.style.display = 'none';
  root.appendChild(probe);
  const resolve = (css: string) => {
    probe.style.color = '';
    probe.style.color = css;
    return probe.style.color ? getComputedStyle(probe).color : null;
  };
  const swaps = pairs.flatMap((p) => {
    const from = resolve(p.from);
    const to = resolve(p.to);
    const px = from && rgba(from);
    return px && to ? [{ px, to }] : [];
  });
  probe.remove();
  if (!swaps.length) return;
  for (const el of root.querySelectorAll<HTMLElement | SVGElement>('*')) {
    const style = getComputedStyle(el);
    for (const prop of PROPS) {
      const px = rgba(style.getPropertyValue(prop));
      const swap = px && px[3] > 0 && swaps.find((s) => same(s.px, px));
      if (swap) el.style.setProperty(prop, swap.to);
    }
  }
}
