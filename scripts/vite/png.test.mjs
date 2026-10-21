// The PNG reader, scaler and writer behind the icons (scripts/vite/png.ts).
import { describe, expect, it } from 'vitest';
import { flatten, readPng, resize, square, writePng } from './png.ts';

const solid = (w, h, rgba) => ({ width: w, height: h, data: new Uint8Array(w * h * 4).map((_, i) => rgba[i % 4]) });

describe('png', () => {
  it('reads back what it writes, opaque and with alpha', () => {
    const opaque = solid(5, 3, [10, 20, 30, 255]);
    opaque.data.set([200, 100, 0, 255], 4 * 7);
    expect(readPng(writePng(opaque))).toEqual(opaque);
    const clear = solid(4, 4, [0, 0, 0, 0]);
    clear.data.set([255, 0, 0, 128], 4 * 5);
    expect(readPng(writePng(clear))).toEqual(clear);
  });
  it('scales down by averaging the area each pixel covers', () => {
    // Left half black, right half white, 6 wide → 3 wide: the middle pixel is half of each.
    const halves = { width: 6, height: 6, data: new Uint8Array(6 * 6 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i / 4) % 6 >= 3 ? 255 : 0)) };
    const out = resize(halves, 3);
    expect([out.data[0], out.data[4], out.data[8]]).toEqual([0, 128, 255]);
  });
  it('keeps a transparent neighbor from darkening a color', () => {
    const half = { width: 2, height: 2, data: Uint8Array.from([255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0]) };
    expect([...resize(half, 1).data]).toEqual([255, 0, 0, 128]);
  });
  it('lays a transparent image over a color', () => {
    expect([...flatten(solid(1, 1, [0, 0, 0, 0]), [255, 255, 255]).data]).toEqual([255, 255, 255, 255]);
  });
  it('crops the centered square of a wide image', () => {
    // 4×2: columns 0 and 3 red, 1 and 2 blue: the square is the two blue columns.
    const wide = { width: 4, height: 2, data: new Uint8Array(32).map((_, i) => { const x = (i >> 2) % 4; return i % 4 === 3 ? 255 : i % 4 === (x === 1 || x === 2 ? 2 : 0) ? 255 : 0; }) };
    const sq = square(wide);
    expect([sq.width, sq.height]).toEqual([2, 2]);
    expect([...sq.data.subarray(0, 4)]).toEqual([0, 0, 255, 255]);
  });
});
