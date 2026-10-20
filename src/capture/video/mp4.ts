// An MP4 file from H.264 frames (what WebCodecs' VideoEncoder hands out): the boxes ISO 14496-12 / 14496-15 ask for
// one video track, and nothing else. Ours instead of a muxer library (AGENTS.md: no new dependency). The index
// (`moov`) goes first, so a player starts before the whole file is read.

export interface Mp4Sample {
  data: Uint8Array;
  key: boolean;
}

export interface Mp4Track {
  width: number;
  height: number;
  /** Frames a second: every sample lasts one tick of this timescale (unless `durations` says otherwise). */
  fps: number;
  /**
   * How long each sample shows, in ticks of `timescale` (a recording of the tab: a picture comes only when something
   * changed). Unset: one tick of `fps` each.
   */
  durations?: number[];
  timescale?: number;
  /** The encoder's `decoderConfig.description`: the avcC record (SPS and PPS). */
  avcC: Uint8Array;
  samples: Mp4Sample[];
}

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n: number) => [(n >>> 8) & 255, n & 255];
const zeros = (n: number): number[] => Array.from({ length: n }, () => 0);

/** A box: its size, its four-letter type, its content. */
function box(type: string, ...content: (number[] | Uint8Array)[]): Uint8Array {
  const size = 8 + content.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(size);
  out.set([...u32(size), ...ascii(type)]);
  let at = 8;
  for (const c of content) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
/** A full box: a box with a version and flags first. */
const fullBox = (type: string, version: number, flags: number, ...content: (number[] | Uint8Array)[]) => box(type, [version, ...u32(flags).slice(1)], ...content);

/** The identity transform every track header and the movie header carry. */
const MATRIX = [...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)];

/** Runs of equal durations, as the time-to-sample box writes them: [count, duration] pairs. */
export function durationRuns(durations: number[]): [number, number][] {
  const runs: [number, number][] = [];
  for (const d of durations) {
    const last = runs[runs.length - 1];
    if (last && last[1] === d) last[0]++;
    else runs.push([1, d]);
  }
  return runs;
}

function moov(t: Mp4Track, mdatDataOffset: number): Uint8Array {
  const n = t.samples.length;
  const timescale = t.durations ? (t.timescale ?? 1000) : t.fps;
  const durations = t.durations ?? Array.from({ length: n }, () => 1);
  const total = durations.reduce((a, b) => a + b, 0);
  const ms = Math.round((total * 1000) / timescale);
  const mvhd = fullBox('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(ms), u32(0x10000), u16(0x100), zeros(10), MATRIX, zeros(24), u32(2));
  const tkhd = fullBox('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(ms), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(t.width << 16), u32(t.height << 16));
  const mdhd = fullBox('mdhd', 0, 0, u32(0), u32(0), u32(timescale), u32(total), u16(0x55c4) /* und */, u16(0));
  const hdlr = fullBox('hdlr', 0, 0, u32(0), ascii('vide'), zeros(12), ascii('VideoHandler'), [0]);
  const vmhd = fullBox('vmhd', 0, 1, zeros(8));
  const dinf = box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1)));
  const avc1 = box(
    'avc1',
    zeros(6),
    u16(1), // data reference index
    zeros(16),
    u16(t.width),
    u16(t.height),
    u32(0x480000), // 72 dpi
    u32(0x480000),
    u32(0),
    u16(1), // frames per sample
    zeros(32), // compressor name
    u16(0x18), // depth
    u16(0xffff),
    box('avcC', t.avcC),
  );
  const stsd = fullBox('stsd', 0, 0, u32(1), avc1);
  const runs = durationRuns(durations);
  const stts = fullBox('stts', 0, 0, u32(runs.length), runs.flatMap(([count, d]) => [...u32(count), ...u32(d)]));
  const keys = t.samples.flatMap((s, i) => (s.key ? [i + 1] : []));
  const stss = fullBox('stss', 0, 0, u32(keys.length), keys.flatMap(u32));
  // One chunk holding every sample, right after the mdat header.
  const stsc = fullBox('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1));
  const stsz = fullBox('stsz', 0, 0, u32(0), u32(n), t.samples.flatMap((s) => u32(s.data.length)));
  const stco = fullBox('stco', 0, 0, u32(1), u32(mdatDataOffset));
  const stbl = box('stbl', stsd, stts, stss, stsc, stsz, stco);
  const trak = box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', vmhd, dinf, stbl)));
  return box('moov', mvhd, trak);
}

/** The whole file: ftyp, moov (the index), mdat (the frames). */
export function muxMp4(t: Mp4Track): Uint8Array {
  const ftyp = box('ftyp', ascii('isom'), u32(0x200), ascii('isom'), ascii('iso2'), ascii('avc1'), ascii('mp41'));
  // The index's size doesn't depend on the offset it holds: measure it once, then write it with the real one.
  const moovSize = moov(t, 0).length;
  const dataSize = t.samples.reduce((n, s) => n + s.data.length, 0);
  const index = moov(t, ftyp.length + moovSize + 8);
  const out = new Uint8Array(ftyp.length + index.length + 8 + dataSize);
  out.set(ftyp, 0);
  out.set(index, ftyp.length);
  let at = ftyp.length + index.length;
  out.set([...u32(8 + dataSize), ...ascii('mdat')], at);
  at += 8;
  for (const s of t.samples) {
    out.set(s.data, at);
    at += s.data.length;
  }
  return out;
}

/** The boxes of a file at one level, for tests and checks: type, offset and size. */
export function readBoxes(bytes: Uint8Array, from = 0, to = bytes.length): { type: string; at: number; size: number }[] {
  const out: { type: string; at: number; size: number }[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let at = from; at + 8 <= to; ) {
    const size = view.getUint32(at);
    if (size < 8) break;
    out.push({ type: String.fromCharCode(...bytes.subarray(at + 4, at + 8)), at, size });
    at += size;
  }
  return out;
}
