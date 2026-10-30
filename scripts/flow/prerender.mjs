// Flow's thumbnails as pictures, for a deployed site: run on the built site (the deploy runs it after `vercel build`,
// on .vercel/output/static), it serves it, asks Flow for every screen it shows (window.__hcFlowSpecs: each page's
// variants, each flow's steps), draws each one in a headless Chrome in real mode, as the dev server does
// (scripts/vite/screenCache.ts), and writes them to <dir>/flow-shots/ with a manifest the site reads
// (src/sim/screenStill.tsx). A screen it has no picture of (another device, persona or language) shows live.
//
//   node scripts/flow/prerender.mjs [dir]     (default: dist)
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { launch, newPage } from '../shot/chrome.mjs';

const dir = resolve(process.argv[2] ?? 'dist');
const out = join(dir, 'flow-shots');
/** Pages drawing at once. */
const PAGES = 8;
/** In the page: once the screen has stopped changing for a moment (or after a while, for one that never does). */
const QUIET = `new Promise((done) => {
  let timer = setTimeout(end, 250);
  const cap = setTimeout(end, 2000);
  const mo = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(end, 250); });
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  function end() { mo.disconnect(); clearTimeout(timer); clearTimeout(cap); done(true); }
})`;

if (!existsSync(join(dir, 'index.html'))) {
  console.error(`flow-shots: no built site in ${dir}`);
  process.exit(1);
}

// The built site, as a static server serves it.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.riv': 'application/octet-stream', '.lottie': 'application/zip' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(dir, path);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
  res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;

const { cdp, close } = await launch();
const started = Date.now();
try {
  // Every screen Flow shows, as the site works them out (the default device, light, no persona picked).
  const first = await newPage(cdp);
  await first.viewport(1440, 900, 1);
  await first.goto(`${base}#/flow`);
  await first.waitFor('window.__hcFlowSpecs', 60000, "Flow's screens");
  const specs = await first.eval('window.__hcFlowSpecs()');
  const manifest = {};
  let failed = 0;
  console.log(`flow-shots: ${specs.length} screens`);
  const tick = setInterval(() => console.log(`flow-shots: ${Object.keys(manifest).length + failed} of ${specs.length}, ${Math.round((Date.now() - started) / 1000)} s`), 15000);
  mkdirSync(out, { recursive: true });
  let next = 0;
  // A page stuck on a screen that timed out isn't used again (it may still be waiting): the others go on.
  const broken = new Set();
  const pages = [first, ...(await Promise.all(Array.from({ length: PAGES - 1 }, () => newPage(cdp))))];
  await Promise.all(
    pages.map(async (page) => {
      await page.reducedMotion();
      for (let i = next++; i < specs.length; i = next++) {
        const spec = specs[i];
        const file = `${createHash('sha1').update(JSON.stringify(spec)).digest('hex').slice(0, 20)}.png`;
        try {
          // A screen that never finishes loading (a load event that never comes) is skipped: it shows live.
          await Promise.race([draw(page, spec, file), new Promise((_, fail) => setTimeout(() => fail(new Error('took longer than 30 s')), 30000))]);
          manifest[JSON.stringify(spec)] = file;
        } catch (e) {
          failed++;
          broken.add(page);
          console.warn(`flow-shots: ${spec.hash}: ${e.message}`);
        }
        if (broken.has(page)) return;
      }
    }),
  );
  async function draw(page, spec, file) {
          await page.viewport(spec.w, spec.h, spec.scale);
          await page.goto(`${base}#${spec.hash}`);
          await page.waitFor("document.querySelector('[data-hc-screen]')", 20000, 'the screen');
          await page.eval(`document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => ${QUIET}).then(() => true)`);
          writeFileSync(join(out, file), await page.png({ x: 0, y: 0, width: spec.w, height: spec.h }, { inView: true }));
  }
  clearInterval(tick);
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest));
  console.log(`flow-shots: ${Object.keys(manifest).length} drawn, ${failed} failed, in ${Math.round((Date.now() - started) / 1000)} s`);
} finally {
  await Promise.race([close(), new Promise((r) => setTimeout(r, 5000))]);
  server.close();
}
