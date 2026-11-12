// Background presets for a store screenshot: meshes, glows, shapes and patterns made of CSS gradients (they draw the
// same on the canvas and in the export, at the image's points). Each preset is a recipe: its colors (named, each one
// editable), its parameters (sliders), and, for one with shapes placed around, variants (Shuffle: the same recipe and
// colors, the shapes elsewhere). Its colors start from one base color (the app's primary by default): its neighbors
// on the color wheel, its complement, lighter and darker, so a preset fits any app.
import { t } from '../i18n/ui';

export type PresetId =
  | 'mesh'
  | 'aurora'
  | 'pastel'
  | 'softMesh'
  | 'glow'
  | 'night'
  | 'sunset'
  | 'fade'
  | 'swirl'
  | 'ripples'
  | 'bubbles'
  | 'horizon'
  | 'split'
  | 'stripes'
  | 'dots'
  | 'grid'
  | 'orbs';

export type PresetParams = Record<string, number>;

/** A preset as kept in a screenshot: what isn't set comes from its base color and the recipe's defaults. */
export interface PresetBackground {
  kind: 'preset';
  id: PresetId;
  /** The color its palette is made from. */
  color: string;
  /** Its colors, in the recipe's order, once changed one by one. */
  colors?: string[];
  params?: PresetParams;
  /** A variant: where its shapes go (0: the recipe's own places). */
  seed?: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

function toHsl(hex: string): Hsl {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6}|[0-9a-f]{3})/i)?.[1] ?? '3b5bfd';
  const full = m.length === 3 ? [...m].map((c) => c + c).join('') : m;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

