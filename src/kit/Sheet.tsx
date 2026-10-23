// The kit's sheet: a panel over the screen in one of eight layouts (from the bottom, the top, a side, a pane, a dialog),
// over a modal barrier, that animates in and out by layout. The simulator presents every sheet an app opens through it
// (sim/sheetPresentation picks the layout a screen size gets). Pure: props in, callbacks out.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { useComponent } from '../design/component';
import { KEYBOARD_MOTION } from '../sim/motion';
import { useEntered } from './motion';
import styles from './Sheet.module.css';

export const BARRIER_COLOR = 'var(--app-scrim)';

export interface ModalBarrierProps {
  /** The barrier's color (the app's scrim by default). */
  color?: string;
  /** A tap on it dismisses (onDismiss). */
  dismissible?: boolean;
  onDismiss?: () => void;
}

export function ModalBarrier({ color = BARRIER_COLOR, dismissible = true, onDismiss }: ModalBarrierProps) {
  const mf = useComponent('ModalBarrier', { color, dismissible, onDismiss });
  return <div {...mf} className={styles.barrier} style={color === BARRIER_COLOR ? undefined : { background: color }} onClick={dismissible ? onDismiss : undefined} />;
}

export type SheetLayout = 'bottomContent' | 'bottomExpanded' | 'topContent' | 'dialog' | 'sideCompact' | 'sideExpanded' | 'leftPane' | 'rightPane';

/**
 * Max width presets: compact 390 (Side Compact), regular 580 (Side Expanded),
 * wide 640 (Content / Dialog / Pane), full (no limit); medium 480 sits between compact and regular.
 * Narrower screens still get the full width.
 */
export type SheetWidth = 'compact' | 'medium' | 'regular' | 'wide' | 'full';
const SHEET_WIDTH: Record<SheetWidth, string> = { compact: '390px', medium: '480px', regular: '580px', wide: '640px', full: 'none' };
/** How wide a bottom sheet gets at most (its width preset; the layout's 640 without one), in px. */
export const sheetMaxWidth = (width?: SheetWidth): number => (width === 'full' ? Infinity : parseInt(SHEET_WIDTH[width ?? 'wide'], 10));

export interface SheetProps {
  layout?: SheetLayout;
  showPadding?: boolean;
  open?: boolean;
  onClose?: () => void;
  /** Home-indicator inset, added inside sheets that reach the bottom edge. A dialog: the keyboard's height, which it
   *  centers above. */
  bottomInset?: number;
  /** Status-bar inset, added inside sheets that reach the top edge; a dialog stays under it. */
  topInset?: number;
  /** Max width preset. Default: the layout's own. */
  width?: SheetWidth;
  /**
   * The panel's background. `page`: the page's, for a sheet of lists or cards (white surfaces made to sit on the
   * page's color). Default: the surface, for loose content.
   */
  surface?: 'page';
  /** Lets a sheet built on it restyle the panel (background, radius, padding). */
  sheetStyle?: CSSProperties;
  children?: ReactNode;
}

const SHEET_MS = 380;

/**
 * Drag a bottom sheet down to close it, as on iOS. Past a third of its height or a quick flick down
 * closes; a shorter drag springs back. The offset uses `translate`, so it stacks with the open / closed `transform`.
 * While its content is scrolled, a drag scrolls it instead; at the top, only a drag down is the close.
 */
