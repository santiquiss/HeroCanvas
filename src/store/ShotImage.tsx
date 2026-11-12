// One store screenshot as an image, in the display's points (the canvas scales it, the export draws it at the store's
// pixels): its background, then its layers back to front. Each layer is a box placed by its center, width and turn,
// its content filling it: a device (the prototype's screen, framed as the simulator frames it or alone with its
// corners), a text in the set's language, an image, a shape. Open on the canvas (`edit`), a click picks a layer, a drag
// moves it, its corner's handle sizes it.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Display } from '../devices/devices';
import { PreviewScreen } from '../flow/PreviewScreen';
import { BASE_LANGUAGE, LANG_PARAM, LANGUAGES, type Language } from '../sim/language';
import { FrameHardware, frameBox, frameStyle } from '../sim/DeviceFrame';
import { computeLayout, screenOnly, type Layout } from '../sim/layout';
import { SharedSimProvider } from '../sim/SimContext';
import { DEFAULT_SHADOW, frameMesh, shadowColor, shadowOffset, type Shadow } from '../capture/exportImage';
import { DEFAULT_LIGHT, lightSide, sceneBounds, type Box, type Lighting } from '../capture/scene';
import { bodyOf } from '../capture/models';
import { SHADOW_PRESETS } from '../capture/prefs';
import { ScreenGlare } from '../capture/ScreenGlare';
import { FLAT, isFlat, tiltCss } from '../capture/tilt';
import { DeviceBody, finishesOf, modelsFor } from './Device3D';
import { applyScroll, replayTaps, screenRootIn } from './replay';
import { ScreenStill, screenSpec, useStillScreens } from './screenImage';
import { useNavRoot } from '../nav/context';
import { presetCss } from './backgrounds';
import { shotsNow } from './shots';
import { sizeOf } from './sizes';
import { googleFontStack, useGoogleFont } from './fonts';
import { Icon } from '../components/Icon';
import { StillCtx } from '../kit/motion';
import { STORIES } from '../design/stories';
import { useAppTheme } from '../sim/appThemes';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { t } from '../i18n/ui';
import { anchorSide, anchorsFor, findLayer, fitScale, inShares, ptScale, REF_W, resolveAt, stackOf, toUnits, type Background, glassBox, glassPill, type ComponentLayer, type ShapeLayer, type TextBox, type DeviceFade, type DeviceLayer, type GroupLayer, type Layer, type StoreShot, type TextLayer } from './shots';
import { recolor } from './recolor';
import { useTextSwap } from './replaceTexts';
import frameStyles from '../sim/SimulatorShell.module.css';
import styles from './StoreAssets.module.css';

export type LayoutFor = (display: Display, detailOpen: boolean, pageId?: string) => Layout;

/**
 * The app's layout as App Store Assets draws it (Live: no proposal's), for what isn't given the canvas's own (the side
 * panels, telling which neighbors' layers reach into a screenshot as the canvas draws them).
 */
export const plainLayout: LayoutFor = (display, detailOpen) => computeLayout({ display, land: false, supported: true, detailOpen });

export const backgroundCss = (b: Background): string => (b.kind === 'solid' ? b.color : b.kind === 'preset' ? presetCss(b) : `linear-gradient(${b.angle}deg, ${b.from}, ${b.to})`);

/** A text layer's words in a language (the base language's when it has none of its own). */
export const textIn = (l: TextLayer, language: Language): string => l.text[language] ?? l.text[BASE_LANGUAGE] ?? Object.values(l.text)[0] ?? '';

const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif';
const SERIF_FONT = '"New York", "Iowan Old Style", Georgia, "Times New Roman", serif';
let appFont: string | null = null;

/** The app's typeface, as its screens are drawn in it (read once from a screen on the page; the system's until then). */
function useAppFont(): string {
  const [font, setFont] = useState(appFont ?? SYSTEM_FONT);
  useEffect(() => {
    if (appFont) return setFont(appFont);
    let tries = 0;
    let raf = 0;
    const look = () => {
      const screen = document.querySelector('[data-device-screen]');
      const f = screen ? getComputedStyle(screen).fontFamily : '';
      if (f) {
        appFont = f;
        setFont(f);
      } else if (tries++ < 120) raf = requestAnimationFrame(look);
    };
    look();
    return () => cancelAnimationFrame(raf);
  }, []);
  return font;
}

/** The screenshot open on the canvas: its picked layer, picking, and (with the dev server) changing them. */
export interface ShotEdit {
  picked: string | null;
  onPick: (layerId: string) => void;
  /** Present where it can be saved: dragging and sizing call it. */
  onChange?: (layerId: string, patch: Partial<Layer>) => void;
  /** The canvas's scale: a pointer's move in screen pixels is this many times one of the image's points. */
  zoom: number;
  /**
   * Over the image, in its points and not cut by its edges: where the picked layer's outline and handles are drawn,
   * above every layer (one covered by another, or past the edge, is still sized).
   */
  overlay?: HTMLElement | null;
  /** Several picked (Shift + click): each outlined, none sized. */
  multi?: string[];
  /** Shift + click: one more picked, or one of them let go. */
  onShiftPick?: (layerId: string) => void;
}

/** Another screenshot of the listing, `at` places from this one (-1 the one before, 2 the one after the next). */
export interface Neighbor {
  shot: StoreShot;
  at: number;
}

interface Props {
  shot: StoreShot;
  display: Display;
  language: Language;
  layoutFor: LayoutFor;
  edit?: ShotEdit;
  /** The screenshots beside it: what of theirs crosses into this one is drawn here too, cut at its edge. */
  neighbors?: Neighbor[];
  /** What a neighbor's layer drawn here does: picked here (this screenshot's), moved and sized in its own. */
  spillEdit?: SpillEdit;
  /** The store's space between screenshots (a share of the width): a neighbor's layer goes on after it. */
  gap?: number;
  /** In a run sharing one background: the run's background, its length, this one's place in it and its drawing's span. */
  run?: BackgroundRun;
}

/** A background drawn across several screenshots as one (StoreShot.continues). */
export interface BackgroundRun {
  background: Background;
  count: number;
  /** This screenshot's place in the run (0: its first). */
  at: number;
  /** How many screenshots its drawing spans before it repeats, mirrored (the whole run when unset). */
  spread?: number;
}

/**
 * A run's background, in one screenshot: drawn as wide as the whole run (its screenshots and the store's space between
 * them) and moved over to this one's part, so it reads as one across them. A preset spread over fewer screenshots
 * repeats, every other one mirrored: no seam, its shapes not stretched thin.
 */
function RunBackground({ run, display, gap }: { run: BackgroundRun; display: Display; gap: number }) {
  const W = display.w;
  const step = (1 + gap) * W;
  const total = run.count * step - gap * W;
  const span = run.background.kind === 'preset' && run.spread && run.spread < run.count ? run.spread : run.count;
  const tile = span * step - gap * W;
  const tiles = Math.ceil(total / tile);
  const css = backgroundCss(run.background);
  return (
    <div aria-hidden style={{ position: 'absolute', top: 0, left: -run.at * step, width: total, height: display.h, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: tiles }, (_, i) => (
        <div key={i} style={{ position: 'absolute', top: 0, left: i * tile, width: tile, height: '100%', background: css, transform: i % 2 ? 'scaleX(-1)' : undefined }} />
      ))}
    </div>
  );
}

/**
 * A neighbor's layer from the part of it in this image: picked in this screenshot (its list shows it, linked), and
 * moved, sized or ordered from here; what moves it is saved in its own screenshot (`owner`).
 */
export interface SpillEdit {
  picked: string | null;
  onPick: (layerId: string) => void;
  /** Where it can be saved. The patch is in its own image's terms. */
  onChange?: (owner: string, layerId: string, patch: Partial<Layer>) => void;
  zoom: number;
  overlay?: HTMLElement | null;
}

/**
 * Where a layer reaches across, as it's drawn (shares of the image's width, on this size): a device by its drawn width
 * (one fit to its height is narrower than its box) and, turned in 3D, its frame in perspective (its outline's bounds);
 * a layer turned on the image by its turned box. A text or an image, whose height isn't known here, as tall as wide.
 */
export function extentOf(layer: Layer, display: Display, layoutFor: LayoutFor = plainLayout): { left: number; right: number } {
  // Worked out once per place and look (a turned device's perspective isn't free; a drag asks on every move).
  const l = inShares(layer, display);
  const d = l.kind === 'device' ? [l.frame, l.model, l.tilt?.x, l.tilt?.y, l.page.id, l.h, l.hUnit] : l.kind === 'shape' ? [l.h, l.hUnit] : l.kind === 'group' ? [l.layout, l.gap, JSON.stringify(l.children)] : [];
  const key = JSON.stringify([display.w, display.h, l.kind, l.x, l.w, l.ax, l.rotate, ...d]);
  let known = extents.get(layoutFor);
  if (!known) extents.set(layoutFor, (known = new Map()));
  const hit = known.get(key);
  if (hit) return hit;
  const e = measureExtent(l, display, layoutFor);
  if (known.size > 2000) known.clear();
  known.set(key, e);
  return e;
}
const extents = new WeakMap<LayoutFor, Map<string, { left: number; right: number }>>();

function measureExtent(l: Layer, display: Display, layoutFor: LayoutFor): { left: number; right: number } {
  const W = display.w;
  const boxW = drawnW(l, display, layoutFor) * W;
  let bw = boxW;
  let bh = boxW;
  if (l.kind === 'device') {
    bh = boxW * deviceAspect(l, display, layoutFor);
    const turned = turnedBounds(l, display, layoutFor);
    if (turned) {
      bw = turned.maxX - turned.minX;
      bh = turned.maxY - turned.minY;
    }
  } else if (l.kind === 'shape') bh = l.h * display.h;
  const r = (l.rotate * Math.PI) / 180;
  const half = (bw * Math.abs(Math.cos(r)) + bh * Math.abs(Math.sin(r))) / 2;
  // Its center: the box's (a turned device is drawn centered on it), from the point its anchor places.
  const cx = l.x * W - (anchorSide(l.ax) * boxW) / 2;
  return { left: (cx - half) / W, right: (cx + half) / W };
}

