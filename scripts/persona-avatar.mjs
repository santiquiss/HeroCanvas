// `npm run persona:avatar -- <image> <persona id>`: a persona's photo for the simulator, from an image the person
// gave: its centered square, scaled to 256 px, written to public/personas/<id>.png (the team's, like app/). Prints
// the path to put in the persona's `avatar`. PNG in; other formats (JPEG, HEIC…) are converted first with macOS's
// `sips`, or export a PNG. No dependency: scripts/vite/png.ts.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPng, resize, square, writePng } from './vite/png.ts';

const SIZE = 256;
const [file, id] = process.argv.slice(2);
if (!file || !id || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Usage: npm run persona:avatar -- <image> <persona id: lowercase, digits, dashes>');
  process.exit(1);
}

/** The image as PNG bytes: as is, or converted by sips (macOS). */
function asPng(path) {
  const bytes = readFileSync(path);
  if (bytes.readUInt32BE(0) === 0x89504e47) return bytes;
  const dir = mkdtempSync(join(tmpdir(), 'hc-avatar-'));
  try {
    const out = join(dir, 'avatar.png');
    execFileSync('sips', ['-s', 'format', 'png', path, '--out', out], { stdio: 'ignore' });
    return readFileSync(out);
  } catch {
    console.error(`${path} isn't a PNG, and it couldn't be converted (sips is macOS's). Export it as a PNG and try again.`);
    process.exit(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

let img;
try {
  img = square(readPng(asPng(file)));
} catch (e) {
  console.error(`Couldn't read ${file}: ${e.message}. Export it as an 8-bit PNG and try again.`);
  process.exit(1);
}
if (img.width < SIZE) console.warn(`(It's ${img.width} px: smaller than ${SIZE}, kept at its size.)`);
const out = `public/personas/${id}.png`;
mkdirSync('public/personas', { recursive: true });
writeFileSync(out, writePng(img.width > SIZE ? resize(img, SIZE) : img));
console.log(`${out}\navatar: 'personas/${id}.png'`);
