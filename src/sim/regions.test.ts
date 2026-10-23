// The app's side panel (appConfig.sidePanel): a panel on the right where the screen splits, the base elsewhere.
import { describe, expect, it } from 'vitest';
import { findAnyDevice, findDisplay } from '../devices/devices';
import { computeLayout } from './layout';
import { screenRegions } from './regions';

const layout = (device: string, land: boolean) => computeLayout({ display: findDisplay(findAnyDevice(device), null), land, supported: true, detailOpen: true });

describe('the side panel’s region', () => {
  it('is fixed on the right of a split, and the app keeps the left part', () => {
    const L = layout('ipad11', true);
    const R = screenRegions(L, true);
    expect(R.panel).toEqual({ left: L.detailLeft, width: L.detailW });
    expect(R.app.width).toBe(L.railW + L.baseW);
    expect(R.pushes.inPanel).toBe(false);
  });
  it('has none on a phone (it takes the base) or while it’s off', () => {
    expect(screenRegions(layout('ip17', false), true).panel).toBeNull();
    expect(screenRegions(layout('ipad11', true), false).panel).toBeNull();
  });
});

describe('the navigation over the pages (navOverPages)', () => {
  const over = (device: string, land: boolean, display: string | null = null) =>
    computeLayout({ display: findDisplay(findAnyDevice(device), display), land, supported: true, detailOpen: false, navOverPages: true });
  it('puts the base and pushes under a tablet’s rail; covers stay over it', () => {
    const L = over('ipadmini', false);
    const R = screenRegions(L);
    expect(L.railW).toBeGreaterThan(0);
    expect(R.base).toEqual({ left: 0, width: L.railW + L.baseW });
    expect(R.pushes).toMatchObject({ left: 0, width: L.railW + L.mainW });
    expect(R.covers).toEqual({ left: 0, width: L.vw });
  });
  it('puts every page under the iPhone Duo’s column', () => {
    const L = over('ipduo', false, 'outer');
    const R = screenRegions(L);
    expect(L.sideW).toBeGreaterThan(0);
    expect(R.base.left + R.base.width).toBe(L.vw);
    expect(R.covers).toEqual({ left: 0, width: L.vw });
  });
  it('leaves them beside it without', () => {
    const L = computeLayout({ display: findDisplay(findAnyDevice('ipadmini'), null), land: false, supported: true, detailOpen: false });
    expect(screenRegions(L).base.left).toBe(L.railW);
  });
});
