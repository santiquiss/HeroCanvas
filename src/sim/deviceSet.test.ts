import { describe, expect, it } from 'vitest';
import { parseDevices, serializeDevices } from './deviceSet';

describe('a set of devices', () => {
  it('keeps each device’s own language (the fifth field), and drops one the app doesn’t have', () => {
    const items = parseDevices('ip17,ip17::::es,ip17:::live:en,ip17::::xx');
    expect(items.map((i) => i.lang)).toEqual([undefined, 'es', 'en', undefined]);
    expect(serializeDevices(items)).toBe('ip17,ip17::::es,ip17:::live:en,ip17');
  });
});
