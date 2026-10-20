// Device registry. Add a device = add one entry here. All sizes are CSS px.

export type DeviceOS = 'ios' | 'android' | 'ipad';

/** Where the app's navigation goes. Default: `bottom` below 600px wide, `rail` (left) from 600. */
export type NavPlacement = 'bottom' | 'rail' | 'column';
export type Edge = 'top' | 'right' | 'bottom' | 'left';
export type Corner = 'tl' | 'tr' | 'br' | 'bl';

export interface Display {
  key: string;
  label: string;
  /** Size in portrait, in points (CSS px). */
  w: number;
  h: number;
  os: DeviceOS;
  /** Screen corner radius. */
  r: number;
  /** Bezel thickness around the screen. */
  bez: number;
  /**
   * More bezel at the screen's two short edges (in portrait, above and below it): the forehead with the earpiece and
   * camera, and the chin with the Home button (`homeButton`). 0 by default.
   */
  ends?: number;
  /** The body's corner radius, when it isn't the screen's plus the bezel (a square screen in a rounded body). */
  bodyR?: number;
  /** The body's thickness in points for Capture's 3D when the device has no model of its own (capture/models). */
  depth?: number;
  /** Punch-hole camera sits on the right instead of centered. */
  camRight?: boolean;
  /** iPhone: what cuts into the top of the screen — the Dynamic Island (default), a notch, or nothing. */
  cutout?: 'island' | 'notch' | 'none';
  /** The Dynamic Island's width in points, when it isn't the 17 Pro's 124 (the 18 Pros' is smaller). */
  islandW?: number;
  /** A Home button below the screen (iPhone SE): no home indicator, and nothing kept clear at the bottom. */
  homeButton?: boolean;
  /** The status bar's height in portrait, when it isn't the OS's usual one (a notch's 47, the SE's 20). */
  statusH?: number;
  /** Layout supports landscape by default. */
  rot?: boolean;
  /**
   * Navigation per orientation, overriding the width default. `column`: vertical controls in a right column
   * (`columnW` wide) with the status at its top (iPhone Duo). Foldable inner displays keep `bottom` in portrait.
   */
  nav?: { portrait?: NavPlacement; landscape?: NavPlacement };
  /** Width of the right column when `nav` is `column`. Content beside it has no right padding. Default 86. */
  columnW?: number;
  /** Force the compact (phone) size class even when 600px+ wide, e.g. a short, wide outer display in landscape. */
  compact?: boolean;
  /**
   * Offers the video layout in portrait (iPhone Duo inner): a 16:9 area across the top (a video playing) and the app
   * in the rest below. Toggled with `?video=1`.
   */
  videoSplit?: boolean;
  /** Side padding of page content. Default 16. */
  padX?: number;
  /** Space between side-by-side panes (list–detail, the split panel, a side column). Default COLUMN_GAP (sim/layout). */
  columnGap?: number;
  /** Hinge along one edge (in portrait) with its own, smaller corner radius. Landscape turns the display clockwise. */
  hinge?: { edge: Edge; r: number };
  /** Always-visible camera in a corner (in portrait), drawn as a circle `inset` from both edges. */
  camera?: { corner: Corner; size: number; inset: number };
  /** iOS 27 corner status (time + ring): vertical at the top of the right column, horizontal in the top-right corner. */
  cornerStatus?: boolean;
  /**
   * The bottom of the safe area when the bars are in the side column (`nav: column`): the system keeps it clear of the
   * screen's corners even with nothing drawn there. Default 0.
   */
  columnSafeBottom?: number;
  /** Width of the detail panel in a landscape split. Default: half the main area. */
  detailW?: number;
  /**
   * The safe area as the device reports it, in the orientation shown (sim/realDevice): it replaces the OS's usual
   * status bar and home indicator heights.
   */
  safe?: SafeArea;
  /**
   * The device in hand (sim/realDevice), not a drawing of one: the system shows its own status, home indicator,
   * camera and keyboard, so the simulator draws none.
   */
  real?: boolean;
}

/** Insets from each edge of the screen, in points. */
export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type DeviceType = 'phone' | 'foldable' | 'tablet';

export interface Device {
  id: string;
  name: string;
  /** Grouping in the all-devices view. */
  type: DeviceType;
  displays: Display[];
}

const D = (
  key: string,
  label: string,
  w: number,
  h: number,
  os: DeviceOS,
  r: number,
  bez: number,
  extra: Partial<Display> = {},
): Display => ({ key, label, w, h, os, r, bez, ...extra });

/** The iPhone 18 Pro and Pro Max's Dynamic Island width (the 17 Pro's is 124): see ip18. */
const ISLAND_18_PRO = 82;

