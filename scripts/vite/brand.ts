// The tool's brand (herocanvas.config.ts). As CSS: `virtual:hc-brand.css` sets --hc-brand (and its hover and the
// color on it) for the light and the dark interface; colors the config doesn't give are taken from the logo, its
// colors counted and the most vivid one that covers a good part of it picked. As files: the favicon, the home-screen
// icons and the web app manifest, made from the logo (served by the dev server, written by the build).
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { flatten, readPng, resize, writePng, type Image } from './png.ts';

export interface HeroCanvasConfig {
  /** Shown in the browser's tab and the rail's logo. */
  name: string;
  /** A square PNG, from the project's root. */
  logo: string;
  /** The brand color per interface theme; unset: from the logo. */
  brand?: { light: string; dark: string };
  /** The language of HeroCanvas's own interface (its panels, menus and buttons): `en` (default) or `es`. */
  language?: 'en' | 'es';
  /** Where comments are shared: a Supabase project's address and publishable key (schema in src/comments/supabase.sql).
   *  Unset: each browser keeps its own. `team`: who can be @mentioned in a comment, each with their Slack member id
   *  (Profile › ⋯ › Copy member ID), so the store tells them in Slack (supabase.sql's notify_mentions). */
  comments?: { url: string; key: string; team?: { name: string; slack: string }[] };
}

type RGB = [number, number, number];

const ID = 'virtual:hc-brand.css';
const RESOLVED = '\0' + ID;

export function brand(config: HeroCanvasConfig, root = process.cwd()): Plugin {
  const logo = resolve(root, config.logo);
  // Made once per change of the logo: decoding and scaling a large PNG takes a moment.
  let cache: { mtime: number; files: Map<string, Buffer | string> } | undefined;
  const files = () => {
    const mtime = statSync(logo).mtimeMs;
    if (cache?.mtime !== mtime) cache = { mtime, files: brandFiles(config, readPng(readFileSync(logo))) };
    return cache.files;
  };
  return {
    name: 'hc-brand',
    resolveId: (id) => (id === ID ? RESOLVED : null),
    // The browser tab's name, and the name under the icon on a home screen.
    transformIndexHtml: (html) =>
      html
        .replace(/<title>[^<]*<\/title>/, `<title>${escape(config.name)}</title>`)
        .replace(/(name="apple-mobile-web-app-title" content=")[^"]*/, `$1${escape(config.name)}`),
    load(id) {
      if (id !== RESOLVED) return null;
      this.addWatchFile(logo);
      return brandCss(config.brand ?? fromLogo(readPng(readFileSync(logo))));
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0].slice(server.config.base.length);
        const file = BRAND_FILES.includes(path) ? files().get(path) : undefined;
        if (file === undefined) return next();
        res.setHeader('Content-Type', path.endsWith('.png') ? 'image/png' : 'application/manifest+json');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(file);
      });
    },
    generateBundle() {
      for (const [fileName, source] of files()) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}

// ---------------------------------------------------------------- the files

/** Where the files made from the logo are served, from the site's root (index.html and the rail link to them). */
export const BRAND_FILES = ['assets/logo-64.png', 'pwa/icon-180.png', 'pwa/icon-192.png', 'pwa/icon-512.png', 'manifest.webmanifest'];

/** The favicon (also the rail's logo), the home-screen icons and the manifest, from the decoded logo. */
export function brandFiles(config: HeroCanvasConfig, logo: Image): Map<string, Buffer | string> {
  const { light } = config.brand ?? fromLogo(logo);
  const manifest = {
    name: config.name,
    short_name: config.name,
    description: "Your app's screens at the real size of this device.",
    start_url: './',
    scope: './',
    display: 'standalone',
    orientation: 'any',
    background_color: light,
    theme_color: '#f2f2f7',
    icons: [192, 512].map((n) => ({ src: `pwa/icon-${n}.png`, sizes: `${n}x${n}`, type: 'image/png', purpose: 'any' })),
  };
  return new Map<string, Buffer | string>([
    ['assets/logo-64.png', writePng(resize(logo, 64))],
    // iOS draws a transparent icon on black: the logo goes over white instead.
    ['pwa/icon-180.png', writePng(flatten(resize(logo, 180), [255, 255, 255]))],
    ['pwa/icon-192.png', writePng(resize(logo, 192))],
    ['pwa/icon-512.png', writePng(resize(logo, 512))],
    ['manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n'],
  ]);
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

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
export function fromLogo(logo: Image): { light: string; dark: string } {
  const base = vividColor(sample(logo));
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

/** Every 4th pixel of every 4th row, leaving out the transparent ones (enough to count colors). */
function* sample({ width, height, data }: Image): Generator<RGB> {
  for (let y = 0; y < height; y += 4)
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4;
      if (data[i + 3] >= 128) yield [data[i], data[i + 1], data[i + 2]];
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