/** Past an edge by less than this (a share of the width) isn't past it: rounding, an antialiased edge. */
const EDGE_SLACK = 0.002;

/** Which edges a layer goes past, as drawn: -1 its left, 1 its right. */
export function edgesCrossed(layer: Layer, display: Display, layoutFor: LayoutFor = plainLayout): (-1 | 1)[] {
  const { left, right } = extentOf(layer, display, layoutFor);
  return [...(left < -EDGE_SLACK ? [-1 as const] : []), ...(right > 1 + EDGE_SLACK ? [1 as const] : [])];
}

/** A neighbor's layer that reaches into this image past the space between them: its own screenshot, and how far over. */
export interface Crossing {
  /** As laid out on this size, in its own image's terms. */
  layer: Layer;
  owner: string;
  /** Where its own image is from this one, in this image's widths (the space between counted): -1.045 the one before. */
  shift: number;
}

/** The neighbors' layers set to extend (`extend`) that reach into this image. */
export function crossingInto(neighbors: Neighbor[], display: Display, gap: number, layoutFor?: LayoutFor, live: (id: string) => Partial<Layer> | null = () => null): Crossing[] {
  const step = 1 + gap;
  return neighbors.flatMap(({ shot: n, at }) =>
    n.layers
      .filter((l) => l.extend && !resolveAt(l, sizeOf(display)).hidden)
      .map((l) => {
        // As it is mid-drag, where it's being dragged (in shares: the drag's are).
        const p = live(l.id);
        const at0 = resolveAt(l, sizeOf(display));
        return p ? ({ ...inShares(at0, display), ...p, wUnit: 'drawn', hUnit: undefined } as Layer) : at0;
      })
      .filter((l) => {
        // This image, in its own image's terms: `at` images back (the space between each counted).
        const { left, right } = extentOf(l, display, layoutFor);
        const start = -at * step;
        return right > start + EDGE_SLACK && left < start + 1 - EDGE_SLACK;
      })
      .map((layer) => ({ layer, owner: n.id, shift: at * step })),
  );
}

/**
 * A neighbor's layer moved over by `by` images, once it's as drawn on this size (inShares): fitting a shorter size
 * shrinks a layer's overhang past its own image's edge, which the move would otherwise count as one.
 */
const shifted = (l: Layer, by: number): Layer => ({ ...l, x: l.x + by });

/** Which screenshots, by their place from a layer's own (-1, 1, 2…), it reaches into as drawn. */
export function reachOf(layer: Layer, display: Display, gap: number, layoutFor?: LayoutFor): number[] {
  const { left, right } = extentOf(layer, display, layoutFor);
  const step = 1 + gap;
  const out: number[] = [];
  for (let k = Math.floor((left + EDGE_SLACK) / step); k * step < right - EDGE_SLACK; k++) if (k && right > k * step + EDGE_SLACK && left < k * step + 1 - EDGE_SLACK) out.push(k);
  return out;
}

/** A canvas for measuring a text's words (TextLayer.hug), made once. */
let measureCtx: CanvasRenderingContext2D | null | undefined;
const lineWidths = new Map<string, number>();
// A font that loads changes what its words measure: measured again, and the images that hug laid out again.
let fontsVersion = 0;
const fontWatchers = new Set<() => void>();
if (typeof document !== 'undefined' && 'fonts' in document)
  document.fonts.addEventListener('loadingdone', () => {
    lineWidths.clear();
    fontsVersion++;
    fontWatchers.forEach((f) => f());
  });
const watchFonts = (f: () => void) => {
  fontWatchers.add(f);
  return () => void fontWatchers.delete(f);
};
const useFontsVersion = () => useSyncExternalStore(watchFonts, () => fontsVersion);

function lineWidth(font: string, text: string, spacing: number): number {
  const key = `${font}|${spacing}|${text}`;
  let w = lineWidths.get(key);
  if (w == null) {
    measureCtx ??= document.createElement('canvas').getContext('2d');
    if (!measureCtx) return 0;
    measureCtx.font = font;
    w = measureCtx.measureText(text).width + spacing * [...text].length;
    if (lineWidths.size > 2000) lineWidths.clear();
    lineWidths.set(key, w);
  }
  return w;
}

/** A text's own width (points): its widest line in its font, its icon and the gap after it, its box's padding and rim. */
export function huggedWidth(l: TextLayer, language: Language, appFont: string): number {
  const family = l.font === 'system' ? SYSTEM_FONT : l.font === 'serif' ? SERIF_FONT : l.font === 'google' && l.family ? googleFontStack(l.family) : appFont;
  const font = `${l.italic ? 'italic ' : ''}${l.weight} ${l.size}px ${family}`;
  // Its accent's words in the accent's own weight, style and family (they're drawn so: wider, often).
  const a = l.accent;
  const accentItalic = a?.italic ?? l.italic;
  const accentFont = a ? `${accentItalic ? 'italic ' : ''}${a.weight ?? l.weight} ${l.size}px ${a.family ? googleFontStack(a.family) : family}` : font;
  const spacing = (l.tracking ?? -0.01) * l.size;
  const lines = textIn(l, language).replace(/\*\*/g, '').split('\n');
  const widthOf = (line: string) => (a ? accentParts(line).reduce((t, p) => t + lineWidth(p.accent ? accentFont : font, p.text, spacing), 0) : lineWidth(font, line.replace(/\*/g, ''), spacing));
  let w = Math.max(...lines.map(widthOf));
  if (l.icon) w += l.size * 1.3;
  const box = l.glass ? glassPill(l.glass) : l.box;
  if (box && !box.wide) w += 2 * box.padX * l.size + 2 * (box.rim ?? 0);
  return Math.ceil(w) + 1;
}

/** A text at this image's size: its points scaled as the breakpoint's reference has them (ptScale). */
const scaledText = (l: TextLayer, display: Display): TextLayer => {
  const k = ptScale(display);
  return k === 1 ? l : { ...l, size: l.size * k };
};

const hasHug = (l: Layer): boolean => (l.kind === 'text' ? !!l.hug : l.kind === 'group' && l.children.some(hasHug));

/**
 * A layer as it's laid out here with its hugging texts (TextLayer.hug) at their words' width in this language, a
 * group's too (its layers resolved for this size, then hugged): everything after (its box, the group, aligning and
 * snapping) sees that width.
 */
function hugged(l: Layer, display: Display, language: Language, appFont: string): Layer {
  if (!hasHug(l)) return l;
  if (l.kind === 'text') return { ...l, w: huggedWidth(scaledText(l, display), language, appFont) / display.w, wUnit: 'drawn' };
  if (l.kind !== 'group') return l;
  return { ...l, children: l.children.map((c) => ({ ...hugged(resolveAt(c, sizeOf(display)), display, language, appFont), sizes: undefined })) };
}

