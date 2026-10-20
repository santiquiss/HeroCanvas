// Capture's video: how the device moves while it plays, in three steps: In (how it comes in), Middle (what it does
// while the screen plays) and Out (how it leaves), joined into one motion for the clip (sequenceMotion). A motion is
// the device's turn (tilt.ts) at a point of the clip, `t` from 0 (start) to 1 (end), and where In and Out take it
// besides: a shift (moved, scaled) and how visible it is (each In and Out brings its own short fade). Pure, so the
// export samples it frame by frame, the canvas plays it, and a test can check it. Within the turn the angle sliders
// allow (TILT_MAX).
import { FLAT, TILT_MAX, type Tilt } from '../tilt';

/** Eases the end only: it arrives and settles. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;
/** A quick arrival that lands softly: most of the way early, the rest slowly. */
const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;
/** Arrives a little past and comes back (an overshoot). */
const easeOutBack = (t: number, c = 1.6) => 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** Eases both ends with no speed at either (smootherstep): a join where nothing jerks. */
const smooth = (t: number) => {
  const k = clamp01(t);
  return k * k * k * (k * (k * 6 - 15) + 10);
};
const TAU = Math.PI * 2;
// `|| 0`: no -0 (a sine back at its start), so a loop's first and last turns compare equal.
const round = (v: number) => Math.round(v * 100) / 100 || 0;
const tilt = (x: number, y: number): Tilt => ({ x: round(x), y: round(y) });
const add = (a: Tilt, b: Tilt): Tilt => tilt(Math.max(-TILT_MAX, Math.min(TILT_MAX, a.x + b.x)), Math.max(-TILT_MAX, Math.min(TILT_MAX, a.y + b.y)));

/** Where a step moves the device besides turning it: points across and down, and its size (1: as it is). */
export interface Shift {
  dx: number;
  dy: number;
  scale: number;
}
export const NO_SHIFT: Shift = { dx: 0, dy: 0, scale: 1 };

export interface Motion {
  /** Its start and end are the same turn: the clip can play in a loop. */
  loops: boolean;
  at: (t: number) => Tilt;
  /** Where it's moved and how big at `t`; unset, where it stands. */
  shift?: (t: number) => Shift;
  /** How visible the device is at `t` (0–1); unset, fully. */
  alpha?: (t: number) => number;
}
const motion = (at: Motion['at'], loops = false): Motion => ({ at, loops });

/**
 * A clip is three steps: how the device comes in (In), what it does while the screen plays (Middle), how it leaves
 * (Out). Every step is about the Middle's resting angle (facing you, or the one you set): In arrives at it, the
 * Middle moves around it, Out leaves from it. So any In joins any Middle and any Out; with neither, the Middle loops.
 */
export interface Step<Id extends string> {
  id: Id;
  label: string;
  /** What it does, for its tooltip. */
  note: string;
  /**
   * In and Out: the turn away from the resting angle at `t` (In ends at none, Out starts at none); null skips the
   * step. Middle: the swing around it over one cycle (`t` 0–1).
   */
  offset: ((t: number) => Tilt) | null;
  /** In and Out: where it's moved and how big at `t` (In ends where it stands, Out starts there). */
  move?: (t: number) => Partial<Shift>;
  /** In and Out: the share of the step its fade takes (In: from the start, Out: to the end); unset, no fade. */
  fade?: number;
  /** In and Out: how long it takes when picked (its row's duration starts there). Middle: one cycle (0: it doesn't move). */
  seconds: number;
  /** An icon instead of its path (one that doesn't turn, or holds an angle). */
  icon?: string;
}

