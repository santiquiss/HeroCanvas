// Capture's interaction recording: what you do on the device (taps, scrolls, the pages it opens) recorded live, to be
// the screen of a video (exportVideo.ts). Chrome records the frame element alone (Element Capture: the tab's picture
// restricted to it, as the browser paints it, animations and blurs included); each frame is encoded as it comes
// (WebCodecs, VP9) and kept in memory, compressed. The taps are logged beside it, in the frame's points, to be drawn
// over the screen (taps.ts). Asking to record the tab is the browser's own prompt: one click each time.
import { t } from '../../i18n/ui';
import { muxMp4 } from './mp4';
import type { Tap } from './taps';

/** A finished recording: its encoded frames (decoded again on export) and the taps made while it ran. */
export interface Recording {
  config: VideoDecoderConfig;
  chunks: EncodedVideoChunk[];
  /** Seconds. */
  duration: number;
  /** The recorded picture, in pixels. */
  width: number;
  height: number;
  taps: Tap[];
  /**
   * The recording as an MP4 to play on the canvas (Capture's preview), as an object URL; null when it isn't H.264.
   * Revoke it when the recording goes (`dropRecording`).
   */
  preview: string | null;
}

/** Frees what a recording holds outside memory the page manages: its preview's URL. */
export function dropRecording(rec: Recording | null) {
  if (rec?.preview) URL.revokeObjectURL(rec.preview);
}

/** Recording stops by itself after this long: a few seconds is what a clip needs, and memory stays small. */
export const MAX_RECORDING_S = 30;

/** Whether this browser can record an element: Element Capture (Chrome), or Region Capture as a fallback. */
export function canRecord(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getDisplayMedia &&
    typeof VideoEncoder !== 'undefined' &&
    typeof MediaStreamTrackProcessor !== 'undefined' &&
    (typeof RestrictionTarget !== 'undefined' || typeof CropTarget !== 'undefined')
  );
}

/**
 * Codecs to keep the recording in, tried in order for its size: H.264 first (packed as an MP4, the canvas plays it
 * back as a plain video), then VP9 (no preview then: only the export reads it).
 */
const CODECS = ['avc1.640033', 'avc1.640034', 'avc1.64003c', 'vp09.00.51.08', 'vp09.00.41.08'];
const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);
/** How long to wait for the first picture before trying the other way of recording. */
const FIRST_FRAME_MS = 1500;

export interface RecordingSession {
  /** Ends it and hands the recording over (null when nothing was recorded). */
  stop: () => Promise<Recording | null>;
  /** Ends it and drops what it had. */
  cancel: () => void;
}

/** The first codec this browser encodes at `width` × `height`, with its settings. */
async function encoderConfig(width: number, height: number): Promise<VideoEncoderConfig> {
  for (const codec of CODECS) {
    const c: VideoEncoderConfig = { codec, width, height, bitrate: Math.min(width * height * 12, 40_000_000), framerate: 60, latencyMode: 'quality' };
    // `avc`: the encoder hands over the avcC record the MP4 needs.
    if (codec.startsWith('avc1')) c.avc = { format: 'avc' };
    if ((await VideoEncoder.isConfigSupported(c).catch(() => ({ supported: false }))).supported) return c;
  }
  throw new Error(t("This browser can't encode video at {width} × {height} px", { width, height }));
}

/**
 * The first picture that has the device's shape (its width to its height, within 4 %), within `ms`: the ones before
 * the recording is narrowed to the device show the whole tab, and are dropped. `seen` collects the sizes that came.
 */
async function firstOfShape(reader: ReadableStreamDefaultReader<VideoFrame>, aspect: number, ms: number, seen: string[]): Promise<VideoFrame | null> {
  const end = performance.now() + ms;
  let pending: Promise<ReadableStreamReadResult<VideoFrame>> | null = null;
  for (;;) {
    const left = end - performance.now();
    if (left <= 0) return null;
    pending ??= reader.read();
    const got = await Promise.race([pending, new Promise<null>((r) => setTimeout(() => r(null), left))]);
    if (!got) return null;
    pending = null;
    const vf = got.value;
    if (got.done || !vf) return null;
    seen.push(`${vf.displayWidth}×${vf.displayHeight}`);
    if (Math.abs(vf.displayWidth / vf.displayHeight / aspect - 1) < 0.04) return vf;
    vf.close();
  }
}

/**
 * Starts recording `frame` (the device on Capture's canvas). Rejects when the browser can't, or the person declines
 * the prompt. `onTick` gets the seconds recorded so far; `onEnd` fires if it ends on its own (the limit, or the
 * browser's own "stop sharing"); `onError` if it breaks on the way.
 */