function useDragToClose(enabled: boolean, open: boolean, onClose?: () => void) {
  const openRef = useRef(open);
  openRef.current = open;
  const sheetRef = useRef<HTMLDivElement>(null);
  const shimRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; y0: number; ratio: number; moved: boolean; dy: number; samples: { t: number; dy: number }[] } | null>(null);

  // Per-frame values go straight to the DOM: no re-render while dragging.
  const follow = (dy: number) => {
    const el = sheetRef.current!;
    el.style.transition = 'none';
    el.style.translate = `0 ${dy}px`;
    if (shimRef.current) {
      shimRef.current.style.transition = 'none';
      shimRef.current.style.opacity = String(Math.max(0, 1 - dy / el.offsetHeight));
    }
  };
  const release = (keepOffset: boolean) => {
    const el = sheetRef.current!;
    el.style.transition = '';
    if (!keepOffset) el.style.translate = '';
    if (shimRef.current) {
      shimRef.current.style.transition = '';
      // Closing: the shim fades out from where the drag left it.
      if (!keepOffset) shimRef.current.style.opacity = '';
    }
  };

  const onPointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
    const el = sheetRef.current;
    if (!enabled || !el || e.button !== 0) return;
    // Scrolled, itself or a part of its content the press is in (a filter's list): the drag scrolls.
    let scrolled = false;
    for (let n = e.target as HTMLElement | null; n && !scrolled; n = n === el ? null : n.parentElement) scrolled = n.scrollTop > 0;
    // At the top a drag down is the sheet's (it closes); a drag up scrolls its content (the touch pointer's, or the
    // browser's with a finger). data-drag-down tells the touch pointer which one to leave alone.
    el.toggleAttribute('data-drag-down', !scrolled);
    if (scrolled) return;
    // Screen px per device px: the device frame is drawn scaled.
    const ratio = el.getBoundingClientRect().height / el.offsetHeight || 1;
    drag.current = { id: e.pointerId, y0: e.clientY, ratio, moved: false, dy: 0, samples: [{ t: performance.now(), dy: 0 }] };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = sheetRef.current;
    if (!d || !el || e.pointerId !== d.id) return;
    const dy = (e.clientY - d.y0) / d.ratio;
    if (!d.moved) {
      if (Math.abs(dy) < 6) return;
      // Upwards: not a close, the content scrolls.
      if (dy < 0) {
        drag.current = null;
        return;
      }
      d.moved = true;
      el.setPointerCapture(d.id);
    }
    d.dy = Math.max(0, dy);
    const now = performance.now();
    d.samples.push({ t: now, dy: d.dy });
    while (d.samples.length > 2 && now - d.samples[0].t > 90) d.samples.shift();
    follow(d.dy);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = sheetRef.current;
    if (!d || !el || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.moved) return;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const velocity = (last.dy - first.dy) / Math.max(1, last.t - first.t);
    const closes = d.dy > el.offsetHeight / 3 || velocity > 0.5;
    // Closing keeps the offset: the sheet slides out from where it was let go.
    release(closes);
    if (!closes) return;
    onClose?.();
    // The owner may keep it open, e.g. asking to discard first: then it springs back.
    window.setTimeout(() => openRef.current && sheetRef.current && release(false), 50);
  };

  return { sheetRef, shimRef, handlers: enabled ? { onPointerDownCapture, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } : {} };
}


export function Sheet({ layout = 'bottomContent', showPadding = true, open = true, onClose, bottomInset = 0, topInset = 0, width, surface, sheetStyle, children }: SheetProps) {
  const mf = useComponent('Sheet', { layout, showPadding, width, surface });
  // Stays mounted while it animates out.
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), SHEET_MS);
    return () => window.clearTimeout(t);
  }, [open]);
  const on = useEntered(open && mounted);
  const { sheetRef, shimRef, handlers } = useDragToClose(layout === 'bottomContent' && !!onClose, open, onClose);
  // Reopened before it unmounted: drop the offset of the drag that closed it.
  useEffect(() => {
    if (open && sheetRef.current) sheetRef.current.style.translate = '';
  }, [open, sheetRef]);
  if (!mounted) return null;
  const pad = showPadding ? 16 : 0;
  const reachesBottom = layout === 'bottomContent' || layout === 'bottomExpanded' || layout === 'sideCompact' || layout === 'sideExpanded';
  const reachesTop = layout === 'topContent' || layout === 'sideCompact' || layout === 'sideExpanded';
  return (
    <div
      {...mf}
      className={`${styles.sheetRoot} ${styles[`sheet_${layout}`]}`}
      // A dialog centers in what the status bar and the keyboard leave, moving with the keyboard's slide.
      style={layout === 'dialog' ? { paddingTop: topInset, paddingBottom: bottomInset ? `calc(${bottomInset}px + var(--app-space-xl))` : 0, transition: `padding ${KEYBOARD_MOTION}` } : undefined}
    >
      <div ref={shimRef} className={styles.sheetShim} style={{ opacity: on ? 1 : 0 }}>
        <ModalBarrier onDismiss={onClose} />
      </div>
      {layout === 'rightPane' && <div className={styles.sheetSpacer} />}
      <div
        ref={sheetRef}
        role="dialog"
        {...handlers}
        className={`${styles.sheet} ${surface === 'page' ? styles.sheetPage : ''} ${on ? styles.sheetOn : ''}`}
        style={{
          // Each side on its own (no shorthand): a side `sheetStyle` sets stays when another changes (the keyboard's inset).
          paddingTop: pad + (reachesTop ? topInset : 0),
          paddingRight: pad,
          paddingBottom: pad + (reachesBottom ? bottomInset : 0),
          paddingLeft: pad,
          // Its bottom padding, for content that scrolls a part of itself down to the sheet's edge.
          ['--sheet-pad-b' as string]: `${pad + (reachesBottom ? bottomInset : 0)}px`,
          // Its side padding, for content that scrolls or slides sideways out to the sheet's edges (a calendar's
          // months).
          ['--sheet-pad-l' as string]: `${pad}px`,
          ['--sheet-pad-r' as string]: `${pad}px`,
          ...(width ? { maxWidth: SHEET_WIDTH[width] } : {}),
          ...sheetStyle,
        }}
      >
        {children}
      </div>
      {layout === 'leftPane' && <div className={styles.sheetSpacer} />}
    </div>
  );
}
