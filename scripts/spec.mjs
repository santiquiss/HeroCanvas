// `npm run spec`: a proposal as files anyone can read without running the designer: an agent given its link, or a
// person opening it. Written to public/spec/<CODE>-<key>/, so the deployed site serves them at /spec/<CODE>-<key>/,
// open to whoever has the link, with no password: the key (made once, kept in the proposal's spec.json) is what makes
// the address one nobody guesses. Deleting it from spec.json and generating again gives a new address; the old one is gone.
//
//
//   index.md               what the proposal is, its screens and variants, and its logic (the handoff): start here
//   index.html             the same for a person, with the pictures
//   screens/<id>.md        one screen: when it shows, and its structure as an outline
//   screens/<id>.json      the same structure in full (every component, its props, box, layout and tokens)
//   screens/<id>-light.png, <id>-dark.png
//
// The screens are the ones the proposal lists in its spec.json (a route and, if needed, steps: as `npm run shot`).
// Their structure is what Layers and Inspect show, read from the screen itself (src/capture/spec/tree.ts).
//
//   npm run spec -- PS-9
//   npm run spec -- --all            # every proposal with a spec.json
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { shotUrl } from './shot/args.mjs';
import { launch, newPage } from './shot/chrome.mjs';
import { designer } from './shot/server.mjs';
import { htmlPage, md } from './spec/html.mjs';
import { markAgainst, outline } from './spec/outline.mjs';

const OUT = 'public/spec';
const VIEWPORT = { w: 3200, h: 2400 };
const USAGE = 'Usage: npm run spec -- <CODE>… | --all   [--base <designer url>]';

/** The production site's address (herocanvas.config.ts `share.url`): where the links in the files point. */
async function siteUrl() {
  const cfg = await readFile('herocanvas.config.ts', 'utf8').catch(() => '');
  return (cfg.match(/share:\s*\{[^}]*url:\s*['"]([^'"]+)['"]/)?.[1] ?? '').replace(/\/+$/, '');
}

