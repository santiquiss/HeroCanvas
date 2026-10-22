// Capture mode on the canvas: the device's body (scene.ts) behind the live frame; dragging around it or with the
// middle button turns the device, and the device itself is the prototype (the touch pointer, the wheel). A drag
// writes the frame's transform and redraws the body itself, every frame; the tilt goes to React state once, when it
// ends (AGENTS.md: no state per pointer move). A new tilt from the panel (a preset, a slider)
// animates both the same way, frame by frame, so the body turns with the screen (the frame's CSS transition is off
// in Capture: it would move the screen alone).
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { frameStyle } from '../sim/DeviceFrame';
import type { Layout } from '../sim/layout';
import { glareAngle, glareAt, glareOpacity } from './ScreenGlare';
import { exportPlan, FORMATS, frameMesh, shadowColor, shadowOffset } from './exportImage';
import { exportBackground, type CapturePrefs } from './prefs';
import type { BodySpec } from './models';
import { DeviceScene, hexRgb, type Box, type Lighting } from './scene';
import { clampTilt, FLAT, tiltCss, type Tilt } from './tilt';
import { previewTime, sequenceMotion, sequenceName, type Sequence, type Shift } from './video/motion';
import { drawTouches, touchesAt, type Tap } from './video/taps';

/** A recorded interaction played on the device's screen in Capture's preview. */
export interface ScreenPlayback {
  /** The recording as a video (its MP4's object URL). */
  url: string;
  taps: Tap[];
  touches: boolean;
  /** How fast it plays (Interaction's playback speed). */
  speed: number;
}
import styles from './CaptureStage.module.css';
import bar from '../sim/Toolbar.module.css';
import { Icon } from '../components/Icon';
import { t } from '../i18n/ui';

/** How long the view takes to settle on a new fit. */
const REFIT_MS = 380;

/** How long the crop's preview fades in or out. */
const CROP_FADE_MS = 200;

/** Screen only's canvas. */
const NEUTRAL = '#e9ebee';

/** The crop's corner marks: on its edges exactly. */
const CORNER_GAP = 0;

/** Marks that read on a background: light on a dark one, dark on a light one (and on the checkerboard). */
function markColor(bg: string | null): string {
  if (!bg) return 'rgba(15, 20, 30, 0.45)';
  const [r, g, b] = hexRgb(bg).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45 ? 'rgba(255, 255, 255, 0.6)' : 'rgba(15, 20, 30, 0.45)';
}

/** Degrees a pixel of drag turns the device. */
const DRAG_DEG = 0.3;
/** A turn to a new angle: the frame's own transition (SimulatorShell .frame), 450 ms on cubic-bezier(0.32, 0.72, 0, 1). */
const TURN_MS = 450;
const turnEase = cubicBezier(0.32, 0.72, 0, 1);

