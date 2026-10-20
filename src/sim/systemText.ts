// The system's accessibility settings for text (Settings › Display & Text Size on iOS, Display size and text on
// Android): the text size a user picked and Bold Text. The device's, whoever uses it: Scenarios' Accessibility section
// sets them (`?textsize=`, `?bold=`), apart from the persona.
//
// What they do here is what an app that follows them looks like: every font size through the system's scale, and each
// line height with its size. Fixed heights and widths don't grow, which is how it shows where a layout breaks.

/** The system family whose steps a display has (an iPad's are iOS's). */
export type TextSystem = 'ios' | 'android';

export interface TextSizeStep {
  id: string;
  /** As the system names it (Dynamic Type's categories; Android shows no names: its percentage). */
  label: string;
  /** What it does to body text. iOS scales every size by it; Android by its curve (`scaleSize`). */
  scale: number;
  /** iOS: one of the five Larger Accessibility Sizes. */
  accessibility?: boolean;
}

/**
 * iOS Dynamic Type: seven sizes, and five more with Larger Accessibility Sizes on. The platform turns a category into the
 * scale of its body size over the default's (17 pt): 14, 15, 16, 17, 19, 21, 23, then 28, 33, 40, 47, 53.
 */
const IOS_BODY: [id: string, label: string, body: number][] = [
  ['xs', 'xSmall', 14],
  ['s', 'Small', 15],
  ['m', 'Medium', 16],
  ['l', 'Large', 17],
  ['xl', 'xLarge', 19],
  ['xxl', 'xxLarge', 21],
  ['xxxl', 'xxxLarge', 23],
  ['ax1', 'AX1', 28],
  ['ax2', 'AX2', 33],
  ['ax3', 'AX3', 40],
  ['ax4', 'AX4', 47],
  ['ax5', 'AX5', 53],
];
const IOS_DEFAULT_BODY = 17;

/**
 * Android's font size slider (Pixel, Android 14+): seven steps up to 200%. From 115% on the scale isn't linear: big
 * text grows less than small text (ANDROID_CURVES).
 * To verify on a device: the steps, and the curves' numbers (written from AOSP's FontScaleConverterFactory).
 */
const ANDROID_SCALES = [0.85, 1, 1.15, 1.3, 1.5, 1.8, 2];

/** Android 14's nonlinear font scaling: what each sp size becomes at a scale, between these points. */
const ANDROID_SP = [8, 10, 12, 14, 18, 20, 24, 30, 100];
const ANDROID_CURVES: Record<number, number[]> = {
  1.15: [9.2, 11.5, 13.8, 16.4, 19.8, 21.8, 25.2, 30, 100],
  1.3: [10.4, 13, 15.6, 18.8, 21.6, 23.6, 26.4, 30, 100],
  1.5: [12, 15, 18, 22, 24, 26, 28, 30, 100],
  1.8: [14.4, 18, 21.6, 24.4, 27.6, 30.8, 32.8, 34.8, 100],
  2: [16, 20, 24, 26, 30, 34, 36, 38, 100],
};

export const TEXT_SIZES: Record<TextSystem, TextSizeStep[]> = {
  ios: IOS_BODY.map(([id, label, body]) => ({ id, label, scale: body / IOS_DEFAULT_BODY, ...(body > 23 ? { accessibility: true } : {}) })),
  android: ANDROID_SCALES.map((scale) => ({ id: `a${Math.round(scale * 100)}`, label: `${Math.round(scale * 100)}%`, scale })),
};

/** The size nobody changed: iOS's Large. On Android it's 100% (`textSizeFor`). */
export const DEFAULT_TEXT_SIZE = 'l';

export const textSystemOf = (os: 'ios' | 'android' | 'ipad'): TextSystem => (os === 'android' ? 'android' : 'ios');

const ALL_STEPS = [...TEXT_SIZES.ios, ...TEXT_SIZES.android];

export const isTextSize = (id: string | null): id is string => !!id && ALL_STEPS.some((s) => s.id === id);

/**
 * A text size on a system: its own step, or — a size of the other system's (a persona's, on another device) — the
 * step that does the closest to body text.
 */
export function textSizeFor(system: TextSystem, id: string): TextSizeStep {
  const steps = TEXT_SIZES[system];
  const own = steps.find((s) => s.id === id);
  if (own) return own;
  const scale = ALL_STEPS.find((s) => s.id === id)?.scale ?? 1;
  return steps.reduce((best, s) => (Math.abs(s.scale - scale) < Math.abs(best.scale - scale) ? s : best));
}

/** A font size (px) at a text size: iOS's scale times it; Android's curve for it from 115% on. */
export function scaleSize(system: TextSystem, step: TextSizeStep, px: number): number {
  const curve = system === 'android' ? ANDROID_CURVES[step.scale] : undefined;
  if (!curve) return px * step.scale;
  // Under the first point and over the last, the nearest segment's slope.
  let i = ANDROID_SP.findIndex((sp) => px <= sp);
  i = i < 0 ? ANDROID_SP.length - 1 : Math.max(1, i);
  const [a, b] = [ANDROID_SP[i - 1], ANDROID_SP[i]];
  return curve[i - 1] + ((px - a) / (b - a)) * (curve[i] - curve[i - 1]);
}

/** The heaviest weight the app's font is loaded in. */
const MAX_WEIGHT = 800;

/** Bold Text: every weight one step heavier (regular reads medium, medium semibold…), up to the font's heaviest. */
export const boldWeight = (weight: number): number => Math.min(MAX_WEIGHT, weight + 100);

// ---------------------------------------------------------------- The settings in use

/** Simulator params (kept across navigation, like the device and the theme): the text size's step, Bold Text on. */
export const ACCESSIBILITY_PARAMS = { textSize: 'textsize', bold: 'bold' } as const;

export interface Accessibility {
  /** A step of either system (`textSizeFor` gives the device's). */
  textSize: string;
  boldText: boolean;
}

/** The settings a query sets; what it doesn't set, or sets to something unknown, is the system's default. */
export function accessibilityIn(get: (param: string) => string | null): Accessibility {
  const size = get(ACCESSIBILITY_PARAMS.textSize);
  return { textSize: isTextSize(size) ? size : DEFAULT_TEXT_SIZE, boldText: get(ACCESSIBILITY_PARAMS.bold) === 'on' };
}
