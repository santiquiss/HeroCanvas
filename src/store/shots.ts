// The screenshots of each store size, each a small artboard: a background and its layers (the prototype's screens on
// devices, texts, images, shapes), drawn back to front. The team's file, app/store-assets.json: the dev server writes it
// as they're made (npm run dev), and a deployed site shows it as it was committed, to look at, comment and export.
import type { PresetBackground } from './backgrounds';
import { useMemo, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';
import { canWrite, writeJson } from '../persist/devApi';
import { t } from '../i18n/ui';
import type { PageRef } from '../nav/types';
import type { Shadow } from '../capture/exportImage';
import type { ShadowPreset } from '../capture/prefs';
import type { Lighting } from '../capture/scene';

export type Background =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string; angle: number }
  /** A preset (backgrounds.ts): its recipe, from one base color, with its own colors and parameters. */
  | PresetBackground;

/** Which of a layer's points keeps its place on every size, across and down (Figma's constraints). */
export type AnchorX = 'left' | 'center' | 'right';
export type AnchorY = 'top' | 'center' | 'bottom';

/**
 * Centered means centered on the image (Figma's Center): a layer off the middle is held by the edge on its half, so
 * moving one that's centered picks that edge, keeping it where it's left.
 */
export function anchorsFor(from: Pick<Placed, 'ax' | 'ay'>, cx: number, cy: number): { ax?: AnchorX; ay?: AnchorY } {
  const off = (c: number) => Math.abs(c - 0.5) > 1e-4;
  return {
    ax: from.ax && from.ax !== 'center' ? from.ax : off(cx) ? (cx < 0.5 ? 'left' : 'right') : undefined,
    ay: from.ay && from.ay !== 'center' ? from.ay : off(cy) ? (cy < 0.5 ? 'top' : 'bottom') : undefined,
  };
}

/** An anchor as a side: -1 the left or top edge, 0 the center, 1 the right or bottom edge. */
export const anchorSide = (a?: AnchorX | AnchorY): -1 | 0 | 1 => (a === 'left' || a === 'top' ? -1 : a === 'right' || a === 'bottom' ? 1 : 0);

/**
 * Where a layer sits: its anchor's point (its center unless `ax` / `ay` say an edge) as shares of the image's width and
 * height, its width as a share of the image's.
 */
interface Placed {
  id: string;
  /** Its name in the layers list (default: from its kind and content). */
  name?: string;
  hidden?: boolean;
  x: number;
  y: number;
  /**
   * Its width: a share of the image's (`%`, the default), or points with `wUnit: 'pt'` (the breakpoint's reference
   * size's: ptScale). `drawn`: a share already as drawn on an image (inShares'), not to fit again; never saved.
   */
  w: number;
  wUnit?: 'pt' | '%' | 'drawn';
  /** A device's or shape's `h` in points instead of a share of the image's height. */
  hUnit?: 'pt' | '%';
  /**
   * Which of its sides is set, the other following its proportions (a device, an image, a component): `h`, its height a
   * share of the image's on every size (the default), or `w`, its width, the layout's fit included on a shorter size.
   */
  lead?: 'w' | 'h';
  /** Its turn, in degrees. */
  rotate: number;
  /**
   * Past its image's left or right edge, it goes on in the screenshot beside it (one element across two); off, it's cut
   * at its own edge. The same on every size.
   */
  extend?: boolean;
  /** Its constraints: the point `x` and `y` place (default: its center). An image of another size keeps that point's. */
  ax?: AnchorX;
  ay?: AnchorY;
  /**
   * What one store size has of its own (by its id: `appstore.ipad13`) over the layer's values, which are the
   * reference's (REFERENCE_SIZE): a fine adjustment for that device alone.
   */
  sizes?: Record<string, LayerOverride>;
}

/**
 * The reference size every other is laid out from: the iPhone 6.3″ (402 × 874 points). A layer's points (a text's size,
 * a width or height in `pt`) are this size's: on another they scale with its width, so every size keeps the
 * reference's proportions (a wider phone's title as much of its width), tablets too.
 */
export const REFERENCE = { w: 402, h: 874 };
/** The reference's store size: what's drawn there is every layer's own values; the others start from them. */
export const REFERENCE_SIZE = 'appstore.iphone63';

/**
 * How much the layout shrinks on an image shorter than the reference (for its width): every layer's size by as much,
 * its place kept, so the reference's layout fits in the height (the 5.5″ iPhone, the Duo, an iPad) with more room at
 * the sides, instead of its pieces piling up. 1 on the reference's shape or a taller one.
 */
export const fitScale = (image: { w: number; h: number }) => Math.min(1, image.h / image.w / (REFERENCE.h / REFERENCE.w));

/** How much a layer's points grow on this image: 1 on the reference (its width, and the fit). */
export const ptScale = (image: { w: number; h: number }) => (image.w / REFERENCE.w) * fitScale(image);

/**
 * What a layer can have of its own on a store size: nearly anything (its place and size, a text's size, weight or color,
 * a device's angle, fade or shadow…), all but what it is and shows (SAME_EVERYWHERE). `null`: unset there (off, its default),
 * over a value the layer has.
 */
export type LayerOverride = {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  wUnit?: 'pt' | '%';
  hUnit?: 'pt' | '%';
  ax?: AnchorX;
  ay?: AnchorY;
  rotate?: number;
  size?: number;
  hidden?: boolean;
  fade?: DeviceFade | null;
} & { [key: string]: unknown };
/** What a layer is and shows: the same on every size (its text, its image, its screen, its component and story). */
export const SAME_EVERYWHERE = new Set<string>(['id', 'kind', 'name', 'text', 'src', 'page', 'query', 'taps', 'scroll', 'replace', 'recolor', 'component', 'story', 'args', 'children', 'sizes', 'lead', 'extend']);
const DEFAULTS: Record<string, unknown> = { ax: 'center', ay: 'center', wUnit: '%', hUnit: '%', hidden: false };

/** One of the prototype's screens, on its device (framed) or alone with its corners. */
/**
 * A device fading toward an edge (the bottom, the top, or both), as shares of its height from that edge: it starts
 * `size` from it and is all the way faded (`fade`: 1 gone) `gone` from it (0: at the edge itself), so the fade can be
 * quick, ending well before the edge. Blurred over the same stretch, `blur` (points of an image 440 wide) at its end.
 * Fade, blur or both.
 */
export interface DeviceFade {
  edge: 'bottom' | 'top' | 'both';
  size: number;
  gone?: number;
  fade: number;
  blur: number;
  /**
   * What fades: the whole device (default), or its screen alone, into the screen's page background, the frame kept
   * whole: a framed screen scrolled to what's below, the rest of the page out of sight. Shares of the screen's height.
   */
  on?: 'device' | 'screen';
}

