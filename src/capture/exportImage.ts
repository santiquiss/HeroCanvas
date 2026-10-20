// The export: the frame drawn flat (domImage), set on its body and turned (scene), with a soft shadow under it, on a
// transparent or colored background, as PNG, JPEG or WebP.
import type { Layout } from '../sim/layout';
import { deviceMesh, radiiOf } from './body';
import { elementToCanvas } from './domImage';
import type { BodySpec } from './models';
import { DEFAULT_LIGHT, lightDir, renderDevice, sceneBounds, type Box, type Lighting } from './scene';
import type { Tilt } from './tilt';

export type ImageFormat = 'png' | 'jpeg' | 'webp';
export const FORMATS: { id: ImageFormat; label: string; alpha: boolean }[] = [
  { id: 'png', label: 'PNG', alpha: true },
  { id: 'jpeg', label: 'JPG', alpha: false },
  { id: 'webp', label: 'WebP', alpha: true },
];

export interface ExportOptions {
  scale: number;
  tilt: Tilt;
  color: string;
  shadow: boolean;
  /** `null`: transparent (a format without alpha falls back to white). */
  background: string | null;
  format: ImageFormat;
  /** JPEG and WebP: 0–1. */
  quality: number;
  /** Room between the device (and its shadow) and the picture's edges, in the file's pixels. */
  padding: number;
  light?: Lighting;
  /** Its look when `shadow` is on. */
  shadowLook?: Shadow;
  /**
   * `fit` (Auto, default): the picture is the device and its shadow, at `scale`, with the padding around. `custom`
   * (Fixed): `size` pixels, the device and its shadow as large as they fit inside the padding, centered.
   */
  crop?: 'fit' | 'custom';
  size?: [number, number];
}

/** What a file will be: its crop around the frame's center and the device in it (points), its pixels a point, its size. */
export interface ExportPlan {
  box: Box;
  device: Box;
  scale: number;
  pixels: [number, number];
}

/** The file's plan for these settings: Fit around the device and its shadow, or Custom at a set size. */
export function exportPlan(layout: Layout, spec: BodySpec | undefined, tilt: Tilt, o: Pick<ExportOptions, 'scale' | 'padding' | 'shadow' | 'shadowLook' | 'crop' | 'size' | 'light'>): ExportPlan {
  const look = o.shadowLook ?? DEFAULT_SHADOW;
  if (o.crop !== 'custom' || !o.size) {
    // The padding is in the file's pixels: in points, it shrinks as the scale grows.
    const fit = exportCrop(layout, spec, tilt, o.padding / o.scale, o.shadow ? look : null, o.light);
    return { ...fit, scale: o.scale, pixels: exportPixels(fit.box, o.scale) };
  }
  // Fixed: the device and its shadow as large as the size holds them inside the padding, centered.
  const c = exportCrop(layout, spec, tilt, 0, o.shadow ? look : null, o.light);
  const [W, H] = o.size;
  const p = Math.min(o.padding, W / 2 - 16, H / 2 - 16);
  const k = Math.min((W - 2 * p) / (c.box.maxX - c.box.minX), (H - 2 * p) / (c.box.maxY - c.box.minY));
  const cx = (c.box.minX + c.box.maxX) / 2;
  const cy = (c.box.minY + c.box.maxY) / 2;
  return { box: { minX: cx - W / k / 2, maxX: cx + W / k / 2, minY: cy - H / k / 2, maxY: cy + H / k / 2 }, device: c.device, scale: k, pixels: [W, H] };
}

/**
 * The shadow under the device, in points: how soft (its blur, twice the deviation, as CSS drop-shadow writes it), how
 * far down it falls, how dark.
 */
export interface Shadow {
  blur: number;
  distance: number;
  opacity: number;
}
export const DEFAULT_SHADOW: Shadow = { blur: 44, distance: 26, opacity: 0.34 };
/** Pure black at its opacity: neutral on any background, never tinted. */
export const shadowColor = (s: Shadow) => `rgba(0, 0, 0, ${s.opacity})`;

/** Where the shadow falls, in points: away from the light (to the right of a light on the left), and down. */
export function shadowOffset(light: Lighting | undefined, s: Shadow): [number, number] {
  return [-lightDir(light ?? DEFAULT_LIGHT)[0] * s.distance, s.distance];
}