/** CSS's cubic-bezier(x1, y1, x2, y2) as a function of progress (0–1). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    // The curve's t for x (bisection: x grows with t), then its y.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

export function CaptureStage({
  frame,
  layout,
  scale,
  tilt,
  color,
  spec,
  light,
  prefs,
  center,
  onTilt,
  play = null,
  paused = false,
  crop = null,
  turnable = false,
  children,
}: {
  frame: HTMLElement | null;
  layout: Layout;
  scale: number;
  tilt: Tilt;
  color: string;
  spec: BodySpec | undefined;
  light: Lighting;
  prefs: CapturePrefs;
  /** The point of the picture the view centers on (points from the frame's center): the whole stage moves by it. */
  center: [number, number];
  onTilt: (t: Tilt) => void;
  /**
   * The video's preview, playing while it's set: the motion on the device, in a loop, and a recorded interaction on
   * its screen (`screen`: drawn over the live one, touches and all, in time with the motion); when it's null the
   * device goes back to `tilt`. Written frame by frame like a drag (no state per frame); a drag waits while it plays.
   */
  play?: { sequence: Sequence; rest: Tilt; duration: number; screen: ScreenPlayback | null } | null;
  /**
   * The preview holds where it is (the motion, a recording on the screen) while something heavier runs: a video's
   * export, a slider dragged in the panel. It plays on from the same point.
   */
  paused?: boolean;
  /** The file's crop when it doesn't follow the angle (a video's: every turn of its motion fits); shown while it plays. */
  crop?: Box | null;
  /**
   * A drag turns the device even while the preview plays (a video holding the custom angle): the motion waits, the device
   * shows the angle it rests at, and the drag sets it; let go and the preview plays again about the new one.
   */
  turnable?: boolean;
  /** The frame: inside the picture's layer, so its shadow and crop are the file's. */
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<DeviceScene | null>(null);
  const mesh = useMemo(() => frameMesh(layout, spec).tris, [layout, spec]);
  // Room for the body around the frame at any turn.
  const size = Math.ceil(Math.max(layout.frameW, layout.frameH) * 1.3 * scale);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  // The latest of everything a frame draws with: a turn or a drag runs across renders, and must draw the color, the
  // light and the size of now, not of when it started.
  const latest = useRef({ mesh, color, light, layout, scale, size, frame, spec, prefs, center, crop, turnable, rest: play?.rest ?? null });
  latest.current = { mesh, color, light, layout, scale, size, frame, spec, prefs, center, crop, turnable, rest: play?.rest ?? null };
  const shadeRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  // A new fit after a turn (the zoom and the middle change with the picture's box): from where it was to where it
  // goes, in one short move instead of a jump. Drawn at the new fit at once, then shown from the old one and eased
  // back (a transform of the whole view: on the compositor).
  const fitWas = useRef<{ k: number; c: [number, number] } | null>(null);
  useLayoutEffect(() => {
    const was = fitWas.current;
    fitWas.current = { k: scale, c: [center[0], center[1]] };
    const view = viewRef.current;
    if (!was || !view || (was.k === scale && was.c[0] === center[0] && was.c[1] === center[1])) return;
    view.style.transition = 'none';
    view.style.transform = `translate(${(center[0] - was.c[0]) * was.k}px, ${(center[1] - was.c[1]) * was.k}px) scale(${was.k / scale})`;
    void view.offsetWidth;
    view.style.transition = `transform ${REFIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`;
    view.style.transform = '';
  }, [scale, center[0], center[1]]);
  const cornersRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  /**
   * The picture's crop on the canvas, for an angle: the device's layer clipped to it (so a shadow the margin cuts is
   * cut here too) and a veil over the rest. While the device turns (a drag, a preset's turn) neither shows: the
   * crop would jump with every frame; it comes back when the turn ends.
   */
  const moving = useRef(false);
  // Shown or hidden (the preview's switch, a turn): a short fade of the veil and the corners, and the cut opening or
  // closing with them. Only while it changes: a crop that follows the device moves at once.
  const showing = useRef<boolean | null>(null);
  const fadeEnd = useRef(0);
  const show = (on: boolean) => {
    if (showing.current === on) return;
    const first = showing.current === null;
    showing.current = on;
    const els = [shadeRef.current, cornersRef.current, layerRef.current].filter((e): e is HTMLDivElement => !!e);
    if (!first) {
      for (const el of els) el.style.transition = `opacity ${CROP_FADE_MS}ms ease, clip-path ${CROP_FADE_MS}ms ease`;
      clearTimeout(fadeEnd.current);
      fadeEnd.current = window.setTimeout(() => els.forEach((el) => (el.style.transition = '')), CROP_FADE_MS + 40);
    }
    for (const el of [shadeRef.current, cornersRef.current]) if (el) el.style.opacity = on ? '1' : '0';
    // The whole layer, uncut (the stage clips it anyway): an inset, so the cut can animate to and from it.
    if (!on && layerRef.current) layerRef.current.style.clipPath = 'inset(0px)';
  };
  const setMoving = (on: boolean) => {
    moving.current = on;
    if (on) show(false);
    else frameBox(shown.current);
  };
  const frameBox = (t: Tilt) => {
    if (moving.current) return;
    const { layout: l, spec: sp, prefs: pr, scale: k, light: li, center: c, crop: fixed } = latest.current;
    // The crop's preview off: the whole device, no veil.
    if (!pr.cropPreview) return show(false);
    const b = fixed ?? exportPlan(l, sp, t, { ...pr, light: li }).box;
    // Its corners, marked a little outside it.
    const corners = cornersRef.current;
    if (corners) {
      corners.style.left = `calc(50% + ${(b.minX - c[0]) * k - CORNER_GAP}px)`;
      corners.style.top = `calc(50% + ${(b.minY - c[1]) * k - CORNER_GAP}px)`;
      corners.style.width = `${(b.maxX - b.minX) * k + 2 * CORNER_GAP}px`;
      corners.style.height = `${(b.maxY - b.minY) * k + 2 * CORNER_GAP}px`;
    }
    // The veil over what isn't exported: the whole stage, with the crop cut out of it.
    if (shadeRef.current) {
      const [x0, x1, y0, y1] = [(b.minX - c[0]) * k, (b.maxX - c[0]) * k, (b.minY - c[1]) * k, (b.maxY - c[1]) * k].map((v) => `calc(50% + ${v}px)`);
      shadeRef.current.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x0} ${y0}, ${x0} ${y1}, ${x1} ${y1}, ${x1} ${y0}, ${x0} ${y0})`;
    }
    if (layerRef.current)
      layerRef.current.style.clipPath = `inset(calc(50% + ${b.minY * k}px) calc(50% - ${b.maxX * k}px) calc(50% - ${b.maxY * k}px) calc(50% + ${b.minX * k}px))`;
    show(true);
  };
  const draw = (t: Tilt) => {
    const L = latest.current;
    sceneRef.current?.draw({ mesh: L.mesh, color: L.color, tilt: t, rot90: L.layout.rotLocked, light: L.light }, L.scale, L.size, L.size);
  };

  // Its own canvas, made and released here: each one holds a WebGL context, and a browser keeps only so many (about
  // sixteen) before it drops the oldest, which would leave the body drawn as it was. A context lost anyway (the GPU
  // reset) comes back, and draws again.
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = styles.body;
    canvas.setAttribute('aria-hidden', 'true');
    hostRef.current!.appendChild(canvas);
    canvasRef.current = canvas;
    sizeCanvas();
    sceneRef.current = DeviceScene.create(canvas);
    draw(shown.current);
    const lost = (e: Event) => {
      e.preventDefault();
      sceneRef.current = null;
    };
    const restored = () => {
      sceneRef.current = DeviceScene.create(canvas);
      draw(shown.current);
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      sceneRef.current?.dispose();
      sceneRef.current = null;
      canvas.remove();
      canvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Its size follows the frame and the zoom (a new size clears it: drawn again below).
  function sizeCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { size: n } = latest.current;
    canvas.width = Math.round(n * dpr);
    canvas.height = Math.round(n * dpr);
    canvas.style.width = `${n}px`;
    canvas.style.height = `${n}px`;
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(sizeCanvas, [size, dpr]);
  const drag = useRef<{ x: number; y: number; from: Tilt; now: Tilt; raf: number } | null>(null);
  // The angle on screen, which a turn or a drag moves toward `tilt`.
  const shown = useRef<Tilt>(tilt);
  const turning = useRef(0);
  const apply = (t: Tilt) => {
    shown.current = t;
    const { frame: f, layout: l, scale: k } = latest.current;
    if (f) f.style.transform = String(frameStyle(l, k, tiltCss(t)).transform);
    // The glass's glare slides with the turn.
    const glare = f?.querySelector<HTMLElement>('[data-glare]');
    if (glare) {
      glare.style.setProperty('--glare', glareAt(t, glare.dataset.side as 'top' | 'bottom'));
      glare.style.setProperty('--glare-angle', glareAngle(t, Number(glare.dataset.light), glare.dataset.side as 'top' | 'bottom'));
      glare.style.opacity = String(glareOpacity(t, Number(glare.dataset.strength), glare.dataset.side as 'top' | 'bottom'));
    }
    draw(t);
    frameBox(t);
  };
  // Before paint: React has just written the new angle on the frame; put it back where it was and turn from there.
  useLayoutEffect(() => {
    cancelAnimationFrame(turning.current);
    const from = shown.current;
    if (drag.current || (from.x === tilt.x && from.y === tilt.y)) {
      // A turn cut short by this one: show the crop again.
      if (!drag.current && moving.current) setMoving(false);
      return void apply(tilt);
    }
    const start = performance.now();
    const step = (now: number) => {
      // Ended by time, not by the curve (which reaches 1 only nearly): the last frame lands on the angle exactly.
      const p = Math.min(1, (now - start) / TURN_MS);
      if (p >= 1) {
        apply(tilt);
        setMoving(false);
        return;
      }
      const k = turnEase(p);
      apply({ x: from.x + (tilt.x - from.x) * k, y: from.y + (tilt.y - from.y) * k });
      turning.current = requestAnimationFrame(step);
    };
    setMoving(true);
    apply(from);
    turning.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(turning.current);
      // Cut short (a new angle, the stage going): not moving any more until the next turn says so.
      moving.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tilt.x, tilt.y]);
  // The device's layer where the picture's middle is the stage's (its React style), moved and scaled by a step's shift.
  const layerTransform = (sh: Shift | null) => {
    const { center: c, scale: k } = latest.current;
    const at = `translate(${-c[0] * k}px, ${-c[1] * k}px)`;
    return sh ? `${at} translate(${sh.dx * k}px, ${sh.dy * k}px) scale(${sh.scale})` : at;
  };
  // The video's preview.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const playing = useRef(false);
  const tiltNow = useRef(tilt);
  tiltNow.current = tilt;
  useEffect(() => {
    if (!play) return;
    cancelAnimationFrame(turning.current);
    playing.current = true;
    // A crop that follows the angle would jump every frame: hidden while it plays. The clip's stays put.
    if (!latest.current.crop) setMoving(true);
    const motion = sequenceMotion(play.sequence, play.duration, play.rest);
    const start = performance.now();
    // A recording plays as a video over the screen: its clock is the preview's, so the motion keeps time with it.
    const screen = play.screen ? screenPlayer(latest.current.frame, play.screen, () => latest.current.scale) : null;
    let raf = 0;
    // Held (paused): since when, and how long it's been held in all, which the clock leaves out.
    let heldAt: number | null = null;
    let held = 0;
    const step = (now: number) => {
      // Held by the panel, or by a drag turning the device (the custom angle): the drag draws it meanwhile.
      if (pausedRef.current || drag.current) {
        if (heldAt === null) {
          heldAt = now;
          screen?.pause();
        }
        raf = requestAnimationFrame(step);
        return;
      }
      if (heldAt !== null) {
        held += now - heldAt;
        heldAt = null;
        screen?.resume();
      }
      const t = screen ? screen.time() : null;
      const at = t !== null ? t / play.duration : previewTime(motion, (now - start - held) / 1000, play.duration);
      apply(motion.at(at));
      // In and Out move, scale and fade the device and its shadow (their layer), the background as it is: transform
      // and opacity, the compositor's.
      const layer = layerRef.current;
      if (layer && motion.shift) {
        layer.style.transform = layerTransform(motion.shift(at));
      }
      if (layer && motion.alpha) layer.style.opacity = String(motion.alpha(at));
      screen?.draw();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      screen?.remove();
      if (layerRef.current) {
        layerRef.current.style.opacity = '';
        layerRef.current.style.transform = layerTransform(null);
      }
      playing.current = false;
      if (moving.current) setMoving(false);
      apply(tiltNow.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play && sequenceName(play.sequence), play?.rest.x, play?.rest.y, play?.duration, play?.screen?.url, play?.screen?.touches, play?.screen?.speed]);

  // Anything else changed (the body, its color, the light, the zoom): redraw where it is.
  useEffect(() => {
    apply(shown.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh, color, size, dpr, light, scale, frame, prefs, center[0], center[1], crop]);

  // Turning by hand, anywhere on the stage: a drag off the device (on it, the pointer uses the prototype), a drag
  // with the middle button anywhere; double-click off the device faces it. The wheel never turns it: it scrolls, the
  // prototype over the device. Native listeners on the stage, ahead of its own (the middle button's pan).
  const onTiltRef = useRef(onTilt);
  onTiltRef.current = onTilt;
  useEffect(() => {
    // The whole stage (the device's layer is clipped to the crop, and a clip takes its clicks with it).
    const stage = viewRef.current;
    if (!stage) return;
    const onDevice = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-comment-device]');
    const down = (e: globalThis.PointerEvent) => {
      // The screen alone (Screen only) doesn't turn; nor does a video's device (its motion turns it: a fixed crop),
      // unless it holds the custom angle (turnable).
      const { layout: l, crop: c, turnable: free, rest } = latest.current;
      if (l.bare || (!free && (playing.current || c)) || !(e.button === 1 || (e.button === 0 && !onDevice(e.target)))) return;
      e.preventDefault();
      e.stopPropagation();
      stage.setPointerCapture(e.pointerId);
      cancelAnimationFrame(turning.current);
      // While it plays, the drag starts from the angle the motion rests at, not where the motion has it now.
      const from = playing.current && rest ? rest : shown.current;
      drag.current = { x: e.clientX, y: e.clientY, from, now: from, raf: 0 };
      // Fully in view and in its place while it's turned (an In or Out may have it moved or faded).
      if (playing.current && layerRef.current) {
        layerRef.current.style.opacity = '';
        layerRef.current.style.transform = layerTransform(null);
      }
      apply(from);
      stage.style.cursor = 'grabbing';
      setMoving(true);
    };
    const move = (e: globalThis.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      // Right turns the face right (its right side away); down turns it down (its top toward you).
      d.now = clampTilt({ x: d.from.x - (e.clientY - d.y) * DRAG_DEG, y: d.from.y + (e.clientX - d.x) * DRAG_DEG });
      if (!d.raf) d.raf = requestAnimationFrame(() => (drag.current && apply(drag.current.now), drag.current && (drag.current.raf = 0)));
    };
    const up = (e: globalThis.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      cancelAnimationFrame(d.raf);
      drag.current = null;
      stage.style.cursor = '';
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      apply(d.now);
      setMoving(false);
      onTiltRef.current(d.now);
    };
    // The middle button's mousedown starts the browser's autoscroll.
    const mouseDown = (e: MouseEvent) => e.button === 1 && e.preventDefault();
    const dbl = (e: MouseEvent) => !onDevice(e.target) && onTiltRef.current(FLAT);
    stage.addEventListener('pointerdown', down);
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('mousedown', mouseDown);
    stage.addEventListener('dblclick', dbl);
    stage.style.cursor = '';
    stage.dataset.capture = '';
    return () => {
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
      stage.removeEventListener('mousedown', mouseDown);
      stage.removeEventListener('dblclick', dbl);
      delete stage.dataset.capture;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const format = FORMATS.find((f) => f.id === prefs.format)!;
  const bg = exportBackground(prefs, format.alpha);
  const look = prefs.shadowLook;
  const [dx, dy] = shadowOffset(light, look);
  const shadow = prefs.shadow ? `drop-shadow(${dx * scale}px ${dy * scale}px ${look.blur * scale}px ${shadowColor(look)})` : undefined;

  return (
    <>
      {/* The whole canvas on the picture's background (a checkerboard when it's transparent), the crop marked on it. */}
      {/* Screen only: a plain, neutral canvas (the picture is the screen, nothing around it). */}
      <div className={styles.backdrop} style={{ background: layout.bare ? NEUTRAL : (bg ?? undefined) }} data-transparent={bg || layout.bare ? undefined : ''} aria-hidden />
      {/* What moves when the view refits (CaptureStage's refit): the veil, the corners, the device. */}
      <div ref={viewRef} className={styles.view}>
      <div ref={shadeRef} className={styles.shade} aria-hidden />
      <div ref={cornersRef} className={styles.corners} style={{ ['--c' as string]: markColor(bg) }} aria-hidden />
      {/* The device's layer, the stage's size: its shadow is the file's (a drop-shadow of the frame and its body,
          the export's blur and offset, in points), and it's clipped to the picture's box. A filter over a layer
          that moves: drawn again on each frame of a turn, which Capture alone does. */}
      {/* Moved so the picture's middle is the stage's (its clip is in its own terms: the frame's center). */}
      <div ref={layerRef} className={styles.layer} style={{ filter: shadow, transform: `translate(${-center[0] * scale}px, ${-center[1] * scale}px)` }}>
        {/* The canvas goes in here (see above); no box of its own, so the canvas sits on the layer. */}
        <span ref={hostRef} style={{ display: 'contents' }} />
        {children}
      </div>
      </div>
    </>
  );
}

/** At the canvas's bottom right, in the zoom bar's place: the picture fitted to the canvas, or at its real size. */
export function CapturePreviewBar({
  bare,
  preview,
  onPreview,
  crop,
  onCrop,
}: {
  /** Screen only: no crop to preview. */
  bare: boolean;
  preview: CapturePrefs['preview'];
  onPreview: (v: CapturePrefs['preview']) => void;
  /** The crop's preview (the veil over what the file leaves out). */
  crop: boolean;
  onCrop: (on: boolean) => void;
}) {
  return (
    <div className={bar.zoomBar} data-canvas-ui>
      {!bare && (
        <>
          <button className={`${bar.chip} ${crop ? bar.active : ''}`} onClick={() => onCrop(!crop)} title={crop ? t('Hide the crop: the whole device, nothing veiled') : t('Preview the crop: veil what the file leaves out')}>
            <Icon name="crop" size={16} />
            <span>{t('Preview crop')}</span>
          </button>
          <span className={bar.viewSep} />
        </>
      )}
      {(
        [
          ['fit', t('Fit'), t('Fit the picture to the canvas')],
          ['actual', t('Actual pixels'), t('The picture at its real size: a pixel of the file a pixel of the screen')],
        ] as const
      ).map(([v, label, title]) => (
        <button key={v} className={`${bar.chip} ${preview === v ? bar.active : ''}`} onClick={() => onPreview(v)} title={title}>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * A recording playing on the frame: a looping video, drawn each frame onto a canvas over the screen (inside the
 * frame, so it turns with it), clipped to the frame's corners, the touches over it.
 */
function screenPlayer(frame: HTMLElement | null, p: ScreenPlayback, zoom: () => number) {
  const video = document.createElement('video');
  video.src = p.url;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.playbackRate = p.speed;
  void video.play().catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.className = styles.screenPlayback;
  canvas.setAttribute('aria-hidden', 'true');
  frame?.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  return {
    /** Seconds into the clip (the recording's at its playback speed), or null before it has started playing. */
    time: () => (video.readyState >= 2 ? video.currentTime / p.speed : null),
    draw() {
      if (!frame || video.readyState < 2) return;
      // Its pixels: the frame's points at the zoom and density it's shown at.
      const k = zoom() * (window.devicePixelRatio || 1);
      const w = Math.round(frame.offsetWidth * k);
      const h = Math.round(frame.offsetHeight * k);
      if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(video, 0, 0, w, h);
      if (p.touches) drawTouches(ctx, touchesAt(p.taps, video.currentTime), k);
    },
    /** Holds the recording where it is (the preview paused), and plays it on from there. */
    pause: () => video.pause(),
    resume: () => {
      video.playbackRate = p.speed;
      void video.play().catch(() => {});
    },
    remove() {
      video.pause();
      video.removeAttribute('src');
      video.load();
      canvas.remove();
    },
  };
}

/**
 * While an interaction records: at the canvas's top, outside the device (the recording keeps only the device, so it
 * isn't in it), how long so far and how to stop it (Escape).
 */
export function RecordingBadge({ seconds, starting, onStop }: { seconds: number; starting: boolean; onStop: () => void }) {
  return (
    <div className={styles.recording} role="status" data-canvas-ui>
      <span className={styles.recDot} aria-hidden />
      {starting ? (
        <span>{t('Waiting for permission…')}</span>
      ) : (
        <>
          {/* Figures of one width: the time counts up without the pill twitching. */}
          <span>
            {t('Recording')} · <span className={styles.recTime}>{seconds.toFixed(1)} s</span>
          </span>
          <span className={styles.recSep} aria-hidden />
          <span>
            {/* The key in the sentence where the language puts it. */}
            {t('Press {key} to stop').split('{key}').map((part, i) => (i ? [<kbd key="k" className={styles.kbd}>Esc</kbd>, part] : part))}
          </span>
          <button className={styles.recStop} onClick={onStop} title={t('Stop recording (Esc)')}>
            <Icon name="stop" size={14} fill />
            <span>{t('Stop')}</span>
          </button>
        </>
      )}
    </div>
  );
}
