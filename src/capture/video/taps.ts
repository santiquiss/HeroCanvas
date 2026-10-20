// The touches drawn over a recorded screen (recording.ts → exportVideo.ts): where a finger is at each moment, the
// way screen recordings show taps. A touch appears as it goes down (growing in), follows the finger while it moves
// (a scroll), and fades out growing a little once it lifts.

/** One pointer event of the recording: seconds from its start, the frame's points from its top left. */
export interface Tap {
  kind: 'down' | 'move' | 'up';
  t: number;
  at: [number, number];
}

/** A touch as drawn at one moment: its center, its radius (points) and how visible it is (0–1). */
export interface TouchMark {
  at: [number, number];
  radius: number;
  opacity: number;
}

/** About a fingertip's size, in points. */
export const TOUCH_RADIUS = 22;
/** Seconds a touch takes to grow in, and to fade out after it lifts. */
export const TOUCH_IN = 0.08;
export const TOUCH_OUT = 0.3;

/** One touch, from the finger going down to it lifting (unset: still down when the recording ended). */
interface Stroke {
  down: Tap;
  moves: Tap[];
  up?: Tap;
}

function strokes(taps: Tap[]): Stroke[] {
  const out: Stroke[] = [];
  let open: Stroke | null = null;
  for (const tap of taps) {
    if (tap.kind === 'down') out.push((open = { down: tap, moves: [] }));
    else if (open && tap.kind === 'move') open.moves.push(tap);
    else if (open && tap.kind === 'up') {
      open.up = tap;
      open = null;
    }
  }
  return out;
}

/** The touches visible at `t` seconds. */
export function touchesAt(taps: Tap[], t: number): TouchMark[] {
  const marks: TouchMark[] = [];
  for (const s of strokes(taps)) {
    if (s.down.t > t) continue;
    if (s.up && s.up.t <= t) {
      // Lifted: fading out where it lifted.
      const k = (t - s.up.t) / TOUCH_OUT;
      if (k < 1) marks.push({ at: s.up.at, radius: TOUCH_RADIUS * (1 + 0.35 * k), opacity: 1 - k });
      continue;
    }
    // Down: where the finger is now, grown in over its first moment.
    const here = [...s.moves].reverse().find((m) => m.t <= t) ?? s.down;
    const k = Math.min(1, (t - s.down.t) / TOUCH_IN);
    marks.push({ at: here.at, radius: TOUCH_RADIUS * (0.6 + 0.4 * k), opacity: k });
  }
  return marks;
}

/** Draws the touches on a canvas holding the frame at `k` pixels a point: a light disc with a soft dark ring. */
export function drawTouches(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, marks: TouchMark[], k: number) {
  for (const m of marks) {
    ctx.save();
    ctx.globalAlpha = m.opacity;
    ctx.beginPath();
    ctx.arc(m.at[0] * k, m.at[1] * k, m.radius * k, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fill();
    ctx.lineWidth = 2 * k;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.stroke();
    ctx.restore();
  }
}
