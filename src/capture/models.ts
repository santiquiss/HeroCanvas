// Each device's body for Capture's 3D: its size and thickness in mm, the buttons on its sides and its colors. Sizes
// from the makers' spec sheets (a foldable's per display: folded behind the outer one, open behind the inner one);
// button places measured off product photos, so approximate. Colors: the finishes each one is sold in, by their names.

/** A button on a side, in portrait: which edge, where it starts (mm from the top, or from the left on the top and bottom edges), how long. */
export interface SideButton {
  edge: 'left' | 'right' | 'top' | 'bottom';
  at: number;
  len: number;
  /** A closed foldable: the half it's on, the outer display's (`front`, default) or the other. */
  half?: 'front' | 'back';
}

export interface Finish {
  name: string;
  color: string;
}

/**
 * How the sides meet the face and the back: `round` all curve (iPhone 6 to 8, the SE), `soft` a flat band with
 * rounded edges (iPhone 17 Pro, Pixel), `flat` a flat band with crisp edges (iPhone 12 to 16, Galaxy, iPads).
 */
export type EdgeStyle = 'round' | 'soft' | 'flat';

/** A body behind one display, in portrait, in mm. */
export interface BodySpec {
  w: number;
  h: number;
  depth: number;
  buttons: SideButton[];
  /** Default `flat`. */
  edge?: EdgeStyle;
  /** The charging port: USB-C (8.4 × 2.6 mm) in the middle of the bottom unless set; `w: 0` for none. */
  port?: Port;
  /**
   * A foldable's fold. Closed (behind an outer display): the side its hinge is on (the spine; the seam between the
   * halves runs around the rest). Open (behind an inner one): which way the fold runs, for the gap where the halves
   * meet on the two sides it crosses (the screen shows no crease).
   */
  fold?: {
    hinge?: 'left' | 'right' | 'top' | 'bottom';
    /** The hinge's cover: a round `barrel` (default) or a `flat` polished plate the whole side (iPhone Duo). */
    spine?: 'barrel' | 'flat';
    crease?: 'vertical' | 'horizontal';
  };
}

/** A port on an edge (default bottom), `at` mm from its middle (right or down), `w` × `h` mm. */
export interface Port {
  edge?: 'bottom' | 'top' | 'left' | 'right';
  /** A closed foldable: the half it's on, the outer display's (`front`, default) or the other. */
  half?: 'front' | 'back';
  at?: number;
  w: number;
  h: number;
}

export interface DeviceModel {
  finishes: Finish[];
  /** How its metal looks by default (Capture's Metallic and Grain, 0–1): 0.5 each unless set. */
  metal?: number;
  grain?: number;
  /** By display key; `main` for a device with one. */
  bodies: Record<string, BodySpec>;
}

// The SE's port is Lightning (7.6 × 1.8 mm); the rest USB-C.
const b = (edge: SideButton['edge'], at: number, len: number): SideButton => ({ edge, at, len });

// The iPhones' left side: Action button (or the SE's ring switch), volume up and down; the right: the side button,
// and the 17 Pros' Camera Control lower down.
const IPHONE_17_PRO: BodySpec['buttons'] = [b('left', 24, 7), b('left', 36, 12), b('left', 51, 12), b('right', 38, 20), b('right', 93, 19)];
const IPHONE_17_PRO_FINISHES: Finish[] = [
  { name: 'Cosmic Orange', color: '#d8682b' },
  { name: 'Deep Blue', color: '#2f3b55' },
  { name: 'Silver', color: '#dcdcd8' },
];
const IPHONE_PRO_MAX: BodySpec['buttons'] = [b('left', 26, 7), b('left', 39, 12), b('left', 54, 12), b('right', 41, 21), b('right', 101, 20)];
const IPHONE_18_PRO_FINISHES: Finish[] = [
  { name: 'Black', color: '#2b2c2e' },
  { name: 'Silver', color: '#dcdcd8' },
  { name: 'Glacier', color: '#c9d7df' },
  { name: 'Burgundy', color: '#5e1f2c' },
];
const FOLD_FINISHES: Finish[] = [
  { name: 'Blue Shadow', color: '#2d3a56' },
  { name: 'Silver Shadow', color: '#c0c1c4' },
  { name: 'Jetblack', color: '#1c1c1e' },
];
const PIXEL_FINISHES: Finish[] = [
  { name: 'Moonstone', color: '#6f7f90' },
  { name: 'Jade', color: '#bcd5c3' },
  { name: 'Obsidian', color: '#2a2a2b' },
];
const IPAD_PRO_FINISHES: Finish[] = [
  { name: 'Space Black', color: '#2f2f31' },
  { name: 'Silver', color: '#dedfdd' },
];
// Androids: volume above the power key on the right.
const androidKeys = (vol: number, volLen: number, power: number, powerLen = 12) => [b('right', vol, volLen), b('right', power, powerLen)];

