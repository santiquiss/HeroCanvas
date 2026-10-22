// Capture's export settings, per viewer (localStorage): the panel sets them, the canvas shows what they'll make.
import { useState } from 'react';
import { DEFAULT_SHADOW, type ExportOptions, type Shadow } from './exportImage';
import { DEFAULT_SEQUENCE, sequenceOf, type Sequence } from './video/motion';
import type { VideoContainer } from './video/plan';
import { t } from '../i18n/ui';

const KEY = 'hc.capture';

export type CapturePrefs = Pick<ExportOptions, 'scale' | 'shadow' | 'background' | 'format' | 'quality' | 'padding'> & {
  /** The canvas: the picture fitted to it, or at its real size (a pixel of the file a pixel of the screen). */
  preview: 'fit' | 'actual';
  /** A glare on the screen's glass (a thin line of light), and how strong (0–1). */
  glare: boolean;
  glareStrength: number;
  /** Where the softbox is: above the scene (`top`: the glare on the screen's top, strongest facing up) or below. */
  glareSide: 'top' | 'bottom';
  /** How soft its edge is (0: a crisp line, 1: a wide fade). Not offered: always crisp (0). */
  glareSoftness: number;
  /** The device in 3D, or its screen alone: square, no frame, what a screenshot would be. */
  frame: 'device' | 'screen';
  /** The canvas veils what the file leaves out, and cuts what it cuts; off, the whole device shows. */
  cropPreview: boolean;
  /** The shadow's look: softness, distance, darkness; a preset's, or its own (`custom`). */
  shadowLook: Shadow;
  shadowPreset: ShadowPreset;
  /** The picture's size: Auto (`fit`: the device's, at `scale`) or Fixed (`custom`: `size` pixels). */
  crop: 'fit' | 'custom';
  size: [number, number];
  /** What the export makes: a picture, or a short clip of the device moving (src/capture/video). */
  output: 'image' | 'video';
  /** The clip: how the device moves and for how long (In, Middle, Out: its length is theirs), in what container. */
  sequence: Sequence;
  videoContainer: VideoContainer;
  /** Frames a second, and whether each frame carries the motion blur a camera's shutter would (MP4). */
  fps: 30 | 60;
  motionBlur: boolean;
  /** An interaction recording's touches drawn over the screen (capture/video/taps.ts). */
  showTouches: boolean;
  /** How fast a recorded interaction plays in the clip: 1x as recorded, 1.5x, 2x (the clip shorter by as much). */
  playbackSpeed: PlaybackSpeed;
};
const DEFAULTS: CapturePrefs = { scale: 3, shadow: true, background: null, format: 'png', quality: 0.92, padding: 120, preview: 'fit', frame: 'device', glare: false, glareStrength: 0.8, glareSide: 'top', glareSoftness: 0, cropPreview: true, shadowLook: DEFAULT_SHADOW, shadowPreset: 'medium', crop: 'fit', size: [1320, 2868], output: 'image', sequence: DEFAULT_SEQUENCE, videoContainer: 'mp4', fps: 60, motionBlur: true, showTouches: true, playbackSpeed: 1 };

export type PlaybackSpeed = 1 | 1.5 | 2;
export const PLAYBACK_SPEEDS: PlaybackSpeed[] = [1, 1.5, 2];
/** A recording's length in the clip: as recorded, at the playback speed. */
export const playedLength = (recording: { duration: number } | null | undefined, speed: number) => (recording ? recording.duration / speed : null);

export type ShadowPreset = 'none' | 'subtle' | 'medium' | 'large' | 'custom';

/** Shadows a click away: none, a subtle one close under the device, the usual one, a large soft one; or its own. */
export const SHADOW_PRESETS: { id: ShadowPreset; label: string; look?: Shadow }[] = [
  { id: 'none', label: t('None') },
  { id: 'subtle', label: t('Subtle'), look: { blur: 24, distance: 10, opacity: 0.2 } },
  { id: 'medium', label: t('Medium'), look: DEFAULT_SHADOW },
  { id: 'large', label: t('Large'), look: { blur: 90, distance: 50, opacity: 0.4 } },
  { id: 'custom', label: t('Custom') },
];

