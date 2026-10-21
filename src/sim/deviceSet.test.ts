import { describe, expect, it } from 'vitest';
import { parseDevices, serializeDevices } from './deviceSet';
import { LANGUAGES } from './language';

// The app's languages (the tour's: English only): its last one, and one it doesn't have.
const own = LANGUAGES[LANGUAGES.length - 1].id;

describe('a set of devices', () => {
  it('keeps each device’s own language (the fifth field), and drops one the app doesn’t have', () => {
    const items = parseDevices(`ip17,ip17::::${own},ip17:::live:${own},ip17::::xx`);
    expect(items.map((i) => i.lang)).toEqual([undefined, own, own, undefined]);
    expect(serializeDevices(items)).toBe(`ip17,ip17::::${own},ip17:::live:${own},ip17`);
  });
});
