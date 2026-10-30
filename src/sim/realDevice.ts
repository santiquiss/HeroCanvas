// The device in hand as a display of the registry: the simulator laid out for the screen it's opened on, at its real
// size, instead of a drawing of a device (SimulatorShell's real mode). A known device (its width, and a height that
// fits it) keeps its traits: the iPhone Duo's column and corner status, a foldable's navigation. Any other screen is
// a plain phone or tablet of its size.
import { ALL_DEVICES as DEVICES, type Device, type DeviceOS, type Display, type SafeArea } from '../devices/devices';

/** URL param: `1` real mode on, `0` off (the designer, on a phone too); unset, it's on where `realByDefault` says. */
export const REAL_PARAM = 'real';
/**
 * URL param: the catalog device whose system real mode draws (`iphone-16-pro`), for a screen that isn't that device (a
 * frame in the designer, as App Store Assets' Interact with the screen): its status bar, home indicator and safe area,
 * as the canvas draws them.
 */
export const SYSTEM_PARAM = 'system';
/**
 * URL param: `1` draws the screen alone, as a screenshot without its device shows it (`screenOnly`): no camera cut into
 * it, square corners.
 */
export const BARE_PARAM = 'bare';

export interface RealViewport {
  /** The window, in CSS px. */
  w: number;
  h: number;
  safe: SafeArea;
}

export type Platform = 'ios' | 'android' | 'other';

/** The system family, from the browser's user agent (an iPad says it's a Mac: it's the one with a touch screen). */
export function platformOf(ua: string, touchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios';
  return /Android/.test(ua) ? 'android' : 'other';
}

/** Widths this close are the same display (a browser may round a width). */
const WIDTH_SLACK = 2;
/** A browser's bars take part of the height: a known display still matches with this much of its height showing. */
const MIN_HEIGHT_SHARE = 0.7;

const familyOf = (os: DeviceOS): Platform => (os === 'android' ? 'android' : 'ios');

/**
 * The registry's display this screen is: the same short side, a long side that fits in it (all of it installed on the
 * home screen, less in a browser with its bars), on the same system. The closest in height when several match.
 */
export function matchDisplay(short: number, long: number, platform: Platform): { device: Device; display: Display } | null {
  let best: { device: Device; display: Display; off: number } | null = null;
  for (const device of DEVICES)
    for (const display of device.displays) {
      if (platform !== 'other' && familyOf(display.os) !== platform) continue;
      if (Math.abs(display.w - short) > WIDTH_SLACK) continue;
      const off = display.h - long;
      if (off < -WIDTH_SLACK || long < display.h * MIN_HEIGHT_SHARE) continue;
      if (!best || off < best.off) best = { device, display, off };
    }
  return best && { device: best.device, display: best.display };
}

/** The device for a screen that isn't in the registry. */
const UNKNOWN: Omit<Device, 'type' | 'displays'> = { id: 'real', name: 'This device' };

/**
 * The screen as a display: its size in portrait, the safe area as reported, no bezel or corners (the device has its
 * own), and whether it's turned. It turns with the device on every page that supports landscape.
 */
export function realDisplay(view: RealViewport, platform: Platform, system?: string | null): { device: Device; display: Display; land: boolean; known: boolean } {
  const land = view.w > view.h;
  const short = Math.min(view.w, view.h);
  const long = Math.max(view.w, view.h);
  // A device named: its display of this width, drawn with its system (not `real`: the device in hand has none here).
  const named = system ? DEVICES.find((d) => d.id === system) : undefined;
  const own = named?.displays.find((x) => Math.abs(x.w - short) <= WIDTH_SLACK);
  if (named && own) return { device: named, display: { ...own, w: short, h: long, r: 0, bez: 0, ends: 0, bodyR: undefined, hinge: undefined }, land, known: true };
  const match = matchDisplay(short, long, platform);
  const size = { w: short, h: long, r: 0, bez: 0, ends: 0, bodyR: undefined, safe: view.safe, real: true };
  if (match) return { device: match.device, display: { ...match.display, ...size, hinge: undefined }, land, known: true };
  const tablet = short >= 600;
  const os: DeviceOS = platform === 'android' ? 'android' : tablet ? 'ipad' : 'ios';
  const display: Display = { key: 'main', label: 'Display', os, rot: tablet, ...size };
  return { device: { ...UNKNOWN, type: tablet ? 'tablet' : 'phone', displays: [display] }, display, land, known: false };
}

/**
 * The safe area of a screen that stays in portrait while the device is turned (a page with no landscape): the insets
 * follow the device. `angle`: screen.orientation's (90: its top is at the window's left; 270: at its right).
 */
export function turnedSafe(safe: SafeArea, angle: number): SafeArea {
  return angle === 270 ? { top: safe.right, right: safe.bottom, bottom: safe.left, left: safe.top } : { top: safe.left, right: safe.top, bottom: safe.right, left: safe.bottom };
}

/**
 * Real mode without asking for it: installed on the home screen (it opens with no browser around it), or a phone's
 * browser, where the designer's own panels don't fit.
 */
export function realByDefault(standalone: boolean, coarse: boolean, short: number): boolean {
  return standalone || (coarse && short < 600);
}
