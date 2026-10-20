// The MP4 packing (mp4.ts): the boxes a player looks for, the index first, and the frames where the index says.
import { describe, expect, it } from 'vitest';
import { muxMp4, readBoxes } from './mp4';

const track = {
  width: 640,
  height: 480,
  fps: 30,
  avcC: new Uint8Array([1, 0x64, 0, 0x33, 0xff, 0xe0, 0, 0]),
  samples: [
    { data: new Uint8Array([1, 2, 3]), key: true },
    { data: new Uint8Array([4, 5]), key: false },
    { data: new Uint8Array([6]), key: false },
  ],
};

const find = (bytes: Uint8Array, path: string[]) => {
  let from = 0;
  let to = bytes.length;
  let hit: { type: string; at: number; size: number } | undefined;
  for (const type of path) {
    hit = readBoxes(bytes, from, to).find((b) => b.type === type);
    if (!hit) return undefined;
    // Container boxes hold their children right after their header (stsd and avc1 carry fields first: not walked).
    from = hit.at + 8;
    to = hit.at + hit.size;
  }
  return hit;
};

describe('muxMp4', () => {
  const bytes = muxMp4(track);
  const view = new DataView(bytes.buffer);

  it('writes ftyp, then the index, then the frames', () => {
    expect(readBoxes(bytes).map((b) => b.type)).toEqual(['ftyp', 'moov', 'mdat']);
    expect(find(bytes, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsz'])).toBeDefined();
  });

  it('points the chunk offset at the first frame', () => {
    const stco = find(bytes, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stco'])!;
    const offset = view.getUint32(stco.at + 16);
    expect([...bytes.subarray(offset, offset + 6)]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('lists every frame size, the key frames and the duration', () => {
    const stsz = find(bytes, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stsz'])!;
    expect(view.getUint32(stsz.at + 16)).toBe(3);
    expect([20, 24, 28].map((d) => view.getUint32(stsz.at + d))).toEqual([3, 2, 1]);
    const stss = find(bytes, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stss'])!;
    expect([view.getUint32(stss.at + 12), view.getUint32(stss.at + 16)]).toEqual([1, 1]);
    const mdhd = find(bytes, ['moov', 'trak', 'mdia', 'mdhd'])!;
    expect([view.getUint32(mdhd.at + 20), view.getUint32(mdhd.at + 24)]).toEqual([30, 3]);
  });
});

describe('durations', () => {
  it('writes each sample’s own duration, runs of equal ones together', () => {
    const bytes = muxMp4({ ...track, timescale: 1000, durations: [33, 33, 500] });
    const view = new DataView(bytes.buffer);
    const stts = find(bytes, ['moov', 'trak', 'mdia', 'minf', 'stbl', 'stts'])!;
    expect(view.getUint32(stts.at + 12)).toBe(2);
    expect([16, 20, 24, 28].map((d) => view.getUint32(stts.at + d))).toEqual([2, 33, 1, 500]);
    const mdhd = find(bytes, ['moov', 'trak', 'mdia', 'mdhd'])!;
    expect([view.getUint32(mdhd.at + 20), view.getUint32(mdhd.at + 24)]).toEqual([1000, 566]);
  });
});