export function ShotImage({ shot, display, language, layoutFor, edit, neighbors, spillEdit, gap = 0, run }: Props) {
  const font = useAppFont();
  // The lines a dragged layer lines up with (shares of the image), while it does.
  const [guides, setGuides] = useState<Guides | null>(null);
  // Each layer as it's laid out on this size's breakpoint.
  const fontsLoaded = useFontsVersion();
  const layers = useMemo(() => shot.layers.map((l) => hugged(resolveAt(l, sizeOf(display)), display, language, font)), [shot.layers, display, language, font, fontsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps
  // The neighbors' layers that reach into this one, moved over by an image and the space between: drawn where this
  // screenshot's stack puts them (linkAbove; at the back if it doesn't say), picked and edited here too.
  // Mid-drag too: one dragged toward this image shows here as it reaches it.
  const watched = useMemo(() => (neighbors ?? []).flatMap((n) => n.shot.layers.filter((l) => l.extend).map((l) => liveKeyOf(display, l.id))), [neighbors, display]);
  const live = useLiveDrags(watched);
  const crossing = useMemo(() => crossingInto(neighbors ?? [], display, gap, layoutFor, (id) => live(liveKeyOf(display, id))), [neighbors, display, gap, layoutFor, live]);
  const order = useMemo(() => stackOf(shot, crossing.map((c) => c.layer.id)), [shot, crossing]);
  const own = new Map(layers.map((l) => [l.id, l]));
  const linked = new Map(crossing.map((c) => [c.layer.id, c]));
  const content = (shown: Layer) => <LayerContent layer={shown} display={display} language={language} layoutFor={layoutFor} />;
  return (
    <div data-store-image={shot.id} data-store-size={sizeOf(display)} style={{ position: 'relative', width: display.w, height: display.h, overflow: 'hidden', background: run ? undefined : backgroundCss(shot.background), '--hc-store-app-font': font } as CSSProperties}>
      {run && <RunBackground run={run} display={display} gap={gap} />}
      {order.map((e) => {
        if (e.linked) {
          const c = linked.get(e.id)!;
          return (
            <LayerBox
              key={`${c.owner}:${e.id}`}
              spillOf={c.owner}
              shift={c.shift}
              layer={shifted(inShares(c.layer, display), c.shift)}
              display={display}
              layoutFor={layoutFor}
              edit={spillEdit && spillEditFor(spillEdit, c.owner, c.shift)}
              snap={seams(gap)}
              onGuides={setGuides}
              content={content}
            />
          );
        }
        const l = own.get(e.id);
        return !l || l.hidden ? null : <LayerBox key={l.id} layer={inShares(l, display)} display={display} layoutFor={layoutFor} edit={edit} snap={snapTargets(layers, l.id, gap)} onGuides={setGuides} content={content} />;
      })}
      {guides?.x !== undefined && <span className={`${styles.snapLine} ${styles.snapV}`} style={{ left: guides.x * display.w }} aria-hidden />}
      {guides?.y !== undefined && <span className={`${styles.snapLine} ${styles.snapH}`} style={{ top: guides.y * display.h }} aria-hidden />}
    </div>
  );
}

/** Where a dragged layer's center lines up: shares of the image across (x) and down (y). */
type Guides = { x?: number; y?: number };
/**
 * Where an element across two screenshots lines up: the image's edges, and the middle of the store's space beside
 * each (centered there, it's half in each image).
 */
const seams = (gap: number) => ({ xs: [-gap / 2, 0, 1, 1 + gap / 2], ys: [] as number[] });

/** A neighbor's layer edited from here: picked here, its place moved back by how far over it's drawn (`shift`). */
function spillEditFor(edit: SpillEdit, owner: string, shift: number): ShotEdit {
  return {
    picked: edit.picked,
    zoom: edit.zoom,
    overlay: edit.overlay,
    onPick: edit.onPick,
    onChange: edit.onChange && ((id, patch) => edit.onChange!(owner, id, patch.x == null ? patch : { ...patch, x: Math.round((patch.x - shift) * 10000) / 10000 })),
  };
}

/** What a layer's center snaps to: the image's middle, and the centers of the other shown layers placed by theirs. */
function snapTargets(layers: Layer[], self: string, gap: number): { xs: number[]; ys: number[] } {
  const others = layers.filter((l) => l.id !== self && !l.hidden);
  // The seams too (seams()): a layer centered on one is half in each image (an element across two screenshots).
  return { xs: [...seams(gap).xs, 0.5, ...others.filter((l) => !anchorSide(l.ax)).map((l) => l.x)], ys: [0.5, ...others.filter((l) => !anchorSide(l.ay)).map((l) => l.y)] };
}

/** How near (screen pixels) a center has to come to a line to snap to it. */
const SNAP_PX = 6;
const nearest = (targets: number[], v: number, within: number) => {
  let best: number | undefined;
  for (const t of targets) if (Math.abs(t - v) <= within && (best === undefined || Math.abs(t - v) < Math.abs(best - v))) best = t;
  return best;
};

/** A device's height over its width as drawn: its frame's, or the screen's alone. */
function deviceAspect(layer: DeviceLayer, display: Display, layoutFor: LayoutFor): number {
  if (!layer.frame) return display.h / display.w;
  const models = modelsFor(display);
  const model = models.find((m) => m.device.id === layer.model) ?? models[0];
  const box = frameBox(layoutFor(model?.display ?? display, false, layer.page.id));
  return box.h / box.w;
}

/** A layer's width as a share of this image's: a device's, as large as fits its box (`w` across, `h` down). */
export function drawnW(layer: Layer, display: Display, layoutFor: LayoutFor): number {
  if (layer.kind === 'group') {
    // Its children's: side by side, theirs added and the gaps between; one under the other, the widest.
    const ws = shownChildren(layer, display).map((c) => drawnW(c, display, layoutFor));
    if (!ws.length) return 0;
    return layer.layout === 'row' ? ws.reduce((a, b) => a + b, 0) + ((ws.length - 1) * layer.gap * fitScale(display)) / REF_W : Math.max(...ws);
  }
  if (layer.kind !== 'device') return layer.w;
  // Its W and H are its outline as seen: turned in 3D (narrower toward its side), the device is drawn as large as
  // makes the outline that size.
  const t = turnOf(layer, display, layoutFor);
  const byW = layer.w / t.w;
  // Its width leads, or no height given: as wide as its W. Its height leads: as large as fits both.
  if (!layer.h || layer.lead === 'w') return byW;
  return Math.min(byW, (layer.h * display.h) / (t.h * deviceAspect(layer, display, layoutFor) * display.w));
}

/**
 * How a turned device's outline compares with its frame flat (outline over frame, across and down): 1 when it isn't
 * turned. The same at any size (the outline scales with the device), so worked out once per angle and model.
 */
const turns = new Map<string, { w: number; h: number }>();
export function turnOf(layer: DeviceLayer, display: Display, layoutFor: LayoutFor): { w: number; h: number } {
  if (!layer.frame || !layer.tilt || isFlat(layer.tilt)) return { w: 1, h: 1 };
  const models = modelsFor(display);
  const model = models.find((m) => m.device.id === layer.model) ?? models[0];
  const layout = layoutFor(model?.display ?? display, false, layer.page.id);
  const key = JSON.stringify([model?.device.id, model?.display.key, layout.frameW, layout.frameH, layout.rotLocked, layer.tilt.x, layer.tilt.y]);
  let r = turns.get(key);
  if (!r) {
    const spec = model ? bodyOf(model.device.id, model.display.key) : undefined;
    const b = sceneBounds({ mesh: frameMesh(layout, spec).tris, tilt: layer.tilt, rot90: layout.rotLocked, face: { w: layout.frameW, h: layout.frameH } });
    const box = frameBox(layout);
    r = { w: (b.maxX - b.minX) / box.w, h: (b.maxY - b.minY) / box.h };
    if (turns.size > 500) turns.clear();
    turns.set(key, r);
  }
  return r;
}

/**
 * Where a layer's outline is drawn, around its box's center (points): a device turned in 3D, where its frame and body
 * show in perspective (Capture's own bounds); anything else, its whole box (null).
 */
function outlineOf(layer: Layer, display: Display, layoutFor: LayoutFor): Box | null {
  const b = turnedBounds(layer, display, layoutFor);
  if (!b) return null;
  // Drawn centered on its place (DeviceContent shifts it so): the outline is too.
  const [cx, cy] = [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2];
  return { minX: b.minX - cx, maxX: b.maxX - cx, minY: b.minY - cy, maxY: b.maxY - cy };
}

/**
 * Where a device turned in 3D shows, around its frame's center (points, at its size on the image): its frame and
 * body in perspective, as Capture bounds them. Null for anything else.
 */
function turnedBounds(layer: Layer, display: Display, layoutFor: LayoutFor): Box | null {
  if (layer.kind !== 'device' || !layer.frame || !layer.tilt || isFlat(layer.tilt)) return null;
  const models = modelsFor(display);
  const model = models.find((m) => m.device.id === layer.model) ?? models[0];
  const layout = layoutFor(model?.display ?? display, false, layer.page.id);
  const s = (drawnW(layer, display, layoutFor) * display.w) / frameBox(layout).w;
  const spec = model ? bodyOf(model.device.id, model.display.key) : undefined;
  const b = sceneBounds({ mesh: frameMesh(layout, spec).tris, tilt: layer.tilt, rot90: layout.rotLocked, face: { w: layout.frameW, h: layout.frameH } });
  return { minX: b.minX * s, maxX: b.maxX * s, minY: b.minY * s, maxY: b.maxY * s };
}

/** A layer being dragged, by size and id (`liveKeyOf`), as it is mid-drag: every copy of it follows. */
const liveDrags = new Map<string, Partial<Layer>>();
const liveSubs = new Map<string, Set<() => void>>();
/** How many times each one changed: what a screenshot watching several reads. */
const liveVersions = new Map<string, number>();
export const liveKeyOf = (display: Display, layerId: string) => `${display.w}x${display.h}:${layerId}`;
function setLiveDrag(key: string, v: Partial<Layer> | null) {
  if (v) liveDrags.set(key, v);
  else if (!liveDrags.delete(key)) return;
  liveVersions.set(key, (liveVersions.get(key) ?? 0) + 1);
  for (const f of liveSubs.get(key) ?? []) f();
}
const subscribeLive = (keys: string[]) => (f: () => void) => {
  for (const k of keys) liveSubs.set(k, (liveSubs.get(k) ?? new Set()).add(f));
  return () => keys.forEach((k) => liveSubs.get(k)?.delete(f));
};
/** The layers `keys` mid-drag, read as `live(key)`: a change to any of them draws again. */
function useLiveDrags(keys: string[]): (key: string) => Partial<Layer> | null {
  const id = keys.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const subscribe = useMemo(() => subscribeLive(keys), [id]);
  const version = useSyncExternalStore(subscribe, () => keys.map((k) => liveVersions.get(k) ?? 0).join(','));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (key: string) => liveDrags.get(key) ?? null, [version]);
}
function useLiveDrag(key: string): Partial<Layer> | null {
  return useSyncExternalStore(
    (f) => {
      const set = liveSubs.get(key) ?? new Set();
      liveSubs.set(key, set.add(f));
      return () => void set.delete(f);
    },
    () => liveDrags.get(key) ?? null,
  );
}

/** How deep a layer is in a group (0: one of its own layers), or null when it isn't in it. */
function depthIn(g: GroupLayer, id: string | null): number | null {
  if (!id) return null;
  for (const c of g.children) {
    if (c.id === id) return 0;
    if (c.kind === 'group') {
      const d = depthIn(c, id);
      if (d !== null) return d + 1;
    }
  }
  return null;
}

/** A pointer that moved less than this (screen pixels) clicked: it picks, doesn't move. */
const CLICK_SLOP = 3;

function LayerBox({
  layer: saved,
  display,
  layoutFor,
  edit,
  snap,
  onGuides,
  content,
  spillOf,
  shift = 0,
}: {
  /** A neighbor's (this screenshot's id), crossing into this image: drawn here, picked and moved in its own. */
  spillOf?: string;
  /** How many images over it's drawn from its own (a neighbor's: -1 or 1): its anchors are its own image's. */
  shift?: number;
  layer: Layer;
  display: Display;
  layoutFor: LayoutFor;
  edit?: ShotEdit;
  snap: { xs: number[]; ys: number[] };
  onGuides: (g: Guides | null) => void;
  /** What it shows, for the layer as it is now (mid-drag: as dragged). */
  content: (layer: Layer) => ReactNode;
}) {
  const W = display.w;
  const H = display.h;
  // Mid-drag the change stays here, on this image alone (every size redrawing on each move is what made a drag slow);
  // it's saved, and the other sizes follow, when the pointer lets go.
  // Shared by every copy of it on this size (its own image's, and the neighbors' it reaches into), in its own image's
  // terms: a drag moves it everywhere it shows.
  const liveKey = liveKeyOf(display, saved.id);
  const shared = useLiveDrag(liveKey);
  const live = useMemo(() => (shared && shift && shared.x != null ? { ...shared, x: shared.x + shift } : shared), [shared, shift]);
  // The latest too, for letting go: a quick drag ends before the move's render, with the one before in its closure.
  const liveNow = useRef<Partial<Layer> | null>(null);
  const setLive = (v: Partial<Layer> | null) => {
    liveNow.current = v;
    setLiveDrag(liveKey, v && shift && v.x != null ? { ...v, x: v.x - shift } : v);
  };
  const layer = useMemo(() => (live ? ({ ...saved, ...live } as Layer) : saved), [saved, live]);
  const committed = useRef(false);
  useEffect(() => {
    if (!committed.current) return;
    committed.current = false;
    setLive(null);
  }, [saved]);
  // Gone mid-drag or before its change came back (moved whole into another screenshot): its drag ends with it.
  useEffect(() => () => void ((committed.current || drag.current) && setLiveDrag(liveKey, null)), [liveKey]);
  const several = (edit?.multi?.length ?? 0) > 1;
  // A group's layers picked (a click a level down, or several with Shift), at any depth: outlined where it draws them.
  const inside = (id: string | null | undefined) => !!id && layer.kind === 'group' && !!findLayer(layer.children, id);
  const pickedChild = !several && inside(edit?.picked) ? edit!.picked : null;
  const outlined = several ? (edit?.multi ?? []).filter(inside) : pickedChild ? [pickedChild] : [];
  const outlinedKey = outlined.join('|');
  const [childBoxes, setChildBoxes] = useState<{ id: string; x: number; y: number; w: number; h: number }[]>([]);
  useLayoutEffect(() => {
    const els = outlined.map((id) => box.current?.querySelector<HTMLElement>(`[data-store-child="${CSS.escape(id)}"]`)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return setChildBoxes((b) => (b.length ? [] : b));
    // Each one's place in the group's box (the box is what its flex layout is laid out in, at every level).
    const read = () => {
      const next = els.map((el) => ({ id: el.dataset.storeChild!, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }));
      setChildBoxes((b) => (JSON.stringify(b) === JSON.stringify(next) ? b : next));
    };
    const ro = new ResizeObserver(read);
    els.forEach((el) => ro.observe(el));
    read();
    return () => ro.disconnect();
  }, [outlinedKey, layer]); // eslint-disable-line react-hooks/exhaustive-deps
  const inMulti = several && !!edit?.multi?.includes(layer.id);
  const picked = !several && edit?.picked === layer.id;
  const outline = useMemo(() => outlineOf(layer, display, layoutFor), [layer, display, layoutFor]);
  const shownW = useMemo(() => drawnW(layer, display, layoutFor), [layer, display, layoutFor]);
  const aspect = useMemo(() => (layer.kind === 'device' ? deviceAspect(layer, display, layoutFor) : 0), [layer, display, layoutFor]);
  const ring = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'move' | 'size' | 'turn' | 'many'; hx: number; hy: number; x: number; y: number; from: Layer; boxW: number; boxH: number; fit: Fit; moved: boolean; others?: { id: string; x: number; y: number }[] } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  /** `hx`, `hy`: the handle's side (-1 left or top, 1 right or bottom, 0 neither). */
  const start = (mode: 'move' | 'size', hx = 0, hy = 0) => (e: PointerEvent<HTMLElement>) => {
    // Only the person's: a screen's replayed taps bubble up here too.
    if (!edit || e.button !== 0 || !e.isTrusted) return;
    e.stopPropagation();
    // Shift: picked with the others (to group them), not moved.
    // A group: a click goes a level down each time (the group, then the layer of it under the pointer, then the layer
    // of that one…), and a click on another at the level picked picks that one. A drag still moves the group at the
    // top (its layers are placed by it). Shift picks with the others at the level picked.
    const chain: string[] = [];
    if (layer.kind === 'group')
      for (let el = (e.target as HTMLElement).closest<HTMLElement>('[data-store-child]'); el && box.current?.contains(el); el = el.parentElement?.closest<HTMLElement>('[data-store-child]') ?? null) chain.unshift(el.dataset.storeChild!);
    const depth = edit.picked === layer.id ? -1 : layer.kind === 'group' ? depthIn(layer, edit.picked) : null;
    let target = layer.id;
    if (depth !== null && chain.length) {
      if (depth === -1) target = chain[0];
      else if (chain[depth] === edit.picked) target = chain[depth + 1] ?? chain[depth];
      else target = chain[Math.min(depth, chain.length - 1)];
    }
    if (e.shiftKey && edit.onShiftPick && !spillOf) return edit.onShiftPick(depth !== null && depth >= 0 && chain.length ? chain[Math.min(depth, chain.length - 1)] : layer.id);
    // One of several picked: a drag moves them all (each by the point it's placed by), and they stay picked.
    if (mode === 'move' && inMulti && edit.onChange && !e.altKey) {
      e.currentTarget.setPointerCapture(e.pointerId);
      const others = (edit.multi ?? []).flatMap((id) => {
        const raw = shotsNow().flatMap((s) => s.layers).find((l) => l.id === id);
        if (!raw) return [];
        const at = inShares(resolveAt(raw, sizeOf(display)), display);
        return [{ id, x: at.x, y: at.y }];
      });
      drag.current = { mode: 'many', hx: 0, hy: 0, x: e.clientX, y: e.clientY, from: layer, boxW: 1, boxH: 1, fit: { w: shownW, aspect }, moved: false, others };
      return;
    }
    edit.onPick(target);
    if (!edit.onChange) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Alt + drag on a framed device turns it in 3D, as Capture's stage does.
    const turn = mode === 'move' && e.altKey && layer.kind === 'device' && layer.frame;
    // The outline's size, in the image's points (before the layer's turn): what the handles size.
    const el = ring.current;
    drag.current = { mode: turn ? 'turn' : mode, hx, hy, x: e.clientX, y: e.clientY, from: layer, boxW: el?.offsetWidth ?? 1, boxH: el?.offsetHeight ?? 1, fit: { w: shownW, aspect }, moved: false };
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || !edit?.onChange) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
    d.moved = true;
    // From screen pixels to the image's points.
    const px = dx / edit.zoom;
    const py = dy / edit.zoom;
    if (d.mode === 'many') {
      const r = (v: number) => Math.round(v * 10000) / 10000;
      for (const o of d.others ?? []) setLiveDrag(liveKeyOf(display, o.id), { x: r(o.x + px / W), y: r(o.y + py / H) });
      return;
    }
    if (d.mode === 'turn' && d.from.kind === 'device') {
      const t0 = d.from.tilt ?? { x: 0, y: 0 };
      // A screen pixel turns it a third of a degree: across, around the vertical axis; up and down, around the horizontal.
      const clamp = (v: number) => Math.max(-45, Math.min(45, Math.round(v)));
      setLive({ tilt: { x: clamp(t0.x - dy / 3), y: clamp(t0.y + dx / 3) } });
      return;
    }
    if (d.mode === 'move') {
      // Its center (x, y place its anchor's point): what snaps, then back to the anchor.
      const ox = (anchorSide(d.from.ax) * d.boxW) / 2 / W;
      const oy = (anchorSide(d.from.ay) * d.boxH) / 2 / H;
      let x = d.from.x - ox + px / W;
      let y = d.from.y - oy + py / H;
      // Its center snaps to the image's middle and to the other layers' centers (Cmd or Ctrl held: it doesn't).
      const g: Guides = {};
      if (!e.metaKey && !e.ctrlKey) {
        const sx = nearest(snap.xs, x, SNAP_PX / (edit.zoom * W));
        const sy = nearest(snap.ys, y, SNAP_PX / (edit.zoom * H));
        if (sx !== undefined) x = g.x = sx;
        if (sy !== undefined) y = g.y = sy;
      }
      onGuides(g.x !== undefined || g.y !== undefined ? g : null);
      // A centered layer moved off the middle is held by the edge on its half from then on.
      const a = anchorsFor(d.from, x - shift, y);
      const nx = x + (anchorSide(a.ax) * d.boxW) / 2 / W;
      const ny = y + (anchorSide(a.ay) * d.boxH) / 2 / H;
      setLive({ x: round(nx), y: round(ny), ax: a.ax, ay: a.ay });
      return;
    }
    setLive(resized(d, px, py, W, H));
  };
  const end = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const d = drag.current;
    drag.current = null;
    onGuides(null);
    if (d.mode === 'many') {
      // Each saved where it was let go (one undo step: they land together), then its mid-drag place let go of once
      // the saved one is drawn.
      const keys = (d.others ?? []).map((o) => liveKeyOf(display, o.id));
      if (d.moved)
        for (const o of d.others ?? []) {
          const at = liveDrags.get(liveKeyOf(display, o.id));
          const stored = storedAt(o.id, display);
          if (at && stored) edit?.onChange?.(o.id, toUnits(at, stored, display));
        }
      requestAnimationFrame(() => requestAnimationFrame(() => keys.forEach((k) => setLiveDrag(k, null))));
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }
    const moved = liveNow.current;
    if (moved) {
      // Back to its units from the layer as saved, not as drawn here (fit to this size, in shares): or a size that fits
      // it keeps the drawn width as its own, and it shrinks when let go.
      edit?.onChange?.(layer.id, toUnits(moved, storedAt(layer.id, display) ?? saved, display));
      // Kept until the saved layer comes back with it (the views hear of it a frame later): no jump back.
      committed.current = true;
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  // The box's height (its content sets it): the overlay's copy of the box is as tall, for its outline and handles.
  const [boxH, setBoxH] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !(picked || inMulti || outlined.length)) return;
    const ro = new ResizeObserver(() => setBoxH(el.offsetHeight));
    ro.observe(el);
    setBoxH(el.offsetHeight);
    return () => ro.disconnect();
  }, [picked, inMulti, outlinedKey]);
  const ringOf = (on: boolean, handles = true) => (
    <div
      ref={ring}
      className={`${styles.ring} ${on ? styles.ringOn : ''}`}
      style={outline ? { left: `calc(50% + ${outline.minX}px)`, top: `calc(50% + ${outline.minY}px)`, width: outline.maxX - outline.minX, height: outline.maxY - outline.minY } : { inset: 0 }}
      aria-hidden
    >
      {on &&
        edit?.onChange &&
        handles &&
        layer.kind !== 'group' &&
        HANDLES.map(([hx, hy]) => (
          <span
            key={`${hx}${hy}`}
            className={styles.handle}
            style={{ left: `${(hx + 1) * 50}%`, top: `${(hy + 1) * 50}%`, cursor: handleCursor(hx, hy, layer.rotate) }}
            onPointerDown={start('size', hx, hy)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
        ))}
    </div>
  );
  // Placed by its anchor's point: an edge or its center, across and down.
  const style: CSSProperties = {
    position: 'absolute',
    left: layer.x * W,
    top: layer.y * H,
    width: shownW * W,
    transform: `translate(${-50 * (1 + anchorSide(layer.ax))}%,${-50 * (1 + anchorSide(layer.ay))}%) rotate(${layer.rotate}deg)`,
    cursor: edit ? (edit.onChange ? 'move' : 'pointer') : undefined,
  };
  return (
    <div ref={box} className={styles.layerBox} data-store-edited={edit ? layer.id : undefined} data-store-outline={outline ? `${(outline.maxX - outline.minX) / display.w} ${(outline.maxY - outline.minY) / display.h}` : undefined} data-store-layer={layer.id} data-store-spill={spillOf} data-pickable={(edit && !picked) || spillOf ? '' : undefined} style={spillOf ? { ...style, cursor: 'pointer' } : style} onPointerDown={start('move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onClick={(e) => edit && e.stopPropagation()}>
      {content(layer)}
      {/* Its outline: the box, or where a turned device shows; picked, with its handles, on the overlay above it all. */}
      {childBoxes.length > 0 && edit?.overlay
        ? createPortal(
            <div style={{ ...style, height: boxH || undefined, cursor: undefined, pointerEvents: 'none' }}>
              <div className={styles.ring} style={{ inset: 0, outline: 'calc(1px / var(--store-zoom, 1)) dashed var(--ui-blue-text)' }} />
              {childBoxes.map((b) => (
                <div key={b.id} className={`${styles.ring} ${styles.ringOn}`} style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
              ))}
            </div>,
            edit.overlay,
          )
        : null}
      {(picked || inMulti) && edit?.overlay ? createPortal(<div style={{ ...style, height: boxH, cursor: undefined, pointerEvents: 'none' }}>{ringOf(true, picked)}</div>, edit.overlay) : ringOf(picked)}
    </div>
  );
}

const round = (v: number) => Math.round(v * 10000) / 10000;

/** A layer as saved for this size (its own values over the reference's), in its own units: what a drag converts back to. */
const storedAt = (id: string, display: Display): Layer | undefined => {
  const raw = findLayer(shotsNow().flatMap((s) => s.layers), id);
  return raw && resolveAt(raw, sizeOf(display));
};

/** A device layer's shadow, as Capture's presets have them: its own, or the usual one (none for a screen filling the image). */
export const shadowOf = (l: DeviceLayer, fills: boolean): Shadow | null => {
  const id = l.shadow ?? (fills ? 'none' : 'medium');
  if (id === 'custom') return l.shadowLook ?? DEFAULT_SHADOW;
  return SHADOW_PRESETS.find((p) => p.id === id)?.look ?? null;
};

/** A device layer's light: its own, or Capture's. */
export const lightOf = (l: DeviceLayer): Lighting => l.light ?? DEFAULT_LIGHT;

/**
 * A text's box shadow (TextLayer.shadow), in ems of its size: a device's presets are a phone's, too wide and faint for
 * a pill. A close edge and a soft spread lift it off a photo; a box-shadow, so the glass keeps its frost.
 */
const TEXT_SHADOWS: Record<string, string> = {
  subtle: '0 0.06em 0.16em rgba(0,0,0,0.1), 0 0.25em 0.7em rgba(0,0,0,0.12)',
  medium: '0 0.08em 0.2em rgba(0,0,0,0.14), 0 0.4em 1.1em rgba(0,0,0,0.2)',
  large: '0 0.1em 0.25em rgba(0,0,0,0.16), 0 0.6em 1.6em rgba(0,0,0,0.28)',
};
const boxShadowOf = (preset: TextLayer['shadow']) => (preset ? TEXT_SHADOWS[preset] : undefined);

/** Capture's shadow under a device scaled by `s`: away from the light, as the export draws it. */
const dropShadow = (look: Shadow | null, s: number, light: Lighting) => {
  if (!look) return undefined;
  const [dx, dy] = shadowOffset(light, look);
  return `drop-shadow(${dx * s}px ${dy * s}px ${look.blur * s}px ${shadowColor(look)})`;
};

/**
 * A filter that draws nothing, for a device without a shadow: it keeps the device the backdrop its fade's blur reads.
 * Without one, Chrome blurs a turned device whole, not only toward its fade.
 */
const BACKDROP_ROOT = 'drop-shadow(0 0 0 transparent)';

/** A device's width as drawn on the image being edited, and its height over its width. */
interface Fit {
  w: number;
  aspect: number;
}

/**
 * A layer sized by one of its handles: the side it's on follows the pointer, the opposite one stays. The move is read
 * along the layer's own axes (it may be turned). A shape's width and height change apart; the rest keep their
 * proportions, sized by the handle's side across (or, from the top or bottom, by its height).
 */
function resized(d: { hx: number; hy: number; from: Layer; boxW: number; boxH: number; fit: Fit }, px: number, py: number, W: number, H: number): Partial<Layer> {
  const a = (-d.from.rotate * Math.PI) / 180;
  const lx = px * Math.cos(a) - py * Math.sin(a);
  const ly = px * Math.sin(a) + py * Math.cos(a);
  const aspect = d.boxH / d.boxW;
  let dw: number;
  let dh: number;
  if (d.from.kind === 'shape') {
    dw = d.hx * lx;
    dh = d.hy * ly;
  } else {
    dw = d.hx ? d.hx * lx : (d.hy * ly) / aspect;
    dh = dw * aspect;
  }
  // Not past nothing.
  dw = Math.max(dw, 8 - d.boxW);
  dh = Math.max(dh, 8 - d.boxH);
  // The center moves half the growth toward the handle (only on the axes the handle pulls), turned back to the image's.
  // Centered, it grows from its center on that axis (it stays centered).
  const sx = anchorSide(d.from.ax) === 0 ? 0 : (d.hx * dw) / 2;
  const sy = anchorSide(d.from.ay) === 0 ? 0 : (d.from.kind === 'shape' || d.hy ? d.hy : 0) * (dh / 2);
  const b = (d.from.rotate * Math.PI) / 180;
  const gx = sx * Math.cos(b) - sy * Math.sin(b);
  const gy = sx * Math.sin(b) + sy * Math.cos(b);
  // Its width grows as its outline does (a turned device's outline isn't its box).
  // Its anchor's point moves with the center, plus half the growth on its side (an edge anchor: that edge's move).
  const ax = anchorSide(d.from.ax);
  const ay = anchorSide(d.from.ay);
  const patch: Partial<Layer> = { w: round((d.from.w * (d.boxW + dw)) / d.boxW), x: round(d.from.x + (gx + (ax * dw) / 2) / W), y: round(d.from.y + (gy + (ay * dh) / 2) / H) };
  if (d.from.kind === 'shape') (patch as Partial<typeof d.from>).h = round((d.from.h * (d.boxH + dh)) / d.boxH);
  // A device: its box is what's drawn here, across and down, so every size fits it in the same room.
  if (d.from.kind === 'device') {
    const w = (d.fit.w * (d.boxW + dw)) / d.boxW;
    Object.assign(patch, { w: round(w), h: round((w * W * d.fit.aspect) / H) });
  }
  return patch;
}

/** A handle's resize cursor, turned with its layer (to the nearest of the four). */
function handleCursor(hx: number, hy: number, rotate: number): string {
  const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
  const deg = (Math.atan2(hy, hx) * 180) / Math.PI + rotate;
  return CURSORS[(((Math.round(deg / 45) % 4) + 4) % 4)];
}

/** The eight handles: corners and sides, as [hx, hy]. */
const HANDLES: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

/** Where a layer is (not what it shows): a move or a turn doesn't redraw its content (a device's live screen). */
const PLACE_KEYS = new Set(['x', 'y', 'rotate', 'ax', 'ay', 'name', 'hidden', 'extend']);
const sameContent = (a: Layer, b: Layer) => {
  if (a === b) return true;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (!PLACE_KEYS.has(k) && (a as unknown as Record<string, unknown>)[k] !== (b as unknown as Record<string, unknown>)[k]) return false;
  return true;
};

const LayerContent = memo(
  LayerContentOf,
  (p, n) => p.display === n.display && p.language === n.language && p.layoutFor === n.layoutFor && sameContent(p.layer, n.layer),
);

/** Room a device's fade covers around it, a share of its box each side: its turned body and shadow reach past it. */
const FADE_ROOM = 0.2;

/** Where a share of the device's height (0 its top, 1 its bottom) falls on its fade's mask, `room` around it. */
const fadeAt = (y: number, room: number) => `${(((room + y) / (1 + 2 * room)) * 100).toFixed(2)}%`;

/**
 * A device's fade as a mask: whole down to its last `size`, then `fade` of the way to gone at the edge (the bottom,
 * the top, or both); past the edge, as at it. On a box `room` larger than the device each side (its turned body and
 * shadow reach past it), the device in its middle.
 */
function fadeMask(f: DeviceFade, room: number): CSSProperties {
  if (f.fade <= 0) return {};
  const edge = `rgba(0,0,0,${(1 - f.fade).toFixed(3)})`;
  const g = Math.min(f.gone ?? 0, f.size);
  const stops =
    f.edge === 'bottom'
      ? `#000 ${fadeAt(1 - f.size, room)}, ${edge} ${fadeAt(1 - g, room)}`
      : f.edge === 'top'
        ? `${edge} ${fadeAt(g, room)}, #000 ${fadeAt(f.size, room)}`
        : `${edge} ${fadeAt(g, room)}, #000 ${fadeAt(f.size, room)}, #000 ${fadeAt(1 - f.size, room)}, ${edge} ${fadeAt(1 - g, room)}`;
  const mask = `linear-gradient(to bottom, ${stops})`;
  return { maskImage: mask, WebkitMaskImage: mask } as CSSProperties;
}

/**
 * A device's blur toward its fade's edge: what's under it (the device: its fade's mask makes it the backdrop's whole
 * world) blurred, more the nearer the edge.
 */
function FadeBlur({ fade: f, room, scale }: { fade: DeviceFade; room: number; scale: number }) {
  if (f.blur <= 0) return null;
  const g = Math.min(f.gone ?? 0, f.size);
  const stops =
    f.edge === 'bottom'
      ? `transparent ${fadeAt(1 - f.size, room)}, #000 ${fadeAt(1 - g, room)}`
      : f.edge === 'top'
        ? `#000 ${fadeAt(g, room)}, transparent ${fadeAt(f.size, room)}`
        : `#000 ${fadeAt(g, room)}, transparent ${fadeAt(f.size, room)}, transparent ${fadeAt(1 - f.size, room)}, #000 ${fadeAt(1 - g, room)}`;
  const mask = `linear-gradient(to bottom, ${stops})`;
  const blur = `blur(${(f.blur * scale).toFixed(2)}px)`;
  return <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', backdropFilter: blur, WebkitBackdropFilter: blur, maskImage: mask, WebkitMaskImage: mask } as CSSProperties} />;
}

/**
 * A framed screen's content fading into its page background (Background/Normal/BackgroundPage, in the screen's
 * theme), over the screen inside the bezel: the stops as a device fade's, on the screen's height.
 */
function ScreenFade({ fade: f, layout, theme }: { fade: DeviceFade; layout: Layout; theme: 'light' | 'dark' }) {
  const bg = 'var(--background-normal-backgroundpage)';
  const clear = 'transparent';
  const g = Math.min(f.gone ?? 0, f.size);
  const at = (v: number) => `${(v * 100).toFixed(2)}%`;
  const solid = `color-mix(in srgb, ${bg} ${(f.fade * 100).toFixed(0)}%, transparent)`;
  const stops =
    f.edge === 'bottom'
      ? `${clear} ${at(1 - f.size)}, ${solid} ${at(1 - g)}`
      : f.edge === 'top'
        ? `${solid} ${at(g)}, ${clear} ${at(f.size)}`
        : `${solid} ${at(g)}, ${clear} ${at(f.size)}, ${clear} ${at(1 - f.size)}, ${solid} ${at(1 - g)}`;
  return (
    <div
      aria-hidden
      data-theme={theme}
      style={{ position: 'absolute', inset: `${layout.bezY}px ${layout.bezX}px`, borderRadius: layout.screenRadius, pointerEvents: 'none', background: `linear-gradient(to bottom, ${stops})` }}
    />
  );
}

/** A group's children as this size lays them out (its breakpoint's, in shares), the hidden left out. */
export function shownChildren(g: GroupLayer, display: Display): Layer[] {
  // Hidden as this size has it: a child can be hidden on one size and shown on another.
  return g.children.map((c) => resolveAt(c, sizeOf(display))).filter((c) => !c.hidden).map((c) => inShares(c, display));
}

const FLEX_ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' } as const;

function LayerContentOf({ layer, display, language, layoutFor }: { layer: Layer; display: Display; language: Language; layoutFor: LayoutFor }) {
  switch (layer.kind) {
    case 'group':
      // Side by side or one under the other, `gap` apart, lined up across by `align`: each child its width and turn.
      return (
        <div style={{ display: 'flex', flexDirection: layer.layout === 'row' ? 'row' : 'column', gap: (layer.gap * display.w * fitScale(display)) / REF_W, alignItems: FLEX_ALIGN[layer.align], width: '100%', ...(layer.fade ? fadeMask(layer.fade, 0) : {}) }}>
          {shownChildren(layer, display).map((c) => (
            <div key={c.id} data-store-child={c.id} style={{ flex: 'none', width: drawnW(c, display, layoutFor) * display.w, transform: c.rotate ? `rotate(${c.rotate}deg)` : undefined }}>
              <LayerContent layer={c} display={display} language={language} layoutFor={layoutFor} />
            </div>
          ))}
        </div>
      );
    case 'device':
      return <DeviceContent layer={layer} display={display} language={language} layoutFor={layoutFor} />;
    case 'text':
      return <TextContent layer={scaledText(layer, display)} language={language} />;
    case 'image':
      return <img src={`${import.meta.env.BASE_URL}${layer.src}`} alt="" draggable={false} style={{ display: 'block', width: '100%', height: 'auto', transform: layer.flip ? 'scaleX(-1)' : undefined }} />;
    case 'component':
      return <ComponentContent layer={layer} width={drawnW(layer, display, layoutFor) * display.w} language={language} />;
    case 'shape': {
      const k = (display.w * fitScale(display)) / REF_W;
      const look = layer.shadow && layer.shadow !== 'none' ? (SHADOW_PRESETS.find((p) => p.id === layer.shadow)?.look ?? DEFAULT_SHADOW) : null;
      const filter = dropShadow(look, k, DEFAULT_LIGHT);
      if (layer.shape === 'viewfinder') return <Viewfinder layer={layer} w={drawnW(layer, display, layoutFor) * display.w} h={layer.h * display.h} k={k} filter={filter} />;
      return <div style={{ width: '100%', height: layer.h * display.h, background: layer.fill, borderRadius: layer.shape === 'ellipse' ? '50%' : layer.radius * k, filter }} />;
    }
  }
}

/** A viewfinder's four corners: each an L with a rounded bend, its arms `arm` of the shorter side, drawn inside its box. */
function Viewfinder({ layer, w, h, k, filter }: { layer: ShapeLayer; w: number; h: number; k: number; filter?: string }) {
  const t = (layer.stroke ?? 5) * k;
  const arm = Math.min(w, h) * (layer.arm ?? 0.18);
  const r = Math.min(layer.radius * k, arm);
  const [a, b, c, d] = [t / 2, t / 2, w - t / 2, h - t / 2];
  const corner = (x: number, y: number, sx: number, sy: number) => `M${x + sx * arm},${y} H${x + sx * r} Q${x},${y} ${x},${y + sy * r} V${y + sy * arm}`;
  const path = [corner(a, b, 1, 1), corner(c, b, -1, 1), corner(a, d, 1, -1), corner(c, d, -1, -1)].join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible', filter }} aria-hidden>
      <path d={path} fill="none" stroke={layer.fill} strokeWidth={t} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * A box's fill, and with a rim, a band of light frosted glass around it: the fill inside the border, the light over
 * the border, both on the box's one blur of what's behind it.
 */
function boxFill(box: TextBox | undefined): CSSProperties {
  if (!box) return {};
  if (!box.rim) return { background: box.fill };
  return {
    border: `${box.rim}px solid transparent`,
    background: `linear-gradient(${box.fill}, ${box.fill}) padding-box, linear-gradient(160deg, rgba(255,255,255,.42), rgba(255,255,255,.14)) border-box`,
  };
}

/**
 * A minimal device (DeviceLayer.look): its face white, lit from the top left and a shade darker toward the bottom
 * right, a hairline around it so it holds on a light background and a soft highlight inside its edge; its sides (turned
 * in 3D) the same white.
 */
const MINIMAL_COLOR = '#F2F3F6';
/**
 * Its face in its color, lit from the top left (a touch lighter) and a shade darker toward the bottom right; a soft
 * highlight inside its top edge, a soft shade inside its bottom one. No line around it: frame, edge and sides one color.
 */
const minimalFrame = (c: string) =>
  ({
    '--hc-device': `linear-gradient(150deg, color-mix(in srgb, ${c}, #fff 55%) 0%, ${c} 50%, color-mix(in srgb, ${c}, #000 7%) 100%)`,
    boxShadow: `inset 0 2px 1px color-mix(in srgb, ${c}, #fff 70%), inset 0 -2px 3px color-mix(in srgb, ${c}, #000 8%)`,
    // Its Home button in its color too, with a ring of a faint gray (the original's silver, barely there).
    '--hc-home-button': `linear-gradient(150deg, color-mix(in srgb, ${c}, #fff 40%), ${c})`,
    '--hc-home-ring': `inset 0 0 0 1.5px color-mix(in srgb, ${c}, #000 12%)`,
  }) as CSSProperties;

/** A minimal device's body as clay: every part in its color, matte (no metal, grain or dark backing). */
const clayLight = (l: Lighting): Lighting => ({ ...l, clay: true, metal: 0, grain: 0 });

/** A text's typeface: the app's, the system's, a serif, or a Google Fonts family. */
const fontOf = (l: TextLayer) => (l.font === 'system' ? SYSTEM_FONT : l.font === 'serif' ? SERIF_FONT : l.font === 'google' && l.family ? googleFontStack(l.family) : 'var(--hc-store-app-font)');

/** A text's words split at its asterisks: every other part (the second, the fourth…) is in its accent. */
export const accentParts = (text: string): { text: string; accent: boolean }[] => text.split('*').map((part, i) => ({ text: part, accent: i % 2 === 1 })).filter((p) => p.text);

/** A text's words split at its double asterisks: every other part (`**Perfect fit.**`) bold, its accents inside. */
const boldParts = (text: string): { text: string; bold: boolean }[] => text.split('**').map((part, i) => ({ text: part, bold: i % 2 === 1 })).filter((p) => p.text);

/** An accent's background, per line it breaks onto (each line its own block or stroke). */
function accentFill(a: NonNullable<TextLayer['accent']>): CSSProperties {
  if (!a.fill) return {};
  const lines = { boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' } as CSSProperties;
  return a.fillStyle === 'marker'
    ? { ...lines, background: `linear-gradient(to top, ${a.fill} 0 36%, transparent 36%)`, padding: '0 0.06em' }
    : { ...lines, background: a.fill, borderRadius: '0.16em', padding: '0 0.12em' };
}

function TextContent({ layer, language }: { layer: TextLayer; language: Language }) {
  useGoogleFont(layer.font === 'google' ? layer.family : undefined);
  useGoogleFont(layer.accent?.family);
  const words = textIn(layer, language);
  const { accent, icon } = layer;
  const box = layer.glass ? glassPill(layer.glass) : layer.box;
  const blur = box?.blur ? `blur(${box.blur}px)` : undefined;
  // A label (an icon, a box) hugs its words, lined up as the text is; a plain text fills its width.
  const label = box || icon;
  const accented = (text: string) =>
    accent
      ? accentParts(text).map((p, i) =>
          p.accent ? (
            <span key={i} style={{ color: accent.color, fontWeight: accent.weight, fontStyle: accent.italic == null ? undefined : accent.italic ? 'italic' : 'normal', fontFamily: accent.family ? googleFontStack(accent.family) : undefined, ...accentFill(accent) }}>
              {p.text}
            </span>
          ) : (
            p.text
          ),
        )
      : text;
  // `**words**` bold (a review's title), then its accents (`*words*`) in each part.
  const shown = words.includes('**') ? boldParts(words).map((p, i) => (p.bold ? <strong key={i} style={{ fontWeight: Math.max(700, layer.weight) }}>{accented(p.text)}</strong> : <span key={i}>{accented(p.text)}</span>)) : accented(words);
  // In a label the words are one item beside the icon, so their lines and accents flow as text, not side by side.
  const inner = (
    <>
      {icon && <Icon name={icon} size={layer.size} fill color={layer.iconColor} style={{ flex: 'none' }} />}
      {label ? <span>{shown}</span> : shown}
    </>
  );
  return (
    <div
      style={{
        ...(label && {
          display: 'flex',
          justifyContent: FLEX_ALIGN[layer.align === 'left' ? 'start' : layer.align === 'right' ? 'end' : 'center'],
        }),
        fontSize: layer.size,
        fontWeight: layer.weight,
        fontStyle: layer.italic ? 'italic' : undefined,
        color: layer.color,
        textAlign: layer.align,
        lineHeight: layer.leading ?? 1.12,
        letterSpacing: `${layer.tracking ?? -0.01}em`,
        // A pill (a box hugging its words) stays on one line: it grows with them, its box's width only places it.
        whiteSpace: (label && !box?.wide) || layer.hug ? 'pre' : 'pre-wrap',
        // Its lines as even as they can be: a text never ends on a word alone, in any language or size.
        textWrap: 'balance',
        fontFamily: fontOf(layer),
      }}
    >
      {label ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            // As wide as the layer (a card in a list, all of one width), or hugging its words (a pill).
            width: box?.wide ? '100%' : undefined,
            boxSizing: 'border-box',
            gap: icon ? '0.3em' : undefined,
            padding: box ? `${box.padY}em ${box.padX}em` : undefined,
            borderRadius: box ? `${box.radius}em` : undefined,
            ...boxFill(box),
            backdropFilter: blur,
            WebkitBackdropFilter: blur,
            boxShadow: [box?.stroke && `inset 0 0 0 1px ${box.stroke}`, box && boxShadowOf(layer.shadow)].filter(Boolean).join(', ') || undefined,
          }}
        >
          {inner}
        </span>
      ) : (
        inner
      )}
    </div>
  );
}

/**
 * One of the app's components, drawn from its story as the gallery draws it (in the app's theme and the screenshot's
 * language), laid out at its own width and zoomed to the layer's: its height follows what it shows.
 */
function ComponentContent({ layer, width, language }: { layer: ComponentLayer; width: number; language: Language }) {
  const [appTheme] = useAppTheme();
  const mod = STORIES.get(layer.component);
  const story = mod?.stories.find((s) => s.name === layer.story) ?? mod?.stories[0];
  const args = useMemo(
    () => (mod ? Object.fromEntries(Object.entries({ ...mod.args, ...story?.args, ...layer.args, ...layer.argsIn?.[language] }).map(([k, v]) => [k, v === null ? undefined : v])) : {}),
    [mod, story, layer.args, layer.argsIn, language],
  );
  // Its texts put another way (ComponentLayer.replace), in the screenshot's language.
  const drawn = useRef<HTMLDivElement>(null);
  useTextSwap(drawn, layer.replace?.[language] ?? layer.replace?.[BASE_LANGUAGE], JSON.stringify(args));
  const frameW = Math.max(40, layer.frameW);
  const zoom = width / frameW;
  const box = layer.glass ? glassBox(layer.glass) : layer.box;
  const blur = box?.blur ? `blur(${box.blur}px)` : undefined;
  const look = layer.shadow && layer.shadow !== 'none' ? (layer.shadow === 'custom' ? DEFAULT_SHADOW : (SHADOW_PRESETS.find((p) => p.id === layer.shadow)?.look ?? null)) : null;
  if (!mod) return <div className={styles.missing}>{t('No component “{name}”', { name: layer.component })}</div>;
  return (
    <div style={{ width, filter: dropShadow(look, zoom, DEFAULT_LIGHT) }}>
      <div
        data-theme={layer.theme ?? 'light'}
        data-app-theme={appTheme?.id}
        lang={language}
        style={{ width: frameW, zoom, boxSizing: 'border-box', color: 'var(--tx)', pointerEvents: 'none', ...(box && SURFACE_CLEAR), ...(box && { padding: `${box.padY}px ${box.padX}px`, borderRadius: box.radius, ...boxFill(box), backdropFilter: blur, WebkitBackdropFilter: blur, boxShadow: box.stroke ? `inset 0 0 0 1px ${box.stroke}` : undefined }) }}
      >
        <ErrorBoundary label={t('Story “{name}”', { name: story?.name ?? layer.story })} resetKey={JSON.stringify(args)}>
          {/* Still, as a screen's picture is: no animation (CSS or JS), each part at its end. */}
          <StillCtx.Provider value>
            <div ref={drawn} data-still style={{ display: 'contents' }}>
              <SharedSimProvider>{mod.render(args as never, NO_STORY_CONTEXT)}</SharedSimProvider>
            </div>
          </StillCtx.Provider>
        </ErrorBoundary>
      </div>
    </div>
  );
}

/**
 * With a box of its own (a card, a glass), the box is the component's surface and its edge: the app's own surface and
 * hairline under it clear, so a story drawn on its card (or a tile with its outline) shows the glass through.
 */
const SURFACE_CLEAR = { '--background-normal-backgroundsurface': 'transparent', '--app-surface': 'transparent', '--border-regular-muted': 'transparent' } as CSSProperties;

/** A story drawn on a screenshot reports nothing and changes nothing. */
const NO_STORY_CONTEXT = { action: () => () => {}, update: () => {} };

function DeviceContent({ layer, display, language, layoutFor }: { layer: DeviceLayer; display: Display; language: Language; layoutFor: LayoutFor }) {
  const W = display.w;
  // The screen as it was added, in the set's language.
  const query = useMemo(() => {
    const q = new URLSearchParams(layer.query);
    if (language !== BASE_LANGUAGE) q.set(LANG_PARAM, language);
    q.set('theme', layer.theme ?? 'light');
    return q;
  }, [layer.query, language, layer.theme]);
  const { frame } = layer;
  // The device it's drawn as: the one picked, or the first of the catalog with this display's size.
  const models = useMemo(() => modelsFor(display), [display]);
  const model = models.find((m) => m.device.id === layer.model) ?? models[0];
  const shown = model?.display ?? display;
  const makeLayout = useMemo(() => (open: boolean, pageId?: string) => (frame ? layoutFor(shown, open, pageId) : screenOnly(layoutFor(shown, open, pageId))), [frame, layoutFor, shown]);
  // The screen: its picture, drawn by the dev server (screenImage.tsx); the app live only where nothing draws it.
  const pages = useNavRoot().pages;
  const still = useStillScreens();
  const spec = useMemo(() => screenSpec(pages, layer, display, language), [pages, layer.page, layer.query, layer.theme, layer.model, layer.frame, layer.taps, layer.scroll, layer.replace, layer.recolor, display, language]); // eslint-disable-line react-hooks/exhaustive-deps
  // Its other languages, drawn ahead while it's on the canvas (ScreenStill): switching language finds them ready.
  const others = useMemo(
    () => (still ? LANGUAGES.filter((l) => l.id !== language).map((l) => screenSpec(pages, layer, display, l.id)) : null),
    [still, spec], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const theme = layer.theme ?? 'light';
  const live = () => <LiveScreen layer={layer} query={query} makeLayout={makeLayout} theme={theme} />;
  const L = makeLayout(false, layer.page.id);
  // A turned or split screen (a page with no landscape, a video area) is the app as it was.
  const pictured = still !== false && !L.rotLocked && !L.videoH;
  const screen = pictured ? <ScreenStill spec={spec} others={others} w={L.vw} h={L.vh} radius={frame ? L.screenRadius : 0} dark={theme === 'dark'} live={live} /> : live();
  const tilt = layer.tilt ?? FLAT;
  const glare = layer.glare ? <ScreenGlare layout={makeLayout(false, layer.page.id)} tilt={tilt} light={lightSide(lightOf(layer))} strength={layer.glareStrength ?? 0.8} side={layer.glareSide ?? 'top'} softness={0} /> : null;
  if (frame) {
    const layout = makeLayout(false, layer.page.id);
    const box = frameBox(layout);
    const s = (drawnW(layer, display, layoutFor) * W) / box.w;
    const minimal = layer.look === 'minimal';
    const clay = layer.minimalColor ?? MINIMAL_COLOR;
    const color = minimal ? clay : (layer.finish ?? finishesOf(model?.device.id)[0].color);
    // Turned, perspective moves it off its frame's center: shifted back, so where it shows is centered on its place
    // (the guides and the handles line up with what's seen, and a turn keeps it where it is).
    const b = turnedBounds(layer, display, layoutFor);
    const shift = b ? `translate(${-(b.minX + b.maxX) / 2}px, ${-(b.minY + b.maxY) / 2}px)` : undefined;
    // A fade on the screen alone keeps the frame whole; one on the device fades all of it.
    const screenFade = layer.fade?.on === 'screen' ? layer.fade : null;
    const deviceFade = layer.fade && !screenFade ? layer.fade : null;
    const body = (
      <>
        {!isFlat(tilt) && <DeviceBody layout={layout} deviceId={model?.device.id} displayKey={model?.display.key} color={color} tilt={tilt} scale={s} light={minimal ? clayLight(lightOf(layer)) : lightOf(layer)} />}
        <div className={frameStyles.frame} style={{ ...frameStyle(layout, s, tiltCss(tilt)), transition: 'none', zIndex: 1, boxShadow: 'none', ...(minimal && minimalFrame(clay)) }}>
          {screen}
          {screenFade && <ScreenFade fade={screenFade} layout={layout} theme={theme} />}
          <FrameHardware layout={layout} />
          {glare}
        </div>
      </>
    );
    return (
      <div style={{ position: 'relative', width: box.w * s, height: box.h * s, transform: shift, filter: dropShadow(shadowOf(layer, false), s, lightOf(layer)) ?? BACKDROP_ROOT }}>
        {deviceFade ? (
          // Faded over room around the device (its turned body reaches past it), its shadow fading with it.
          <div style={{ position: 'absolute', left: -FADE_ROOM * box.w * s, top: -FADE_ROOM * box.h * s, width: box.w * s * (1 + 2 * FADE_ROOM), height: box.h * s * (1 + 2 * FADE_ROOM), ...fadeMask(deviceFade, FADE_ROOM) }}>
            <div style={{ position: 'absolute', left: FADE_ROOM * box.w * s, top: FADE_ROOM * box.h * s, width: box.w * s, height: box.h * s }}>{body}</div>
            <FadeBlur fade={deviceFade} room={FADE_ROOM} scale={(W * fitScale(display)) / REF_W} />
          </div>
        ) : (
          body
        )}
      </div>
    );
  }
  const s = (drawnW(layer, display, layoutFor) * W) / display.w;
  // Filling the image (no frame, full width, straight): square, as the screenshot it is; smaller: the screen's corners.
  const fills = s >= 0.999 && layer.rotate === 0;
  // In glass: the slab as wide as the layer, the screen inset by an even edge; shorter than the screen alone, so
  // centered in its box (the guides and handles keep the screen's).
  const glass = !fills && layer.glass ? glassBox(layer.glass) : null;
  const edge = glass ? GLASS_EDGE * display.w : 0;
  const k = (display.w * s) / (display.w + 2 * edge);
  const slabH = (display.h + 2 * edge) * k;
  const blur = glass?.blur ? `blur(${glass.blur}px)` : undefined;
  return (
    <div style={{ height: display.h * s, display: 'flex', alignItems: 'center', filter: dropShadow(shadowOf(layer, fills), s, lightOf(layer)) ?? BACKDROP_ROOT }}>
      <div
        style={{
          position: 'relative',
          width: display.w * s,
          height: slabH,
          borderRadius: fills ? 0 : (display.r + edge) * k,
          overflow: 'hidden',
          ...(glass && { background: glass.fill, backdropFilter: blur, WebkitBackdropFilter: blur, boxShadow: `inset 0 0 0 1px ${glass.stroke}` }),
          ...(layer.fade ? fadeMask(layer.fade, 0) : {}),
        }}
      >
        <div style={{ position: 'absolute', left: edge * k, top: edge * k, width: display.w * k, height: display.h * k, borderRadius: glass ? display.r * k : 0, overflow: 'hidden' }}>
          <div style={{ position: 'relative', width: display.w, height: display.h, transform: `scale(${k})`, transformOrigin: 'top left' }}>
            {screen}
            {glare}
          </div>
        </div>
        {layer.fade && <FadeBlur fade={layer.fade} room={0} scale={(W * fitScale(display)) / REF_W} />}
      </div>
    </div>
  );
}

/** A device in glass: its edge around the screen, a share of the screen's width (a frosted phone's, as Figma draws it). */
const GLASS_EDGE = 0.045;

/**
 * The screen as the app, live (where no dev server draws its picture): as Interact with the screen left it, its taps
 * again (what they opened), then its lists scrolled, once the screen has drawn them. A new state draws a new screen (a
 * tap twice would close what it opened).
 */
const LiveScreen = memo(function LiveScreen({ layer, query, makeLayout, theme }: { layer: DeviceLayer; query: URLSearchParams; makeLayout: (open: boolean, pageId?: string) => Layout; theme: 'light' | 'dark' }) {
  const holder = useRef<HTMLDivElement>(null);
  // The screen's box: what the texts are swapped in (the holder is `display: contents`).
  const screenBox = useMemo(() => ({ get current() { return holder.current?.parentElement ?? null; } }), []);
  const { scroll, taps } = layer;
  const stateKey = useMemo(() => JSON.stringify([taps, scroll, query.toString(), layer.frame]), [taps, scroll, query, layer.frame]);
  useEffect(() => {
    if (!scroll?.length && !taps?.length) return;
    let live = true;
    let raf = 0;
    const nextFrame = () => new Promise((r) => (raf = requestAnimationFrame(r)));
    // Busy until it's set (the export waits for it: ExportStage).
    const el = holder.current;
    if (el) el.dataset.replaying = '';
    void (async () => {
      // A frame first: an effect run twice (React's development check) lets go of the first before it taps.
      await nextFrame();
      for (let i = 0; live && holder.current && !screenRootIn(holder.current) && i < 120; i++) await nextFrame();
      if (!live || !holder.current) return;
      if (taps?.length) await replayTaps(holder.current, taps, () => live);
      for (let i = 0; live && holder.current && !applyScroll(holder.current, scroll ?? []) && i < 180; i++) await nextFrame();
      if (live && el) delete el.dataset.replaying;
    })();
    return () => {
      if (el) delete el.dataset.replaying;
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [stateKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Its texts put another way (DeviceLayer.replace), as the picture has them: again whenever the screen redraws them.
  const lang = query.get(LANG_PARAM) ?? BASE_LANGUAGE;
  useTextSwap(screenBox, layer.replace?.[lang] ?? layer.replace?.[BASE_LANGUAGE], stateKey);
  // Its colors put another way (DeviceLayer.recolor): once a frame at most, as the screen redraws.
  const colorsKey = JSON.stringify(layer.recolor ?? null);
  useEffect(() => {
    const root = holder.current?.parentElement;
    const swaps = layer.recolor;
    if (!root || !swaps?.length) return;
    let raf = 0;
    const paint = () => {
      raf = 0;
      recolor(root, swaps);
      // What recolor changed itself (its probe) isn't the screen redrawing: left unread, it would paint forever, and
      // the export would wait for a screen that never settles.
      mo.takeRecords();
    };
    const mo = new MutationObserver(() => (raf ||= requestAnimationFrame(paint)));
    mo.observe(root, { subtree: true, childList: true, characterData: true });
    paint();
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [colorsKey, stateKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Not for the pointer here (the wheel, a tap): the canvas picks and moves it; the screen is set in its dialog.
  return (
    <div key={stateKey} ref={holder} style={{ display: 'contents', pointerEvents: 'none' }}>
      {/* Its own app state: each screenshot's screen is a phone of its own, so a tap replayed on one (a question to
          the Coach) doesn't add to the others'. */}
      <SharedSimProvider>
        <PreviewScreen page={layer.page} query={query} makeLayout={makeLayout} still overlays theme={theme} />
      </SharedSimProvider>
    </div>
  );
});
