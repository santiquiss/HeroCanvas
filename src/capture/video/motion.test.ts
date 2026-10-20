// Capture's video motions (motion.ts): the steps In, Middle and Out about a resting angle (In and Out moving, scaling
// and fading the device too), how they join into a clip, and that none turns past the canvas's limit.
import { describe, expect, it } from 'vitest';
import { FLAT, type Tilt } from '../tilt';
import { exposure, IN_STEPS, isStill, loopsAlone, MID_STEPS, motionFrames, NO_SHIFT, OUT_STEPS, PREVIEW_HOLD, previewTime, sequenceDuration, sequenceMotion, sequenceName, sequenceOf, stepMotion, withinLimit, type Sequence } from './motion';

/** A sequence from the steps that matter to a test, the rest the defaults. */
const q = (p: Partial<Sequence>): Sequence => sequenceOf(p);
const every: Sequence[] = IN_STEPS.flatMap((i) => MID_STEPS.flatMap((m) => OUT_STEPS.map((o) => q({ in: i.id, mid: m.id, out: o.id }))));
const ANGLE: Tilt = { x: 12, y: -25 };
const dist = (a: Tilt, b: Tilt) => Math.hypot(a.x - b.x, a.y - b.y);
const shiftAt = (st: (typeof IN_STEPS)[number], t: number) => stepMotion(st)?.shift?.(t) ?? NO_SHIFT;

describe('steps', () => {
  it('ten Ins and ten Outs to choose from, besides None', () => {
    expect(IN_STEPS.filter((s) => s.id !== 'none')).toHaveLength(11);
    expect(OUT_STEPS.filter((s) => s.id !== 'none')).toHaveLength(10);
  });
  it('In ends at the resting angle, in place and full size; Out starts there; a Middle cycle comes back to its start', () => {
    for (const s of IN_STEPS) if (s.offset) {
      expect(s.offset(1), s.id).toEqual(FLAT);
      expect(shiftAt(s, 1), s.id).toEqual(NO_SHIFT);
    }
    for (const s of OUT_STEPS) if (s.offset) {
      expect(s.offset(0), s.id).toEqual(FLAT);
      expect(stepMotion(s)?.shift?.(0) ?? NO_SHIFT, s.id).toEqual(NO_SHIFT);
    }
    for (const s of MID_STEPS) expect(s.offset!(1), s.id).toEqual(s.offset!(0));
  });
  it('every In and Out but None fades, quickly: well within its step (the Fade alone takes all of it)', () => {
    for (const s of [...IN_STEPS, ...OUT_STEPS]) {
      if (s.id === 'none') continue;
      expect(s.fade, s.id).toBeGreaterThan(0);
      if (s.id !== 'fade') expect(s.fade! * s.seconds, s.id).toBeLessThanOrEqual(0.6);
    }
  });
  it('Drop in comes from above, Rise up from below', () => {
    expect(IN_STEPS.find((s) => s.id === 'drop')!.move!(0).dy).toBeLessThan(0);
    expect(IN_STEPS.find((s) => s.id === 'rise')!.move!(0).dy).toBeGreaterThan(0);
  });
  it('the flip goes past the resting angle before it settles', () => {
    const flip = IN_STEPS.find((s) => s.id === 'flip')!.offset!;
    expect(Array.from({ length: 40 }, (_, i) => flip(i / 50).x).some((x) => x < 0)).toBe(true);
  });
  it('draws a path for its icon, its moves too', () => {
    expect(stepMotion(IN_STEPS[0])).toBeNull();
    expect(stepMotion(MID_STEPS.find((s) => s.id === 'orbit')!, true)!.loops).toBe(true);
    expect(stepMotion(IN_STEPS.find((s) => s.id === 'drop')!)!.shift!(0).dy).toBeLessThan(0);
  });
});

