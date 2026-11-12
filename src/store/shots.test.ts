import { describe, expect, it } from 'vitest';
import { copiedPlacement, copyPlacement, REFERENCE_SIZE, resolveAt, setOwnDevice, sourceAt, writeAt, type TextLayer } from './shots';

const text = (over: Partial<TextLayer> = {}): TextLayer => ({ id: 't', kind: 'text', text: { en: 'Hi' }, size: 40, weight: 700, color: '#000', align: 'center', x: 0.5, y: 0.1, w: 0.8, rotate: 0, ...over });

describe('a layer on each size', () => {
  const l = text({ sizes: { 'appstore.ipad13': { size: 64, y: 0.2 } } });

  it('takes its size’s own values over its own', () => {
    expect(resolveAt(l, 'appstore.ipad13')).toMatchObject({ size: 64, y: 0.2, x: 0.5, w: 0.8 });
    expect(resolveAt(l, 'appstore.ipad11')).toMatchObject({ size: 40, y: 0.1 });
  });

  it('says which values are the size’s own', () => {
    expect(sourceAt(l, 'size', 'appstore.ipad13')).toBe('device');
    expect(sourceAt(l, 'x', 'appstore.ipad13')).toBeUndefined();
  });

  it('keeps a change on a size as its own there (a color too); what it says, everywhere', () => {
    expect(writeAt(l, { x: 0.3, color: '#f00', text: { en: 'Hey' } }, 'appstore.ipad13')).toEqual({ text: { en: 'Hey' }, sizes: { 'appstore.ipad13': { size: 64, y: 0.2, x: 0.3, color: '#f00' } } });
    // Turned off there (unset): null, over the layer's own; drawn as unset.
    const off = writeAt(text({ italic: true }), { italic: undefined }, 'appstore.ipad11');
    expect(off).toEqual({ sizes: { 'appstore.ipad11': { italic: null } } });
    expect(resolveAt({ ...text({ italic: true }), ...off } as TextLayer, 'appstore.ipad11').italic).toBeUndefined();
    expect(writeAt(text(), { x: 0.3 }, 'appstore.ipad11')).toEqual({ sizes: { 'appstore.ipad11': { x: 0.3 } } });
  });

  it('on the reference, a change is the layer’s own', () => {
    expect(writeAt(l, { y: 0.3 }, REFERENCE_SIZE)).toEqual({ y: 0.3 });
  });

  it('copies a place and size as laid out on one size, to paste on another as its own', () => {
    copyPlacement(l, 'appstore.ipad13', 'iPad 13″');
    expect(copiedPlacement()).toEqual({ from: 'iPad 13″', values: { x: 0.5, y: 0.2, w: 0.8, rotate: 0, size: 64, ax: 'center', ay: 'center', wUnit: '%' } });
    expect(writeAt(text(), copiedPlacement()!.values, 'appstore.ipad11')).toEqual({ sizes: { 'appstore.ipad11': { x: 0.5, y: 0.2, w: 0.8, rotate: 0, size: 64, ax: 'center', ay: 'center', wUnit: '%' } } });
  });

  it('starts and stops a size’s own values', () => {
    expect(setOwnDevice(text(), 'appstore.ipad13', true)).toEqual({ sizes: { 'appstore.ipad13': {} } });
    expect(setOwnDevice(l, 'appstore.ipad13', false)).toEqual({ sizes: undefined });
  });
});
