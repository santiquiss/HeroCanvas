// Capture's video: the device turning (motion.ts) with the screen as it is, recorded as a short clip. The screen is
// drawn once (domImage, the costly part); each frame only turns the body in WebGL (scene.ts) and lays its shadow
// under it, so frames are cheap. The picture keeps one crop for the whole clip (every turn's device and shadow fit
// in it), so the device doesn't jump. No library:
// - MP4: each frame is encoded with its own timestamp (WebCodecs' VideoEncoder, H.264) and packed by mp4.ts, so the
//   clip is exact however long a frame takes to draw.
// - WebM, for a transparent background (the browser's encoder has no alpha): recorded in real time by MediaRecorder,
//   which timestamps frames as they come; a frame drawn late shows as a stutter (`late` counts them).
import type { Layout } from '../../sim/layout';
import { elementToCanvas } from '../domImage';
import { drawGlare } from '../ScreenGlare';
import { DEFAULT_SHADOW, frameMesh, shadowColor, shadowOffset } from '../exportImage';
import type { BodySpec } from '../models';
import { DeviceScene } from '../scene';
import { muxMp4, type Mp4Sample } from './mp4';
import { recordingReader, type Recording } from './recording';
import { drawTouches, touchesAt } from './taps';
import { exposure, frameTime, sequenceMotion } from './motion';
import { t } from '../../i18n/ui';
import { AVC_CODECS, BLUR_SAMPLES, recordableMime, VIDEO_CONTAINERS, videoPlan, type VideoOptions } from './plan';

/**
 * Records the clip. `onProgress` gets 0–1 as frames go out. Real time: the clip takes its own duration to record
 * (MediaRecorder timestamps frames as they come), so each frame must draw within its slot; `late` counts those that
 * didn't (they show as a stutter).
 */
