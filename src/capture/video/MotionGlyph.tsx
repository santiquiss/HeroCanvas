// A motion's icon: the path it takes, drawn from the motion itself (motion.ts), so a new one gets its icon for free.
// Across is the turn (y, right side away to the right), down is the tilt (x, top away upward); the dot is where it
// ends (none for a loop: it has no end). The small phone is where it starts.
import { TILT_MAX } from '../tilt';
import type { Motion } from './motion';

const W = 36;
const H = 24;
/** Degrees to the icon's units: the whole turn the sliders allow spans most of its width. */
const KX = (W / 2 - 4) / TILT_MAX;
const KY = (H / 2 - 3) / TILT_MAX;
/** Points of a move to the icon's units. */
const KD = 0.12;

export function MotionGlyph({ motion }: { motion: Motion }) {
  // A step that moves the device (In, Out) draws where it goes too, a point a few of the icon's units per 10.
  const pts = Array.from({ length: 49 }, (_, i) => {
    const t = motion.at(i / 48);
    const sh = motion.shift?.(i / 48);
    return [W / 2 + t.y * KX + (sh?.dx ?? 0) * KD, H / 2 - t.x * KY + (sh?.dy ?? 0) * KD];
  });
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + (motion.loops ? ' Z' : '');
  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ overflow: 'visible' }}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      <rect x={sx - 2.5} y={sy - 4} width="5" height="8" rx="1.3" fill="var(--ui-bg)" stroke="currentColor" strokeWidth="1.3" />
      {!motion.loops && <circle cx={ex} cy={ey} r="2" fill="currentColor" />}
    </svg>
  );
}