export type InId = 'none' | 'drop' | 'rise' | 'float' | 'zoom' | 'swing' | 'flip' | 'spin' | 'tumble' | 'pendulum' | 'pop' | 'fade';
export type MidId = 'still' | 'angle' | 'sway' | 'orbit' | 'figure8' | 'float' | 'breathe' | 'rock' | 'wobble' | 'look' | 'drift' | 'hover';
export type OutId = 'none' | 'lift' | 'drop' | 'float' | 'zoom' | 'swing' | 'lay' | 'spin' | 'tumble' | 'pop' | 'fade';
export interface Sequence {
  /** Loop: the Middle alone, repeating without a seam. Once: In, the Middle, Out, start to end (In and Out kept while
   * it loops, for when it plays once again). */
  mode: 'loop' | 'once';
  in: InId;
  mid: MidId;
  out: OutId;
  /** Each step's length: the clip is their sum (a recording's length stretches the Middle). */
  inSeconds: number;
  midSeconds: number;
  outSeconds: number;
}
export const DEFAULT_SEQUENCE: Sequence = { mode: 'once', in: 'drop', mid: 'sway', out: 'none', inSeconds: 1, midSeconds: 6, outSeconds: 1 };

/** The lengths a row offers: In and Out, the Middle. */
export const EDGE_SECONDS = [0.5, 1, 1.5, 2];
export const MID_SECONDS = [2, 3, 4, 6, 8, 10, 12];

/** How far a move goes (points): enough to read as coming from somewhere, not to leave the picture. */
const NEAR = 24;
const FAR = 70;

/** The Ins: each arrives at the resting angle, where it stands and at its size, fully in view. */
const IN_STEP_LIST: Step<InId>[] = [
  { id: 'none', label: 'None', note: 'It starts already in the middle motion', offset: null, seconds: 0 },
  {
    id: 'drop',
    label: 'Drop in',
    note: 'Comes down from above, leaning back a touch, appearing as it comes',
    offset: (t) => tilt(10 * (1 - easeOutQuint(t)), 0),
    move: (t) => ({ dy: -FAR * (1 - easeOutQuint(t)) }),
    fade: 0.35,
    seconds: 1,
  },
  {
    id: 'rise',
    label: 'Rise up',
    note: 'Comes up from below, leaning forward a touch',
    offset: (t) => tilt(-12 * (1 - easeOutQuint(t)), 0),
    move: (t) => ({ dy: FAR * (1 - easeOutQuint(t)) }),
    fade: 0.35,
    seconds: 1,
  },
  {
    id: 'float',
    label: 'Float in',
    note: 'Drifts up a little and grows into place, softly',
    offset: () => FLAT,
    move: (t) => ({ dy: NEAR * (1 - easeOut(t)), scale: 1 - 0.04 * (1 - easeOut(t)) }),
    fade: 0.35,
    seconds: 1.5,
  },
  {
    id: 'zoom',
    label: 'Zoom in',
    note: 'Grows into place from a little smaller',
    offset: () => FLAT,
    move: (t) => ({ scale: 1 - 0.18 * (1 - easeOutQuint(t)) }),
    fade: 0.35,
    seconds: 1,
    icon: 'zoom_in',
  },
  {
    id: 'swing',
    label: 'Swing in',
    note: 'Comes in from the side, turned, and faces you',
    offset: (t) => {
      const left = 1 - easeOut(t);
      return tilt(8 * left, 38 * left);
    },
    move: (t) => ({ dx: 40 * (1 - easeOut(t)) }),
    fade: 0.3,
    seconds: 1.5,
  },
  {
    id: 'flip',
    label: 'Flip up',
    note: 'Lifts as if from a table, with a small bounce',
    // A spring: past the resting angle and back, settled before its end.
    offset: (t) => {
      const k = clamp01(t / 0.9);
      if (k >= 1) return FLAT;
      const left = (1 - spring(k)) * (1 - smooth(k) ** 8);
      return tilt(40 * left, 6 * left);
    },
    fade: 0.25,
    seconds: 1.5,
  },
  {
    id: 'spin',
    label: 'Spin in',
    note: 'Turns on its axis into place, a little past and back',
    offset: (t) => tilt(0, -42 * (1 - easeOutBack(clamp01(t)))),
    move: (t) => ({ scale: 1 - 0.08 * (1 - easeOut(t)) }),
    fade: 0.3,
    seconds: 1,
  },
  {
    id: 'tumble',
    label: 'Tumble in',
    note: 'Comes in from the top corner, tilted both ways, and settles',
    offset: (t) => {
      const left = 1 - easeOutQuint(t);
      return tilt(16 * left, -24 * left);
    },
    move: (t) => {
      const left = 1 - easeOutQuint(t);
      return { dx: -50 * left, dy: -50 * left };
    },
    fade: 0.3,
    seconds: 1,
  },
  {
    id: 'pendulum',
    label: 'Pendulum',
    note: 'Swings side to side, slowing until it rests',
    offset: (t) => {
      const k = clamp01(t);
      // Two swings, each smaller than the last: the reach shrinks to nothing at the end, with no speed left.
      const reach = (1 - k) ** 3;
      return tilt(4 * reach * Math.abs(Math.sin(4 * Math.PI * k)), 30 * reach * Math.cos(4 * Math.PI * k));
    },
    fade: 0.2,
    seconds: 2,
  },
  {
    id: 'pop',
    label: 'Pop',
    note: 'Grows quickly from small, a little past and back',
    offset: () => FLAT,
    move: (t) => ({ scale: 0.6 + 0.4 * easeOutBack(clamp01(t), 2.2) }),
    fade: 0.2,
    seconds: 0.5,
    icon: 'open_in_full',
  },
  { id: 'fade', label: 'Fade', note: 'Only appears: no motion', offset: () => FLAT, fade: 1, seconds: 0.5, icon: 'gradient' },
];
export const IN_STEPS = IN_STEP_LIST;

