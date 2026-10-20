// The touches drawn over a recorded screen (taps.ts): when they show, where, and how they fade.
import { describe, expect, it } from 'vitest';
import { TOUCH_IN, TOUCH_OUT, TOUCH_RADIUS, touchesAt, type Tap } from './taps';

const tap: Tap[] = [
  { kind: 'down', t: 1, at: [100, 200] },
  { kind: 'up', t: 1.1, at: [100, 200] },
];
const scroll: Tap[] = [
  { kind: 'down', t: 2, at: [200, 600] },
  { kind: 'move', t: 2.2, at: [200, 500] },
  { kind: 'move', t: 2.4, at: [200, 300] },
  { kind: 'up', t: 2.5, at: [200, 300] },
];

describe('touchesAt', () => {
  it('shows nothing before a touch or once it has faded', () => {
    expect(touchesAt(tap, 0.9)).toEqual([]);
    expect(touchesAt(tap, 1.1 + TOUCH_OUT + 0.01)).toEqual([]);
  });
  it('grows in as the finger goes down, and is full while held', () => {
    const [a] = touchesAt(tap, 1 + TOUCH_IN / 2);
    expect(a.opacity).toBeCloseTo(0.5);
    expect(a.radius).toBeLessThan(TOUCH_RADIUS);
    expect(touchesAt(tap, 1.09)[0]).toEqual({ at: [100, 200], radius: TOUCH_RADIUS, opacity: 1 });
  });
  it('follows the finger while it moves, and fades out where it lifts', () => {
    expect(touchesAt(scroll, 2.3)[0].at).toEqual([200, 500]);
    const [gone] = touchesAt(scroll, 2.5 + TOUCH_OUT / 2);
    expect(gone.at).toEqual([200, 300]);
    expect(gone.opacity).toBeCloseTo(0.5);
    expect(gone.radius).toBeGreaterThan(TOUCH_RADIUS);
  });
  it('keeps one still down at the end of the recording', () => {
    expect(touchesAt([{ kind: 'down', t: 0, at: [1, 1] }], 9)).toHaveLength(1);
  });
});
