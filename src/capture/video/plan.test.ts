// A clip's crop and size (plan.ts): every turn fits, sizes are even (H.264), a fixed size is kept.
import { describe, expect, it } from 'vitest';
import { findAnyDevice, findDisplay } from '../../devices/devices';
import { computeLayout } from '../../sim/layout';
import { exportCrop } from '../exportImage';
import { bodyOf } from '../models';
import { videoPlan } from './plan';
import { sequenceOf } from './motion';

const layout = computeLayout({ display: findDisplay(findAnyDevice('ip17'), null), land: false, supported: true, detailOpen: false });
const spec = bodyOf('ip17', 'main');
const base = { sequence: sequenceOf({ in: 'swing', mid: 'orbit', out: 'swing' }), duration: 2, fps: 30, scale: 2, padding: 40, shadow: true };

describe('videoPlan', () => {
  it('fits every frame’s device and shadow, at even sizes', () => {
    const plan = videoPlan(layout, spec, base);
    expect(plan.pixels.every((v) => v % 2 === 0)).toBe(true);
    for (const t of plan.tilts) {
      const b = exportCrop(layout, spec, t, 0, null).box;
      expect(b.minX).toBeGreaterThanOrEqual(plan.box.minX);
      expect(b.maxX).toBeLessThanOrEqual(plan.box.maxX);
      expect(b.minY).toBeGreaterThanOrEqual(plan.box.minY);
      expect(b.maxY).toBeLessThanOrEqual(plan.box.maxY);
    }
  });
  it('keeps a fixed size, the motion fitted inside it', () => {
    const plan = videoPlan(layout, spec, { ...base, crop: 'custom', size: [1080, 1351] });
    expect(plan.pixels).toEqual([1080, 1352]);
    expect((plan.box.maxX - plan.box.minX) * plan.scale).toBeCloseTo(1080);
  });
  it('has twice the frames at 60 fps', () => {
    expect(videoPlan(layout, spec, { ...base, fps: 60 }).tilts).toHaveLength(120);
  });
});
