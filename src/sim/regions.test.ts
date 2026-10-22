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