export async function startRecording(frame: HTMLElement, onTick: (seconds: number) => void, onEnd: () => void, onError: (e: unknown) => void): Promise<RecordingSession> {
  if (!canRecord()) throw new Error(t("This browser can't record the device's screen (it needs Chrome)"));
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 60 },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
    surfaceSwitching: 'exclude',
  } as DisplayMediaStreamOptions);
  const track = stream.getVideoTracks()[0];
  // What Element Capture asks of the element it records: its own stacking context and backdrop root, flat.
  const before = { isolation: frame.style.isolation, transformStyle: frame.style.transformStyle };
  frame.style.isolation = 'isolate';
  frame.style.transformStyle = 'flat';
  // The glare isn't recorded: the video draws its own on each frame, at its turn (exportVideo).
  const glare = frame.querySelector<HTMLElement>('[data-glare]');
  const glareWas = glare?.style.visibility ?? '';
  if (glare) glare.style.visibility = 'hidden';
  const restore = () => {
    Object.assign(frame.style, before);
    if (glare) glare.style.visibility = glareWas;
  };
  const reader = new MediaStreamTrackProcessor({ track }).readable.getReader();
  let first: VideoFrame | null = null;
  let mode = 'element';
  // Its own shape, not as turned on the canvas (a playing preview may have it turned as recording starts).
  const box = { width: frame.offsetWidth, height: frame.offsetHeight };
  const aspect = box.width / box.height;
  const seen: string[] = [];
  try {
    // Only the device: Element Capture keeps its own pixels (nothing over it shows). When Chrome doesn't send any
    // (the element doesn't qualify), Region Capture instead: the tab cropped to the device's box.
    if (typeof RestrictionTarget !== 'undefined') {
      await track.restrictTo(await RestrictionTarget.fromElement(frame));
      first = await firstOfShape(reader, aspect, FIRST_FRAME_MS, seen);
    }
    if (!first && typeof CropTarget !== 'undefined') {
      mode = 'region';
      if (typeof RestrictionTarget !== 'undefined') await track.restrictTo(null).catch(() => {});
      await track.cropTo(await CropTarget.fromElement(frame));
      first = await firstOfShape(reader, aspect, FIRST_FRAME_MS * 2, seen);
    }
    if (!first) {
      console.info(`[Capture] no frames of the device (${Math.round(box.width)}×${Math.round(box.height)}); came: ${[...new Set(seen)].join(', ') || 'none'}`);
      throw new Error(t("Chrome didn't send frames of the device"));
    }
  } catch (e) {
    track.stop();
    restore();
    throw e;
  }
  const width = even(first.displayWidth);
  const height = even(first.displayHeight);
  const config = await encoderConfig(width, height);
  console.info(`[Capture] recording the interaction: ${mode === 'element' ? 'Element Capture' : 'Region Capture'}, ${width} × ${height} px, ${config.codec} (before, came: ${[...new Set(seen.slice(0, -1))].join(', ') || 'nothing'})`);

  const chunks: EncodedVideoChunk[] = [];
  let decoderConfig: VideoDecoderConfig | null = null;
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      chunks.push(chunk);
      if (meta?.decoderConfig) decoderConfig = meta.decoderConfig;
    },
    error: (e) => {
      failure = e;
      onError(e);
    },
  });
  encoder.configure(config);
  // Each picture drawn into one canvas of the first one's size: a picture that changes size (the window resized) is
  // scaled into it instead of breaking the encoder.
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const start = first.timestamp;
  const startAt = performance.now();
  let last = 0;
  let stopped = false;
  const taps = trackTaps(frame, () => (performance.now() - startAt) / 1000);

  const take = (vf: VideoFrame) => {
    ctx.drawImage(vf, 0, 0, width, height);
    const t = vf.timestamp - start;
    vf.close();
    const out = new VideoFrame(canvas, { timestamp: t });
    // A key frame every second: the export reads forward through it.
    encoder.encode(out, { keyFrame: chunks.length === 0 || Math.floor(t / 1e6) !== Math.floor(last / 1e6) });
    out.close();
    last = t;
    onTick(t / 1e6);
    return t / 1e6;
  };
  const pump = (async () => {
    take(first!);
    for (;;) {
      const { value: vf, done } = await reader.read();
      if (done || !vf) break;
      if (stopped || failure) {
        vf.close();
        break;
      }
      if (take(vf) >= MAX_RECORDING_S) {
        onEnd();
        break;
      }
    }
  })().catch((e) => {
    failure = e;
    onError(e);
  });
  // The browser's own "Stop sharing" ends it too.
  track.addEventListener('ended', onEnd);

  const finish = async () => {
    stopped = true;
    track.stop();
    taps.stop();
    restore();
    await reader.cancel().catch(() => {});
    await pump;
    if (encoder.state === 'configured') await encoder.flush().catch(() => {});
    if (encoder.state !== 'closed') encoder.close();
  };
  return {
    async stop() {
      await finish();
      if (failure) throw failure instanceof Error ? failure : new Error(String(failure));
      if (!decoderConfig || !chunks.length) return null;
      const duration = Math.max(last / 1e6, 0.1);
      return { config: decoderConfig, chunks, duration, width, height, taps: taps.list, preview: previewUrl(decoderConfig, chunks, width, height) };
    },
    cancel() {
      void finish();
    },
  };
}

