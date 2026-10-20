import { describe, expect, it } from 'vitest';
import { DEVICES } from '../devices/devices';
import { computeLayout } from '../sim/layout';
import { deviceMesh, radiiOf } from './body';
import { DEVICE_MODELS } from './models';

describe('the devices’ 3D models', () => {
  it('cover every device and display, with colors', () => {
    for (const d of DEVICES) {
      const m = DEVICE_MODELS[d.id];
      expect(m, d.id).toBeTruthy();
      expect(m.finishes.length, d.id).toBeGreaterThan(0);
      for (const x of d.displays) expect(m.bodies[x.key], `${d.id} ${x.key}`).toBeTruthy();
    }
  });

  it('fold where foldables fold: a hinge behind each outer display, a crease behind each inner one', () => {
    for (const d of DEVICES.filter((x) => x.type === 'foldable'))
      for (const x of d.displays) {
        const fold = DEVICE_MODELS[d.id].bodies[x.key].fold;
        expect(fold?.hinge ?? fold?.crease, `${d.id} ${x.key}`).toBeTruthy();
        expect(!!fold?.crease, `${d.id} ${x.key}`).toBe(x.key === 'inner');
      }
  });

  it('keep their buttons on their sides and their thickness in a phone’s or a tablet’s range', () => {
    for (const d of DEVICES)
      for (const x of d.displays) {
        const spec = DEVICE_MODELS[d.id].bodies[x.key];
        expect(spec.depth, d.id).toBeGreaterThan(3.5);
        expect(spec.depth, d.id).toBeLessThan(15);
        for (const k of spec.buttons) expect(k.at + k.len, `${d.id} ${k.edge}`).toBeLessThanOrEqual(k.edge === 'top' || k.edge === 'bottom' ? spec.w : spec.h);
        // The port, from the middle of its edge, inside it.
        if (spec.port) expect(Math.abs(spec.port.at ?? 0) + spec.port.w / 2, `${d.id} port`).toBeLessThan((spec.port.edge === 'left' || spec.port.edge === 'right' ? spec.h : spec.w) / 2);
        const L = computeLayout({ display: x, land: false, supported: true, detailOpen: false });
        const { depth } = deviceMesh({ frameW: L.frameW, frameH: L.frameH, radii: radiiOf(L.frameRadius), land: false, spec, depth: L.depth });
        // In points, about 6 a mm on a phone's frame.
        expect(depth / spec.depth, d.id).toBeGreaterThan(3);
        expect(depth / spec.depth, d.id).toBeLessThan(9);
      }
  });
});
