// The brand color from the logo (scripts/vite/brand.ts): HeroCanvas's logo gives its blue, dark enough for white
// text in light and a step lighter in dark.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { brandCss, contrast, fromLogo, vividColor } from './brand.ts';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('the brand color', () => {
  it('is the logo’s blue, readable under white text in light, lighter in dark', () => {
    const { light, dark } = fromLogo(readFileSync('brand/hc-logo.png'));
    const [r, g, b] = rgb(light);
    expect(b).toBeGreaterThan(r + 80);
    expect(b).toBeGreaterThan(g);
    expect(contrast(rgb(light), [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(rgb(dark), [255, 255, 255])).toBeGreaterThanOrEqual(3);
    expect(dark).not.toBe(light);
  });
  it('picks the vivid color over grays, whites and a smaller vivid one', () => {
    const px = [...Array(50).fill([240, 240, 240]), ...Array(30).fill([20, 90, 250]), ...Array(10).fill([230, 30, 40])];
    const [r, , b] = vividColor(px);
    expect(b).toBeGreaterThan(200);
    expect(r).toBeLessThan(60);
  });
  it('writes the light and dark variables, with white on a dark enough color', () => {
    const css = brandCss({ light: '#0a5cff', dark: '#3d7dff' });
    expect(css).toContain(':root { --hc-brand: #0a5cff;');
    expect(css).toContain("[data-ui='dark'] { --hc-brand: #3d7dff;");
    expect(css).toContain('--hc-on-brand: #ffffff;');
  });
});
