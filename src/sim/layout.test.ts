import { describe, expect, it } from 'vitest';
import { findAnyDevice, findDisplay } from '../devices/devices';
import { anchoredFloats, computeLayout, tallSheetTop } from './layout';

const layoutOf = (device: string, display: string | null = null, land = false) =>
  computeLayout({ display: findDisplay(findAnyDevice(device), display), land, supported: true, detailOpen: false });

describe('a sheet as tall as it gets', () => {
  it('stops 10 under the status bar, as the app’s', () => {
    expect(tallSheetTop(layoutOf('ip17'))).toBe(54 + 10);
  });

  it('stops 8 under the iPhone Duo’s status in the right column, so it can span the screen under it', () => {
    const L = layoutOf('ipduo', 'outer');
    expect(L.cornerStatus).toBe('vertical');
    // Camera (21 + 28), 8 to the status, the status (86), then 8.
    expect(tallSheetTop(L)).toBe(21 + 28 + 8 + 86 + 8);
  });

  it('stops 8 under the corner status where it sits in the top-right corner', () => {
    const L = layoutOf('ipduo', 'inner');
    expect(L.reserved).not.toBeNull();
    expect(tallSheetTop(L)).toBe(L.reserved!.top + L.reserved!.height + 8);
  });
});

describe('an anchored menu floats or rises as a sheet', () => {
  const floats = (device: string, display: string | null = null, land = false) => anchoredFloats(layoutOf(device, display, land));

  it('floats 600pt wide or more: iPads, a foldable open, a phone turned that wide', () => {
    expect(floats('ipad13')).toBe(true);
    expect(floats('zf8', 'inner')).toBe(true);
    expect(floats('p10', null, true)).toBe(true);
  });

  it('on the iPhone Duo, follows the width from the content and floats from its nav column on both displays', () => {
    expect(floats('ipduo', 'outer')).toBe(false);
    expect(floats('ipduo', 'inner')).toBe(true);
    expect(anchoredFloats(layoutOf('ipduo', 'outer'), true)).toBe(true);
  });

  it('rises as a sheet on a phone and a foldable closed', () => {
    expect(floats('p10')).toBe(false);
    expect(floats('ip17')).toBe(false);
    expect(floats('zf8', 'outer')).toBe(false);
  });
});

describe('an app with only a phone layout (compactOnly)', () => {
  const tablet = findDisplay(findAnyDevice('ipad13'), 'main');
  const at = (compactOnly: boolean) => computeLayout({ display: tablet, land: false, supported: true, detailOpen: true, compactOnly });

  it('draws it on a tablet: the bar at the bottom, no rail, one column', () => {
    const l = at(true);
    expect(l.bottomNav).toBe(true);
    expect(l.showRail).toBe(false);
    expect(l.isTablet).toBe(false);
    expect(l.dashOpen).toBe(false);
  });

  it('leaves a tablet layout alone otherwise', () => {
    expect(at(false).isTablet).toBe(true);
  });
});

describe('the app’s bar height (tabBarHeight)', () => {
  const phone = findDisplay(findAnyDevice('ip17'), 'main');
  it('keeps room for the bar over the bottom inset, not the tour’s pill', () => {
    const l = computeLayout({ display: phone, land: false, supported: true, detailOpen: false, tabBarHeight: 80 });
    expect(l.padB).toBe(l.botIn + 80 + 24);
  });
});
