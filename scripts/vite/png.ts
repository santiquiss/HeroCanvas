// PNG in and out, with no dependency: enough to read a logo, scale it down and write the icons made from it.
import { deflateSync, inflateSync } from 'node:zlib';

/** An image as 8-bit RGBA, row by row. */
export interface Image {
  width: number;
  height: number;
  data: Uint8Array;
}

// ---------------------------------------------------------------- reading

/** Any 8-bit, non-interlaced PNG (gray, RGB, palette, with or without alpha), as RGBA. */
export function readPng(b: Uint8Array): Image {
  const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('The logo is not a PNG');
  let o = 8;
  let width = 0;
  let height = 0;
  let type = 0;
  let palette: Uint8Array = new Uint8Array();
  let alphas: Uint8Array = new Uint8Array();
  const idat: Buffer[] = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const t = buf.toString('ascii', o + 4, o + 8);
    const d = buf.subarray(o + 8, o + 8 + len);
    if (t === 'IHDR') {
      width = d.readUInt32BE(0);
      height = d.readUInt32BE(4);
      type = d[9];
      if (d[8] !== 8 || d[12] !== 0 || ![0, 2, 3, 4, 6].includes(type))
        throw new Error('The logo must be an 8-bit PNG, not interlaced');
    }
    if (t === 'PLTE') palette = d;
    if (t === 'tRNS') alphas = d;
    if (t === 'IDAT') idat.push(d);
    if (t === 'IEND') break;
    o += 12 + len;
  }
  const bpp = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]!;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const data = new Uint8Array(width * height * 4);
  let prev: Uint8Array = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const row = unfilter(raw, y * (stride + 1), stride, bpp, prev);
    for (let x = 0; x < width; x++) {
      const i = x * bpp;
      const out = (y * width + x) * 4;
      let px: [number, number, number, number];
      if (type === 6) px = [row[i], row[i + 1], row[i + 2], row[i + 3]];
      else if (type === 2) px = [row[i], row[i + 1], row[i + 2], 255];
      else if (type === 4) px = [row[i], row[i], row[i], row[i + 1]];
      else if (type === 0) px = [row[i], row[i], row[i], 255];
      else px = [palette[row[i] * 3], palette[row[i] * 3 + 1], palette[row[i] * 3 + 2], alphas[row[i]] ?? 255];
      data.set(px, out);
    }
    prev = row;
  }
  return { width, height, data };
}

/** One row with its filter undone (PNG's five filters, against the row above). */
function unfilter(raw: Uint8Array, at: number, stride: number, bpp: number, prev: Uint8Array): Uint8Array {
  const f = raw[at];
  const row = new Uint8Array(stride);
  for (let i = 0; i < stride; i++) {
    const a = i >= bpp ? row[i - bpp] : 0;
    const up = prev[i];
    const c = i >= bpp ? prev[i - bpp] : 0;
    let p = raw[at + 1 + i];
    if (f === 1) p += a;
    else if (f === 2) p += up;
    else if (f === 3) p += (a + up) >> 1;
    else if (f === 4) p += paeth(a, up, c);
    row[i] = p & 255;
  }
  return row;
}

function paeth(a: number, b: number, c: number): number {
  const pa = Math.abs(b - c);
  const pb = Math.abs(a - c);
  const pc = Math.abs(a + b - 2 * c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// ---------------------------------------------------------------- scaling

/**
 * The image at `size`×`size`, each pixel the average of the area it covers (sharp and alias-free when scaling down).
 * Colors are averaged weighted by alpha, so transparent pixels don't darken the edges.
 */
export function resize(img: Image, size: number): Image {
  const { width: w, height: h, data } = img;
  // Premultiplied, as floats.
  const src = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] / 255;
    src[i * 4] = data[i * 4] * a;
    src[i * 4 + 1] = data[i * 4 + 1] * a;
    src[i * 4 + 2] = data[i * 4 + 2] * a;
    src[i * 4 + 3] = data[i * 4 + 3];
  }
  // Across each row (w → size), then down each column (h → size).
  const across = boxFilter(src, w, h, size, 4, w * 4);
  const down = boxFilter(across, h, size, size, size * 4, 4);
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const a = down[i * 4 + 3];
    const k = a > 0 ? 255 / a : 0;
    out[i * 4] = Math.round(Math.min(255, down[i * 4] * k));
    out[i * 4 + 1] = Math.round(Math.min(255, down[i * 4 + 1] * k));
    out[i * 4 + 2] = Math.round(Math.min(255, down[i * 4 + 2] * k));
    out[i * 4 + 3] = Math.round(Math.min(255, a));
  }
  return { width: size, height: size, data: out };
}

