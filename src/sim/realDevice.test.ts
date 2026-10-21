import { describe, expect, it } from 'vitest';
import { findAnyDevice, findDisplay } from '../devices/devices';
import { computeLayout } from './layout';
import { matchDisplay, platformOf, realByDefault, realDisplay, turnedSafe } from './realDevice';

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };

describe('the device in hand', () => {
  it('knows the system from the user agent', () => {
    expect(platformOf('Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)')).toBe('ios');
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
    expect(platformOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('other');
    expect(platformOf('Mozilla/5.0 (Linux; Android 16; Pixel 10 Pro)')).toBe('android');
  });

  it('matches a known display by its width, with all of its height or less (a browser with its bars)', () => {
    expect(matchDisplay(402, 874, 'ios')?.device.id).toBe('ip17');
    expect(matchDisplay(402, 760, 'ios')?.device.id).toBe('ip17');
    expect(matchDisplay(466, 678, 'ios')?.display.key).toBe('outer');
    expect(matchDisplay(669, 951, 'ios')?.device.id).toBe('ipduo');
    expect(matchDisplay(390, 760, 'ios')?.device.id).toBe('ip16e');
    // Not another system's display of the same width, nor a much shorter or a taller screen.
    expect(matchDisplay(427, 952, 'ios')).toBeNull();
    expect(matchDisplay(402, 500, 'ios')).toBeNull();
    expect(matchDisplay(402, 900, 'ios')).toBeNull();
  });

  it('keeps a known display’s traits at the real size, and draws no system', () => {
    const { device, display, land, known } = realDisplay({ w: 678, h: 466, safe: NONE }, 'ios');
    expect([device.id, display.key, land, known]).toEqual(['ipduo', 'outer', true, true]);
    const L = computeLayout({ display, land, supported: true, detailOpen: false });
    expect([L.sideNav, L.cornerStatus, L.real, L.bez]).toEqual([true, 'vertical', true, 0]);
    expect([L.frameW, L.frameH]).toEqual([678, 466]);
  });

  it('makes any other screen a phone or a tablet of its size', () => {
    const phone = realDisplay({ w: 385, h: 700, safe: NONE }, 'other');
    expect([phone.known, phone.device.type, phone.display.os, phone.display.w, phone.display.h]).toEqual([false, 'phone', 'ios', 385, 700]);
    const tablet = realDisplay({ w: 1180, h: 820, safe: NONE }, 'android');
    expect([tablet.device.type, tablet.display.os, tablet.land, tablet.display.rot]).toEqual(['tablet', 'android', true, true]);
  });

  it('lays out with the safe area the device reports', () => {
    const { display } = realDisplay({ w: 402, h: 874, safe: { top: 62, right: 0, bottom: 34, left: 0 } }, 'ios');
    const L = computeLayout({ display, land: false, supported: false, detailOpen: false });
    expect([L.sbH, L.botIn]).toEqual([62, 34]);
    // A registry display keeps its OS's heights.
    const ip17 = findAnyDevice('ip17');
    expect(computeLayout({ display: findDisplay(ip17, null), land: false, supported: false, detailOpen: false }).sbH).toBe(54);
  });

  it('turns the safe area with the device for a screen that stays in portrait', () => {
    const safe = { top: 0, right: 0, bottom: 21, left: 62 };
    expect(turnedSafe(safe, 90)).toEqual({ top: 62, right: 0, bottom: 0, left: 21 });
    expect(turnedSafe({ top: 0, right: 62, bottom: 21, left: 0 }, 270)).toEqual({ top: 62, right: 21, bottom: 0, left: 0 });
  });

  it('is on by itself when installed or on a phone', () => {
    expect(realByDefault(true, false, 1200)).toBe(true);
    expect(realByDefault(false, true, 402)).toBe(true);
    expect(realByDefault(false, true, 834)).toBe(false);
    expect(realByDefault(false, false, 402)).toBe(false);
  });
});