describe('a clip of steps', () => {
  it('stays within the turn the sliders allow, about your angle too', () => {
    for (const seq of every) for (const rest of [FLAT, ANGLE]) for (const t of motionFrames(sequenceMotion(seq, sequenceDuration(seq), rest), 120)) expect(withinLimit(t), sequenceName(seq)).toBe(true);
  });
  it('never jumps between frames: turn, move and visibility (In → Middle → Out)', () => {
    // Every In with every Out over a moving Middle, and every Middle between an In and an Out: each join, every step.
    const joins = [
      ...IN_STEPS.flatMap((i) => OUT_STEPS.map((o) => q({ in: i.id, mid: 'sway', out: o.id }))),
      ...MID_STEPS.map((m) => q({ in: 'drop', mid: m.id, out: 'lift' })),
    ];
    for (const seq of joins) {
      const clip = sequenceMotion(seq, sequenceDuration(seq));
      const n = Math.round(sequenceDuration(seq) * 60);
      const ts = Array.from({ length: n }, (_, i) => i / (n - 1));
      for (let i = 1; i < n; i++) {
        const [a, b] = [ts[i - 1], ts[i]];
        expect(dist(clip.at(b), clip.at(a)), `${sequenceName(seq)} turn at ${i}`).toBeLessThan(6);
        const [sa, sb] = [clip.shift?.(a) ?? NO_SHIFT, clip.shift?.(b) ?? NO_SHIFT];
        expect(Math.hypot(sb.dx - sa.dx, sb.dy - sa.dy), `${sequenceName(seq)} move at ${i}`).toBeLessThan(8);
        // Pop grows from 60% in half a second: the quickest; a jump would be a step's whole size at once.
        expect(Math.abs(sb.scale - sa.scale), `${sequenceName(seq)} size at ${i}`).toBeLessThan(0.08);
      }
    }
  });
  it('is in view, in place and full size between In and Out', () => {
    const seq = q({ in: 'drop', mid: 'sway', out: 'lift' });
    const clip = sequenceMotion(seq, sequenceDuration(seq));
    expect(clip.alpha!(0)).toBe(0);
    expect(clip.alpha!(0.5)).toBe(1);
    expect(clip.shift!(0.5)).toEqual(NO_SHIFT);
    expect(clip.alpha!(1)).toBe(0);
  });
  it('flows: the Middle is already moving as In ends, and still moving as Out begins (no pause between them)', () => {
    const seq = q({ in: 'drop', inSeconds: 1, mid: 'sway', midSeconds: 6, out: 'lift', outSeconds: 1 });
    const d = sequenceDuration(seq);
    const clip = sequenceMotion(seq, d);
    const speed = (s: number) => dist(clip.at((s + 0.02) / d), clip.at(s / d));
    expect(speed(1)).toBeGreaterThan(0.05);
    expect(speed(d - 1)).toBeGreaterThan(0.05);
  });
  it('Loop leaves In and Out out (kept for Once) and repeats the motion; Once plays them', () => {
    const loop = q({ mode: 'loop', in: 'drop', mid: 'sway', out: 'lift', midSeconds: 6 });
    expect(loopsAlone(loop)).toBe(true);
    expect(sequenceDuration(loop)).toBe(6);
    expect(sequenceMotion(loop, 6).loops).toBe(true);
    expect(loop.in).toBe('drop');
    const once = { ...loop, mode: 'once' as const };
    expect(loopsAlone(once)).toBe(false);
    expect(sequenceDuration(once)).toBe(8);
    // A setting kept before Loop and Once: no In and no Out was a loop.
    expect(sequenceOf({ in: 'none', out: 'none', mid: 'orbit' }).mode).toBe('loop');
    expect(sequenceOf({ in: 'drop', mid: 'orbit' }).mode).toBe('once');
  });
  it('twelve Middles, ten of them moving', () => {
    expect(MID_STEPS).toHaveLength(12);
    expect(MID_STEPS.filter((m) => m.seconds > 0)).toHaveLength(10);
  });
  it('loops the Middle alone, whole cycles in the clip: no seam', () => {
    const clip = sequenceMotion(q({ in: 'none', mid: 'sway', out: 'none', midSeconds: 12 }), 12);
    expect(clip.loops).toBe(true);
    expect(clip.at(1)).toEqual(clip.at(0));
    expect(loopsAlone(q({ in: 'none', mid: 'sway', out: 'none' }))).toBe(true);
  });
  it('holds your angle, and In and Out arrive at it and leave from it', () => {
    const hold = sequenceMotion(q({ in: 'none', mid: 'angle', out: 'none' }), 6, ANGLE);
    for (const t of motionFrames(hold, 10)) expect(t).toEqual(ANGLE);
    const once = sequenceMotion(q({ in: 'swing', mid: 'angle', out: 'lay' }), 6, ANGLE);
    expect(once.at(0.5)).toEqual(ANGLE);
    expect(dist(once.at(0), ANGLE)).toBeGreaterThan(10);
    expect(dist(once.at(1), ANGLE)).toBeGreaterThan(10);
    expect(sequenceMotion(q({ in: 'none', mid: 'still', out: 'none' }), 6, ANGLE).at(0.5)).toEqual(FLAT);
  });
  it('lasts its steps’ sum; the Middle alone when it loops', () => {
    expect(sequenceDuration(q({ in: 'drop', inSeconds: 1, midSeconds: 6, out: 'swing', outSeconds: 2 }))).toBe(9);
    expect(sequenceDuration(q({ in: 'none', out: 'none', midSeconds: 8 }))).toBe(8);
  });
  it('names its file by its steps, reads a setting kept before the steps, knows what stands still', () => {
    expect(sequenceName(q({ in: 'none', mid: 'sway', out: 'none' }))).toBe('sway-loop');
    expect(sequenceName(q({ in: 'drop', mid: 'angle', out: 'lift' }))).toBe('drop-angle-lift-out');
    expect(sequenceOf({ mid: 'orbit', in: 'none' })).toMatchObject({ in: 'none', mid: 'orbit', out: 'none' });
    expect(sequenceOf({ in: 'reveal' as never }).in).toBe('none');
    expect(sequenceOf({ in: 'drop', inSeconds: 0.9, midSeconds: 5 })).toMatchObject({ inSeconds: 1, midSeconds: 4 });
    expect(isStill(q({ in: 'none', mid: 'angle', out: 'none' }))).toBe(true);
    expect(isStill(q({ in: 'fade', mid: 'still', out: 'none' }))).toBe(false);
  });
});

