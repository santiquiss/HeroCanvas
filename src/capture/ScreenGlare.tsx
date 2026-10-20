// A glare on the screen's glass (Capture): a big square softbox mirrored in a new, spotless screen, so one part of it
// is lit, up to a crisp edge across it at the light's angle, and the rest isn't. It slides as the device turns
// (`--glare`, written with the turn by CaptureStage), as a reflection does. Part of the frame, so the export draws it
// as the canvas shows it.
import type { CSSProperties } from 'react';
import type { Layout } from '../sim/layout';
import type { Tilt } from './tilt';
import styles from './ScreenGlare.module.css';

/**
 * Which way the lit side faces, by where the light is across (`light`: -1 left, 0 top, 1 right, as lightSide; CSS
 * gradient degrees, the lit part at the start): the presets' 150, 172 and 210, a hand-set angle between them and past.
 */
const lightAngle = (light: number) => 172 + light * (light < 0 ? 22 : 38);

/**
 * Where the edge crosses the screen (% along the gradient, from the lit end) for a turn. A mirror's image moves twice
 * its turn, so the edge sweeps across fast: the screen turned toward the lightbox (up, with it above; down, below)
 * mirrors more of it, and the lit part grows. The gradient runs from the lightbox's end, so a turn sideways counts the
 * other way below.
 */
export const glareAt = (t: Tilt, side: 'top' | 'bottom') => {
  const toward = side === 'top' ? t.x : -t.x;
  const across = side === 'top' ? t.y : -t.y;
  // Kept on the screen: past its ends there'd be no edge to see.
  return `${Math.max(8, Math.min(92, 50 + across * 0.9 + toward * 1))}%`;
};

/** The edge's angle for a turn: the softbox seen from aside skews it a little. The bottom lights from the other end. */
const glareDeg = (t: Tilt, light: number, side: 'top' | 'bottom') => lightAngle(light) + (side === 'bottom' ? 180 : 0) + t.y * 0.6 + t.x * 0.3;
export const glareAngle = (t: Tilt, light: number, side: 'top' | 'bottom') => `${glareDeg(t, light, side)}deg`;

/**
 * How strong the glare is for a turn: the softbox above the scene lights the screen the more it faces up (leaning
 * back: tilt x positive), none facing down; below it, the other way round.
 */
export function glareOpacity(t: Tilt, strength: number, side: 'top' | 'bottom'): number {
  const lean = side === 'top' ? t.x : -t.x;
  return strength * Math.max(0, Math.min(1, (lean + 20) / 45));
}

/** The edge's half width (% along the gradient) for a softness (0–1): from a hair to a wide fade. */
const glareSoftPct = (softness: number) => 0.3 + softness * 8;
export const glareSoft = (softness: number) => `${glareSoftPct(softness)}%`;

/** The glare's settings (Capture's), where the light comes from (the scene's). */
export interface GlareLook {
  /** Where the light is across (lightSide: -1 left, 0 top, 1 right). */
  light: number;
  strength: number;
  side: 'top' | 'bottom';
  softness: number;
}

/**
 * The glare drawn on a canvas, as the CSS draws it on the canvas's screen (ScreenGlare.module.css: its two tones, its
 * angle, where its edge falls, how strong), for a turn: a video draws it on each frame's screen, turn by turn, so it
 * slides as the device turns. `rect`: the screen in the canvas's pixels, its corners' radius.
 */
export function drawGlare(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number; r: number }, t: Tilt, g: GlareLook) {
  const alpha = glareOpacity(t, g.strength, g.side);
  if (alpha <= 0) return;
  const a = (glareDeg(t, g.light, g.side) * Math.PI) / 180;
  // A CSS gradient's line: through the middle, at its angle (0: up), as long as the box seen along it.
  const [dx, dy] = [Math.sin(a), -Math.cos(a)];
  const len = Math.abs(rect.w * Math.sin(a)) + Math.abs(rect.h * Math.cos(a));
  const [cx, cy] = [rect.x + rect.w / 2, rect.y + rect.h / 2];
  const grad = ctx.createLinearGradient(cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2);
  const at = parseFloat(glareAt(t, g.side)) / 100;
  const soft = glareSoftPct(g.softness) / 100;
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
  grad.addColorStop(Math.max(0, at - soft), 'rgba(255, 255, 255, 0.16)');
  grad.addColorStop(Math.min(1, at + soft), 'rgba(0, 0, 0, 0.1)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, rect.r);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

export function ScreenGlare({
  layout,
  tilt,
  light,
  strength,
  side,
  softness,
}: {
  layout: Layout;
  tilt: Tilt;
  /** Where the light is across (lightSide). */
  light: number;
  strength: number;
  side: 'top' | 'bottom';
  softness: number;
}) {
  return (
    <span
      className={styles.glare}
      data-glare=""
      data-light={light}
      data-side={side}
      data-strength={strength}
      style={
        {
          inset: `${layout.bezY}px ${layout.bezX}px`,
          borderRadius: layout.screenRadius,
          opacity: glareOpacity(tilt, strength, side),
          '--glare': glareAt(tilt, side),
          '--glare-angle': glareAngle(tilt, light, side),
          '--glare-soft': glareSoft(softness),
        } as CSSProperties
      }
      aria-hidden
    />
  );
}
