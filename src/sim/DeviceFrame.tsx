// A device frame on the canvas: the bezel around a DeviceScreen, centered on its slot, scaled and turned (a
// portrait-only page in a landscape frame). The single-device stage, device sets and All devices all use it.
import type { Language } from './language';
import { useState, type CSSProperties } from 'react';
import { screenAttrs, type CanvasScreen } from '../comments/anchor';
import { useCommenting } from '../comments/CommentsContext';
import { useDesignRoot } from '../design/DesignContext';
import { DeviceScreen } from './DeviceScreen';
import { NOTCH_W, type Layout } from './layout';
import { SimProvider } from './SimContext';
import styles from './SimulatorShell.module.css';
import { TouchPointer } from './TouchPointer';

/**
 * The frame's own box: size, bezel and corners, centered on its slot, scaled and turned. `tilt`: a 3D turn (capture
 * mode) after the scale, so its perspective is in the device's points at any zoom, as the PNG draws it.
 */
export function frameStyle(layout: Layout, scale: number, tilt = ''): CSSProperties {
  return {
    width: layout.frameW,
    height: layout.frameH,
    padding: `${layout.bezY}px ${layout.bezX}px`,
    borderRadius: layout.frameRadius,
    transform: `translate(-50%,-50%) scale(${scale}) ${tilt} rotate(${layout.rotLocked ? 90 : 0}deg)`,
    // One device pixel in the frame's points: the screen's edge (DeviceScreen) covers it.
    '--hc-edge': `${1 / (scale * (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))}px`,
  } as CSSProperties;
}

/**
 * What a frame with `ends` has in them: the earpiece and front camera at the top, the Home button at the bottom (left
 * and right when turned, the Home button on the right as iOS turns it). Drawn in the frame's own box, under its padding.
 */
export function FrameHardware({ layout }: { layout: Layout }) {
  const cap = notchCap(layout);
  const edge = screenEdge(layout);
  if (!layout.ends) return (cap || edge) && <div className={styles.hardware} aria-hidden>{edge}{cap}</div>;
  const turned = layout.land;
  return (
    <div className={styles.hardware} data-turned={turned || undefined} style={{ '--end': `${turned ? layout.bezX : layout.bezY}px` } as CSSProperties} aria-hidden>
      {edge}
      <span className={styles.earpiece} />
      <span className={styles.frontCamera} />
      {layout.homeButton && <span className={styles.homeButton} />}
      {cap}
    </div>
  );
}

/**
 * The screen's edge: a ring of the bezel one device pixel to each side of it (`--hc-edge`, frameStyle). At a fractional
 * zoom the edge falls inside a pixel, and a scroller's clip is rounded out to whole pixels: what it scrolls under an
 * opaque bar (a sticky header) showed as a line of text on the bezel, and the page's color as a hairline.
 */
function screenEdge(layout: Layout) {
  if (layout.bare) return null;
  // Each corner one pixel rounder, as the ring sits one pixel outside the screen.
  const radius = layout.fullRadius.replace(/(\d+(?:\.\d+)?)px/g, 'calc($1px + var(--hc-edge))');
  return (
    <span
      className={styles.screenEdge}
      style={{ inset: `calc(${layout.bezY}px - var(--hc-edge)) calc(${layout.bezX}px - var(--hc-edge))`, borderRadius: radius }}
    />
  );
}

/** How far the notch's cap reaches into the bezel and into the screen. */
const CAP = 2;

/**
 * Where the notch (16e) meets the bezel: a strip of black its width across the screen's edge, over the screen. The
 * notch is drawn in the screen, and at a fractional zoom the page under it showed as a hairline at that edge (the two
 * antialiased edges of the notch and of the screen's clip don't add up to black).
 */
function notchCap(layout: Layout) {
  if (layout.os !== 'ios' || layout.cutout !== 'notch' || layout.bare) return null;
  const side = layout.phoneLand;
  if (!side && !layout.sbH) return null;
  const style: CSSProperties = side
    ? { left: layout.bezX - CAP, top: '50%', width: 2 * CAP, height: NOTCH_W, marginTop: -NOTCH_W / 2 }
    : { top: layout.bezY - CAP, left: '50%', height: 2 * CAP, width: NOTCH_W, marginLeft: -NOTCH_W / 2 };
  return <span className={styles.notchCap} style={style} />;
}

/** The frame as it sits on the canvas (turned frames swap width and height). */
export const frameBox = (l: Layout) => (l.rotLocked ? { w: l.frameH, h: l.frameW } : { w: l.frameW, h: l.frameH });

/**
 * A frame in a set or All devices: its own layout, and its own touch pointer (fingertip and drag-to-scroll). `screen`:
 * which device it is, for the comments left on it.
 */
export function DeviceFrame({ layout, scale, theme, language, active = false, screen }: { layout: Layout; scale: number; theme: 'light' | 'dark'; /** Its own language (a set's device), over `?lang=`. */ language?: Language; active?: boolean; screen?: CanvasScreen }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const { inspect } = useDesignRoot();
  // Inspect and comment mode keep their own cursor and click: no fingertip then.
  const commenting = useCommenting();
  return (
    <>
      <div ref={setEl} className={styles.frame} style={frameStyle(layout, scale)} {...(screen && screenAttrs(screen))}>
        <SimProvider layout={layout} theme={theme} language={language}>
          <DeviceScreen preview={!active} overlays />
        </SimProvider>
        <FrameHardware layout={layout} />
      </div>
      <TouchPointer frame={el} enabled={!inspect && !commenting} scale={scale} rotated={layout.rotLocked} />
    </>
  );
}
