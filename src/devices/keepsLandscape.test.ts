// Switching devices: landscape stays on a display that's turned as a rule, else back upright.
import { describe, expect, it } from 'vitest';
import { keepsLandscape, landAfterSwitch } from './devices';

describe('keepsLandscape', () => {
  it('keeps it to a tablet and a foldable’s inner display', () => {
    expect(keepsLandscape('ipad11', null)).toBe(true);
    expect(keepsLandscape('ipadmini', null)).toBe(true);
    expect(keepsLandscape('ipduo', 'inner')).toBe(true);
  });
  it('drops it to a phone and the iPhone Duo’s outer display (its first, the one a switch to the device opens)', () => {
    expect(keepsLandscape('ip17', null)).toBe(false);
    expect(keepsLandscape('ipduo', 'outer')).toBe(false);
    expect(keepsLandscape('ipduo', null)).toBe(false);
  });
});

describe('landAfterSwitch: a foldable opened', () => {
  it('opens the iPhone Duo like a book: from its outer display upright, the inner one turned', () => {
    expect(landAfterSwitch('ipduo', 'outer', 'inner', false)).toBe(true);
  });
  it('opens a Galaxy Z Fold or a Pixel Fold upright', () => {
    expect(landAfterSwitch('zf7', 'outer', 'inner', false)).toBe(false);
    expect(landAfterSwitch('pf10', 'outer', 'inner', false)).toBe(false);
  });
  it('closes back upright, and keeps a turned inner display turned on another switch', () => {
    expect(landAfterSwitch('ipduo', 'inner', 'outer', true)).toBe(false);
    expect(landAfterSwitch('zf7', 'inner', 'inner', true)).toBe(true);
  });
});
