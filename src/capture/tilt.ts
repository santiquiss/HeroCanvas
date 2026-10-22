// A 3D turn of the device, the same on the canvas (a CSS transform of the frame, its body drawn by scene.ts behind
// it) and in the export (scene.ts: the frame's picture on the body, projected with the same perspective, so the file
// is what you saw).

/** Degrees around the horizontal (x: top away, positive) and vertical (y: right side away, positive) axes. */
import { t } from '../i18n/ui';

export interface Tilt {
  x: number;
  y: number;
}

export const FLAT: Tilt = { x: 0, y: 0 };
/** As far as it turns: the screen always shows, the side well in view. */
export const TILT_MAX = 45;
/** The viewer's distance, in CSS px of the device (CSS `perspective()`): far enough that the turn stays gentle. */
export const PERSPECTIVE = 2400;

/** The angles a click away, from facing furthest left to furthest right (facing you is Reset). */
export const TILT_PRESETS: { label: string; tilt: Tilt }[] = [
  { label: t('Side left'), tilt: { x: 4, y: 38 } },
  { label: t('Left'), tilt: { x: 6, y: 18 } },
  { label: t('Lean back'), tilt: { x: 22, y: 0 } },
  { label: t('Right'), tilt: { x: 6, y: -18 } },
  { label: t('Side right'), tilt: { x: 4, y: -38 } },
];

export const isFlat = (t: Tilt) => !t.x && !t.y;

export const clampTilt = (t: Tilt): Tilt => ({
  x: Math.round(Math.max(-TILT_MAX, Math.min(TILT_MAX, t.x))),
  y: Math.round(Math.max(-TILT_MAX, Math.min(TILT_MAX, t.y))),
});

/** The CSS for the canvas preview: after the frame's scale, before its own rotation. */
export const tiltCss = (t: Tilt) => (isFlat(t) ? '' : `perspective(${PERSPECTIVE}px) rotateX(${t.x}deg) rotateY(${t.y}deg)`);

/** rotateX(a) rotateY(b): CSS applies the rightmost first (y, then x). z grows toward the viewer. */
export function turn(px: number, py: number, pz: number, t: Tilt): [number, number, number] {
  const a = (t.x * Math.PI) / 180;
  const b = (t.y * Math.PI) / 180;
  const x1 = px * Math.cos(b) + pz * Math.sin(b);
  const z1 = -px * Math.sin(b) + pz * Math.cos(b);
  return [x1, py * Math.cos(a) - z1 * Math.sin(a), py * Math.sin(a) + z1 * Math.cos(a)];
}

/**
 * A point of the device (centered, y down, z toward the viewer, CSS px) turned as CSS turns it and projected: screen
 * x, y, the perspective's divisor w, and its depth after the turn.
 */
export function project(px: number, py: number, t: Tilt, pz = 0): [number, number, number, number] {
  const [x, y, z] = turn(px, py, pz, t);
  const w = (PERSPECTIVE - z) / PERSPECTIVE;
  return [x / w, y / w, w, z];
}