/**
 * Logs the pointer on the frame while it records: where (the frame's points, from its top left) and when (seconds
 * from the first recorded frame) each touch goes down, moves and lifts.
 */
function trackTaps(frame: HTMLElement, now: () => number) {
  const list: Tap[] = [];
  const at = (e: PointerEvent): [number, number] => {
    const r = frame.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * frame.offsetWidth, ((e.clientY - r.top) / r.height) * frame.offsetHeight];
  };
  let down = false;
  const onDown = (e: PointerEvent) => {
    down = true;
    list.push({ kind: 'down', t: now(), at: at(e) });
  };
  const onMove = (e: PointerEvent) => down && list.push({ kind: 'move', t: now(), at: at(e) });
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    down = false;
    list.push({ kind: 'up', t: now(), at: at(e) });
  };
  const opts = { capture: true, passive: true };
  frame.addEventListener('pointerdown', onDown, opts);
  window.addEventListener('pointermove', onMove, opts);
  window.addEventListener('pointerup', onUp, opts);
  window.addEventListener('pointercancel', onUp, opts);
  return {
    list,
    stop() {
      frame.removeEventListener('pointerdown', onDown, opts);
      window.removeEventListener('pointermove', onMove, opts);
      window.removeEventListener('pointerup', onUp, opts);
      window.removeEventListener('pointercancel', onUp, opts);
    },
  };
}

/** Reads a recording back in order: the frame showing at each time of the clip (export, frame by frame). */
export function recordingReader(rec: Recording) {
  const ready: VideoFrame[] = [];
  let failure: unknown = null;
  const decoder = new VideoDecoder({ output: (f) => ready.push(f), error: (e) => (failure = e) });
  decoder.configure(rec.config);
  let next = 0;
  let current: VideoFrame | null = null;
  let flushed = false;
  return {
    /** The frame on screen at `t` seconds (the latest one at or before it). */
    async at(t: number): Promise<VideoFrame | null> {
      const us = t * 1e6;
      for (;;) {
        if (failure) throw failure instanceof Error ? failure : new Error(String(failure));
        // Move on while the next decoded frame is already due.
        while (ready.length && ready[0].timestamp <= us) {
          current?.close();
          current = ready.shift()!;
        }
        if (ready.length || flushed) return current;
        if (next < rec.chunks.length) {
          decoder.decode(rec.chunks[next++]);
          // Let the decoder hand over what it has before deciding.
          if (decoder.decodeQueueSize > 2) await new Promise((r) => setTimeout(r, 0));
          await new Promise((r) => setTimeout(r, 0));
        } else {
          await decoder.flush();
          flushed = true;
        }
      }
    },
    close() {
      current?.close();
      ready.forEach((f) => f.close());
      if (decoder.state !== 'closed') decoder.close();
    },
  };
}

/**
 * The recording as an MP4 (H.264 only: the muxer's), each picture lasting until the next came (a tab sends one only
 * when something changed), as an object URL.
 */
function previewUrl(config: VideoDecoderConfig, chunks: EncodedVideoChunk[], width: number, height: number): string | null {
  const desc = config.description;
  if (!config.codec.startsWith('avc1') || !desc) return null;
  const avcC = ArrayBuffer.isView(desc) ? new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength).slice() : new Uint8Array(desc as ArrayBuffer).slice();
  const samples = chunks.map((c) => {
    const data = new Uint8Array(c.byteLength);
    c.copyTo(data);
    return { data, key: c.type === 'key' };
  });
  // Milliseconds: each picture until the next one; the last one a frame at 60.
  const durations = chunks.map((c, i) => Math.max(1, Math.round(((chunks[i + 1]?.timestamp ?? c.timestamp + 16_667) - c.timestamp) / 1000)));
  const bytes = muxMp4({ width, height, fps: 60, timescale: 1000, durations, avcC, samples });
  return URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'video/mp4' }));
}