export interface DeviceLayer extends Placed {
  kind: 'device';
  fade?: DeviceFade;
  page: PageRef;
  /** The prototype's query when it was added (its scenario: persona, theme, state params). */
  query: string;
  frame: boolean;
  /** Unframed: a glass slab around the screen instead of a device (a frosted phone), as a component's glass. */
  glass?: Glass;
  /** The catalog device it's drawn as (one with a display of the size's): its frame, its body, its finishes. */
  model?: string;
  /** Its body's color (`#rrggbb`): one of the model's finishes. */
  finish?: string;
  /**
   * Words its screen shows put another way, for this screenshot alone (the app's screen stays as it is): each text
   * that reads `from` reads `to`. By language; a language without its own takes the base one's.
   */
  replace?: Record<string, { from: string; to: string }[]>;
  /**
   * Colors its screen paints put another way, for this screenshot alone (store/recolor): each fill, stroke, text or
   * background painted `from` is painted `to`. The same in every language.
   */
  recolor?: { from: string; to: string }[];
  /**
   * How its model is drawn: as it is (its finish, its bezel; default), or minimal: the same model (its size, status
   * bar and island) in one color, matte, like clay, for a screenshot that shows the screen, not the hardware.
   */
  look?: 'device' | 'minimal';
  /** A minimal device's color (`#rrggbb`, default white): its frame, its edge and its sides, all one, as clay. */
  minimalColor?: string;
  /** Its shadow, as Capture's presets (default: medium; none for a screen filling the image); `custom`: `shadowLook`. */
  shadow?: ShadowPreset;
  shadowLook?: Shadow;
  /** The screen's light or dark (default: light), whatever the designer's is. */
  theme?: 'light' | 'dark';
  /** The scene's light, as Capture's (where from, brightness, shine, the metal's look). Default: Capture's. */
  light?: Lighting;
  /** The glass's glare (Capture's): on, the lightbox above or below, how strong (0–1). */
  glare?: boolean;
  glareSide?: 'top' | 'bottom';
  glareStrength?: number;
  /** Its 3D turn, in degrees (x: top away, y: right side away); the body shows while it's turned. */
  tilt?: { x: number; y: number };
  /** How far its lists are scrolled (each by its place among the screen's scrollers), set in Interact with the screen. */
  scroll?: ScrollAt[];
  /**
   * The taps that left something open on the page (a menu, a sheet, a tile), in order: replayed when it's drawn. Taps
   * that changed the URL aren't here (the page and query keep them).
   */
  taps?: Tap[];
  /**
   * Its box's height as a share of the image's, set with its size: on every store size it's drawn as large as fits both
   * `w` and `h` (a wider, shorter image draws it narrower, so it keeps its room above and below). Unset: by `w` alone.
   */
  h?: number;
}

/**
 * What was tapped, found again by what it is (the same on every size and device, where its place in the tree isn't):
 * the control's tag, its label (aria-label or its text), and which of the screen's controls with both it was.
 */
export interface Tap {
  tag: string;
  label: string;
  n: number;
}

export interface ScrollAt {
  i: number;
  top: number;
  left: number;
}

export interface TextLayer extends Placed {
  kind: 'text';
  /** By language; a language without its own shows the base one's. */
  text: Record<string, string>;
  /** In points, the same on every size (a title reads at the same size on each device). */
  size: number;
  weight: 400 | 500 | 600 | 700 | 800;
  color: string;
  align: 'left' | 'center' | 'right';
  /** The app's own typeface (default), the system's, a serif, or a Google Fonts family (`family`). */
  font?: 'app' | 'system' | 'serif' | 'google';
  /** With `font: 'google'`: the family's name as Google Fonts lists it (`Nunito`), loaded when it's drawn. */
  family?: string;
  italic?: boolean;
  /** Its letters' spacing, in ems (default -0.01: a title's). */
  tracking?: number;
  /** Its lines' height, a share of its size (default 1.12). */
  leading?: number;
  /**
   * The words written between asterisks (`REACH YOUR *GOAL*`) drawn in this look instead: a title's accent, kept on
   * the same words in every language.
   */
  accent?: TextAccent;
  /** An icon before its words, by name (as `<Icon>`: a Material Symbol, or `sf:<name>`), at the text's size. */
  icon?: string;
  /** The icon's own color (default: the text's). */
  iconColor?: string;
  /** A box behind it, hugging its words: a label or a pill. Its corners and padding in ems of its size. */
  box?: TextBox;
  /** A glass pill behind it instead of a box (as a component's). */
  glass?: Glass;
  /** Its box's or glass's shadow, as a device's (default: none), lifting a pill off what's behind it. */
  shadow?: ShadowPreset;
  /**
   * Its width is its words' (on one line, with its icon and its box), in each language and size: `w` is set aside.
   * What lays it out, aligns and snaps it sees that width.
   */
  hug?: boolean;
}

export interface TextBox {
  fill: string;
  radius: number;
  padX: number;
  padY: number;
  /** Blurs what's behind it (frosted glass), in points. */
  blur?: number;
  /** As wide as the layer, not hugging its words: cards in a list, all of one width. */
  wide?: boolean;
  /** A thin edge around it (a glass's highlight): its color. */
  stroke?: string;
  /** A band of light frosted glass around it, in points, outside its fill (Glass.rim). */
  rim?: number;
}

export interface TextAccent {
  color: string;
  weight?: TextLayer['weight'];
  italic?: boolean;
  /** A Google Fonts family of their own (as TextLayer.family): a serif italic phrase in a sans headline. */
  family?: string;
  /** A color behind the words: a block around them (rounded), or a marker's stroke under their lower part. */
  fill?: string;
  fillStyle?: 'block' | 'marker';
}

/** A picture added to the project (public/assets/store/…), as wide as `w`, its own proportions. */
export interface ImageLayer extends Placed {
  kind: 'image';
  src: string;
  /** Mirrored, left to right. */
  flip?: boolean;
}

/**
 * One of the app's components, drawn live from one of its gallery stories (its args over the story's): a card or a
 * chip floating beside a device, in the app's look and the screenshot's language, as the app draws it today.
 */
