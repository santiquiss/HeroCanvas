// The kit's popover: content opened from a control on a large screen, a card with a pointer at the control, growing
// out of it on a spring and shrinking back. No barrier: a tap outside closes it. Pure: props in, callbacks out.
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useComponent } from '../design/component';
import { useDismissOutside } from './dismissOutside';
import { spring, useEntered } from './motion';
import styles from './Popover.module.css';

export interface AnchorRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PopoverProps {
  anchor: AnchorRect;
  /** The container's size (the device screen). */
  bounds: { w: number; h: number };
  open?: boolean;
  onClose?: () => void;
  /** Card width. */
  width?: number;
  /** Keep clear of the status bar at the top. */
  topInset?: number;
  /**
   * The side of its control it opens on (a rail's +: to its right, wherever the rail puts it). None: by where the
   * control is (below one in the top band, else away from the nearer edge).
   */
  side?: 'left' | 'right' | 'top' | 'bottom';
  children?: ReactNode;
}

// iOS menus and popovers grow out of their button on a snappy spring and shrink back into it on a smooth, quicker one.
const POP_IN = spring(0.4, 0.15);
const POP_OUT = spring(0.35);
const POP_MOTION = {
  '--pop-in': POP_IN.easing,
  '--pop-in-ms': `${POP_IN.ms}ms`,
  '--pop-out': POP_OUT.easing,
  '--pop-out-ms': `${POP_OUT.ms}ms`,
} as CSSProperties;

const POINTER = 10;
const GAP = 8;
/** Share of the screen's height from the top in which a control opens the popover below it. */
const TOP_BAND = 0.25;
const EDGE = 8;
const RADIUS = 24;
/** Room around the shape for its pointer and shadow. */
const PAD = 40;

/** The card + pointer outline: a rounded rect with the pointer bump on one edge (`along` from its start), offset by PAD. */
function popoverPath(w: number, h: number, edge: 'top' | 'right' | 'bottom' | 'left', along: number): string {
  const r = RADIUS;
  const B = 10; // half the pointer's base
  const T = POINTER; // its length
  const p = (x: number, y: number) => `${(x + PAD).toFixed(1)} ${(y + PAD).toFixed(1)}`;
  let d = `M${p(r, 0)}`;
  if (edge === 'top') d += ` L${p(along - B, 0)} L${p(along - 1.5, -T + 1.5)} Q${p(along, -T)} ${p(along + 1.5, -T + 1.5)} L${p(along + B, 0)}`;
  d += ` L${p(w - r, 0)} A${r} ${r} 0 0 1 ${p(w, r)}`;
  if (edge === 'right') d += ` L${p(w, along - B)} L${p(w + T - 1.5, along - 1.5)} Q${p(w + T, along)} ${p(w + T - 1.5, along + 1.5)} L${p(w, along + B)}`;
  d += ` L${p(w, h - r)} A${r} ${r} 0 0 1 ${p(w - r, h)}`;
  if (edge === 'bottom') d += ` L${p(along + B, h)} L${p(along + 1.5, h + T - 1.5)} Q${p(along, h + T)} ${p(along - 1.5, h + T - 1.5)} L${p(along - B, h)}`;
  d += ` L${p(r, h)} A${r} ${r} 0 0 1 ${p(0, h - r)}`;
  if (edge === 'left') d += ` L${p(0, along + B)} L${p(-T + 1.5, along + 1.5)} Q${p(-T, along)} ${p(-T + 1.5, along - 1.5)} L${p(0, along - B)}`;
  return d + ` L${p(0, r)} A${r} ${r} 0 0 1 ${p(r, 0)} Z`;
}