const foldInner: Partial<Display> = { camRight: true, rot: true, nav: { portrait: 'bottom' } };

// Sizes in points. iPhones and iPads from the Xcode 27 simulator's profiles (capabilities.plist: corner radius, Home
// button, Dynamic Island); their safe areas are iOS's. Androids from their panels at their default density (dp).
export const DEVICES: Device[] = [
  // The smallest iPhone still in use: a Home button, a 20pt status bar, square corners. The body is 67.3×138.4 mm
  // around a 375×667 screen (~6.4 pt a mm): ~20 at the sides, ~110 above and below it (the earpiece; the Home button).
  {
    id: 'ipse',
    name: 'iPhone SE',
    type: 'phone',
    displays: [D('main', 'Display', 375, 667, 'ios', 0, 20, { ends: 90, bodyR: 62, cutout: 'none', homeButton: true, statusH: 20 })],
  },
  // The base iPhone: the most common iOS width, a notch (no Dynamic Island).
  { id: 'ip16e', name: 'iPhone 16e', type: 'phone', displays: [D('main', 'Display', 390, 844, 'ios', 47, 12, { cutout: 'notch', statusH: 47 })] },
  { id: 'ip17', name: 'iPhone 17 Pro', type: 'phone', displays: [D('main', 'Display', 402, 874, 'ios', 55, 12)] },
  // The 17 Pro's size and screen (6.3″, 2622×1206 at 3×), in new colors (capture/models). A smaller Dynamic Island:
  // 13.49 mm wide against the 17 Pro's 20.76 mm (reported before launch; Apple gives no size), 82 at the 17 Pro's
  // ~6 points per mm (its 20.76 mm is our 124). Face ID moved under the display.
  { id: 'ip18', name: 'iPhone 18 Pro', type: 'phone', displays: [D('main', 'Display', 402, 874, 'ios', 55, 12, { islandW: ISLAND_18_PRO })] },
  // The largest iPhone.
  { id: 'ip17pm', name: 'iPhone 17 Pro Max', type: 'phone', displays: [D('main', 'Display', 440, 956, 'ios', 62, 12)] },
  // The 17 Pro Max's size and screen, in the 18 Pro's colors and with its smaller Dynamic Island.
  { id: 'ip18pm', name: 'iPhone 18 Pro Max', type: 'phone', displays: [D('main', 'Display', 440, 956, 'ios', 62, 12, { islandW: ISLAND_18_PRO })] },
  // 360 wide: the most common Android width (1080×2340 at 3×).
  { id: 'gs25', name: 'Galaxy S25', type: 'phone', displays: [D('main', 'Display', 360, 780, 'android', 40, 12)] },
  // The best-selling mid-range: 1080×2340 at 2.625× (as its A55 and A54 siblings).
  { id: 'ga56', name: 'Galaxy A56', type: 'phone', displays: [D('main', 'Display', 412, 892, 'android', 36, 13)] },
  // 412 wide, the other usual Android width: 1440×3120 at 3.5×.
  { id: 'gs25u', name: 'Galaxy S25 Ultra', type: 'phone', displays: [D('main', 'Display', 412, 891, 'android', 24, 12)] },
  { id: 'p10', name: 'Pixel 10 Pro', type: 'phone', displays: [D('main', 'Display', 427, 952, 'android', 44, 12)] },
  {
    id: 'zf7',
    name: 'Galaxy Z Fold 7',
    type: 'foldable',
    displays: [
      D('outer', 'Outer 6.5″', 360, 840, 'android', 26, 14),
      D('inner', 'Inner 8″', 656, 728, 'android', 22, 10, foldInner),
    ],
  },
  {
    id: 'zf8',
    name: 'Galaxy Z Fold 8',
    type: 'foldable',
    displays: [
      D('outer', 'Outer 5.5″', 416, 657, 'android', 26, 14),
      D('inner', 'Inner 7.6″', 616, 816, 'android', 22, 10, foldInner),
    ],
  },
  {
    id: 'pf10',
    name: 'Pixel 10 Pro Fold',
    type: 'foldable',
    displays: [
      D('outer', 'Outer 6.4″', 360, 788, 'android', 34, 13),
      D('inner', 'Inner 8″', 692, 717, 'android', 24, 10, foldInner),
    ],
  },
  {
    id: 'pf11',
    name: 'Pixel 11 Pro Fold',
    type: 'foldable',
    displays: [
      D('outer', 'Outer 6.5″', 360, 780, 'android', 34, 13),
      D('inner', 'Inner 8″', 692, 717, 'android', 24, 10, foldInner),
    ],
  },
  {
    // A flip: the inner 6.9″ (1080×2520 at 3×) and the 4.1″ cover screen (948×1048 at 3×), small and nearly square.
    id: 'zflip7',
    name: 'Galaxy Z Flip 7',
    type: 'foldable',
    displays: [
      D('inner', 'Inner 6.9″', 360, 840, 'android', 28, 12),
      D('cover', 'Cover 4.1″', 316, 349, 'android', 36, 14),
    ],
  },
  {
    id: 'ipduo',
    name: 'iPhone Duo',
    type: 'foldable',
    displays: [
      // Sizes and radii from the Xcode 27.2 simulator (iPhone Duo capabilities.plist): outer 466×678 pt, radius 59 / 8 on
      // the hinge side; inner 669×951 pt (2007×2853 px @3x), radius 55.
      // Bars on the side (HIG "vertical controls") on the outer display, and on the inner one in landscape.
      D('outer', 'Outer 5.4″', 466, 678, 'ios', 59, 12, {
        nav: { portrait: 'column', landscape: 'column' },
        compact: true,
        hinge: { edge: 'left', r: 8 },
        camera: { corner: 'tr', size: 28, inset: 21 },
        cornerStatus: true,
        // iOS's safeAreaInsets.bottom on this display, in portrait and in landscape (Xcode 27.1 simulator).
        columnSafeBottom: 34,
      }),
      D('inner', 'Inner 7.6″', 669, 951, 'ipad', 55, 10, {
        rot: true,
        nav: { portrait: 'bottom', landscape: 'column' },
        padX: 24,
        cornerStatus: true,
        detailW: 418,
        videoSplit: true,
      }),
    ],
  },
  // The smallest iPad: between a phone and a tablet (one column next to the rail).
  { id: 'ipadmini', name: 'iPad mini', type: 'tablet', displays: [D('main', 'Display', 744, 1133, 'ipad', 22, 20, { rot: true })] },
  // The best-selling iPad (A16).
  { id: 'ipad', name: 'iPad', type: 'tablet', displays: [D('main', 'Display', 820, 1180, 'ipad', 25, 22, { rot: true })] },
  // The usual Android tablet: 1600×2560 at 2×.
  { id: 'gtabs9', name: 'Galaxy Tab S9', type: 'tablet', displays: [D('main', 'Display', 800, 1280, 'android', 18, 20, { rot: true })] },
  { id: 'ipad11', name: 'iPad Pro 11″', type: 'tablet', displays: [D('main', 'Display', 834, 1210, 'ipad', 26, 22, { rot: true })] },
  { id: 'ipad13', name: 'iPad Pro 13″', type: 'tablet', displays: [D('main', 'Display', 1032, 1376, 'ipad', 26, 22, { rot: true })] },
];