export const MID_STEPS: Step<MidId>[] = [
  { id: 'still', label: 'No motion: facing', note: 'Facing you, not moving: to show an interaction on the screen', offset: () => FLAT, seconds: 0 },
  { id: 'angle', label: 'No motion: custom angle', note: 'Holds the angle you set: turn the device on the canvas, or with Angle', offset: () => FLAT, seconds: 0, icon: '3d_rotation' },
  { id: 'sway', label: 'Sway', note: 'Gently back and forth', offset: (t) => tilt(3 * Math.sin(TAU * t * 2), 14 * Math.sin(TAU * t)), seconds: 6 },
  { id: 'orbit', label: 'Orbit', note: 'Goes slowly around, as if looking around it', offset: (t) => tilt(8 * Math.sin(TAU * t), 16 * Math.cos(TAU * t)), seconds: 8 },
  { id: 'figure8', label: 'Figure 8', note: 'Traces a slow sideways eight', offset: (t) => tilt(6 * Math.sin(2 * TAU * t), 18 * Math.sin(TAU * t)), seconds: 10 },
  {
    id: 'float',
    label: 'Float',
    note: 'Bobs gently up and down, as if on water',
    offset: (t) => tilt(2 * Math.sin(TAU * t + Math.PI / 2), 0),
    move: (t) => ({ dy: -8 * Math.sin(TAU * t) }),
    seconds: 4,
  },
  { id: 'breathe', label: 'Breathe', note: 'Grows and shrinks, barely, like a breath', offset: () => FLAT, move: (t) => ({ scale: 1 + 0.025 * Math.sin(TAU * t) }), seconds: 5, icon: 'expand_content' },
  { id: 'rock', label: 'Rock', note: 'Leans back and forth, top toward you and away', offset: (t) => tilt(10 * Math.sin(TAU * t), 2 * Math.sin(2 * TAU * t)), seconds: 6 },
  { id: 'wobble', label: 'Wobble', note: 'Small lively turns, every which way', offset: (t) => tilt(4 * Math.sin(2 * TAU * t) + 2 * Math.sin(3 * TAU * t), 6 * Math.sin(TAU * t) + 3 * Math.sin(4 * TAU * t)), seconds: 4 },
  { id: 'look', label: 'Look around', note: 'Turns slowly to one side and the other, wider than a sway', offset: (t) => tilt(4 * Math.sin(2 * TAU * t), 28 * Math.sin(TAU * t)), seconds: 10 },
  {
    id: 'drift',
    label: 'Drift',
    note: 'Slides slowly side to side, turning with it',
    offset: (t) => tilt(0, 10 * Math.sin(TAU * t)),
    move: (t) => ({ dx: 14 * Math.sin(TAU * t) }),
    seconds: 8,
  },
  {
    id: 'hover',
    label: 'Hover',
    note: 'Floats up and down while it turns a little',
    offset: (t) => tilt(3 * Math.sin(TAU * t), 8 * Math.sin(2 * TAU * t)),
    move: (t) => ({ dy: -6 * Math.sin(2 * TAU * t) }),
    seconds: 8,
  },
];