export function Popover({ anchor, bounds, open = true, onClose, width = 378, topInset = 0, side: askedSide, children }: PopoverProps) {
  const mf = useComponent('Popover', { width });
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), POP_OUT.ms);
    return () => window.clearTimeout(t);
  }, [open]);
  const on = useEntered(open && mounted);
  const outside = useDismissOutside(onClose, open);
  const shadowId = 'pop' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const card = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(400);
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const measure = () => setH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted]);
  if (!mounted) return null;

  const cx = anchor.x + anchor.w / 2;
  const cy = anchor.y + anchor.h / 2;
  // Below a control in the top band (an app bar, a header's title or button), pointing up; otherwise as the + opens.
  const side: 'left' | 'right' | 'top' | 'bottom' =
    askedSide ?? (anchor.y + anchor.h < bounds.h * TOP_BAND ? 'bottom' : cx > bounds.w * 0.75 ? 'left' : cx < bounds.w * 0.25 ? 'right' : 'top');
  // Beside the anchor it takes what room there is between the anchor and the screen edge.
  const room = side === 'left' ? anchor.x - GAP - POINTER - EDGE : side === 'right' ? bounds.w - anchor.x - anchor.w - GAP - POINTER - EDGE : bounds.w - 2 * EDGE;
  const w = Math.min(width, room);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const top0 = EDGE + topInset;
  let left: number;
  let top: number;
  if (side === 'top') {
    left = clamp(cx - w / 2, EDGE, bounds.w - EDGE - w);
    top = clamp(anchor.y - GAP - POINTER - h, top0, bounds.h - EDGE - h);
  } else if (side === 'bottom') {
    left = clamp(cx - w / 2, EDGE, bounds.w - EDGE - w);
    top = anchor.y + anchor.h + GAP + POINTER;
  } else {
    left = side === 'left' ? anchor.x - GAP - POINTER - w : anchor.x + anchor.w + GAP + POINTER;
    top = clamp(cy - h / 2, top0, bounds.h - EDGE - h);
  }
  // Where the pointer meets the card, kept off the rounded corners.
  const vertical = side === 'top' || side === 'bottom';
  const along = vertical ? clamp(cx - left, 28, w - 28) : clamp(cy - top, 28, h - 28);
  const origin =
    side === 'top' ? `${along}px ${h + POINTER}px` : side === 'bottom' ? `${along}px ${-POINTER}px` : side === 'left' ? `${w + POINTER}px ${along}px` : `${-POINTER}px ${along}px`;
  const d = popoverPath(w, h, side === 'top' ? 'bottom' : side === 'bottom' ? 'top' : side === 'left' ? 'right' : 'left', along);
  const frame: CSSProperties = { left: -PAD, top: -PAD, width: w + 2 * PAD, height: h + 2 * PAD };
  return (
    // The layer lets taps through (pointer-events none); the catcher has a hole over the anchor, so the button that
    // opened the popover (the +, turned ×) stays tappable and shows its press.
    <div className={styles.popoverRoot} style={{ pointerEvents: 'none' }}>
      {/* No shim: a transparent layer catches the tap outside, and a scroll of the page under it (kit/dismissOutside). */}
      <div
        className={styles.popoverCatch}
        {...outside}
        style={{
          ...outside.style,
          clipPath: `path(evenodd, 'M0 0H${bounds.w}V${bounds.h}H0Z M${anchor.x} ${anchor.y}h${anchor.w}v${anchor.h}h${-anchor.w}Z')`,
        }}
      />
      {/* Named on the card, not the layer over the screen: Inspect and the changes highlight mark the popover itself. */}
      <div
        {...mf}
        className={`${styles.popover} ${on ? styles.popoverOn : ''}`}
        style={{ left, top, width: w, transformOrigin: origin, ...POP_MOTION }}
      >
        <svg className={styles.popoverShape} style={frame} width={w + 2 * PAD} height={h + 2 * PAD} aria-hidden>
          <defs>
            {/* Shadow outside the shape only: a close one that marks the edge and a wide, soft one. */}
            <filter id={shadowId} x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
              <feOffset in="SourceAlpha" dy="1" result="o1" />
              <feGaussianBlur in="o1" stdDeviation="1.5" result="b1" />
              <feColorMatrix in="b1" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.14 0" result="s1" />
              <feOffset in="SourceAlpha" dy="12" result="o2" />
              <feGaussianBlur in="o2" stdDeviation="14" result="b2" />
              <feColorMatrix in="b2" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.2 0" result="s2" />
              <feMerge result="both">
                <feMergeNode in="s2" />
                <feMergeNode in="s1" />
              </feMerge>
              <feComposite in="both" in2="SourceAlpha" operator="out" />
            </filter>
          </defs>
          <path d={d} fill="#000" filter={`url(#${shadowId})`} />
          {/* On the page's color, so a list of white rows in it reads as a card. */}
          <path d={d} fill="var(--app-page)" />
          <path d={d} fill="none" stroke="var(--app-border)" strokeWidth="1" />
        </svg>
        <div ref={card} className={styles.popoverCard} style={{ maxHeight: side === 'bottom' ? bounds.h - EDGE - top : bounds.h - 2 * EDGE - topInset, pointerEvents: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