export interface ComponentLayer extends Placed {
  kind: 'component';
  /** Its stories' component (StoryModule.component). */
  component: string;
  story: string;
  /** Args over the story's. */
  args?: Record<string, unknown>;
  /** Args by language, over `args` (a text it shows, in the screenshot's language). */
  argsIn?: Record<string, Record<string, unknown>>;
  /** Words it shows put another way, for this screenshot alone, by language: as a device's (DeviceLayer.replace). */
  replace?: Record<string, { from: string; to: string }[]>;
  /** The width it's laid out at, in its own points (as on a phone): drawn scaled to the layer's width. */
  frameW: number;
  theme?: 'light' | 'dark';
  /** Its shadow, as a device's (default: none). */
  shadow?: ShadowPreset;
  /**
   * A card behind it, for a component the app draws on a surface it doesn't have here (a tile on its card): its
   * corners and padding in the component's own points.
   */
  box?: TextBox;
  /** A glass behind it instead of a box: how much it blurs what's behind (points), how much it covers, how dark it is. */
  glass?: Glass;
}

export interface Glass {
  frost: number;
  /** 0: clear, 1: solid. */
  opacity: number;
  /** 0: white glass, 1: black. */
  dark: number;
  /** A band of light frosted glass around it, in points (0 or unset: none): the glass on its edge alone. */
  rim?: number;
}

export const DEFAULT_GLASS: Glass = { frost: 22, opacity: 0.38, dark: 0 };

/** A glass as a box: its tint between white and black at its opacity, its frost, a thin light edge, round corners. */
export function glassBox(g: Glass): TextBox {
  const c = Math.round(255 * (1 - g.dark));
  return { fill: `rgba(${c},${c},${c},${g.opacity})`, radius: 28, padX: 18, padY: 18, blur: g.frost, stroke: `rgba(255,255,255,${(0.75 * (1 - g.dark * 0.6)).toFixed(2)})`, rim: g.rim || undefined };
}

/** A glass as a text's pill: its corners and padding in ems of the text's size. */
export const glassPill = (g: Glass): TextBox => ({ ...glassBox(g), radius: 2, padX: 0.7, padY: 0.42 });

export interface ShapeLayer extends Placed {
  kind: 'shape';
  /** A viewfinder: only its four corners, as a camera frames what it shoots. */
  shape: 'rect' | 'ellipse' | 'viewfinder';
  /** Its height as a share of the image's (or points: `hUnit`). */
  h: number;
  fill: string;
  /** A rectangle's corners (a viewfinder's bends), in points of an image 440 wide (REF_W). */
  radius: number;
  /** A viewfinder's line, in points of an image 440 wide, and how far each corner reaches along its sides (a share). */
  stroke?: number;
  arm?: number;
  /** Its shadow, as a device's (default: none). */
  shadow?: ShadowPreset;
}

/**
 * Layers laid out together, as Figma's auto layout: side by side (a row) or one under the other (a stack), `gap`
 * apart, lined up on the other axis by `align`. Placed as one (its x, y and anchors); its width is its children's (its
 * own `w` isn't used). Its children's own places aren't either: the order is theirs (a row left to right, a stack top
 * to bottom), and each keeps its width and look.
 */
export interface GroupLayer extends Placed {
  kind: 'group';
  layout: 'row' | 'stack';
  /** Points of an image 440 wide (REF_W), as a text's size. */
  gap: number;
  /** Across a row: top, middle, bottom; across a stack: left, center, right. */
  align: 'start' | 'center' | 'end';
  children: Layer[];
  /** Fading toward an edge, as a device's (a long list going on past what's shown). */
  fade?: DeviceFade;
}

export type Layer = DeviceLayer | TextLayer | ImageLayer | ShapeLayer | GroupLayer | ComponentLayer;

/** A layer by id, at the top or in a group. */
export function findLayer(layers: Layer[], id: string | null | undefined): Layer | undefined {
  if (!id) return undefined;
  for (const l of layers) {
    if (l.id === id) return l;
    if (l.kind === 'group') {
      const inner = findLayer(l.children, id);
      if (inner) return inner;
    }
  }
  return undefined;
}

/** The group a layer is in (undefined at the top). */
export function groupOf(layers: Layer[], id: string): GroupLayer | undefined {
  for (const l of layers)
    if (l.kind === 'group') {
      if (l.children.some((c) => c.id === id)) return l;
      const inner = groupOf(l.children, id);
      if (inner) return inner;
    }
  return undefined;
}

/** The layers with the one `id` (at the top or in a group) changed by `f` (null removes it). */
function mapLayer(layers: Layer[], id: string, f: (l: Layer) => Layer | null): Layer[] {
  const out: Layer[] = [];
  for (const l of layers) {
    if (l.id === id) {
      const next = f(l);
      if (next) out.push(next);
    } else if (l.kind === 'group' && findLayer(l.children, id)) out.push({ ...l, children: mapLayer(l.children, id, f) });
    else out.push(l);
  }
  return out;
}

/** A layer as it's laid out on a store size (`key`): that size's own values over its own. */
export function resolveAt<L extends Layer>(l: L, key?: string): L {
  const own = key ? l.sizes?.[key] : undefined;
  if (!own) return l;
  const out = { ...l, ...own } as Record<string, unknown>;
  // Unset there (null): as the layer would be without it.
  for (const [k, v] of Object.entries(own)) if (v === null) out[k] = undefined;
  return out as L;
}

/** Whether a layer has values of its own on a store size. */
export const ownsDevice = (l: Layer, key: string | undefined): key is string => !!key && !!l.sizes?.[key] && Object.keys(l.sizes[key]).length > 0;

/** A layer with values of its own on a size (`on`: starting from none), or back to its own everywhere. */
export function setOwnDevice(l: Layer, key: string, on: boolean): Partial<Layer> {
  if (!on) {
    const { [key]: _gone, ...rest } = l.sizes ?? {};
    return { sizes: Object.keys(rest).length ? rest : undefined };
  }
  return { sizes: { ...l.sizes, [key]: {} } };
}

/** A layer's place and size, copied from one size to paste on another (the layer menu's Copy and Paste). */
export interface CopiedPlacement {
  values: Partial<LayerOverride>;
  /** The size it was copied on (its label, for the menu). */
  from: string;
}
const PLACEMENT_KEYS = ['x', 'y', 'w', 'h', 'wUnit', 'hUnit', 'ax', 'ay', 'rotate', 'size'] as const;
let copied: CopiedPlacement | null = null;
const copiedWatchers = new Set<() => void>();
/** Its place, size, turn and text size as laid out on `key` (that size's own over its own), kept to paste. */
export function copyPlacement(l: Layer, key: string, label: string) {
  const at = resolveAt(l, key) as unknown as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const k of PLACEMENT_KEYS) if (k in at && at[k] !== undefined) values[k] = at[k];
  // Unset means the default: pasted, it has to say so, or the target's own would stay.
  values.ax ??= 'center';
  values.ay ??= 'center';
  values.wUnit ??= '%';
  if ('h' in at) values.hUnit ??= '%';
  copied = { values: values as Partial<LayerOverride>, from: label };
  copiedWatchers.forEach((f) => f());
}
export const copiedPlacement = () => copied;
export const useCopiedPlacement = () =>
  useSyncExternalStore(
    (f) => {
      copiedWatchers.add(f);
      return () => void copiedWatchers.delete(f);
    },
    () => copied,
  );