/**
 * An In played backwards: an Out of its own (it leaves the way the In arrives, easing off, going off at speed), the
 * same moves, its fade at the end.
 */
function outOf(id: OutId, from: Step<InId>, label: string, note: string): Step<OutId> {
  // The In's eased arrival, run backwards, is an eased departure: k = 1 - t.
  const back = (t: number) => 1 - clamp01(t);
  return {
    id,
    label,
    note,
    offset: from.offset ? (t) => from.offset!(back(t)) : null,
    move: from.move ? (t) => from.move!(back(t)) : undefined,
    fade: from.fade,
    seconds: from.seconds,
    icon: from.icon,
  };
}
const inStep = (id: InId) => IN_STEP_LIST.find((x) => x.id === id)!;

export const OUT_STEPS: Step<OutId>[] = [
  { id: 'none', label: 'None', note: 'It ends in the middle motion', offset: null, seconds: 0 },
  outOf('lift', inStep('drop'), 'Lift away', 'Rises out of the picture, fading as it goes'),
  outOf('drop', inStep('rise'), 'Drop out', 'Sinks out of the picture, fading as it goes'),
  outOf('float', inStep('float'), 'Float out', 'Drifts down a little and shrinks away, softly'),
  outOf('zoom', inStep('zoom'), 'Zoom out', 'Shrinks away'),
  outOf('swing', inStep('swing'), 'Swing out', 'Turns away to the side'),
  outOf('lay', inStep('flip'), 'Lay down', 'Goes back down as if onto a table'),
  outOf('spin', inStep('spin'), 'Spin out', 'Turns away on its axis'),
  outOf('tumble', inStep('tumble'), 'Tumble out', 'Tilts away to the top corner'),
  outOf('pop', inStep('pop'), 'Pop out', 'Shrinks quickly away'),
  outOf('fade', inStep('fade'), 'Fade', 'Only disappears: no motion'),
];

/** The fade of a step at `t`: an In's from nothing over its first `fade`, an Out's to nothing over its last. */
const fadeIn = (step: Step<string>, t: number) => (step.fade ? smooth(t / step.fade) : 1);
const fadeOut = (step: Step<string>, t: number) => (step.fade ? smooth((1 - t) / step.fade) : 1);
const shiftOf = (step: Step<string>, t: number): Shift => {
  const m = { ...NO_SHIFT, ...step.move?.(t) };
  return { dx: round(m.dx), dy: round(m.dy), scale: Math.round(m.scale * 10000) / 10000 };
};

/** A step's path as a motion of its own, for its icon (from the resting angle facing you). */
export const stepMotion = (step: Step<string>, middle = false): Motion | null =>
  step.offset ? { ...motion(step.offset, middle), ...(step.move ? { shift: (t: number) => shiftOf(step, t) } : {}) } : null;

const stepOf = <Id extends string>(steps: Step<Id>[], id: Id) => steps.find((x) => x.id === id) ?? steps[0];

/** A length kept, on the nearest of the row's (lengths it offered before snap to today's); none kept, `fallback`. */
const num = (v: unknown, fallback: number, offered: number[]) =>
  typeof v === 'number' && v > 0 ? offered.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a)) : fallback;