/** Every proposal of the copy: its folder and proposal.json. */
async function proposals() {
  const out = [];
  for (const dir of await readdir('proposals', { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const folder = join('proposals', dir.name);
    const json = await readFile(join(folder, 'proposal.json'), 'utf8').then(JSON.parse, () => null);
    if (json?.code) out.push({ folder, ...json });
  }
  return out;
}

const STATUS = { draft: 'Draft', review: 'In review', 'handed-off': 'Dev handoff' };

/** The route with the proposal in it. */
function routeOf(route, code) {
  const [path, query = ''] = route.split('?');
  const params = new URLSearchParams(query);
  if (!params.get('proposal')) params.set('proposal', code);
  return `${path}?${params}`;
}

async function capture(page, base, shot) {
  await page.goto(shotUrl(base, shot));
  await page.waitFor('window.__shot', 20000, 'the shot view');
  await page.eval('window.__shot.ready()');
  if (shot.steps?.length) await page.eval(`window.__shot.act(${JSON.stringify(shot.steps)})`);
  await page.eval('window.__shot.finish()');
  return page.png(await page.eval('window.__shot.rect()'));
}

/** The pages a tree shows, by name. */
const pagesOf = (nodes) => nodes.flatMap((n) => [...(n.type === 'page' ? [n.name] : []), ...pagesOf(n.children ?? [])]);

/** Live's tree of a route, or null when the route (or its steps) isn't Live's. */
async function liveTree(page, base, shot) {
  try {
    await capture(page, base, shot);
    return await page.eval('window.__shot.tree()');
  } catch {
    return null;
  }
}

async function build(p, { page, base, site, version, commit }) {
  const specFile = join(p.folder, 'spec.json');
  if (!existsSync(specFile)) throw new Error(`${p.code} has no spec.json (${specFile}): the screens to show`);
  const spec = JSON.parse(await readFile(specFile, 'utf8'));
  const handoff = await readFile(join(p.folder, 'handoff.md'), 'utf8').catch(() => null);
  // The key in the address: made the first time, then the same, so the link given out keeps working.
  if (!spec.key) {
    spec.key = randomBytes(12).toString('hex');
    await writeFile(specFile, JSON.stringify(spec, null, 2) + '\n');
  }
  const slug = `${p.code}-${spec.key}`;
  // One address per proposal: an earlier one (another key) goes.
  for (const d of await readdir(OUT, { withFileTypes: true }).catch(() => [])) if (d.isDirectory() && (d.name === p.code || d.name.startsWith(`${p.code}-`))) await rm(join(OUT, d.name), { recursive: true, force: true });
  const dir = join(OUT, slug);
  await mkdir(join(dir, 'screens'), { recursive: true });

  const screens = [];
  for (const s of spec.screens) {
    const route = routeOf(s.route, p.code);
    const shot = { route, steps: s.steps ?? [], device: s.device, land: s.land, padding: 0 };
    for (const theme of ['light', 'dark']) {
      await writeFile(join(dir, 'screens', `${s.id}-${theme}.png`), await capture(page, base, { ...shot, theme }));
      // The structure is the same in both: read once, with the light theme's token names.
      if (theme === 'light') s.tree = await page.eval('window.__shot.tree()');
    }
    // The same screen in Live (the route without the proposal), to say what the proposal adds to it. A screen Live
    // doesn't have opens on another page there: all of it is new.
    const live = await liveTree(page, base, { ...shot, route: s.route, theme: 'light' });
    const inLive = !!live && pagesOf(live.nodes).join('|') === pagesOf(s.tree.nodes).join('|');
    const added = inLive ? markAgainst(s.tree.nodes, live.nodes) : null;
    const open = site ? `${site}/#${route}` : null;
    const screen = { id: s.id, group: s.group ?? null, title: s.title, when: s.when ?? null, shows: s.shows ?? null, actions: s.actions ?? [], route, steps: shot.steps, open, device: s.tree.device, inLive, added };
    const tree = outline(s.tree.nodes, { marked: inLive });
    await writeFile(join(dir, 'screens', `${s.id}.json`), JSON.stringify({ proposal: p.code, ...screen, nodes: s.tree.nodes }, null, 1) + '\n');
    screens.push({ ...screen, outline: tree });
    console.log(`  ${s.id}`);
  }

  // Each screen's file, with the ones before and after it to go on reading.
  for (const [i, screen] of screens.entries()) await writeFile(join(dir, 'screens', `${screen.id}.md`), md.screen(p, screen, screen.outline, { prev: screens[i - 1] ?? null, next: screens[i + 1] ?? null }));

  const meta = { code: p.code, path: slug, title: p.title, status: STATUS[p.status] ?? p.status, ticket: p.ticket ?? null, summary: p.summary ?? '', description: p.description ?? '', author: p.author ?? null, version, commit, generated: new Date().toISOString().slice(0, 10), screens: screens.map(({ outline: _, ...s }) => s) };
  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 1) + '\n');
  await writeFile(join(dir, 'index.md'), md.index(meta, spec.intro ?? null, handoff, site));
  await writeFile(join(dir, 'index.html'), htmlPage(meta, spec.intro ?? null, screens, handoff));
  return meta;
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('--help')) return console.log(USAGE);
  const baseAt = argv.indexOf('--base');
  const given = baseAt >= 0 ? argv[baseAt + 1] : null;
  const codes = argv.filter((a, i) => !a.startsWith('--') && (baseAt < 0 || i !== baseAt + 1)).map((c) => c.toUpperCase());
  const all = await proposals();
  const picked = argv.includes('--all') ? all.filter((p) => existsSync(join(p.folder, 'spec.json'))) : codes.map((c) => all.find((p) => p.code === c) ?? (() => { throw new Error(`No proposal ${c}`); })());
  if (!picked.length) throw new Error('No proposal with a spec.json');

  const site = await siteUrl();
  const version = JSON.parse(await readFile('package.json', 'utf8')).version;
  const commit = (() => { try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return null; } })();
  const app = await designer(given);
  const browser = await launch();
  try {
    const page = await newPage(browser.cdp);
    await page.transparent();
    await page.reducedMotion();
    await page.viewport(VIEWPORT.w, VIEWPORT.h, 2);
    for (const p of picked) {
      console.log(`${p.code} · ${p.title}`);
      const m = await build(p, { page, base: app.base, site, version, commit });
      console.log(`  → ${resolve(OUT, m.path, 'index.html')}`);
      if (site) console.log(`  Once published, open to anyone with the link:\n    for a person: ${site}/spec/${m.path}/index.html\n    for an agent: ${site}/spec/${m.path}/index.md`);
    }
  } finally {
    await browser.close();
    await app.close();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