export async function exportVideo(
  frame: HTMLElement,
  layout: Layout,
  spec: BodySpec | undefined,
  o: VideoOptions,
  onProgress: (done: number) => void = () => {},
  /** An interaction recorded on the device: its frames are the screen, and the clip lasts as long as it does. */
  recording: { rec: Recording; touches: boolean; /** Playback speed: the recording played this much faster. */ speed: number } | null = null,
): Promise<{ blob: Blob; mime: string; late: number }> {
  const mime = recordableMime(o.container);
  if (!mime) throw new Error(t("This browser doesn't record {format}", { format: o.container.toUpperCase() }));
  const { tilts, box, pixels, scale: k } = videoPlan(layout, spec, recording ? { ...o, duration: recording.rec.duration / recording.speed } : o);
  const [W, H] = pixels;
  const motion = sequenceMotion(o.sequence, recording ? recording.rec.duration / recording.speed : o.duration, o.rest);
  // Motion blur only where frames aren't timed by the clock (MP4): averaging eight turns a frame can't keep up in
  // real time.
  const realtime = !(o.container === 'mp4' && typeof VideoEncoder !== 'undefined');
  // Nothing to blur when the device stands still (Still, under a recording).
  const moves = tilts.some((t) => t.x !== tilts[0].x || t.y !== tilts[0].y);
  const samples = o.motionBlur && !realtime && moves ? BLUR_SAMPLES : 1;
  const look = o.shadowLook ?? DEFAULT_SHADOW;
  const alpha = VIDEO_CONTAINERS.find((c) => c.id === o.container)!.alpha;
  const background = o.background ?? (alpha ? null : '#ffffff');

  // The screen: drawn once (what costs: it walks every element; its shadow on the canvas isn't the clip's), or each
  // frame from the recording, into the frame's rounded outline (the recorded picture is square), touches over it.
  const fw = frame.offsetWidth;
  const fh = frame.offsetHeight;
  // The glare isn't the screen's: each frame draws its own at its turn (glazed), so it's left out of the picture.
  const glareEl = frame.querySelector<HTMLElement>('[data-glare]');
  const glareWas = glareEl?.style.visibility ?? '';
  if (glareEl) glareEl.style.visibility = 'hidden';
  const face = recording ? document.createElement('canvas') : await elementToCanvas(frame, k, { 'box-shadow': 'none' }).finally(() => glareEl && (glareEl.style.visibility = glareWas));
  const reader = recording ? recordingReader(recording.rec) : null;
  const faceCtx = recording ? (face as HTMLCanvasElement).getContext('2d')! : null;
  if (recording) {
    face.width = Math.round(fw * k);
    face.height = Math.round(fh * k);
  }
  const radius = parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0;
  const paintFace = async (i: number) => {
    if (!reader || !faceCtx || !recording) return;
    // The recording's own time at this frame: the clip's, at the playback speed.
    const t = (i / o.fps) * recording.speed;
    const vf = await reader.at(t);
    faceCtx.clearRect(0, 0, face.width, face.height);
    faceCtx.save();
    faceCtx.beginPath();
    faceCtx.roundRect(0, 0, face.width, face.height, radius * k);
    faceCtx.clip();
    if (vf) faceCtx.drawImage(vf, 0, 0, face.width, face.height);
    if (recording.touches) drawTouches(faceCtx, touchesAt(recording.rec.taps, t), k);
    faceCtx.restore();
  };
  const mesh = frameMesh(layout, spec).tris;

  // The body is drawn at the crop's size, the frame's center where it falls in the crop.
  const gl = document.createElement('canvas');
  gl.width = W;
  gl.height = H;
  const scene = DeviceScene.create(gl);
  if (!scene) throw new Error(t("Without WebGL the device can't be drawn in 3D"));
  const center: [number, number] = [-(box.minX + box.maxX) / 2, -(box.minY + box.maxY) / 2];

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d', { alpha: background === null })!;
  const silhouette = document.createElement('canvas');
  silhouette.width = W;
  silhouette.height = H;
  const sc = silhouette.getContext('2d')!;
  // The frame's device: one turn, or the average of the turns its shutter sees (each drawn over the running mean
  // with weight 1/(j+1), so all count the same).
  const device = samples > 1 ? document.createElement('canvas') : gl;
  device.width = W;
  device.height = H;
  const acc = samples > 1 ? device.getContext('2d')! : null;
  const [dx, dy] = shadowOffset(o.light, look);
  // The screen with the glare at a frame's turn, over the screen as drawn (or as recorded): only with a glare.
  const glazed = o.glare ? document.createElement('canvas') : null;
  const gctx = glazed?.getContext('2d') ?? null;
  if (glazed) {
    glazed.width = face.width;
    glazed.height = face.height;
  }
  const screen = { x: layout.bezX * k, y: layout.bezY * k, w: (fw - 2 * layout.bezX) * k, h: (fh - 2 * layout.bezY) * k, r: (parseFloat(layout.screenRadius) || 0) * k };
  const faceAt = (tilt: (typeof tilts)[number]) => {
    if (!glazed || !gctx || !o.glare) return { src: face, w: fw, h: fh };
    gctx.clearRect(0, 0, glazed.width, glazed.height);
    gctx.drawImage(face, 0, 0);
    drawGlare(gctx, screen, tilt, o.glare);
    return { src: glazed, w: fw, h: fh };
  };

  const draw = async (i: number) => {
    await paintFace(i);
    const turns = samples > 1 ? exposure(motion, i, tilts.length, samples) : [tilts[i]];
    if (acc) acc.clearRect(0, 0, W, H);
    // The glare at the frame's own turn (the blur's instants share it: it moves with the turn, not across it).
    const faceInput = faceAt(tilts[i]);
    turns.forEach((tilt, j) => {
      scene.draw({ mesh, color: o.color, tilt, rot90: layout.rotLocked, light: o.light, face: faceInput }, k, W, H, center);
      if (!acc) return;
      acc.globalAlpha = 1 / (j + 1);
      acc.globalCompositeOperation = j === 0 ? 'copy' : 'source-over';
      acc.drawImage(gl, 0, 0);
    });
    if (acc) {
      acc.globalAlpha = 1;
      acc.globalCompositeOperation = 'source-over';
    }
    ctx.clearRect(0, 0, W, H);
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, W, H);
    }
    // In and Out move, scale and fade the device and its shadow, over the background as it is (about the device's
    // middle, where the frame's center falls in the crop).
    const ft = frameTime(motion, i, tilts.length);
    ctx.globalAlpha = motion.alpha ? motion.alpha(ft) : 1;
    const sh = motion.shift?.(ft);
    ctx.save();
    if (sh) {
      const cx = W / 2 + center[0] * k;
      const cy = H / 2 + center[1] * k;
      ctx.translate(cx + sh.dx * k, cy + sh.dy * k);
      ctx.scale(sh.scale, sh.scale);
      ctx.translate(-cx, -cy);
    }
    if (o.shadow) {
      sc.globalCompositeOperation = 'copy';
      sc.drawImage(device, 0, 0);
      sc.globalCompositeOperation = 'source-in';
      sc.fillStyle = shadowColor(look);
      sc.fillRect(0, 0, W, H);
      ctx.filter = `blur(${Math.round(look.blur * k) / 2}px)`;
      ctx.drawImage(silhouette, Math.round(dx * k), Math.round(dy * k));
      ctx.filter = 'none';
    }
    ctx.drawImage(device, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  try {
    if (!realtime) {
      const blob = await encodeMp4(out, draw, tilts.length, o.fps, onProgress);
      return { blob, mime: 'video/mp4', late: 0 };
    }
    return await recordRealtime(out, draw, tilts.length, o.fps, mime, onProgress);
  } finally {
    scene.dispose();
    reader?.close();
  }
}

