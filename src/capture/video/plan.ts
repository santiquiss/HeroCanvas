// Capture's video, the light part the panel reads as it renders (the encoder, exportVideo.ts, loads on export): the
// containers this browser can make, the options of a clip, and its crop and size.
import type { Layout } from '../../sim/layout';
import { DEFAULT_SHADOW, exportCrop, type Shadow } from '../exportImage';
import type { BodySpec } from '../models';
import type { Box, Lighting } from '../scene';
import { motionFrames, sequenceDuration, sequenceMotion, type Sequence } from './motion';
import { FLAT, type Tilt } from '../tilt';
import type { GlareLook } from '../ScreenGlare';

export type VideoContainer = 'mp4' | 'webm';

/** What each container is recorded as, best first; the first the browser records is used. */
const MIME: Record<VideoContainer, string[]> = {
  mp4: ['video/mp4;codecs=avc1.640033', 'video/mp4;codecs=avc1', 'video/mp4'],
  webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
};

/** The mime type this browser records a container as, or null. MP4 is encoded frame by frame where WebCodecs is. */
export function recordableMime(container: VideoContainer): string | null {
  if (container === 'mp4' && typeof VideoEncoder !== 'undefined') return 'video/mp4';
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME[container].find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

/** H.264 profiles and levels, smallest that fits first: High 5.1 (up to ~4K), 5.2, 6.0 (larger frames). */
export const AVC_CODECS = ['avc1.640033', 'avc1.640034', 'avc1.64003c'];

/** The containers this browser can record, MP4 first (it plays everywhere; WebM keeps transparency). */
export const VIDEO_CONTAINERS: { id: VideoContainer; label: string; alpha: boolean }[] = [
  { id: 'mp4', label: 'MP4', alpha: false },
  { id: 'webm', label: 'WebM', alpha: true },
];

export interface VideoOptions {
  /** How the device moves: In, Middle, Out (motion.ts). */
  sequence: Sequence;
  /** The Middle's resting angle when it holds yours (the custom angle): the canvas's. */
  rest?: Tilt;
  /** Seconds. */
  duration: number;
  /** Frames a second: 30 or 60. */
  fps: number;
  /** Each frame averages the turns its shutter would see (`exposure`): smooth motion at 30 frames a second too. */
  motionBlur: boolean;
  container: VideoContainer;
  /** Pixels a point (Automatic size). */
  scale: number;
  /** Automatic (`fit`: the motion's crop at `scale`) or Fixed (`custom`: `size` pixels, the motion fitted inside). */
  crop?: 'fit' | 'custom';
  size?: [number, number];
  color: string;
  light?: Lighting;
  shadow: boolean;
  shadowLook?: Shadow;
  /** `null`: transparent (MP4 has no alpha: white then). */
  background: string | null;
  /** Room around the device and its shadow, in the file's pixels. */
  padding: number;
  /** The screen's glare (ScreenGlare), drawn on each frame at its turn; null, none. */
  glare?: GlareLook | null;
}

/** Instants a frame averages for its motion blur: enough for a smooth smear at a turn's fastest. */
export const BLUR_SAMPLES = 8;

export type PlanOptions = Pick<VideoOptions, 'sequence' | 'rest' | 'duration' | 'fps' | 'scale' | 'padding' | 'shadow' | 'shadowLook' | 'light' | 'crop' | 'size'>;

/** H.264 wants even sizes. */
const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);

/**
 * The clip's crop, in points, and its pixels a point and size: every frame's device and shadow fit, so the device
 * doesn't jump. Automatic: that crop with the padding around, at `scale`. Fixed: `size` pixels (even), the crop as
 * large as fits inside the padding, centered.
 */
export function videoPlan(layout: Layout, spec: BodySpec | undefined, o: PlanOptions) {
  const tilts = motionFrames(sequenceMotion(o.sequence, o.duration, o.rest ?? FLAT), Math.round(o.duration * o.fps));
  const look = o.shadowLook ?? DEFAULT_SHADOW;
  const fixed = o.crop === 'custom' && o.size;
  // Fixed puts its padding in the file's pixels after fitting: none around the turns here.
  const margin = fixed ? 0 : o.padding / o.scale;
  const boxes = tilts.map((t) => exportCrop(layout, spec, t, margin, o.shadow ? look : null, o.light).box);
  const all: Box = {
    minX: Math.min(...boxes.map((b) => b.minX)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
  if (!fixed) {
    const pixels: [number, number] = [even((all.maxX - all.minX) * o.scale), even((all.maxY - all.minY) * o.scale)];
    // The crop grown to the even pixels, around the same middle.
    const cx = (all.minX + all.maxX) / 2;
    const cy = (all.minY + all.maxY) / 2;
    const box = { minX: cx - pixels[0] / o.scale / 2, maxX: cx + pixels[0] / o.scale / 2, minY: cy - pixels[1] / o.scale / 2, maxY: cy + pixels[1] / o.scale / 2 };
    return { tilts, box, scale: o.scale, pixels };
  }
  const [W, H] = [even(o.size![0]), even(o.size![1])];
  const p = Math.max(0, Math.min(o.padding, W / 2 - 16, H / 2 - 16));
  const k = Math.min((W - 2 * p) / (all.maxX - all.minX), (H - 2 * p) / (all.maxY - all.minY));
  const cx = (all.minX + all.maxX) / 2;
  const cy = (all.minY + all.maxY) / 2;
  const box = { minX: cx - W / k / 2, maxX: cx + W / k / 2, minY: cy - H / k / 2, maxY: cy + H / k / 2 };
  return { tilts, box, scale: k, pixels: [W, H] as [number, number] };
}

/**
 * A clip's options from Capture's settings (what the canvas, the panel and the export share): the device without
 * its body (Screen only) casts no shadow and has no fixed size.
 */
export function videoOptionsOf(
  prefs: { sequence: Sequence; fps: number; motionBlur: boolean; scale: number; crop: 'fit' | 'custom'; size: [number, number]; padding: number; shadow: boolean; shadowLook: Shadow },
  bare: boolean,
  light: Lighting,
  /** A recording's length, which the clip takes instead of the chosen duration. */
  recorded: number | null = null,
  /** The angle set on the canvas: the custom angle holds it. */
  rest: Tilt = FLAT,
): PlanOptions & Pick<VideoOptions, 'motionBlur'> {
  return {
    sequence: prefs.sequence,
    rest,
    duration: recorded ?? sequenceDuration(prefs.sequence),
    fps: prefs.fps,
    motionBlur: prefs.motionBlur,
    scale: prefs.scale,
    crop: bare ? 'fit' : prefs.crop,
    size: prefs.size,
    padding: prefs.padding,
    shadow: prefs.shadow && !bare,
    shadowLook: prefs.shadowLook,
    light,
  };
}