/** A sequence a stored setting may have left half-known: each step a known one, else its default. */
export function sequenceOf(seq: Partial<Sequence> | undefined): Sequence {
  const d = DEFAULT_SEQUENCE;
  const inS = stepOf(IN_STEPS, seq?.in ?? d.in);
  const outS = stepOf(OUT_STEPS, seq?.out ?? d.out);
  // Kept before Loop and Once: with no In and no Out it looped.
  const mode = seq?.mode === 'loop' || seq?.mode === 'once' ? seq.mode : seq?.in === 'none' && (seq.out ?? 'none') === 'none' ? 'loop' : d.mode;
  return {
    mode,
    in: inS.id,
    mid: stepOf(MID_STEPS, seq?.mid ?? d.mid).id,
    out: outS.id,
    // A length not given: its motion's own (as picking it sets), else the default.
    inSeconds: num(seq?.inSeconds, inS.seconds || d.inSeconds, EDGE_SECONDS),
    midSeconds: num(seq?.midSeconds, d.midSeconds, MID_SECONDS),
    outSeconds: num(seq?.outSeconds, outS.seconds || d.outSeconds, EDGE_SECONDS),
  };
}

/** Whether there's an In, and an Out (only when it plays once). */
export const hasIn = (seq: Sequence) => seq.mode === 'once' && seq.in !== 'none';
export const hasOut = (seq: Sequence) => seq.mode === 'once' && seq.out !== 'none';

/** Whether the middle loops on its own (Loop, or Once with no In and no Out). */
export const loopsAlone = (seq: Sequence) => !hasIn(seq) && !hasOut(seq);

/** Nothing moves: no In or Out, and a Middle that holds (facing you, or your angle). */
export const isStill = (seq: Sequence) => loopsAlone(seq) && stepOf(MID_STEPS, seq.mid).seconds === 0;

/** The clip's length: its steps' (the Middle's alone when it loops). */
export const sequenceDuration = (seq: Sequence) => (hasIn(seq) ? seq.inSeconds : 0) + seq.midSeconds + (hasOut(seq) ? seq.outSeconds : 0);

/** A name for the file: its steps, In and Out only when there are. */
export const sequenceName = (seq: Sequence) => [hasIn(seq) && seq.in, seq.mid, hasOut(seq) && `${seq.out}-out`, seq.mode === 'loop' && 'loop'].filter(Boolean).join('-');

/** Two shifts at once: their moves added, their sizes multiplied. */
const both = (a: Shift, b: Shift): Shift => ({ dx: round(a.dx + b.dx), dy: round(a.dy + b.dy), scale: Math.round(a.scale * b.scale * 10000) / 10000 });
/** A shift `w` of the way (0: none, 1: all of it). */
const part = (sh: Shift, w: number): Shift => ({ dx: sh.dx * w, dy: sh.dy * w, scale: 1 + (sh.scale - 1) * w });

/**
 * The whole clip's motion, `duration` seconds (its steps' sum, or a recording's: the Middle takes what In and Out
 * leave), about `rest` (the Middle's resting angle: facing you, or the one set by hand for the custom angle). The Middle
 * runs through the whole clip at its own pace (its cycle in seconds), from the first frame: it grows in as In plays
 * and fades out as Out plays, In and Out laid over it. So one flows into the next, no pause between them. Alone it
 * loops, fitting whole cycles in the clip so the loop has no seam. In and Out keep their length unless the clip is
 * short (then they share 60% of it); they move, scale and fade the device as they go.
 */
