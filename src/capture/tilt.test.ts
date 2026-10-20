import { describe, expect, it } from 'vitest';
import { FLAT, PERSPECTIVE, project, tiltCss } from './tilt';

describe('the capture tilt', () => {
  it('leaves a flat picture as it is', () => {
    expect(project(100, -50, FLAT)).toEqual([100, -50, 1, 0]);
    expect(tiltCss(FLAT)).toBe('');
  });

  it('turns as CSS does: a positive y turn takes the right side away (smaller), the left side nearer', () => {
    const right = project(200, 0, { x: 0, y: 18 });
    const left = project(-200, 0, { x: 0, y: 18 });
    expect(right[2]).toBeGreaterThan(1);
    expect(Math.abs(right[0])).toBeLessThan(Math.abs(left[0]));
    expect(tiltCss({ x: 6, y: 18 })).toBe(`perspective(${PERSPECTIVE}px) rotateX(6deg) rotateY(18deg)`);
  });

  it('leans back with a positive x turn: the top goes away', () => {
    const top = project(100, -300, { x: 20, y: 0 });
    const bottom = project(100, 300, { x: 20, y: 0 });
    expect(top[0]).toBeLessThan(bottom[0]);
  });
});