/**
 * One direction of the area average: `lines` lines of `from` pixels become lines of `to`. `step` is the distance
 * between neighbors along a line and `lineStep` between lines, in the source; the output is laid out the same way,
 * with `to` in place of `from` (so rows stay rows and columns stay columns).
 */
function boxFilter(src: Float32Array, from: number, lines: number, to: number, step: number, lineStep: number): Float32Array {
  const out = new Float32Array(to * lines * 4);
  const outStep = step === 4 ? 4 : to * 4;
  const outLineStep = step === 4 ? to * 4 : 4;
  const scale = from / to;
  for (let j = 0; j < to; j++) {
    const start = j * scale;
    const end = start + scale;
    for (let line = 0; line < lines; line++) {
      const o = j * outStep + line * outLineStep;
      for (let s = Math.floor(start); s < Math.min(from, Math.ceil(end)); s++) {
        const weight = (Math.min(end, s + 1) - Math.max(start, s)) / scale;
        const i = s * step + line * lineStep;
        for (let c = 0; c < 4; c++) out[o + c] += src[i + c] * weight;
      }
    }
  }
  return out;
}

/** The largest centered square of the image (a photo cropped for an avatar). */
export function square(img: Image): Image {
  const side = Math.min(img.width, img.height);
  const x0 = Math.floor((img.width - side) / 2);
  const y0 = Math.floor((img.height - side) / 2);
  const data = new Uint8Array(side * side * 4);
  for (let y = 0; y < side; y++) data.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + side) * 4), y * side * 4);
  return { width: side, height: side, data };
}

/** The image over a solid color (an iOS home-screen icon can't be transparent: iOS fills it with black). */
export function flatten(img: Image, [r, g, b]: [number, number, number]): Image {
  const data = new Uint8Array(img.data);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    data[i] = Math.round(data[i] * a + r * (1 - a));
    data[i + 1] = Math.round(data[i + 1] * a + g * (1 - a));
    data[i + 2] = Math.round(data[i + 2] * a + b * (1 - a));
    data[i + 3] = 255;
  }
  return { ...img, data };
}

// ---------------------------------------------------------------- writing

/** The image as a PNG: RGB when it's opaque, RGBA otherwise; each row with the filter that compresses it best. */
export function writePng({ width, height, data }: Image): Buffer {
  let opaque = true;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) opaque = false;
  const bpp = opaque ? 3 : 4;
  const stride = width * bpp;
  const raw = Buffer.alloc((stride + 1) * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const row = new Uint8Array(stride);
    for (let x = 0; x < width; x++)
      for (let c = 0; c < bpp; c++) row[x * bpp + c] = data[(y * width + x) * 4 + c];
    // The usual heuristic: the filter whose bytes, read as signed, add up to the least.
    let best = 0;
    let bestRow = row;
    let bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const filtered = new Uint8Array(stride);
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? row[i - bpp] : 0;
        const up = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? up : f === 3 ? (a + up) >> 1 : paeth(a, up, c);
        const v = (row[i] - pred) & 255;
        filtered[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) [best, bestRow, bestSum] = [f, filtered, sum];
    }
    raw[y * (stride + 1)] = best;
    raw.set(bestRow, y * (stride + 1) + 1);
    prev = row;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of b) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
