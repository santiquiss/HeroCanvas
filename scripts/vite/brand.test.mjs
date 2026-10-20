// The brand color from the logo (scripts/vite/brand.ts): HeroCanvas's logo gives its blue, dark enough for white
// text in light and a step lighter in dark.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BRAND_FILES, brandCss, brandFiles, contrast, fromLogo, vividColor } from './brand.ts';
import { readPng } from './png.ts';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('the brand color', () => {
  it('is the logo’s blue, readable under white text in light, lighter in dark', () => {
    const { light, dark } = fromLogo(readPng(readFileSync('brand/hc-logo.png')));
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
  it('makes the icons at their sizes and the manifest, from the logo', () => {
    const files = brandFiles({ name: 'Acme', logo: '' }, readPng(readFileSync('brand/hc-logo.png')));
    expect([...files.keys()]).toEqual(BRAND_FILES);
    for (const [path, n] of [['assets/logo-64.png', 64], ['pwa/icon-180.png', 180], ['pwa/icon-512.png', 512]]) {
      const icon = readPng(files.get(path));
      expect([icon.width, icon.height]).toEqual([n, n]);
    }
    // Smaller than the hand-made one was (290 KB): this logo is a render, all gradients, so lossless can't go much lower.
    expect(files.get('pwa/icon-512.png').length).toBeLessThan(250_000);
    const manifest = JSON.parse(files.get('manifest.webmanifest'));
    expect(manifest.name).toBe('Acme');
    expect(manifest.icons.map((i) => i.src)).toEqual(['pwa/icon-192.png', 'pwa/icon-512.png']);
  });
});
