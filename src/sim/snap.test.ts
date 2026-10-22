// Where a dragged carousel rests (sim/snap.ts): on an item's own snap position, never between two.
import { describe, expect, it } from 'vitest';
import { snapTarget } from './snap';

// A row of 330px cards with a 12px gap in a 402px screen: one position per card, the last
// one clamped to the end of the row.
const CARDS = [0, 342, 684, 1026, 1300];
const PAGES = [0, 402, 804, 1206];

describe('snapTarget', () => {
  it('rests on the nearest card when released without speed', () => {
    expect(snapTarget(CARDS, 0, 100, 0)).toBe(0);
    expect(snapTarget(CARDS, 0, 200, 0)).toBe(342);
    expect(snapTarget(CARDS, 342, 402, 0)).toBe(342);
  });
  it('a flick moves on one card even after a short drag, in its direction', () => {
    expect(snapTarget(CARDS, 0, 30, 0.5)).toBe(342);
    expect(snapTarget(CARDS, 684, 660, -0.5)).toBe(342);
  });
  it('one card per flick, however fast', () => {
    expect(snapTarget(CARDS, 0, 120, 4)).toBe(342);
    expect(snapTarget(CARDS, 0, 202, 200)).toBe(342);
  });
  it('a flick after a long drag goes on to the card the content is heading into', () => {
    expect(snapTarget(CARDS, 0, 700, 1)).toBe(1026);
    expect(snapTarget(CARDS, 0, 600, 1)).toBe(684);
  });
  it('never rests between two cards or past the ends', () => {
    expect(snapTarget(CARDS, 1026, 1290, 6)).toBe(1300);
    expect(snapTarget(CARDS, 0, -40, -6)).toBe(0);
    for (let position = 0; position <= 1300; position += 37) expect(CARDS).toContain(snapTarget(CARDS, 0, position, 0));
  });
  it('a pager turns one page per flick', () => {
    expect(snapTarget(PAGES, 402, 500, 9)).toBe(804);
    expect(snapTarget(PAGES, 402, 380, -9)).toBe(0);
    expect(snapTarget(PAGES, 402, 430, 0)).toBe(402);
  });
  it('has nowhere to go without snap positions', () => {
    expect(snapTarget([], 0, 50, 1)).toBeNull();
  });
});