/** How far a shadow's blur reaches past its edge, by its blur (a Gaussian fades out by three deviations). */
const SHADOW_REACH = 1.5;

/**
 * The picture's crop around the frame's center, in points (Fit): the turned device and its shadow, all of it, and
 * the margin around both. `device` is where the device itself lands in it.
 */
export function exportCrop(layout: Layout, spec: BodySpec | undefined, tilt: Tilt, margin: number, shadow: Shadow | null, light?: Lighting): { box: Box; device: Box } {
  const d = sceneBounds({ mesh: frameMesh(layout, spec).tris, tilt, rot90: layout.rotLocked, face: { w: layout.frameW, h: layout.frameH } });
  let b = { ...d };
  if (shadow) {
    const [dx, dy] = shadowOffset(light, shadow);
    const r = shadow.blur * SHADOW_REACH;
    b = { minX: Math.min(b.minX, d.minX + dx - r), maxX: Math.max(b.maxX, d.maxX + dx + r), minY: Math.min(b.minY, d.minY + dy - r), maxY: Math.max(b.maxY, d.maxY + dy + r) };
  }
  return { device: d, box: { minX: b.minX - margin, maxX: b.maxX + margin, minY: b.minY - margin, maxY: b.maxY + margin } };
}

/** The file's size in pixels for a crop. */
export function exportPixels(box: Box, scale: number): [number, number] {
  return [Math.ceil((box.maxX - box.minX) * scale), Math.ceil((box.maxY - box.minY) * scale)];
}

/** The device's body for this frame: the model's thickness and keys, scaled to it. */
export function frameMesh(layout: Layout, spec: BodySpec | undefined) {
  // The screen alone: no body.
  if (layout.bare) return { tris: [], depth: 0 };
  return deviceMesh({ frameW: layout.frameW, frameH: layout.frameH, radii: radiiOf(layout.frameRadius), land: layout.land, spec, depth: layout.depth });
}

export async function exportImage(frame: HTMLElement, layout: Layout, spec: BodySpec | undefined, opts: ExportOptions): Promise<Blob> {
  const plan = exportPlan(layout, spec, opts.tilt, opts);
  // Custom sets its own pixels a point.
  const o = { ...opts, scale: plan.scale };
  // Its shadow on the canvas isn't the picture's (drawn here, under the turned device).
  const face = await elementToCanvas(frame, o.scale, { 'box-shadow': 'none' });
  const device = renderDevice(
    { mesh: frameMesh(layout, spec).tris, color: o.color, tilt: o.tilt, rot90: layout.rotLocked, light: o.light, face: { src: face, w: frame.offsetWidth, h: frame.offsetHeight } },
    o.scale,
  );
  const w = device.width;
  const h = device.height;
  const look = o.shadowLook ?? DEFAULT_SHADOW;
  const blur = o.shadow ? Math.round(look.blur * o.scale) : 0;
  // Where the device goes in the picture: its own box's corner, from the crop's.
  const ox = Math.round((plan.device.minX - plan.box.minX) * o.scale);
  const oy = Math.round((plan.device.minY - plan.box.minY) * o.scale);
  const out = document.createElement('canvas');
  [out.width, out.height] = plan.pixels;
  const ctx = out.getContext('2d')!;
  const alpha = FORMATS.find((f) => f.id === o.format)!.alpha;
  const bg = o.background ?? (alpha ? null : '#ffffff');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, out.width, out.height);
  }
  if (o.shadow) {
    // The silhouette in the shadow's color, blurred with a filter (a large shadowBlur bands).
    const silhouette = document.createElement('canvas');
    silhouette.width = w;
    silhouette.height = h;
    const sc = silhouette.getContext('2d')!;
    sc.drawImage(device, 0, 0);
    sc.globalCompositeOperation = 'source-in';
    sc.fillStyle = shadowColor(look);
    sc.fillRect(0, 0, w, h);
    ctx.filter = `blur(${blur / 2}px)`;
    const [dx, dy] = shadowOffset(o.light, look);
    ctx.drawImage(silhouette, ox + Math.round(dx * o.scale), oy + Math.round(dy * o.scale));
    ctx.filter = 'none';
  }
  ctx.drawImage(device, ox, oy);
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), `image/${o.format}`, o.quality));
}