/** Backgrounds a click away (besides transparent and any color): white, greys, black. */
export const BACKGROUNDS: { name: string; color: string }[] = [
  { name: t('White'), color: '#ffffff' },
  { name: t('Light gray'), color: '#f2f3f5' },
  { name: t('Gray'), color: '#d7dade' },
  { name: t('Dark gray'), color: '#3a3d42' },
  { name: t('Black'), color: '#000000' },
];

/** Sizes a picture is often wanted at: the stores' screenshots, social posts. */
export const SIZE_PRESETS: { group: string; label: string; size: [number, number] }[] = [
  { group: 'App Store', label: 'iPhone 6.9″', size: [1320, 2868] },
  { group: 'App Store', label: 'iPhone 6.5″', size: [1284, 2778] },
  { group: 'App Store', label: 'iPad 13″', size: [2064, 2752] },
  { group: 'Google Play', label: t('Phone'), size: [1080, 1920] },
  { group: t('Social'), label: t('Instagram post'), size: [1080, 1350] },
  { group: t('Social'), label: t('Instagram story'), size: [1080, 1920] },
  { group: t('Social'), label: t('Square'), size: [1080, 1080] },
  { group: t('Social'), label: 'X / Twitter', size: [1600, 900] },
  { group: t('Social'), label: 'LinkedIn', size: [1200, 627] },
  { group: t('Social'), label: 'Dribbble', size: [1600, 1200] },
];

/** The preset a size is (its group and label), if any. */
export const presetOf = (size: [number, number]) => SIZE_PRESETS.find((x) => x.size[0] === size[0] && x.size[1] === size[1]);

function read(): CapturePrefs {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) || '{}');
    const look = { ...DEFAULT_SHADOW, ...kept.shadowLook };
    // Kept before the presets: off is None, else its own look.
    const preset = kept.shadowPreset ?? (kept.shadow === false ? 'none' : kept.shadowLook ? 'custom' : 'medium');
    // Kept before padding: the margin was in points.
    const padding = kept.padding ?? (typeof kept.margin === 'number' ? Math.round(kept.margin * (kept.scale ?? 3)) : DEFAULTS.padding);
    // A motion kept before the steps (`motion`) was a Middle: its steps, or the default.
    // A length kept before the steps (`duration`) was the Middle's.
    const sequence = sequenceOf({ ...(typeof kept.motion === 'string' ? { mid: kept.motion } : {}), ...(typeof kept.duration === 'number' ? { midSeconds: kept.duration } : {}), ...kept.sequence });
    // The glare's edge is crisp: its softness isn't offered (a value kept from when it was goes).
    return { ...DEFAULTS, ...kept, padding, shadowLook: look, shadowPreset: preset, sequence, glareSoftness: DEFAULTS.glareSoftness };
  } catch {
    return DEFAULTS;
  }
}

export function useCapturePrefs(): [CapturePrefs, (patch: Partial<CapturePrefs>) => void] {
  const [prefs, setPrefs] = useState(read);
  const update = (patch: Partial<CapturePrefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Not kept: private mode.
      }
      return next;
    });
  return [prefs, update];
}

/** The background the file gets: none (transparent) or a color; a format without alpha falls back to white. */
export function exportBackground(prefs: CapturePrefs, alpha: boolean): string | null {
  return prefs.background ?? (alpha ? null : '#ffffff');
}

/**
 * The settings a picture is made with. Screen only is the screen alone at its size, a screenshot: no shadow, no
 * fixed size or padding, no background, no crop to preview.
 */
export function effectivePrefs(prefs: CapturePrefs): CapturePrefs {
  return prefs.frame === 'screen' ? { ...prefs, shadow: false, glare: false, crop: 'fit', padding: 0, background: null, cropPreview: false } : prefs;
}

/** A clip is made of the device in 3D only: with Screen only there's nothing to turn, so the export is a picture. */
export const videoOn = (prefs: Pick<CapturePrefs, 'output' | 'frame'>) => prefs.output === 'video' && prefs.frame === 'device';