/**
 * Compare's presets (`?compare=`, with `?device=all`): which devices and displays All devices shows, by their type and
 * OS. A new preset is one more entry here; the view bar lists them all.
 */
export interface DeviceGroup {
  id: string;
  label: string;
  has: (device: Device, display: Display) => boolean;
}
export const DEVICE_GROUPS: DeviceGroup[] = [
  { id: 'all', label: 'All devices', has: () => true },
  // iPads too (iPadOS): Apple's devices against Android's.
  { id: 'ios', label: 'iOS', has: (_, x) => x.os !== 'android' },
  { id: 'android', label: 'Android', has: (_, x) => x.os === 'android' },
  { id: 'phones', label: 'Phones', has: (d) => d.type === 'phone' },
  { id: 'foldables', label: 'Foldables', has: (d) => d.type === 'foldable' },
  { id: 'tablets', label: 'Tablets', has: (d) => d.type === 'tablet' },
];
export const deviceGroup = (id: string | null | undefined): DeviceGroup => DEVICE_GROUPS.find((g) => g.id === id) ?? DEVICE_GROUPS[0];

export const DEFAULT_DEVICE = 'ip17';

/**
 * Size class of a display, by its short side (which rotating doesn't change), as apps usually decide it
 * (`shortestSide < 600`): compact for phones and foldable outer displays, regular for tablets and inner displays.
 */
export type SizeClass = 'compact' | 'regular';
export const sizeClass = (d: Display): SizeClass => (Math.min(d.w, d.h) >= 600 ? 'regular' : 'compact');

/** A display's id across the app: `device:display`, e.g. `ipduo:outer`. */
export const displayId = (device: Device, display: Display) => `${device.id}:${display.key}`;

export function findDevice(id: string | null): Device {
  return DEVICES.find((d) => d.id === id) ?? DEVICES.find((d) => d.id === DEFAULT_DEVICE)!;
}

export function findDisplay(device: Device, key: string | null): Display {
  return device.displays.find((x) => x.key === key) ?? device.displays[0];
}