/**
 * A change made on a store size (`key`), as the layer keeps it. On the reference: the layer's own values (that size's
 * own for the same keys given up). On another size: its place, size, turn, text size, showing and fade that size's own;
 * the rest (a text, a color) everywhere. To use one size's on another: Copy and Paste position and size.
 */
export function writeAt(l: Layer, patch: Partial<Layer>, key?: string): Partial<Layer> {
  if (!key || key === REFERENCE_SIZE) {
    if (!key || !l.sizes?.[key]) return patch;
    const left = Object.fromEntries(Object.entries(l.sizes[key]).filter(([k]) => !(k in patch)));
    const { [key]: _was, ...others } = l.sizes;
    const sizes = Object.keys(left).length ? { ...others, [key]: left } : others;
    return { ...patch, sizes: Object.keys(sizes).length ? sizes : undefined } as Partial<Layer>;
  }
  const own: Record<string, unknown> = {};
  const every: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!SAME_EVERYWHERE.has(k)) own[k] = v === undefined ? (DEFAULTS[k] ?? null) : v;
    else every[k] = v;
  }
  if (!Object.keys(own).length) return every as Partial<Layer>;
  return { ...every, sizes: { ...l.sizes, [key]: { ...l.sizes?.[key], ...own } } } as Partial<Layer>;
}

/** A layer with these values of its own on a size given up: back to the reference's there. */
export function dropOwn(l: Layer, key: string, keys: string[]): Partial<Layer> {
  const own = l.sizes?.[key];
  if (!own) return {};
  const left = Object.fromEntries(Object.entries(own).filter(([k]) => !keys.includes(k)));
  const { [key]: _was, ...others } = l.sizes!;
  const sizes = Object.keys(left).length ? { ...others, [key]: left } : others;
  return { sizes: Object.keys(sizes).length ? sizes : undefined };
}

/** Whether a value of a layer is this size's own (`device`), or the layer's (undefined). */
export function sourceAt(l: Layer, key: string, device?: string): 'device' | undefined {
  return device && l.sizes?.[device] && key in l.sizes[device] ? 'device' : undefined;
}

/**
 * Whether a layer's height leads (Placed.lead): a device, an image or a component unless set to its width. Its width is
 * then fit to a shorter image, which keeps its height the same share of the image's on every size.
 */
export const leadsByHeight = (l: Layer) => (l.kind === 'device' || l.kind === 'image' || l.kind === 'component') && (l.lead ?? 'h') === 'h';

/** A layer with its sizes as shares of this image (what the canvas draws and drags): sizes in points divided by it. */
export function inShares<L extends Layer>(l: L, image: { w: number; h: number }): L {
  if (l.wUnit === 'drawn') return l;
  const k = ptScale(image);
  // The fit only for one its height leads: its share of the image's height kept. One its width leads, as typed.
  const f = leadsByHeight(l) ? fitScale(image) : 1;
  if (f === 1 && l.wUnit !== 'pt' && l.hUnit !== 'pt') return l;
  const h = 'h' in l && l.h != null && l.hUnit === 'pt' ? { h: (l.h * k) / image.h, hUnit: undefined } : {};
  return { ...l, w: l.wUnit === 'pt' ? (l.w * k) / image.w : l.w * f, x: overhang(l.x, l.ax, f), wUnit: 'drawn', ...h };
}

/**
 * A layer held past a side (a person bleeding off the right), its overhang shrunk with the fit: as much of it shows
 * as on the reference. `undo`: back to the saved place.
 */
function overhang(x: number, ax: AnchorX | undefined, f: number, undo = false): number {
  if (f === 1) return x;
  const by = undo ? 1 / f : f;
  if (ax === 'right' && x > 1) return 1 + (x - 1) * by;
  if (ax === 'left' && x < 0) return x * by;
  return x;
}

/** A change made in shares, in the layer's own units (its sizes in points stay points). */
export function toUnits(patch: Partial<Layer>, l: Layer, image: { w: number; h: number }): Partial<Layer> {
  const out = { ...patch } as Partial<Layer> & { h?: number };
  const p = patch as Partial<Layer> & { h?: number };
  const k = ptScale(image);
  if (p.w != null && l.wUnit === 'pt') out.w = Math.round(((p.w * image.w) / k) * 10) / 10;
  // A share as drawn, back to the saved one (the fit undone, for one its height leads).
  const f = leadsByHeight(l) ? fitScale(image) : 1;
  if (p.w != null && l.wUnit !== 'pt' && l.wUnit !== 'drawn') out.w = Math.round((p.w / f) * 10000) / 10000;
  if (p.x != null) out.x = Math.round(overhang(p.x, p.ax ?? l.ax, f, true) * 10000) / 10000;
  if (p.h != null && l.hUnit === 'pt') out.h = Math.round(((p.h * image.h) / k) * 10) / 10;
  return out;
}
export type LayerKind = Layer['kind'];

export interface StoreShot {
  id: string;
  background: Background;
  /** Back to front. */
  layers: Layer[];
  /**
   * Where the neighbors' layers that cross into it (`extend`) are drawn among its own: each one's id, and the id of
   * the layer of its own it's just above. One not here is at the back.
   */
  linkAbove?: Record<string, string>;
  /**
   * Its background is the screenshot before's, drawn across both as one (and across the gap the store leaves between
   * them): a run of screenshots each continuing the one before shares the first one's. Its own `background` waits,
   * for when it's first in the set.
   */
  continues?: boolean;
  /**
   * The first of a run: how many screenshots its drawing spans (a preset's shapes, its gradient), mirrored after
   * that, so it doesn't stretch thin across a long run. Unset: the whole run.
   */
  spread?: number;
}

/** A run of screenshots sharing one background: the first's place and the last's, around `i`. */
export function runOf(shots: StoreShot[], i: number): { start: number; end: number } {
  let start = i;
  while (start > 0 && shots[start]?.continues) start--;
  let end = i;
  while (shots[end + 1]?.continues) end++;
  return { start, end };
}

/** A screenshot's stack, back to front: its own layers, and the neighbors' crossing into it (`linked`) among them. */
export type StackEntry = { id: string; linked: boolean };

