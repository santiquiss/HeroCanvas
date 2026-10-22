// Where an anchored sheet hangs as a drop-down (`openSheet({ anchored: 'dropdown' })`), where anchored sheets float
// (sim/layout anchoredFloats: 600pt wide or more): below its anchor, at its start, centered or at
// its end, kept on screen, above the anchor when there isn't
// room below. A tap outside closes it (no shim, as the app's: a transparent layer), and so does scrolling the page under
// it (kit/dismissOutside). It fades and drops in a little; motion: transform and opacity.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { AnchorRect } from '../kit';
import { useDismissOutside } from '../kit/dismissOutside';
import styles from './DropDownLayer.module.css';
import { useOverlay } from './useOverlay';

const GAP = 4;
const EDGE = 8;
const MS = 160;

export type DropDownAlign = 'start' | 'center' | 'end';

export function DropDownLayer({
  anchor,
  bounds,
  open,
  onClose,
  topInset,
  align = 'start',
  children,
}: {
  anchor: AnchorRect;
  bounds: { w: number; h: number };
  open: boolean;
  onClose: () => void;
  topInset: number;
  align?: DropDownAlign;
  children: ReactNode;
}) {
  const { mounted, on } = useOverlay(open, MS);
  const menu = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const outside = useDismissOutside(onClose, open);
  useLayoutEffect(() => {
    const el = menu.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted]);
  if (!mounted) return null;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), v));
  const x = align === 'start' ? anchor.x : align === 'end' ? anchor.x + anchor.w - size.w : anchor.x + (anchor.w - size.w) / 2;
  const below = anchor.y + anchor.h + GAP;
  const up = below + size.h > bounds.h - EDGE && anchor.y - GAP - size.h >= topInset + EDGE;
  const top = up ? anchor.y - GAP - size.h : clamp(below, topInset + EDGE, bounds.h - EDGE - size.h);
  return (
    <div className={styles.root}>
      <div className={styles.catch} {...outside} />
      <div
        ref={menu}
        className={`${styles.menu} ${on ? styles.on : ''}`}
        style={{
          left: clamp(x, EDGE, bounds.w - EDGE - size.w),
          top,
          maxHeight: bounds.h - topInset - 2 * EDGE,
          transformOrigin: up ? '50% 100%' : '50% 0',
          ['--drop' as string]: up ? '6px' : '-6px',
        }}
      >
        {children}
      </div>
    </div>
  );
}
