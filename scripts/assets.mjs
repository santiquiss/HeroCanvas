// `npm run assets -- --from <path> [--to <folder>]`: an app's images for its mirror, from where its code keeps them.
//
//   an asset catalog (.xcassets)      each image set's 2× (else its only) image, keeping its folders, names in kebab
//                                     case; each color set's light and dark values, listed for app/theme.css
//   Android's res/ (drawable*)        its PNG, WebP and JPEG, the densest of each (vector drawables are listed: convert
//                                     the few the screens use by hand)
//   any other folder (Flutter's assets/, a web app's public/)   its images as they are
//
// They go in public/<to>/ (default: the app's name in app/config.ts, in kebab case), where screens reach them as
// `${import.meta.env.BASE_URL}<to>/<path>`. Read only from the app's repository: it's never written.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const from = opt('--from');
if (!from || !existsSync(from)) {
  console.log('Usage: npm run assets -- --from <Assets.xcassets | res/ | a folder of images> [--to <folder in public/>]');
  process.exit(1);
}
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
const appName = (readFileSync(join(root, 'app/config.ts'), 'utf8').match(/name:\s*'([^']+)'/) ?? [])[1] ?? 'app';
const to = opt('--to') ?? kebab(appName);
const OUT = join(root, 'public', to);
const IMAGE = /\.(png|jpe?g|webp|gif|svg|pdf)$/i;

const walk = (dir, visit) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      if (visit(p, true) !== false) walk(p, visit);
    } else visit(p, false);
  }
};
const write = (file, src) => {
  mkdirSync(dirname(file), { recursive: true });
  copyFileSync(src, file);
};

const images = [];
const colors = {};
const skipped = [];

/** A color set's component, as CSS: `#rrggbb`, or with its alpha `rgba(…)`. */
function cssColor(c) {
  if (c.reference) return `/* system: ${c.reference} */`;
  const comp = c.components ?? {};
  // "0xED", "0.929" (0–1) or "237".
  const ch = (v) => (String(v).startsWith('0x') ? parseInt(v, 16) : String(v).includes('.') ? Math.round(Number(v) * 255) : Number(v));
  const [r, g, b] = ['red', 'green', 'blue'].map((k) => ch(comp[k] ?? 0));
  const a = Number(comp.alpha ?? 1);
  return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

if (from.endsWith('.xcassets')) {
  walk(from, (p, dir) => {
    if (!dir) return;
    const rel = relative(from, p);
    if (p.endsWith('.imageset')) {
      const meta = JSON.parse(readFileSync(join(p, 'Contents.json'), 'utf8'));
      const files = (meta.images ?? []).filter((i) => i.filename && !(i.appearances ?? []).length);
      const pick = files.find((i) => i.scale === '2x') ?? files.find((i) => i.scale === '3x') ?? files[0];
      if (pick) {
        const out = join(OUT, kebab(rel.replace(/\.imageset$/, '')) + extname(pick.filename).toLowerCase());
        write(out, join(p, pick.filename));
        images.push(relative(join(root, 'public'), out));
      }
      return false;
    }
    if (p.endsWith('.colorset')) {
      const meta = JSON.parse(readFileSync(join(p, 'Contents.json'), 'utf8'));
      const entry = {};
      for (const c of meta.colors ?? []) {
        const dark = (c.appearances ?? []).some((a) => a.value === 'dark');
        entry[dark ? 'dark' : 'light'] = cssColor(c.color ?? {});
      }
      colors[kebab(rel.replace(/\.colorset$/, '').replace(/\//g, '-'))] = entry;
      return false;
    }
    if (p.endsWith('.symbolset') || p.endsWith('.appiconset')) return false;
  });
} else {
  // Android's res/: the densest density folder that has each image.
  const dens = ['xxxhdpi', 'xxhdpi', 'xhdpi', 'hdpi', 'mdpi'];
  const seen = new Map();
  walk(from, (p, dir) => {
    if (dir) return;
    const folder = basename(dirname(p));
    if (/\.xml$/.test(p) && /^drawable/.test(folder)) return void skipped.push(relative(from, p));
    if (!IMAGE.test(p)) return;
    const d = dens.findIndex((x) => folder.includes(x));
    const key = /^(drawable|mipmap)/.test(folder) ? basename(p) : relative(from, p);
    const rank = d < 0 ? dens.length : d;
    if (!seen.has(key) || seen.get(key).rank > rank) seen.set(key, { p, rank });
  });
  for (const [key, { p }] of seen) {
    const out = join(OUT, kebab(key.replace(extname(key), '')) + extname(key).toLowerCase());
    write(out, p);
    images.push(relative(join(root, 'public'), out));
  }
}

console.log(`${images.length} images → public/${to}/`);
if (Object.keys(colors).length) {
  writeFileSync(join(OUT, 'colors.json'), JSON.stringify(colors, null, 2) + '\n');
  console.log(`${Object.keys(colors).length} colors → public/${to}/colors.json (light and dark): make the ones the screens use tokens in app/theme.css:`);
  for (const [name, c] of Object.entries(colors)) console.log(`  --app-${name}: ${c.light ?? c.dark}${c.dark && c.dark !== c.light ? `  /* dark: ${c.dark} */` : ''}`);
}
if (skipped.length) console.log(`${skipped.length} vector drawables not copied (XML): convert the ones the screens use, e.g. ${skipped.slice(0, 3).join(', ')}`);
console.log(`Use them as \`\${import.meta.env.BASE_URL}${images[0] ?? `${to}/…`}\`.`);