/** `shot`'s stack with the neighbors' layers `linked` (their ids) where linkAbove puts them. */
export function stackOf(shot: StoreShot, linked: string[]): StackEntry[] {
  const above = shot.linkAbove ?? {};
  const own = new Set(shot.layers.map((l) => l.id));
  const at = (id: string) => (above[id] && own.has(above[id]) ? above[id] : null);
  const out: StackEntry[] = linked.filter((id) => !at(id)).map((id) => ({ id, linked: true }));
  for (const l of shot.layers) {
    out.push({ id: l.id, linked: false });
    for (const id of linked) if (at(id) === l.id) out.push({ id, linked: true });
  }
  return out;
}

/** A screenshot's stack in a new order (back to front): its own layers in it, and where each linked one sits. */
export function restack(sizeId: string, shotId: string, order: StackEntry[]) {
  setShot(sizeId, shotId, (s) => {
    const byId = new Map(s.layers.map((l) => [l.id, l]));
    const layers: Layer[] = [];
    const linkAbove: Record<string, string> = {};
    for (const e of order) {
      if (!e.linked) {
        const l = byId.get(e.id);
        if (l) layers.push(l);
      } else if (layers.length) linkAbove[e.id] = layers[layers.length - 1].id;
    }
    // Any of its own the order missed stays, in front.
    for (const l of s.layers) if (!layers.includes(l)) layers.push(l);
    const { linkAbove: _old, ...rest } = s;
    return Object.keys(linkAbove).length ? { ...rest, layers, linkAbove } : { ...rest, layers };
  });
}

/**
 * A layer moved whole into another screenshot (dragged past the space between them): it's that one's from then on,
 * where it was drawn among its layers, `dx` (image widths) moved back on every breakpoint.
 */
export function transferLayer(sizeId: string, fromId: string, toId: string, layerId: string, dx: number) {
  const from = shotsOf(read()).find((s) => s.id === fromId);
  const layer = from?.layers.find((l) => l.id === layerId);
  if (!layer) return;
  const r = (v: number) => Math.round(v * 10000) / 10000;
  const sizes = layer.sizes && Object.fromEntries(Object.entries(layer.sizes).map(([k, o]) => [k, o.x != null ? { ...o, x: r(o.x - dx) } : o]));
  const moved = { ...layer, x: r(layer.x - dx), ...(sizes ? { sizes } : {}) } as Layer;
  setShots(sizeId, (list) =>
    list.map((s) => {
      if (s.id === fromId) {
        const { [layerId]: _gone, ...linkAbove } = s.linkAbove ?? {};
        return { ...s, layers: s.layers.filter((l) => l.id !== layerId), ...(s.linkAbove ? { linkAbove } : {}) };
      }
      if (s.id !== toId) return s;
      // Where it showed among this one's layers (linkAbove), or at the back.
      const { [layerId]: above, ...linkAbove } = s.linkAbove ?? {};
      const i = above ? s.layers.findIndex((l) => l.id === above) + 1 : 0;
      const layers = [...s.layers];
      layers.splice(Math.max(0, i), 0, moved);
      return { ...s, layers, ...(s.linkAbove ? { linkAbove } : {}) };
    }),
  );
}

export type ShotSets = Record<string, StoreShot[]>;

export const STORE_ASSETS_PATH = 'app/store-assets.json';
/** Where the first sketch kept them: moved into the file the first time the dev server can write it. */
const OLD_KEY = 'hc.storeAssets';

export const newId = () => crypto.randomUUID();

/** The width sizes in points are given for (a text's, a shape's corners): each image draws them in proportion. */
export const REF_W = 440;

/** A screen filling the image, as a screenshot starts. */
export const fillingDevice = (page: PageRef, query: string): DeviceLayer => ({ id: newId(), kind: 'device', page, query, frame: false, x: 0.5, y: 0.5, w: 1, rotate: 0 });

/** A screenshot from before layers (a page and its query, maybe a `look`): its screen as a device layer. */
interface OldShot {
  id: string;
  page: PageRef;
  query: string;
  look?: { background: Background; frame: boolean; size: number; x: number; y: number; rotate: number };
}
function upgrade(s: StoreShot | OldShot): StoreShot {
  if ('layers' in s) return s;
  const device = fillingDevice(s.page, s.query);
  if (!s.look) return { id: s.id, background: { kind: 'solid', color: '#FFFFFF' }, layers: [device] };
  const { background, frame, size, x, y, rotate } = s.look;
  return { id: s.id, background, layers: [{ ...device, frame, w: size, x, y, rotate }] };
}
const upgradeAll = (sets: Record<string, (StoreShot | OldShot)[]>): ShotSets => Object.fromEntries(Object.entries(sets).map(([k, list]) => [k, list.map(upgrade)]));

/**
 * The layout every size shows: one list of screenshots, each drawn at each store size with that size's device (a
 * store that takes fewer shows the first ones). Kept under this key; the sets made per size before it stay in the
 * file, unused.
 */
export const SHARED = '*';

/** The first sets had one per size: the one with the most work in it (its layers) starts the shared layout. */
function shareOne(sets: ShotSets): ShotSets {
  if (sets[SHARED]) return sets;
  const weight = (list: StoreShot[]) => list.reduce((n, sh) => n + sh.layers.length, 0);
  const best = Object.values(sets).sort((a, b) => weight(b) - weight(a))[0];
  return best ? { ...sets, [SHARED]: best } : sets;
}

/**
 * A proposal for the store's listing: its own screenshots, made beside the ones the store shows (Live) to try a new
 * set without touching it. Only the images: the screens in its devices are always the app as it ships.
 */
export interface ListingProposal {
  /** Its reference (`L3`): links carry it (`?listing=L3`). Never reused. */
  id: string;
  title: string;
  status: ListingStatus;
  /** `yyyy-mm-dd`. */
  created: string;
  shots: StoreShot[];
}
export type ListingStatus = 'draft' | 'review';

/** The file: the listing the store shows (Live), and its proposals. */
export interface StoreData {
  live: ShotSets;
  proposals: ListingProposal[];
  /** How many proposals were ever made: the next one's number, so a code isn't reused. */
  made: number;
  /**
   * The listing graphics made outside (its icons, a feature graphic): a file in public/ by the asset's id
   * (`play.feature`), shown in its place and exported at the store's pixels.
   */
  graphics?: Record<string, string>;
  /** What the store shows around the screenshots (its name, rating, category…): the Preview's App Store page. */
  listing?: ListingInfo;
}

/** The listing's own texts, as the store's page shows them (Preview). */
export interface ListingInfo {
  name: string;
  subtitle: string;
  developer: string;
  category: string;
  rating: number;
  /** How many ratings, as the store writes it (`24K`). */
  ratings: string;
  age: string;
  /** Its rank in its category (`No. 1`), if it has one. */
  chart?: number;
  /** "In-App Purchases" beside Get. */
  inAppPurchases?: boolean;
}

