import { describe, expect, it } from 'vitest';
import { DISCOVER_TAPS, TAP_RESET_MS, tapCounter } from './developerHidden';

describe('the hidden developer gesture', () => {
  it('is discovered by quick taps, and starts over after it', () => {
    const tap = tapCounter();
    const quick = Array.from({ length: DISCOVER_TAPS * 2 }, (_, i) => tap(i * 100));
    expect(quick.map((found, i) => (found ? i + 1 : 0)).filter(Boolean)).toEqual([DISCOVER_TAPS, DISCOVER_TAPS * 2]);
  });

  it('starts over when the taps are slow', () => {
    const tap = tapCounter(3);
    expect([tap(0), tap(100), tap(100 + TAP_RESET_MS + 1), tap(100 + TAP_RESET_MS + 100)]).toEqual([false, false, false, false]);
  });
});
