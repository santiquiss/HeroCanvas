// The app's device targets (appConfig.devices): what the designer offers.
import { describe, expect, it } from 'vitest';
import { ALL_DEVICES, platformOf, targetDevices } from './devices';

const ids = (t: Parameters<typeof targetDevices>[0]) => targetDevices(t).map((d) => d.id);

describe('targetDevices', () => {
  it('keeps every device with no targets', () => {
    expect(ids(undefined)).toEqual(ALL_DEVICES.map((d) => d.id));
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
    expect(targetDevices({ platforms: ['windows' as 'ios'] }).length).toBe(ALL_DEVICES.length);
  });
});