function toHex({ h, s, l }: Hsl): string {
  const [S, L] = [s / 100, l / 100];
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** The base moved around the wheel (`dh`°), at a saturation (null: the base's) and lightness: a color input's hex. */
const tone = (b: Hsl, dh: number, s: number | null, l: number) => toHex({ h: (b.h + dh + 360) % 360, s: clamp(s ?? b.s), l: clamp(l) });

/** A hex color at an opacity. */
function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  return `rgb(${r} ${g} ${b} / ${clamp(a, 0, 1)})`;
}

/** A soft patch: a color fading out from a point. */
const blob = (x: number, y: number, size: number, color: string) => `radial-gradient(circle at ${x}% ${y}%, ${color} 0%, transparent ${size}%)`;
/** A circle with a crisp edge. */
const disc = (x: number, y: number, r: number, color: string) => `radial-gradient(circle at ${x}% ${y}%, ${color} 0 ${r}%, transparent ${r + 0.3}%)`;
/** Film grain over everything (an SVG noise, gray), at an opacity. */
const grain = (a: number) =>
  a > 0
    ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='${a}'/%3E%3C/svg%3E")`
    : null;
const layers = (...l: (string | null)[]) => l.filter(Boolean).join(', ');

/** The same numbers again for the same seed (a variant stays as it was picked). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Where a recipe's shapes go: its own places (no variant), or anywhere in and a little past the image. */
function places(own: [number, number][], seed: number): [number, number][] {
  if (!seed) return own;
  const r = seeded(seed);
  return own.map(() => [Math.round(-10 + r() * 120), Math.round(-10 + r() * 120)]);
}

interface Param {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: '%' | '°' | 'pt' | '×';
}

interface ColorSpec {
  label: string;
  dh: number;
  s: number | null;
  l: number;
  keep?: boolean;
}

interface Recipe {
  id: PresetId;
  name: string;
  /** Each color as made from the base: turned `dh`° on the wheel, at a saturation (null: the base's) and lightness;
   * `keep` for one that stays as it is when a palette is made (a white shine). */
  colors: ColorSpec[];
  params: Param[];
  /** Its shapes can go elsewhere (Shuffle). */
  shuffles?: boolean;
  css: (c: string[], p: PresetParams, seed: number) => string;
}

const GRAIN: Param = { key: 'grain', label: t('Grain'), min: 0, max: 0.4, step: 0.01, value: 0, unit: '%' };
const SPREAD = (value: number): Param => ({ key: 'spread', label: t('Spread'), min: 20, max: 100, step: 1, value, unit: '%' });
const STRENGTH = (value: number): Param => ({ key: 'strength', label: t('Strength'), min: 0, max: 1, step: 0.01, value, unit: '%' });
const ANGLE = (value: number): Param => ({ key: 'angle', label: t('Angle'), min: 0, max: 360, step: 5, value, unit: '°' });
const X = (value: number): Param => ({ key: 'x', label: t('Across'), min: 0, max: 100, step: 1, value, unit: '%' });
const Y = (value: number, max = 100): Param => ({ key: 'y', label: t('Down'), min: 0, max, step: 1, value, unit: '%' });

const RECIPES: Recipe[] = [
  {
    id: 'mesh',
    name: t('Mesh'),
    colors: [
      { label: t('Background'), dh: 0, s: null, l: 50 },
      { label: t('Highlight'), dh: 0, s: null, l: 72 },
      { label: t('Neighbor'), dh: 35, s: null, l: 55 },
      { label: t('Other neighbor'), dh: -40, s: null, l: 55 },
    ],
    params: [SPREAD(55), GRAIN],
    shuffles: true,
    css: (c, p, seed) => {
      const at = places([[15, 10], [90, 30], [20, 90]], seed);
      return layers(grain(p.grain), ...at.map(([x, y], i) => blob(x, y, p.spread, c[i + 1])), c[0]);
    },
  },
  {
    id: 'aurora',
    name: t('Aurora'),
    colors: [
      { label: t('Background'), dh: 10, s: 45, l: 10 },
      { label: t('Highlight'), dh: -60, s: 90, l: 55 },
      { label: t('Second highlight'), dh: 30, s: 90, l: 60 },
      { label: t('Glow'), dh: 0, s: 80, l: 35 },
    ],
    params: [SPREAD(58), STRENGTH(0.8), GRAIN],
    shuffles: true,
    css: (c, p, seed) => {
      const at = places([[20, 0], [80, 10], [50, 100]], seed);
      return layers(grain(p.grain), ...at.map(([x, y], i) => blob(x, y, p.spread, alpha(c[i + 1], p.strength))), c[0]);
    },
  },
  {
    // Nine points in a grid (the top, the middle and the bottom, at each side and the center): the tones vary down
    // as well as across, and every one can be picked.
    id: 'softMesh',
    name: t('Soft mesh'),
    colors: [
      { label: t('Background'), dh: 0, s: 30, l: 98 },
      { label: t('Top left'), dh: 0, s: 90, l: 93 },
      { label: t('Top'), dh: 0, s: 0, l: 100, keep: true },
      { label: t('Top right'), dh: 60, s: 85, l: 94 },
      { label: t('Left'), dh: -40, s: 90, l: 94 },
      { label: t('Center'), dh: 0, s: 20, l: 97 },
      { label: t('Right'), dh: 0, s: 90, l: 93 },
      { label: t('Bottom left'), dh: -170, s: 90, l: 92 },
      { label: t('Bottom'), dh: 60, s: 85, l: 94 },
      { label: t('Bottom right'), dh: 0, s: 0, l: 100, keep: true },
    ],
    params: [SPREAD(42), { ...GRAIN, value: 0.07 }],
    shuffles: true,
    css: (c, p, seed) => {
      const at = places([[0, 2], [50, 2], [100, 2], [0, 50], [50, 50], [100, 50], [0, 98], [50, 98], [100, 98]], seed);
      return layers(grain(p.grain), ...at.map(([x, y], i) => blob(x, y, p.spread, c[i + 1])), c[0]);
    },
  },
  {
    id: 'pastel',
    name: t('Pastel'),
    colors: [
      { label: t('Background'), dh: 0, s: 40, l: 97 },
      { label: t('First'), dh: 0, s: 90, l: 85 },
      { label: t('Second'), dh: 150, s: 80, l: 86 },
      { label: t('Third'), dh: -120, s: 80, l: 87 },
      { label: t('Fourth'), dh: 60, s: 85, l: 88 },
    ],
    params: [SPREAD(55), GRAIN],
    shuffles: true,
    css: (c, p, seed) => {
      const at = places([[0, 0], [100, 15], [10, 100], [100, 95]], seed);
      return layers(grain(p.grain), ...at.map(([x, y], i) => blob(x, y, p.spread, c[i + 1])), c[0]);
    },
  },
  {
    id: 'glow',
    name: t('Glow'),
    colors: [
      { label: t('Background'), dh: 0, s: 60, l: 98 },
      { label: t('Glow'), dh: 0, s: null, l: 70 },
      { label: t('Halo'), dh: 0, s: null, l: 88 },
    ],
    params: [X(50), Y(58), { ...SPREAD(55), label: t('Size') }, STRENGTH(0.55), GRAIN],
    css: (c, p) => layers(grain(p.grain), blob(p.x, p.y, p.spread, alpha(c[1], p.strength)), blob(p.x, p.y, p.spread * 1.55, alpha(c[2], 0.6)), c[0]),
  },
  {
    id: 'night',
    name: t('Night'),
    colors: [
      { label: t('Background'), dh: 0, s: 40, l: 7 },
      { label: t('Spotlight'), dh: 0, s: null, l: 45 },
      { label: t('Accent'), dh: 40, s: null, l: 40 },
    ],
    params: [X(50), { ...SPREAD(65), label: t('Size') }, STRENGTH(0.75), GRAIN],
    css: (c, p) => layers(grain(p.grain), blob(p.x, -5, p.spread, alpha(c[1], p.strength)), blob(100 - p.x / 2, 100, p.spread * 0.7, alpha(c[2], p.strength * 0.6)), c[0]),
  },
  {
    id: 'sunset',
    name: t('Sunset'),
    colors: [
      { label: t('Top'), dh: 180, s: 90, l: 65 },
      { label: t('Middle'), dh: 150, s: 85, l: 60 },
      { label: t('Bottom'), dh: 40, s: null, l: 50 },
      { label: t('Shine'), dh: 0, s: 0, l: 100, keep: true },
    ],
    params: [ANGLE(165), { key: 'middle', label: t('Middle at'), min: 10, max: 90, step: 1, value: 40, unit: '%' }, { ...STRENGTH(0.35), label: t('Shine') }, GRAIN],
    css: (c, p) => layers(grain(p.grain), blob(80, 15, 45, alpha(c[3], p.strength)), `linear-gradient(${p.angle}deg, ${c[0]} 0%, ${c[1]} ${p.middle}%, ${c[2]} 100%)`),
  },
  {
    id: 'fade',
    name: t('Fade'),
    colors: [
      { label: t('From'), dh: 0, s: null, l: 70 },
      { label: t('To'), dh: 30, s: null, l: 42 },
    ],
    params: [ANGLE(180), { key: 'middle', label: t('Halfway at'), min: 5, max: 95, step: 1, value: 50, unit: '%' }, GRAIN],
    css: (c, p) => layers(grain(p.grain), `linear-gradient(${p.angle}deg, ${c[0]}, ${p.middle}%, ${c[1]})`),
  },
  {
    id: 'swirl',
    name: t('Swirl'),
    colors: [
      { label: t('First'), dh: 0, s: null, l: 55 },
      { label: t('Second'), dh: 50, s: null, l: 60 },
      { label: t('Third'), dh: -50, s: null, l: 65 },
    ],
    params: [X(50), Y(45), { ...ANGLE(0), label: t('Turn') }, { key: 'soft', label: t('Softness'), min: 0, max: 100, step: 1, value: 60, unit: '%' }, GRAIN],
    css: (c, p) =>
      layers(grain(p.grain), blob(p.x, p.y, 100, alpha('#ffffff', p.soft / 250)), `conic-gradient(from ${p.angle}deg at ${p.x}% ${p.y}%, ${c[0]}, ${c[1]}, ${c[2]}, ${c[0]})`),
  },
  {
    id: 'ripples',
    name: t('Ripples'),
    colors: [
      { label: t('Background'), dh: 0, s: null, l: 48 },
      { label: t('Center'), dh: 0, s: null, l: 65 },
      { label: t('Rings'), dh: 0, s: 0, l: 100, keep: true },
    ],
    params: [X(50), Y(100, 120), { key: 'ring', label: t('Ring width'), min: 2, max: 25, step: 0.5, value: 9, unit: '%' }, { ...STRENGTH(0.08), max: 0.4, label: t('Rings') }],
    css: (c, p) =>
      layers(`repeating-radial-gradient(circle at ${p.x}% ${p.y}%, transparent 0 ${p.ring}%, ${alpha(c[2], p.strength)} ${p.ring}% ${p.ring * 2}%)`, blob(p.x, p.y, 70, c[1]), c[0]),
  },
  {
    id: 'bubbles',
    name: t('Bubbles'),
    colors: [
      { label: t('Background'), dh: 0, s: 40, l: 97 },
      { label: t('First'), dh: 0, s: 90, l: 80 },
      { label: t('Second'), dh: 150, s: 80, l: 82 },
      { label: t('Third'), dh: 60, s: 85, l: 84 },
      { label: t('Fourth'), dh: -120, s: 80, l: 84 },
    ],
    params: [{ key: 'scale', label: t('Size'), min: 0.4, max: 1.8, step: 0.05, value: 1, unit: '×' }],
    shuffles: true,
    css: (c, p, seed) => {
      const at = places([[0, 8], [100, 40], [5, 78], [95, 100]], seed);
      const r = seed ? seeded(seed + 1) : null;
      const sizes = [30, 24, 18, 34].map((s) => (r ? 14 + r() * 24 : s) * p.scale);
      return layers(...at.map(([x, y], i) => disc(x, y, sizes[i], c[i + 1])), c[0]);
    },
  },
  {
    id: 'orbs',
    name: t('Orbs'),
    colors: [
      { label: t('Background'), dh: 0, s: null, l: 45 },
      { label: t('Orbs'), dh: 0, s: null, l: 70 },
      { label: t('Highlight'), dh: 0, s: 0, l: 100, keep: true },
    ],
    params: [{ key: 'scale', label: t('Size'), min: 0.4, max: 2, step: 0.05, value: 1, unit: '×' }, { ...STRENGTH(0.35), label: t('Shine') }],
    shuffles: true,
    css: (c, p, seed) => {
      const at = places([[85, 12], [12, 40], [80, 70], [25, 95], [55, 35]], seed);
      const sizes = [16, 10, 13, 18, 6];
      // Each orb: lit in its middle, darker to its edge, as a sphere.
      const orb = ([x, y]: [number, number], i: number) => {
        const r = sizes[i] * p.scale;
        const lit = `color-mix(in srgb, ${c[2]} ${Math.round(p.strength * 100)}%, ${c[1]})`;
        return `radial-gradient(circle at ${x}% ${y}%, ${lit} 0, ${c[1]} ${r * 0.7}%, ${c[1]} ${r * 0.97}%, transparent ${r}%)`;
      };
      return layers(...at.map(orb), c[0]);
    },
  },
  {
    id: 'horizon',
    name: t('Horizon'),
    colors: [
      { label: t('Sky'), dh: 0, s: null, l: 48 },
      { label: t('Top glow'), dh: 0, s: null, l: 42 },
      { label: t('Inner circle'), dh: 0, s: null, l: 62 },
      { label: t('Outer circle'), dh: 0, s: null, l: 56 },
    ],
    params: [{ key: 'rise', label: t('Rise'), min: 0, max: 60, step: 1, value: 25, unit: '%' }, { key: 'size', label: t('Size'), min: 30, max: 100, step: 1, value: 62, unit: '%' }],
    css: (c, p) => {
      const y = 150 - p.rise;
      return layers(disc(50, y, p.size, c[2]), disc(50, y, p.size * 1.2, c[3]), blob(50, 0, 60, c[1]), c[0]);
    },
  },
  {
    id: 'split',
    name: t('Split'),
    colors: [
      { label: t('First'), dh: 0, s: null, l: 55 },
      { label: t('Second'), dh: 12, s: null, l: 42 },
    ],
    params: [ANGLE(160), { key: 'at', label: t('Cut at'), min: 10, max: 90, step: 1, value: 52, unit: '%' }, GRAIN],
    css: (c, p) => layers(grain(p.grain), `linear-gradient(${p.angle}deg, ${c[0]} 0 ${p.at}%, ${c[1]} ${p.at}% 100%)`),
  },
  {
    id: 'stripes',
    name: t('Stripes'),
    colors: [
      { label: t('First'), dh: 0, s: null, l: 52 },
      { label: t('Second'), dh: 0, s: null, l: 58 },
    ],
    params: [ANGLE(135), { key: 'width', label: t('Width'), min: 4, max: 120, step: 1, value: 36, unit: 'pt' }],
    css: (c, p) => `repeating-linear-gradient(${p.angle}deg, ${c[0]} 0 ${p.width}px, ${c[1]} ${p.width}px ${p.width * 2}px)`,
  },
  {
    id: 'dots',
    name: t('Dots'),
    colors: [
      { label: t('Background'), dh: 0, s: 40, l: 97 },
      { label: t('Dots'), dh: 0, s: null, l: 75 },
      { label: t('Glow'), dh: 0, s: null, l: 80 },
    ],
    params: [
      { key: 'gap', label: t('Spacing'), min: 8, max: 80, step: 1, value: 22, unit: 'pt' },
      { key: 'dot', label: t('Dot size'), min: 1, max: 20, step: 0.5, value: 2.5, unit: 'pt' },
      STRENGTH(0.7),
    ],
    css: (c, p) =>
      layers(blob(50, 55, 60, alpha(c[2], p.strength)), `radial-gradient(circle, ${c[1]} 0 ${p.dot}px, transparent ${p.dot + 0.5}px) 0 0 / ${p.gap}px ${p.gap}px`, c[0]),
  },
  {
    id: 'grid',
    name: t('Grid'),
    colors: [
      { label: t('Background'), dh: 0, s: 45, l: 9 },
      { label: t('Lines'), dh: 0, s: null, l: 60 },
      { label: t('Glow'), dh: 0, s: null, l: 50 },
    ],
    params: [
      { key: 'gap', label: t('Spacing'), min: 10, max: 120, step: 1, value: 40, unit: 'pt' },
      { key: 'line', label: t('Line width'), min: 0.5, max: 6, step: 0.5, value: 1, unit: 'pt' },
      { ...STRENGTH(0.25), label: t('Lines') },
      { key: 'glow', label: t('Glow'), min: 0, max: 1, step: 0.01, value: 0.6, unit: '%' },
    ],
    css: (c, p) => {
      const line = alpha(c[1], p.strength);
      return layers(
        blob(50, 40, 65, alpha(c[2], p.glow)),
        `linear-gradient(${line} 0 ${p.line}px, transparent ${p.line}px) 0 0 / ${p.gap}px ${p.gap}px`,
        `linear-gradient(90deg, ${line} 0 ${p.line}px, transparent ${p.line}px) 0 0 / ${p.gap}px ${p.gap}px`,
        c[0],
      );
    },
  },
];

const BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
const recipeOf = (id: PresetId) => BY_ID.get(id) ?? RECIPES[0];

/** The presets, in the order they're offered. */
export const PRESETS: { id: PresetId; name: string }[] = RECIPES.map(({ id, name }) => ({ id, name }));

/** What a preset lets change: its colors (named), its parameters, and whether it has variants. */
export function presetControls(id: PresetId): { colors: string[]; params: Param[]; shuffles: boolean } {
  const r = recipeOf(id);
  return { colors: r.colors.map((c) => c.label), params: r.params, shuffles: !!r.shuffles };
}

/** A preset's colors and parameters as drawn: its own where set, else from its base color and the recipe. */
export function resolvePreset(b: PresetBackground): { colors: string[]; params: PresetParams; seed: number } {
  const r = recipeOf(b.id);
  const base = toHsl(b.color);
  const colors = r.colors.map((c, i) => b.colors?.[i] ?? tone(base, c.dh, c.s, c.l));
  const params = Object.fromEntries(r.params.map((p) => [p.key, b.params?.[p.key] ?? p.value]));
  return { colors, params, seed: b.seed ?? 0 };
}

/** A preset as CSS `background`. */
export function presetCss(b: PresetBackground): string {
  const { colors, params, seed } = resolvePreset(b);
  return recipeOf(b.id).css(colors, params, seed);
}

/** A new variant's seed (never 0: that's the recipe's own places). */
export const newSeed = () => 1 + Math.floor(Math.random() * 2 ** 31);

export type PaletteKind = 'shades' | 'analogous';

/** Between `lo` and `hi`. */
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/**
 * A new palette for a preset from its base color, each color keeping its part (a dark background stays dark, a light
 * stays light): `shades`, the base's own hue in other lightness and saturation; `analogous`, its neighbors on the
 * wheel (up to 45° either side). Another one each time.
 */
export function generatePalette(b: PresetBackground, kind: PaletteKind): string[] {
  const base = toHsl(b.color);
  return recipeOf(b.id).colors.map((c) => {
    if (c.keep) return tone(base, c.dh, c.s, c.l);
    const s = (c.s ?? base.s) * between(0.75, 1.1);
    if (kind === 'shades') return tone(base, 0, s, c.l + between(-15, 15));
    const dh = (Math.random() < 0.5 ? -1 : 1) * between(10, 45);
    return tone(base, dh, s, c.l + between(-6, 6));
  });
}

/** Colors made lighter (`by` > 0) or darker, in lightness points. */
export const shiftLightness = (colors: string[], by: number): string[] =>
  colors.map((c) => {
    const h = toHsl(c);
    return toHex({ ...h, l: clamp(h.l + by, 2, 98) });
  });