type RawFile = Record<string, (StoreShot | OldShot)[]> | { live: Record<string, (StoreShot | OldShot)[]>; proposals?: ListingProposal[]; made?: number; graphics?: Record<string, string>; listing?: ListingInfo };
/** The file as written before proposals (only Live's sets) or after. */
function upgradeFile(raw: RawFile): StoreData {
  if ('live' in raw && !Array.isArray(raw.live)) {
    const r = raw as { live: Record<string, (StoreShot | OldShot)[]>; proposals?: ListingProposal[]; made?: number; graphics?: Record<string, string>; listing?: ListingInfo };
    const proposals = (r.proposals ?? []).map((p) => ({ ...p, shots: p.shots.map(upgrade) }));
    return { live: shareOne(upgradeAll(r.live)), proposals, made: Math.max(r.made ?? 0, ...proposals.map(numberOf)), ...(r.graphics && { graphics: r.graphics }), ...(r.listing && { listing: r.listing }) };
  }
  return { live: shareOne(upgradeAll(raw as Record<string, (StoreShot | OldShot)[]>)), proposals: [], made: 0 };
}
const numberOf = (p: ListingProposal) => Number(p.id.replace(/\D/g, '')) || 0;

const file = upgradeFile(Object.values(import.meta.glob<RawFile>('@app/store-assets.json', { eager: true, import: 'default' }))[0] ?? {});

// One state for every copy of this module: an edit of the file (the agent's, a pull) reloads it, and the views keep
// listening to the same one.
interface State {
  data: StoreData;
  listeners: Set<() => void>;
  /** Undo's steps (the data before each change) and redo's: kept here, so a reload of this module keeps them. */
  history?: { past: StoreData[]; future: StoreData[]; last: number; listeners: Set<() => void> };
}
// (The tests' runner has import.meta.hot with no data: only the dev server's reloads.)
const state: State = (import.meta.hot?.data?.state as State | undefined) ?? { data: file, listeners: new Set() };
if (import.meta.hot?.data) {
  if (import.meta.hot.data.state) {
    // The file changed under us: show what it says now.
    state.data = file;
    state.listeners.forEach((l) => l());
  }
  import.meta.hot.data.state = state;
  import.meta.hot.accept();
}

state.history ??= { past: [], future: [], last: 0, listeners: new Set() };
const history = state.history;

const subscribe = (l: () => void) => {
  state.listeners.add(l);
  return () => state.listeners.delete(l);
};
const readData = () => state.data;

/** The listing on screen: a proposal's (`?listing=L3`), or Live's (none, or one that isn't there). */
export const LISTING_PARAM = 'listing';
const proposalIn = (data: StoreData, id: string | null) => (id ? data.proposals.find((p) => p.id === id) : undefined);
const setsIn = (data: StoreData, id: string | null): ShotSets => {
  const p = proposalIn(data, id);
  return p ? { [SHARED]: p.shots } : data.live;
};
/** The listing open now, for the edits (made from the canvas or a panel, after the URL has it). */
const openListing = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(LISTING_PARAM);
const read = () => setsIn(state.data, openListing());

/** The listing open's screenshots (Live's or a proposal's), kept in sync between the views that read them. */
export function useShotSets(): ShotSets {
  const data = useSyncExternalStore(subscribe, readData, readData);
  const [search] = useSearchParams();
  const id = search.get(LISTING_PARAM);
  return useMemo(() => setsIn(data, id), [data, id]);
}

/** A listing's screenshots now (a proposal's id, or null for Live): for a handler, after a change it just made. */
export const listingShots = (id: string | null): StoreShot[] => shotsOf(setsIn(state.data, id));

/** Live's listing and its proposals. */
export function useStoreData(): StoreData {
  return useSyncExternalStore(subscribe, readData, readData);
}

/** The proposal open (from the URL), or undefined on Live. */
export function useListingProposal(): ListingProposal | undefined {
  const data = useStoreData();
  const [search] = useSearchParams();
  return proposalIn(data, search.get(LISTING_PARAM));
}

/** A slider sends many changes a second: the file is written once they settle. */
const SAVE_AFTER_MS = 300;
let saving: ReturnType<typeof setTimeout> | undefined;

/** The views hear of changes once a frame (a slider or a drag in the panel sends more than the screen can show). */
let notifying = 0;
const notify = () => {
  if (notifying) return;
  notifying = requestAnimationFrame(() => {
    notifying = 0;
    state.listeners.forEach((l) => l());
  });
};

/**
 * Undo and redo (⌘Z, ⇧⌘Z): the data before each change, a continuous change (a drag, a slider, typing) as one step:
 * changes less than this apart join the step before.
 */
const STEP_GAP_MS = 400;
const HISTORY = 100;
const { past, future } = history;
const historyChanged = () => {
  for (const l of history.listeners) l();
};

function save(data: StoreData, step = true) {
  if (step) {
    const now = Date.now();
    if (now - history.last > STEP_GAP_MS) {
      past.push(state.data);
      if (past.length > HISTORY) past.shift();
    }
    history.last = now;
    future.length = 0;
    historyChanged();
  }
  state.data = data;
  notify();
  // Only the dev server saves: elsewhere the controls that call this aren't shown.
  clearTimeout(saving);
  saving = setTimeout(() => void writeJson(STORE_ASSETS_PATH, state.data).catch((e: unknown) => console.warn('App Store Assets: not saved.', e)), SAVE_AFTER_MS);
}

/** The last change undone (the step before it back); false when there's none. */
export function undo(): boolean {
  const before = past.pop();
  if (!before) return false;
  future.push(state.data);
  history.last = 0;
  save(before, false);
  historyChanged();
  return true;
}

/** The last change undone, done again; false when there's none. */
export function redo(): boolean {
  const after = future.pop();
  if (!after) return false;
  past.push(state.data);
  history.last = 0;
  save(after, false);
  historyChanged();
  return true;
}

/** Whether there's a change to undo and one to redo. */
export function useHistory(): { canUndo: boolean; canRedo: boolean } {
  const n = useSyncExternalStore(
    (l) => (history.listeners.add(l), () => history.listeners.delete(l)),
    () => past.length * 1000 + future.length,
  );
  return { canUndo: n >= 1000, canRedo: n % 1000 > 0 };
}

