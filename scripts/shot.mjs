// `npm run shot`: PNG captures of any screen of the designer, for an agent to attach anywhere (a ticket, a PR, a doc).
// Each is the screen on its device in light and dark side by side, in black frames, with room around them, on a
// transparent background (src/capture/shot/ShotShell.tsx, `?shot=1`). Steps (tap, type, scroll) run before the
// picture. Uses the designer that's running (`npm run dev`), or starts one for the time it takes.
//
//   npm run shot -- "/today?proposal=PJ-3&persona=sam" -o today.png
//   npm run shot -- "/projects" --click "Work" --theme light
//   npm run shot -- "/today?proposal=PJ-3" --compare                   # Before (Live) and After
//   npm run shot -- --batch shots.json --out-dir shots/pj3
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { batchShots, DEFAULTS, outPath, parseArgs, shotUrl, USAGE } from './shot/args.mjs';
import { launch, newPage } from './shot/chrome.mjs';

/** A page large enough for the widest pair (two tablets turned) at any scale. */
const VIEWPORT = { w: 3200, h: 2400 };

/** Why a before-and-after shot came out with the proposal's screen alone. */
const NOTES = {
  new: 'a screen the proposal adds: no "Before"',
  same: 'the proposal leaves this screen as it is: one only',
};

/** The PNG's size, from its header. */
const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

/** The dev server of this project on a usual port (Vite's 5173 on: another project's may hold 5173), by its root. */
async function ownServer() {
  const root = process.cwd();
  for (let port = 5173; port <= 5199; port++) {
    const base = `http://localhost:${port}`;
    const status = await fetch(`${base}/__hc/status`, { headers: { 'x-hc': '1' }, signal: AbortSignal.timeout(400) }).then((r) => (r.ok ? r.json().catch(() => null) : null), () => null);
    if (status?.root === root) return base;
  }
  return null;
}

/** The designer at `base` (given, else this project's own dev server), or one started here (closed at the end). */
async function designer(given) {
  const base = given ?? (await ownServer());
  const up = base && (await fetch(base, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok, () => false));
  if (up) return { base, close: async () => {} };
  const { createServer } = await import('vite');
  const server = await createServer({ logLevel: 'error', server: { port: 5190, strictPort: false, open: false } });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error("Couldn't start the designer");
  console.error(`(${base ? `no designer at ${base}` : 'no dev server of this project running'}: started one at ${url})`);
  return { base: url, close: () => server.close() };
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${e.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (args.help) {
    console.log(USAGE);
    return;
  }
  const shots = args.batch ? batchShots(JSON.parse(await readFile(args.batch, 'utf8'))) : args.shots;

  const app = await designer(args.base);
  const browser = await launch();
  let failed = 0;
  try {
    const page = await newPage(browser.cdp);
    await page.transparent();
    await page.reducedMotion();
    let scale = null;
    for (const shot of shots) {
      const label = shot.name ?? shot.route;
      try {
        const s = shot.scale ?? DEFAULTS.scale;
        if (s !== scale) await page.viewport(VIEWPORT.w, VIEWPORT.h, (scale = s));
        await page.goto(shotUrl(app.base, shot));
        await page.waitFor('window.__shot', 20000, 'the shot view (is the route the designer\'s?)');
        await page.eval('window.__shot.ready()');
        if (shot.steps?.length) await page.eval(`window.__shot.act(${JSON.stringify(shot.steps)})`);
        const note = await page.eval('window.__shot.finish()');
        const png = await page.png(await page.eval('window.__shot.rect()'));
        const file = resolve(outPath(shot, args.outDir));
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, png);
        const [w, h] = pngSize(png);
        console.log(`${file}  ${w}×${h}${note ? `  (${NOTES[note]})` : ''}`);
      } catch (e) {
        failed++;
        console.error(`✗ ${label}: ${e.message}`);
      }
    }
  } finally {
    await browser.close();
    await app.close();
  }
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
