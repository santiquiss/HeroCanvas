// `npm run symbols`: SF Symbols and an app's own symbols for the screens, where `<Icon name="sf:…">` finds them.
//
//   npm run symbols -- box.truck heart.fill trophy:semibold   SF Symbols, rendered by this Mac (macOS only)
//   npm run symbols -- --from <path/to/Assets.xcassets>       the app's own symbols (.symbolset), as SVG
//
// They go in public/symbols/ and are listed in app/symbols.json (the team's: what the app uses). HeroCanvas ships no
// SF Symbols: Apple's license lets you use them to design and mock up apps for its platforms, made here on your Mac
// from your own copy, not redistributed.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public/symbols');
const MANIFEST = join(root, 'app/symbols.json');
const args = process.argv.slice(2);
if (!args.length) {
  console.log('Usage: npm run symbols -- <sf.symbol.name[:weight]>…   |   npm run symbols -- --from <Assets.xcassets or a .symbolset>');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const added = [];

/** A custom symbol template's Regular-M glyph as a standalone SVG: its paths, in a box around them. */
function fromTemplate(svgFile) {
  const svg = readFileSync(svgFile, 'utf8');
  const at = svg.indexOf('id="Regular-M"');
  if (at < 0) return null;
  const end = svg.indexOf('</g>', at);
  const group = svg.slice(svg.lastIndexOf('<g', at), end + 4);
  const paths = [...group.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  if (!paths.length) return null;
  // The paths' extent from their absolute points (control points included: a hair larger at most).
  const nums = paths.join(' ').match(/-?\d*\.?\d+(?:e-?\d+)?/g).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0);
  const ys = nums.filter((_, i) => i % 2 === 1);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 1;
  const w = x1 - x0 + pad * 2;
  const h = y1 - y0 + pad * 2;
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0 - pad} ${y0 - pad} ${w} ${h}">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>\n`,
    w,
    h,
  };
}

if (args[0] === '--from') {
  const from = args[1];
  const sets = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (f.endsWith('.symbolset')) sets.push(p);
      else if (statSync(p).isDirectory()) walk(p);
    }
  };
  if (from.endsWith('.symbolset')) sets.push(from);
  else walk(from);
  for (const set of sets) {
    const svgFile = readdirSync(set).find((f) => f.endsWith('.svg'));
    const name = basename(set, '.symbolset');
    const glyph = svgFile && fromTemplate(join(set, svgFile));
    if (!glyph) {
      console.log(`  ${name}: no Regular-M glyph, skipped`);
      continue;
    }
    writeFileSync(join(OUT, `${name}.svg`), glyph.svg);
    // A template's glyph is drawn at 100 points: in the 32 the system ones are rendered at.
    manifest[name] = { file: `${name}.svg`, w: +((glyph.w * 32) / 100).toFixed(1), h: +((glyph.h * 32) / 100).toFixed(1), custom: true };
    added.push(name);
  }
} else {
  if (process.platform !== 'darwin') {
    console.log('SF Symbols are rendered by macOS: run this on a Mac (or ask a teammate with one, and commit what it writes).');
    process.exit(1);
  }
  const lines = execFileSync('swift', [join(root, 'scripts/symbols/render.swift'), OUT, ...args], { encoding: 'utf8' }).trim().split('\n');
  for (const line of lines) {
    const r = JSON.parse(line);
    if (r.missing) {
      console.log(`  ${r.name}: not an SF Symbol on this Mac (check its name in the SF Symbols app)`);
      continue;
    }
    manifest[r.name.replace(/:regular$/, '')] = { file: r.file, w: r.w, h: r.h };
    added.push(r.name);
  }
}

writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
console.log(added.length ? `Added ${added.length}: ${added.join(', ')}.\nUse them as <Icon name="sf:${added[0].split(':')[0]}" />.` : 'Nothing added.');