/** The listing open's sets, changed: a proposal's, or Live's. */
function write(next: ShotSets) {
  const data = state.data;
  const p = proposalIn(data, openListing());
  if (!p) return save({ ...data, live: next });
  save({ ...data, proposals: data.proposals.map((x) => (x === p ? { ...x, shots: next[SHARED] ?? [] } : x)) });
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A new proposal, a copy of the listing `from` (a proposal's id, or null for Live): its id. */
export function newListingProposal(from: string | null): string {
  const data = state.data;
  const n = data.made + 1;
  const id = `L${n}`;
  // The same screenshots' ids: what's picked stays picked across the two.
  const shots = structuredClone(shotsOf(setsIn(data, from)));
  save({ ...data, made: n, proposals: [...data.proposals, { id, title: t('Proposal {n}', { n }), status: 'draft', created: today(), shots }] });
  return id;
}

export function updateListingProposal(id: string, patch: Partial<Pick<ListingProposal, 'title' | 'status'>>) {
  const data = state.data;
  save({ ...data, proposals: data.proposals.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
}

export function removeListingProposal(id: string) {
  const data = state.data;
  save({ ...data, proposals: data.proposals.filter((p) => p.id !== id) });
}

/** A proposal the store now shows: its screenshots become Live's, and it's done (removed). */
export function makeListingLive(id: string) {
  const data = state.data;
  const p = proposalIn(data, id);
  if (!p) return;
  save({ ...data, live: { ...data.live, [SHARED]: p.shots }, proposals: data.proposals.filter((x) => x !== p) });
}

/** The screenshots a size shows: the shared layout (`_sizeId`: every size shows the same). */
export const shotsOf = (sets: ShotSets, _sizeId?: string): StoreShot[] => sets[SHARED] ?? [];


/** A screenshot's first screen: what it's named by on the canvas. */
export const mainDevice = (s: StoreShot): DeviceLayer | undefined => s.layers.find((l): l is DeviceLayer => l.kind === 'device');

/** The open listing's screenshots as they are now (for a handler, right after a change). */
export const shotsNow = (): StoreShot[] => shotsOf(read());

/** The listing graphics' files, by the asset's id (StoreData.graphics). */
export const graphicsNow = (): Record<string, string> => state.data.graphics ?? {};
export const useGraphics = (): Record<string, string> => useStoreData().graphics ?? {};
/** The listing's texts (StoreData.listing), or a placeholder until it has them. */
export const useListingInfo = (): ListingInfo => useStoreData().listing ?? { name: 'App', subtitle: '', developer: '', category: '', rating: 5, ratings: '0', age: '4+' };

const setShots = (_sizeId: string, f: (list: StoreShot[]) => StoreShot[]) => write({ ...read(), [SHARED]: f(shotsOf(read())) });
const setShot = (sizeId: string, id: string, f: (s: StoreShot) => StoreShot) => setShots(sizeId, (list) => list.map((s) => (s.id === id ? f(s) : s)));

/** A new screenshot on white: empty, to build from its layers, or a screen filling it. Its id. */
export function addShot(sizeId: string, screen?: { page: PageRef; query: string }): string {
  const id = newId();
  setShots(sizeId, (list) => [...list, { id, background: { kind: 'solid', color: '#FFFFFF' }, layers: screen ? [fillingDevice(screen.page, screen.query)] : [] }]);
  return id;
}

export function removeShot(sizeId: string, id: string) {
  setShots(sizeId, (list) => {
    const i = list.findIndex((s) => s.id === id);
    const gone = list[i];
    // The first of a run gone: the next takes its background and goes on leading the run.
    return list
      .map((s, j) => (j === i + 1 && s.continues && gone && !gone.continues ? { ...s, background: gone.background, continues: undefined, ...(gone.spread ? { spread: gone.spread } : {}) } : s))
      .filter((s) => s.id !== id);
  });
}

/** Consecutive screenshots (`ids`, in the set's order) sharing the first one's background, as one across them. */
export function unifyBackground(sizeId: string, ids: string[]) {
  setShots(sizeId, (list) => {
    const at = ids.map((id) => list.findIndex((s) => s.id === id)).sort((a, b) => a - b);
    if (at.length < 2 || at.some((x, k) => k && x !== at[k - 1] + 1)) return list;
    return list.map((s, j) => (j > at[0] && j <= at[at.length - 1] ? { ...s, continues: true } : s));
  });
}

/**
 * The run a screenshot is in, apart: each keeps the background they shared, drawn on its own (then each can be
 * changed alone).
 */
export function separateBackground(sizeId: string, shotId: string) {
  setShots(sizeId, (list) => {
    const i = list.findIndex((s) => s.id === shotId);
    if (i < 0) return list;
    const { start, end } = runOf(list, i);
    const shared = list[start].background;
    return list.map((s, j) => {
      if (j < start || j > end) return s;
      const { continues: _c, spread: _s, ...rest } = s;
      return { ...rest, background: shared };
    });
  });
}

/** How many screenshots the run's drawing spans (its first one keeps it); null: the whole run. */
export function setSpread(sizeId: string, leaderId: string, spread: number | null) {
  setShot(sizeId, leaderId, (s) => {
    const { spread: _old, ...rest } = s;
    return spread ? { ...rest, spread } : rest;
  });
}

/** Moves a screenshot one place earlier (-1) or later (+1) in its set. */
export function moveShot(sizeId: string, id: string, by: -1 | 1) {
  setShots(sizeId, (list) => swap(list, (s) => s.id === id, by));
}


export function setBackground(sizeId: string, shotId: string, background: Background) {
  setShot(sizeId, shotId, (s) => ({ ...s, background }));
}

/** A layer on top of the others; its id. */
export function addLayer(sizeId: string, shotId: string, layer: Layer): string {
  setShot(sizeId, shotId, (s) => ({ ...s, layers: [...s.layers, layer] }));
  return layer.id;
}

export function updateLayer(sizeId: string, shotId: string, layerId: string, patch: Partial<Layer>) {
  setShot(sizeId, shotId, (s) => ({ ...s, layers: mapLayer(s.layers, layerId, (l) => ({ ...l, ...patch }) as Layer) }));
}

/** A change made on a store size: that size's own, or the layer's (writeAt). */
export function updateLayerAt(sizeId: string, shotId: string, layerId: string, patch: Partial<Layer>, device?: string) {
  setShot(sizeId, shotId, (s) => ({ ...s, layers: mapLayer(s.layers, layerId, (l) => ({ ...l, ...writeAt(l, patch, device) }) as Layer) }));
}

export function removeLayer(sizeId: string, shotId: string, layerId: string) {
  setShot(sizeId, shotId, (s) => ({ ...s, layers: mapLayer(s.layers, layerId, () => null) }));
}

/** A copy just in front of it, a little lower and to the right; its id. */
export function duplicateLayer(sizeId: string, shotId: string, layerId: string): string {
  const id = newId();
  setShot(sizeId, shotId, (s) => {
    const i = s.layers.findIndex((l) => l.id === layerId);
    if (i < 0) return s;
    const copy = { ...s.layers[i], id, x: s.layers[i].x + 0.03, y: s.layers[i].y + 0.03 };
    return { ...s, layers: [...s.layers.slice(0, i + 1), copy, ...s.layers.slice(i + 1)] };
  });
  return id;
}

/** Brings a layer one step to the front (+1) or sends it one step back (-1). */
/** A layer moved to `index` in the stack (back to front, as `layers`), the others keeping their order. */
export function placeLayer(sizeId: string, shotId: string, layerId: string, index: number) {
  setShot(sizeId, shotId, (s) => {
    const layer = s.layers.find((l) => l.id === layerId);
    if (!layer) return s;
    const rest = s.layers.filter((l) => l !== layer);
    rest.splice(Math.max(0, Math.min(rest.length, index)), 0, layer);
    return { ...s, layers: rest };
  });
}

export function moveLayer(sizeId: string, shotId: string, layerId: string, by: -1 | 1) {
  setShot(sizeId, shotId, (s) => ({ ...s, layers: swap(s.layers, (l) => l.id === layerId, by) }));
}

function swap<T>(list: T[], is: (x: T) => boolean, by: -1 | 1): T[] {
  const i = list.findIndex(is);
  const j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** The first sketch's sets, kept in this browser, into the file when it has none (once, with the dev server). */
export async function adoptBrowserShots(): Promise<void> {
  if (Object.keys(state.data.live).length || !(await canWrite())) return;
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || '{}') as Record<string, OldShot[]>;
    if (Object.values(old).some((l) => l.length)) write(shareOne(upgradeAll(old)));
    localStorage.removeItem(OLD_KEY);
  } catch {
    /* nothing kept, or no storage */
  }
}

/** Several layers off the top of the stack. */
export function removeLayers(sizeId: string, shotId: string, ids: string[]) {
  setShot(sizeId, shotId, (s) => ({ ...s, layers: ids.reduce((list, id) => mapLayer(list, id, () => null), s.layers) }));
}

/** The group a layer is directly in, or null at the top of the stack; undefined when it isn't there. */
export function parentOf(layers: Layer[], id: string): GroupLayer | null | undefined {
  if (layers.some((l) => l.id === id)) return null;
  return groupOf(layers, id);
}

/** The layer at the top of the stack a layer is in (itself, at the top): what places it. */
export function topOf(layers: Layer[], id: string): Layer | undefined {
  return layers.find((l) => l.id === id || (l.kind === 'group' && !!findLayer(l.children, id)));
}

/** Whether layers can be grouped together: two or more, all in the same list (the top of the stack, or one group). */
export function canGroup(layers: Layer[], ids: string[]): boolean {
  if (ids.length < 2) return false;
  const p = parentOf(layers, ids[0]);
  return p !== undefined && ids.every((id) => parentOf(layers, id)?.id === p?.id && parentOf(layers, id) !== undefined);
}

/** A list (the top of the stack, or a group's children) with layers `order` made one group where the front one was. */
function groupIn(list: Layer[], order: string[], group: Omit<GroupLayer, 'children'>): Layer[] {
  const picked = order.map((o) => list.find((l) => l.id === o)).filter((l): l is Layer => !!l);
  if (picked.length < 2) return list;
  const front = Math.max(...picked.map((l) => list.indexOf(l)));
  const out: Layer[] = [];
  list.forEach((l, i) => {
    if (i === front) out.push({ ...group, children: picked } as GroupLayer);
    else if (!picked.includes(l)) out.push(l);
  });
  return out;
}

/**
 * Sibling layers (at the top of the stack, or in one group) made one group, in `order` (a row's left to right, a
 * stack's top to bottom), where the front one of them was. At the top it's placed at (x, y) centered; in a group, its
 * group lays it out. Its id.
 */
export function groupLayers(sizeId: string, shotId: string, order: string[], layout: GroupLayer['layout'], at: { x: number; y: number; gap: number }): string {
  const id = newId();
  const group = { id, kind: 'group' as const, layout, gap: at.gap, align: 'center' as const, x: at.x, y: at.y, w: 0, rotate: 0 };
  setShot(sizeId, shotId, (s) => {
    const parent = parentOf(s.layers, order[0]);
    if (parent === undefined) return s;
    if (!parent) return { ...s, layers: groupIn(s.layers, order, group) };
    return { ...s, layers: mapLayer(s.layers, parent.id, (g) => ({ ...(g as GroupLayer), children: groupIn((g as GroupLayer).children, order, group) })) };
  });
  return id;
}

/**
 * A group's layers back on their own, where the group was: at the top of the stack each at its place as it's drawn
 * (`places`); in a group, laid out by it.
 */
export function ungroup(sizeId: string, shotId: string, groupId: string, places: Record<string, { x: number; y: number }>) {
  const placed = (c: Layer): Layer => {
    const p = places[c.id];
    if (!p) return c;
    // Placed by its center from now on, on every size (the group placed it, not its own x, y).
    const sizes = c.sizes && Object.fromEntries(Object.entries(c.sizes).map(([k, o]) => [k, (({ x: _x, y: _y, ax: _ax, ay: _ay, ...rest }) => rest)(o)]));
    const { ax: _ax, ay: _ay, ...rest } = c;
    return { ...rest, x: p.x, y: p.y, ...(sizes ? { sizes } : {}) } as Layer;
  };
  const spread = (list: Layer[], top: boolean): Layer[] => list.flatMap((l) => (l.id === groupId && l.kind === 'group' ? (top ? l.children.map(placed) : l.children) : [l]));
  setShot(sizeId, shotId, (s) => {
    const parent = parentOf(s.layers, groupId);
    if (parent === undefined) return s;
    if (!parent) return { ...s, layers: spread(s.layers, true) };
    return { ...s, layers: mapLayer(s.layers, parent.id, (g) => ({ ...(g as GroupLayer), children: spread((g as GroupLayer).children, false) })) };
  });
}

/** A layer one place earlier (-1) or later (1) in its group's order. */
export function moveInGroup(sizeId: string, shotId: string, layerId: string, by: -1 | 1) {
  setShot(sizeId, shotId, (s) => {
    const g = groupOf(s.layers, layerId);
    if (!g) return s;
    return { ...s, layers: mapLayer(s.layers, g.id, (l) => ({ ...(l as GroupLayer), children: swap((l as GroupLayer).children, (c) => c.id === layerId, by) })) };
  });
}