export const DEVICE_MODELS: Record<string, DeviceModel> = {
  ipse: {
    finishes: [
      { name: 'Midnight', color: '#232a31' },
      { name: 'Starlight', color: '#f0e9e1' },
      { name: '(PRODUCT)RED', color: '#ba0c2f' },
    ],
    bodies: { main: { w: 67.3, h: 138.4, depth: 7.3, edge: 'round', port: { w: 7.6, h: 1.8 }, buttons: [b('left', 17, 5), b('left', 29, 10), b('left', 43, 10), b('right', 30, 11)] } },
  },
  ip16e: {
    finishes: [
      { name: 'Black', color: '#2c2c2e' },
      { name: 'White', color: '#f2f2ee' },
    ],
    bodies: { main: { w: 71.5, h: 146.7, depth: 7.8, buttons: [b('left', 23, 7), b('left', 35, 12), b('left', 50, 12), b('right', 38, 18)] } },
  },
  ip17: { finishes: IPHONE_17_PRO_FINISHES, bodies: { main: { w: 71.9, h: 150, depth: 8.75, edge: 'soft', buttons: IPHONE_17_PRO } } },
  // Apple's 18 Pro and Pro Max: the 17 Pros' bodies (71.9 × 150 and 78 × 163.4, 8.75 mm) and keys, four new colors.
  ip18: { finishes: IPHONE_18_PRO_FINISHES, bodies: { main: { w: 71.9, h: 150, depth: 8.75, edge: 'soft', buttons: IPHONE_17_PRO } } },
  ip17pm: { finishes: IPHONE_17_PRO_FINISHES, bodies: { main: { w: 78, h: 163.4, depth: 8.75, edge: 'soft', buttons: IPHONE_PRO_MAX } } },
  ip18pm: { finishes: IPHONE_18_PRO_FINISHES, bodies: { main: { w: 78, h: 163.4, depth: 8.75, edge: 'soft', buttons: IPHONE_PRO_MAX } } },
  gs25: {
    finishes: [
      { name: 'Navy', color: '#2b3550' },
      { name: 'Icyblue', color: '#bcd0e3' },
      { name: 'Mint', color: '#c6dfd0' },
      { name: 'Silver Shadow', color: '#bfc0c3' },
    ],
    bodies: { main: { w: 70.5, h: 146.9, depth: 7.2, buttons: androidKeys(28, 22, 55) } },
  },
  ga56: {
    finishes: [
      { name: 'Awesome Graphite', color: '#3b3b3d' },
      { name: 'Awesome Lightgray', color: '#d5d5d2' },
      { name: 'Awesome Olive', color: '#7d8463' },
      { name: 'Awesome Pink', color: '#e9c3c9' },
    ],
    bodies: { main: { w: 77.5, h: 162.2, depth: 7.4, buttons: androidKeys(33, 22, 58) } },
  },
  gs25u: {
    finishes: [
      { name: 'Titanium Silverblue', color: '#9fb0c3' },
      { name: 'Titanium Black', color: '#303133' },
      { name: 'Titanium Gray', color: '#8a8884' },
      { name: 'Titanium Whitesilver', color: '#dcdbd6' },
    ],
    bodies: { main: { w: 77.6, h: 162.8, depth: 8.2, buttons: androidKeys(30, 25, 60, 14) } },
  },
  p10: {
    finishes: [{ name: 'Obsidian', color: '#2a2a2b' }, { name: 'Porcelain', color: '#e8e2d8' }, ...PIXEL_FINISHES.slice(0, 2)],
    // The Pixel's power key above the volume.
    bodies: { main: { w: 72, h: 152.8, depth: 8.6, edge: 'soft', buttons: [b('right', 32, 13), b('right', 50, 22)] } },
  },
  // Book foldables, closed: the hinge on the left of the outer display, the keys on the right (Samsung: volume above
  // the power key; Pixel: power above volume), keys and USB-C on the cover's half (the front one). Open: the crease down the middle, the
  // keys on the right half's edge, USB-C under that half.
  zf7: {
    finishes: FOLD_FINISHES,
    bodies: {
      // The keys about halfway down the side.
      outer: { w: 72.8, h: 158.4, depth: 8.9, fold: { hinge: 'left' }, buttons: androidKeys(58, 18, 80, 14) },
      inner: { w: 143.2, h: 158.4, depth: 4.2, fold: { crease: 'vertical' }, port: { at: 35.8, w: 8.4, h: 2.6 }, buttons: androidKeys(58, 18, 80, 14) },
    },
  },
  // The wide Fold 8 (123.9 × 81.9 × 9.7 mm folded, 161.4 wide open): its keys near the top corner. Open it's wider
  // than tall, and the simulator shows that display turned (portrait), the device turned left: the crease across,
  // the keys on the top edge, the port on the right.
  zf8: {
    finishes: FOLD_FINISHES,
    bodies: {
      outer: { w: 81.9, h: 123.9, depth: 9.7, fold: { hinge: 'left' }, buttons: androidKeys(16, 16, 35, 12) },
      inner: {
        w: 123.9,
        h: 161.4,
        depth: 4.5,
        fold: { crease: 'horizontal' },
        port: { edge: 'right', at: -40.4, w: 8.4, h: 2.6 },
        buttons: [b('top', 16, 16), b('top', 35, 12)],
      },
    },
  },
  pf10: {
    finishes: PIXEL_FINISHES,
    bodies: {
      outer: { w: 76.3, h: 155.2, depth: 10.8, fold: { hinge: 'left' }, buttons: [b('right', 30, 13), b('right', 48, 22)] },
      inner: { w: 150.4, h: 155.2, depth: 5.2, fold: { crease: 'vertical' }, port: { at: 37.6, w: 8.4, h: 2.6 }, buttons: [b('right', 30, 13), b('right', 48, 22)] },
    },
  },
  pf11: {
    finishes: PIXEL_FINISHES,
    bodies: {
      outer: { w: 76, h: 155.2, depth: 10.1, fold: { hinge: 'left' }, buttons: [b('right', 30, 13), b('right', 48, 22)] },
      inner: { w: 150.4, h: 155.2, depth: 5, fold: { crease: 'vertical' }, port: { at: 37.6, w: 8.4, h: 2.6 }, buttons: [b('right', 30, 13), b('right', 48, 22)] },
    },
  },
  // Open, the keys are on the top half's right edge (volume above power) and the crease across the middle. Folded,
  // the cover is on that half's back, upright with the hinge below it: the half turned over, so the keys are on the
  // left (volume higher, further from the hinge) on the cover's half, and the port, on the other half's bottom, at
  // the top of the back half.
  zflip7: {
    finishes: [FOLD_FINISHES[0], FOLD_FINISHES[2], { name: 'Coralred', color: '#d65a4c' }],
    bodies: {
      inner: { w: 75.2, h: 166.7, depth: 6.5, fold: { crease: 'horizontal' }, buttons: androidKeys(45, 15, 63, 12) },
      cover: {
        w: 75.2,
        h: 85.5,
        depth: 14.1,
        fold: { hinge: 'bottom' },
        port: { edge: 'top', half: 'back', w: 8.4, h: 2.6 },
        buttons: [b('left', 47, 15), b('left', 66, 12)],
      },
    },
  },
  // iPhone Duo (117.8 × 84.1 × 11.3 mm closed, 5.2 open): volume on the top edge, the Touch ID side button on the
  // right with Camera Control under it, the hinge on the left under a flat polished titanium cover. Open it's wider than tall and the simulator shows it
  // turned (portrait), the device turned left: the crease across, volume on the left edge, the side button and
  // Camera Control on the top, the port on the right.
  // Polished titanium: more mirror, little grain.
  ipduo: {
    metal: 0.8,
    grain: 0.1,
    finishes: [
      { name: 'Silver', color: '#dcdcd8' },
      { name: 'Space Black', color: '#2c2c2e' },
    ],
    bodies: {
      // Closed, its keys are on the back half, not the outer display's.
      outer: {
        w: 84.1,
        h: 117.8,
        depth: 11.3,
        fold: { hinge: 'left', spine: 'flat' },
        buttons: [b('top', 50, 10), b('top', 62, 10), b('right', 20, 16), b('right', 44, 15)].map((k) => ({ ...k, half: 'back' as const })),
      },
      inner: {
        w: 117.8,
        h: 168.2,
        depth: 5.2,
        fold: { crease: 'horizontal' },
        port: { edge: 'right', at: -42, w: 8.4, h: 2.6 },
        buttons: [b('left', 12, 10), b('left', 24, 10), b('top', 20, 16), b('top', 44, 15)],
      },
    },
  },
  // iPads: the top button near the top edge's right end; volume on the right side near the top (the mini's on top).
  ipadmini: {
    finishes: [
      { name: 'Space Gray', color: '#6d6e72' },
      { name: 'Blue', color: '#9fb4cc' },
      { name: 'Purple', color: '#c4b4d4' },
      { name: 'Starlight', color: '#e6e0d6' },
    ],
    bodies: { main: { w: 134.8, h: 195.4, depth: 6.3, buttons: [b('top', 80, 12), b('top', 94, 12), b('top', 110, 13)] } },
  },
  ipad: {
    finishes: [
      { name: 'Blue', color: '#8db0d6' },
      { name: 'Pink', color: '#e5b3c0' },
      { name: 'Yellow', color: '#f0d873' },
      { name: 'Silver', color: '#dfe0e1' },
    ],
    bodies: { main: { w: 179.5, h: 248.6, depth: 7, buttons: [b('top', 152, 13), b('right', 15, 15), b('right', 33, 15)] } },
  },
  gtabs9: {
    finishes: [
      { name: 'Graphite', color: '#47484a' },
      { name: 'Beige', color: '#e3d8c6' },
    ],
    bodies: { main: { w: 165.8, h: 254.3, depth: 5.9, buttons: [b('right', 20, 14), b('right', 40, 22)] } },
  },
  ipad11: {
    finishes: IPAD_PRO_FINISHES,
    bodies: { main: { w: 177.5, h: 249.7, depth: 5.3, buttons: [b('top', 150, 13), b('right', 15, 15), b('right', 33, 15)] } },
  },
  ipad13: {
    finishes: IPAD_PRO_FINISHES,
    bodies: { main: { w: 215.5, h: 281.6, depth: 5.1, buttons: [b('top', 185, 13), b('right', 15, 15), b('right', 33, 15)] } },
  },
};

/** A device's model, or a plain one (a phone's thickness, no keys, black) for a device without its own. */
export function modelOf(deviceId: string): DeviceModel {
  return DEVICE_MODELS[deviceId] ?? { finishes: [{ name: 'Black', color: '#1f2226' }], bodies: {} };
}

/** The body behind a display: its own, or the device's first. */
export function bodyOf(deviceId: string, displayKey: string): BodySpec | undefined {
  const { bodies } = modelOf(deviceId);
  return bodies[displayKey] ?? Object.values(bodies)[0];
}
