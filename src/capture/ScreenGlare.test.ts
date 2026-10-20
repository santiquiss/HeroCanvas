// The glare a video draws on each frame (drawGlare) is the one the canvas shows (ScreenGlare's CSS): as strong, its
// edge where the CSS puts it, and nothing when it doesn't show.
import { describe, expect, it } from 'vitest';
import { drawGlare, glareAt, glareOpacity, type GlareLook } from './ScreenGlare';

/** A 2D context that only records what's drawn. */
function recorder() {
  const stops: [number, string][] = [];
  const calls: string[] = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: '' as unknown,
    createLinearGradient: () => ({ addColorStop: (at: number, c: string) => stops.push([at, c]) }),
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => {},
    roundRect: () => {},
    clip: () => calls.push('clip'),
    fillRect: () => calls.push(`fill@${ctx.globalAlpha}`),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, stops, calls };
}

const LOOK: GlareLook = { light: -1, strength: 0.8, side: 'top', softness: 0.2 };
const RECT = { x: 10, y: 20, w: 300, h: 600, r: 40 };

describe('drawGlare', () => {
  it('is as strong as the canvas’s at the turn, its edge where the CSS puts it', () => {
    const t = { x: 15, y: -10 };
    const { ctx, stops, calls } = recorder();
    drawGlare(ctx, RECT, t, LOOK);
    expect(calls).toContain(`fill@${glareOpacity(t, LOOK.strength, LOOK.side)}`);
    const edge = parseFloat(glareAt(t, LOOK.side)) / 100;
    expect(stops[1][0]).toBeLessThan(edge);
    expect(stops[2][0]).toBeGreaterThan(edge);
  });
  it('slides with the turn', () => {
    const a = recorder();
    const b = recorder();
    drawGlare(a.ctx, RECT, { x: 0, y: -20 }, LOOK);
    drawGlare(b.ctx, RECT, { x: 0, y: 20 }, LOOK);
    expect(a.stops[1][0]).not.toBe(b.stops[1][0]);
  });
  it('draws nothing where the screen faces away from the light', () => {
    const { ctx, calls } = recorder();
    drawGlare(ctx, RECT, { x: -30, y: 0 }, LOOK);
    expect(calls).toEqual([]);
  });
});
