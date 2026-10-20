// A recorded interaction at its playback speed (prefs.ts): the clip lasts what the recording does, that much faster.
import { describe, expect, it } from 'vitest';
import { playedLength, PLAYBACK_SPEEDS } from './prefs';

describe('playback speed', () => {
  it('offers 1x, 1.5x and 2x', () => {
    expect(PLAYBACK_SPEEDS).toEqual([1, 1.5, 2]);
  });
  it('shortens the clip by the speed; no recording, no length', () => {
    expect(playedLength({ duration: 12 }, 1)).toBe(12);
    expect(playedLength({ duration: 12 }, 1.5)).toBe(8);
    expect(playedLength({ duration: 12 }, 2)).toBe(6);
    expect(playedLength(null, 2)).toBeNull();
  });
});
