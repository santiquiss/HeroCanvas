// A device layer in 3D: Capture's body (capture/scene: the device's sides and buttons in its finish, in WebGL) behind
// the live frame, turned with the same projection (capture/tilt), so a screenshot's device can lean like a photo of
// one. Only drawn while it's turned: facing front the body doesn't show.
import { useLayoutEffect, useRef } from 'react';
import { ALL_DEVICES, type Device, type Display } from '../devices/devices';
import { frameMesh } from '../capture/exportImage';
import { bodyOf, modelOf, type Finish } from '../capture/models';
import { DeviceScene, type Lighting } from '../capture/scene';
import type { Tilt } from '../capture/tilt';
import type { Layout } from '../sim/layout';
import captureStyles from '../capture/CaptureStage.module.css';

/** The catalog's devices with a display of this size: the models a screenshot's device can be. */
export function modelsFor(display: Display): { device: Device; display: Display }[] {
  // A screen of no device's size names its own (Google Play's): those first, each at its own proportions.
  const named = (display.devices ?? []).flatMap((id) => ALL_DEVICES.filter((d) => d.id === id).map((device) => ({ device, display: device.displays[0] })));
  const same = ALL_DEVICES.flatMap((device) => device.displays.filter((x) => x.w === display.w && x.h === display.h).map((x) => ({ device, display: x })));
  return [...named, ...same];
}

/** The finishes a model is sold in (one dark one for a device without its own). */
export const finishesOf = (deviceId: string | undefined): Finish[] => modelOf(deviceId ?? '').finishes;

/**
 * One WebGL context for every body on the canvas: each is drawn on it and copied to its own 2D canvas, so a layout with
 * many turned devices (one a size, each screenshot) doesn't run out of the browser's few contexts (the oldest go
 * blank). Made again if the browser takes it back.
 */
let shared: DeviceScene | null = null;
function sharedScene(): DeviceScene | null {
  if (!shared || shared.lost) shared = DeviceScene.create(document.createElement('canvas'));
  return shared;
}

/**
 * Bodies drawn, by what they show: a screenshot drawn again (back from Listing graphics, another store, a zoom seen
 * before) copies its body instead of drawing it in 3D. The oldest go past a few screens' worth.
 */
const drawnBodies = new Map<string, HTMLCanvasElement>();
const MAX_BODIES = 160;

/**
 * Bodies to draw, a few each frame (a 3D draw is tens of milliseconds; a canvas of turned devices would stop the page
 * for seconds): the interface answers at once and the bodies come in, one after another.
 */
const bodyJobs = new Set<() => void>();
let bodyFrame = 0;
const FRAME_BUDGET_MS = 8;
function runBodyJobs() {
  bodyFrame = 0;
  const end = performance.now() + FRAME_BUDGET_MS;
  for (const job of bodyJobs) {
    bodyJobs.delete(job);
    job();
    if (performance.now() > end) break;
  }
  if (bodyJobs.size) bodyFrame = requestAnimationFrame(runBodyJobs);
}
/** Bodies waiting to be drawn: none, and every device on the page shows its body (the export waits for it). */
export const bodiesPending = () => bodyJobs.size;

/** The pixels per point a body is drawn at when it's exported (the store's own), or null: the screen's, at most 2. */
let exportScale: number | null = null;
export const setBodyExportScale = (n: number | null) => void (exportScale = n);

function queueBody(job: () => void): () => void {
  bodyJobs.add(job);
  bodyFrame ||= requestAnimationFrame(runBodyJobs);
  return () => bodyJobs.delete(job);
}

/** The body behind a framed device, turned by `tilt`, at `scale` points to pixels. */
export function DeviceBody({ layout, deviceId, displayKey, color, tilt, scale, light }: { layout: Layout; deviceId?: string; displayKey?: string; color: string; tilt: Tilt; scale: number; light: Lighting }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const spec = deviceId ? bodyOf(deviceId, displayKey ?? 'main') : undefined;
  // Room for the body around the frame at any turn.
  const size = Math.ceil(Math.max(layout.frameW, layout.frameH) * 1.3 * scale);
  const dpr = exportScale ?? Math.min(2, window.devicePixelRatio || 1);
  const { frameW, frameH, rotLocked } = layout;
  const key = JSON.stringify([deviceId, displayKey, frameW, frameH, rotLocked, color, tilt, light, Math.round(scale * 1000), size, dpr]);
  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const px = Math.round(size * dpr);
    // Drawn into the canvas when it's ready: until then the one before stays, stretched to the new size.
    const show = (from: HTMLCanvasElement) => {
      c.width = px;
      c.height = px;
      c.getContext('2d')?.drawImage(from, 0, 0);
    };
    const kept = drawnBodies.get(key);
    if (kept) {
      drawnBodies.delete(key);
      drawnBodies.set(key, kept);
      return show(kept);
    }
    return queueBody(() => {
      const scene = sharedScene();
      if (!scene) return;
      scene.canvas.width = px;
      scene.canvas.height = px;
      scene.draw({ mesh: frameMesh(layout, spec).tris, color, tilt, rot90: rotLocked, light }, scale, size, size);
      const copy = document.createElement('canvas');
      copy.width = px;
      copy.height = px;
      copy.getContext('2d')?.drawImage(scene.canvas, 0, 0);
      drawnBodies.set(key, copy);
      for (const old of drawnBodies.keys()) {
        if (drawnBodies.size <= MAX_BODIES) break;
        drawnBodies.delete(old);
      }
      show(copy);
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={canvas} className={captureStyles.body} aria-hidden style={{ width: size, height: size }} />;
}
