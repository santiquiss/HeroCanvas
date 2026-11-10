// The app's device targets (appConfig.devices): what the designer offers.
import { describe, expect, it } from 'vitest';
import { ALL_DEVICES, platformOf, targetDevices } from './devices';

const ids = (t: Parameters<typeof targetDevices>[0]) => targetDevices(t).map((d) => d.id);

const MOBILE = ALL_DEVICES.filter((d) => d.type !== 'desktop').map((d) => d.id);

describe('targetDevices', () => {
  it('keeps every phone, foldable and tablet with no targets', () => {
    expect(ids(undefined)).toEqual(MOBILE);
  });
  it('keeps browser windows only for an app that asks, listed in its kinds’ order', () => {
    const kept = targetDevices({ types: ['desktop', 'phone'] });
    expect(kept[0].type).toBe('desktop');
    expect(new Set(kept.map((d) => d.type))).toEqual(new Set(['desktop', 'phone']));
    expect(kept.filter((d) => d.type === 'desktop').every((d) => platformOf(d) === 'web')).toBe(true);
  });
  it('keeps iPhones and iPads for iOS', () => {
    const kept = targetDevices({ platforms: ['ios'] });
    expect(kept.every((d) => platformOf(d) === 'ios')).toBe(true);
    expect(kept.some((d) => d.type === 'tablet')).toBe(true);
  });
  it('crosses platform and kind', () => {
    const kept = targetDevices({ platforms: ['android'], types: ['phone'] });
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.every((d) => platformOf(d) === 'android' && d.type === 'phone')).toBe(true);
  });
  it('keeps tablets of both platforms', () => {
    const kept = targetDevices({ types: ['tablet'] });
    expect(new Set(kept.map(platformOf))).toEqual(new Set(['ios', 'android']));
  });
  it('never empties the menus', () => {
    expect(ids({ platforms: ['windows' as 'ios'] })).toEqual(MOBILE);
  });
});
