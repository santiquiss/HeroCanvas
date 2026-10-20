// The tool's brand (herocanvas.config.ts) as CSS: `virtual:hc-brand.css` sets --hc-brand (and its hover and the
// color on it) for the light and the dark interface. Colors the config doesn't give are taken from the logo: decoded
// here (PNG, no dependency), its colors counted, the most vivid one that covers a good part of it picked.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import type { Plugin } from 'vite';

export interface HeroCanvasConfig {
  /** Shown in the browser's tab and the rail's logo. */
  name: string;
  /** A square PNG, from the project's root. */
  logo: string;
  /** The brand color per interface theme; unset: from the logo. */
  brand?: { light: string; dark: string };
}

type RGB = [number, number, number];

const ID = 'virtual:hc-brand.css';
const RESOLVED = '\0' + ID;

export function brand(config: HeroCanvasConfig, root = process.cwd()): Plugin {
  return {
    name: 'hc-brand',
    resolveId: (id) => (id === ID ? RESOLVED : null),
    // The browser tab's name.
    transformIndexHtml: (html) => html.replace(/<title>[^<]*<\/title>/, `<title>${config.name}</title>`),
    load(id) {
      if (id !== RESOLVED) return null;
      const logo = resolve(root, config.logo);
      this.addWatchFile(logo);
      return brandCss(config.brand ?? fromLogo(readFileSync(logo)));
    },
  };
}

// ---------------------------------------------------------------- the CSS

export function brandCss({ light, dark }: { light: string; dark: string }): string {
  const vars = (hex: string, hoverBy: number) => {
    const rgb = parseHex(hex);
    const on = contrast(rgb, [255, 255, 255]) >= 3 ? '#ffffff' : '#111114';
    return `--hc-brand: ${hex}; --hc-brand-hover: ${toHex(shade(rgb, hoverBy))}; --hc-on-brand: ${on};`;
  };
  return `:root { ${vars(light, -0.08)} }\n[data-ui='dark'] { ${vars(dark, 0.08)} }\n`;
}

/** The logo's brand color, as it should look on the light and the dark interface. */
export function fromLogo(png: Buffer): { light: string; dark: string } {
  const base = vividColor(decodePng(png));
  // Light: dark enough for white text (WCAG AA for its bold 12px label, 4.5). Dark: a step lighter, still under white.
  let light = base;
  for (let i = 0; i < 20 && contrast(light, [255, 255, 255]) < 4.5; i++) light = shade(light, -0.05);
  let dark = shade(light, 0.12);
  for (let i = 0; i < 20 && contrast(dark, [255, 255, 255]) < 3; i++) dark = shade(dark, -0.04);
  return { light: toHex(light), dark: toHex(dark) };
}

// ---------------------------------------------------------------- picking the color

/**
 * The most vivid color that covers a good part of the image: its pixels grouped by hue and lightness, each group
 * scored by how many pixels it has times how saturated it is. Grays and near-whites and blacks don't count.
 */
export function vividColor(pixels: Iterable<RGB>): RGB {
  const groups = new Map<string, { n: number; sum: RGB; sat: number }>();
  for (const p of pixels) {
    const [h, s, l] = hsl(p);
    if (s < 0.35 || l < 0.12 || l > 0.92) continue;
    const key = `${Math.round(h / 20)}:${Math.round(l * 5)}`;
    const g = groups.get(key) ?? { n: 0, sum: [0, 0, 0], sat: 0 };
    g.n++;
    g.sat += s;
    g.sum = [g.sum[0] + p[0], g.sum[1] + p[1], g.sum[2] + p[2]];
    groups.set(key, g);
  }
  let best: RGB = [10, 92, 255];
  let score = 0;
  for (const g of groups.values()) {
    const sc = g.n * (g.sat / g.n) ** 2;
    if (sc > score) {
      score = sc;
      best = [Math.round(g.sum[0] / g.n), Math.round(g.sum[1] / g.n), Math.round(g.sum[2] / g.n)];
    }
  }
  return best;
}

// ---------------------------------------------------------------- PNG

/** Every 4th pixel of every 4th row of an 8-bit, non-interlaced RGB or RGBA PNG (enough to count colors). */
export function* decodePng(b: Buffer): Generator<RGB> {
  let o = 8;
  let w = 0;
  let h = 0;
  let type = 0;
  const idat: Buffer[] = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o);
    const t = b.toString('ascii', o + 4, o + 8);
    const d = b.subarray(o + 8, o + 8 + len);
    if (t === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      if (d[8] !== 8 || d[12] !== 0 || (d[9] !== 2 && d[9] !== 6)) throw new Error('The logo must be an 8-bit RGB or RGBA PNG, not interlaced');
      type = d[9];
    }
    if (t === 'IDAT') idat.push(d);
    o += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3;
  const stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  let prev = Buffer.alloc(stride);
  const row = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const at = y * (stride + 1) + 1;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const up = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let p = raw[at + i];
      if (f === 1) p += a;
      else if (f === 2) p += up;
      else if (f === 3) p += (a + up) >> 1;
      else if (f === 4) {
        const pa = Math.abs(up - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + up - 2 * c);
        p += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      row[i] = p & 255;
    }
    if (y % 4 === 0)
      for (let x = 0; x < w; x += 4) {
        const i = x * bpp;
        if (bpp === 4 && row[i + 3] < 128) continue;
        yield [row[i], row[i + 1], row[i + 2]];
      }
    prev = Buffer.from(row);
  }
}

// ---------------------------------------------------------------- color math

const parseHex = (hex: string): RGB => {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? [...v].map((c) => c + c).join('') : v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (c: RGB) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

function hsl([r, g, b]: RGB): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? ((G - B) / d + (G < B ? 6 : 0)) * 60 : max === G ? ((B - R) / d + 2) * 60 : ((R - G) / d + 4) * 60;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** The same hue and saturation, `by` lighter (positive) or darker (negative). */
function shade(c: RGB, by: number): RGB {
  const [h, s, l] = hsl(c);
  return fromHsl(h, s, Math.max(0, Math.min(1, l + by)));
}

const luminance = (c: RGB) => {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two colors. */
export function contrast(a: RGB, b: RGB): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
