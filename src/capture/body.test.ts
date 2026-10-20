import { describe, expect, it } from 'vitest';
import { outline, radiiOf, sideProfile, sideTriangles } from './body';

describe('the device body', () => {
  it('reads a frame’s corners as CSS writes them', () => {
    expect(radiiOf('67px')).toEqual([67, 67, 67, 67]);
    expect(radiiOf('30px 30px 12px 12px')).toEqual([30, 30, 12, 12]);
  });

  it('runs from the face back to the full depth, flush with the outline at both edges and furthest out between', () => {
    for (const edge of ['round', 'soft', 'flat'] as const) {
      const p = sideProfile(50, edge);
      expect(p[0].z).toBeCloseTo(0);
      expect(p[p.length - 1].z).toBeCloseTo(-50);
      expect(p[0].out).toBeCloseTo(0);
      expect(p[p.length - 1].out).toBeCloseTo(0);
      expect(p[0].n[1]).toBeCloseTo(1);
    }
    // A round side curves all the way; a flat one has a band straight out (normal pointing out, not forward).
    const straight = (edge: 'round' | 'flat') => sideProfile(50, edge).filter((r) => Math.abs(r.n[1]) < 0.01).length;
    expect(straight('round')).toBe(1);
    expect(straight('flat')).toBe(2);
    expect(Math.max(...sideProfile(50, 'round').map((r) => r.out))).toBeGreaterThan(Math.max(...sideProfile(50, 'flat').map((r) => r.out)));
  });

  it('follows the frame’s outline, inside its box', () => {
    const pts = outline(400, 800, [60, 60, 60, 60]);
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(200 + 1e-9);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(400 + 1e-9);
    }
    expect(sideTriangles(400, 800, [60, 60, 60, 60], 50).length % 3).toBe(0);
  });
});
