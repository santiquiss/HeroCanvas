// Where Capture's light comes from: the three presets as they were, an angle set by hand anywhere across (scene.ts
// lightDir, ScreenGlare's angle).
import { describe, expect, it } from 'vitest';
import { lightDir, lightSide, presetAt } from './scene';
import { glareAngle } from './ScreenGlare';

const FLAT = { x: 0, y: 0 };
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));
const norm = (v: number[]) => v.map((x) => x / Math.hypot(...v));

describe('the light', () => {
  it('lights the presets as before: left, top, right', () => {
    close(lightDir({ from: 'left' }), norm([-0.45, -0.6, 0.66]));
    close(lightDir({ from: 'top' }), norm([0, -0.75, 0.66]));
    close(lightDir({ from: 'right' }), norm([0.45, -0.6, 0.66]));
    expect(glareAngle(FLAT, lightSide({ from: 'left' }), 'top')).toBe('150deg');
    expect(glareAngle(FLAT, lightSide({ from: 'top' }), 'top')).toBe('172deg');
    expect(glareAngle(FLAT, lightSide({ from: 'right' }), 'top')).toBe('210deg');
  });
  it('takes an angle set by hand over its preset, between them and past', () => {
    expect(lightSide({ from: 'right', side: 0.5 })).toBe(0.5);
    const half = lightDir({ from: 'right', side: 0.5 })[0];
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(lightDir({ from: 'right' })[0]);
    expect(lightDir({ from: 'right', side: 1.5 })[0]).toBeGreaterThan(lightDir({ from: 'right' })[0]);
    expect(presetAt(0)).toBe('top');
    expect(presetAt(0.5)).toBeNull();
  });
});