/** Frame by frame, each with its timestamp: H.264 by WebCodecs, packed as MP4. */
async function encodeMp4(canvas: HTMLCanvasElement, draw: (i: number) => Promise<void>, frames: number, fps: number, onProgress: (done: number) => void): Promise<Blob> {
  const { width, height } = canvas;
  const base = { width, height, bitrate: Math.round(width * height * fps * 0.06), framerate: fps, avc: { format: 'avc' as const } };
  let config: VideoEncoderConfig | null = null;
  for (const codec of AVC_CODECS) {
    const c = { ...base, codec };
    if ((await VideoEncoder.isConfigSupported(c)).supported) {
      config = c;
      break;
    }
  }
  if (!config) throw new Error(t("The browser can't encode H.264 at {width} × {height} px: try a smaller scale", { width, height }));
  const samples: Mp4Sample[] = [];
  let avcC: Uint8Array | null = null;
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      samples.push({ data, key: chunk.type === 'key' });
      const desc = meta?.decoderConfig?.description;
      if (desc && !avcC) avcC = ArrayBuffer.isView(desc) ? new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength).slice() : new Uint8Array(desc as ArrayBuffer).slice();
    },
    error: (e) => (failure = e),
  });
  encoder.configure(config);
  const us = 1e6 / fps;
  for (let i = 0; i < frames; i++) {
    await draw(i);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * us), duration: Math.round(us) });
    // A key frame every second: a player can seek, and one bad frame doesn't spoil the rest.
    encoder.encode(frame, { keyFrame: i % fps === 0 });
    frame.close();
    // Don't let the encoder's queue grow without bound (each frame is the full picture).
    while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 0));
    onProgress((i + 1) / frames);
    if (failure) break;
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure instanceof Error ? failure : new Error(String(failure));
  if (!avcC) throw new Error("The encoder didn't give the video's configuration");
  const bytes = muxMp4({ width, height, fps, avcC, samples });
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'video/mp4' });
}

/** In real time, as the canvas plays: MediaRecorder (the only browser encoder that keeps transparency). */
async function recordRealtime(canvas: HTMLCanvasElement, draw: (i: number) => Promise<void>, frames: number, fps: number, mime: string, onProgress: (done: number) => void) {
  // The first frame is on the canvas before recording starts, so the clip doesn't open on an empty one.
  await draw(0);
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(canvas.width * canvas.height * fps * 0.15) });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  recorder.start();

  const slot = 1000 / fps;
  const start = performance.now();
  let late = 0;
  try {
    for (let i = 0; i < frames; i++) {
      // Each frame at its own time: wait for its slot, draw it, hand it to the recorder.
      const due = start + i * slot;
      const wait = due - performance.now();
      if (wait > 1) await new Promise((r) => setTimeout(r, wait));
      else if (wait < -slot / 2) late++;
      if (i > 0) await draw(i);
      track.requestFrame();
      onProgress((i + 1) / frames);
    }
    // The last frame stays its full slot.
    await new Promise((r) => setTimeout(r, slot));
  } finally {
    recorder.stop();
    track.stop();
  }
  await stopped;
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), mime, late };
}