export function sequenceMotion(seq: Sequence, duration: number, rest: Tilt = FLAT): Motion {
  const inSt = stepOf(IN_STEPS, seq.in);
  const midSt = stepOf(MID_STEPS, seq.mid);
  const outSt = stepOf(OUT_STEPS, seq.out);
  const base = seq.mid === 'angle' ? rest : FLAT;
  const swing = midSt.offset!;
  const sway = (phase: number): { turn: Tilt; shift: Shift } =>
    midSt.seconds ? { turn: swing(phase), shift: shiftOf(midSt, phase) } : { turn: FLAT, shift: NO_SHIFT };
  if (loopsAlone(seq)) {
    const cycles = midSt.seconds ? Math.max(1, Math.round(duration / midSt.seconds)) : 1;
    return {
      ...motion((t) => add(base, sway((t * cycles) % 1).turn), true),
      ...(midSt.move ? { shift: (t: number) => sway((t * cycles) % 1).shift } : {}),
    };
  }
  const inWant = hasIn(seq) ? seq.inSeconds : 0;
  const outWant = hasOut(seq) ? seq.outSeconds : 0;
  const fit = Math.min(1, (duration * 0.6) / (inWant + outWant));
  const inS = inWant * fit;
  const outS = outWant * fit;
  // The clip at `t`: its seconds, the Middle's share (growing over In, fading over Out), and where In and Out are.
  const at = (t: number) => {
    const s = clamp01(t) * duration;
    const w = Math.min(inS ? smooth(s / inS) : 1, outS ? smooth((duration - s) / outS) : 1);
    const mid = sway(midSt.seconds ? (s / midSt.seconds) % 1 : 0);
    return { s, w, mid, inU: inS && s < inS ? s / inS : null, outU: outS && s > duration - outS ? (s - (duration - outS)) / outS : null };
  };
  return {
    loops: false,
    at: (t) => {
      const p = at(t);
      let turn = add(base, tilt(p.mid.turn.x * p.w, p.mid.turn.y * p.w));
      if (p.inU !== null) turn = add(turn, inSt.offset!(p.inU));
      if (p.outU !== null) turn = add(turn, outSt.offset!(p.outU));
      return turn;
    },
    shift: (t) => {
      const p = at(t);
      let sh = part(p.mid.shift, p.w);
      if (p.inU !== null) sh = both(sh, shiftOf(inSt, p.inU));
      if (p.outU !== null) sh = both(sh, shiftOf(outSt, p.outU));
      return both(sh, NO_SHIFT);
    },
    alpha: (t) => {
      const p = at(t);
      return p.inU !== null ? fadeIn(inSt, p.inU) : p.outU !== null ? fadeOut(outSt, p.outU) : 1;
    },
  };
}

/** A damped spring from 0 to 1: it overshoots a little, comes back and settles. */
function spring(k: number) {
  return 1 - Math.exp(-6 * k) * Math.cos(9 * k);
}

/** Where frame `i` of `n` falls in the motion (0–1): a loop's last frame stops short of its first, which follows it. */
export function frameTime(motion: Motion, i: number, n: number): number {
  if (motion.loops) return i / n;
  return n <= 1 ? 0 : i / (n - 1);
}

/** The turns of every frame of a clip: `frames` samples from start to end. */
export function motionFrames(motion: Motion, frames: number): Tilt[] {
  const n = Math.max(1, frames);
  return Array.from({ length: n }, (_, i) => motion.at(frameTime(motion, i, n)));
}

/**
 * The turns one frame averages for its motion blur, as a camera's shutter would see them: `samples` instants spread
 * over `shutter` of the time between two frames (0.5: a 180° shutter, a film camera's), centered on the frame. A
 * loop wraps around its ends; a motion that stops holds its first and last turn.
 */
export function exposure(motion: Motion, i: number, n: number, samples: number, shutter = 0.5): Tilt[] {
  const t = frameTime(motion, i, n);
  const step = motion.loops ? 1 / n : n <= 1 ? 0 : 1 / (n - 1);
  const k = Math.max(1, samples);
  return Array.from({ length: k }, (_, j) => {
    const at = t + (k === 1 ? 0 : (j / (k - 1) - 0.5) * shutter * step);
    return motion.at(motion.loops ? ((at % 1) + 1) % 1 : clamp01(at));
  });
}

/** The preview's time `elapsed` seconds in: a loop goes round; a motion that stops holds its end a moment, then starts over. */
export function previewTime(motion: Motion, elapsed: number, duration: number): number {
  if (motion.loops) return (elapsed / duration) % 1;
  return Math.min(1, (elapsed % (duration + PREVIEW_HOLD)) / duration);
}
/** Seconds the preview holds the end of a motion that stops, before it plays again. */
export const PREVIEW_HOLD = 0.8;

/** Within the canvas's limit: a motion never turns the device further than the angle sliders do. */
export const withinLimit = (t: Tilt) => Math.abs(t.x) <= TILT_MAX && Math.abs(t.y) <= TILT_MAX;