describe('frames, blur and preview', () => {
  const loop = sequenceMotion(q({ in: 'none', mid: 'orbit', out: 'none' }), 8);
  const once = sequenceMotion(q({ in: 'swing', mid: 'sway', out: 'swing' }), 8);
  it('sample a frame per slot; a loop stops short of its first frame', () => {
    const frames = motionFrames(loop, 4);
    expect(frames).toHaveLength(4);
    expect(frames[3]).toEqual(loop.at(0.75));
    expect(motionFrames(once, 3)[2]).toEqual(once.at(1));
  });
  it('spreads a frame’s instants around it; holds the ends of a clip that plays once, wraps a loop', () => {
    const [first, mid, last] = exposure(once, 15, 31, 3);
    expect(mid).toEqual(once.at(0.5));
    expect(first).toEqual(once.at(0.5 - 0.25 / 30));
    expect(last).toEqual(once.at(0.5 + 0.25 / 30));
    expect(exposure(once, 0, 30, 4)[0]).toEqual(once.at(0));
    expect(exposure(loop, 0, 30, 3)[0]).toEqual(loop.at(1 - 0.25 / 30));
  });
  it('goes round a loop, and holds the end of a clip that plays once before it plays again', () => {
    expect(previewTime(loop, 10, 8)).toBeCloseTo(0.25);
    expect(previewTime(once, 8.5, 8)).toBe(1);
    expect(previewTime(once, 8 + PREVIEW_HOLD + 2, 8)).toBeCloseTo(0.25);
  });
});
