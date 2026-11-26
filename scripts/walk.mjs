// `npm run walk`: a proposal's walkthrough checked step by step in a real browser, as a person would walk it. Every
// step two ways: opened from a link (its place, then its actions replayed), and reached by tapping, with a real click,
// what the step before marks as its next. Each must get there, with every mark it lists on the screen. Starts each
// story with the Coach open (`--coach`), so a step that leaves it open shows. Uses the designer that's running (`npm
// run dev`), or starts one for the time it takes.
//
//   npm run walk -- PS-15
//   npm run walk -- PS-15 PS-10 --devices ip18,ipad      # on a set: the marks on the selected device (the first)
//   npm run walk -- --all --shots shots/walk              # every proposal with a walkthrough, a picture of each step
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch, newPage } from './shot/chrome.mjs';
import { designer } from './shot/server.mjs';

const USAGE = `npm run walk -- <CODE…> | --all [--device ip18 | --devices ip18,ipad] [--no-coach] [--shots <dir>]`;
const VIEWPORT = { w: 1600, h: 1000 };
/** How long a step's way in may take, and how long what a tap did may take to settle. */
const ARRIVE_MS = 15000;
const SETTLE_MS = 600;
/** How long a step's marks may take to show once it's there. */
const MARKS_MS = 10000;

function parseArgs(argv) {
  const a = { codes: [], all: false, device: 'ip18', devices: null, coach: true, shots: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--all') a.all = true;
    else if (v === '--device') a.device = argv[++i];
    else if (v === '--devices') a.devices = argv[++i];
    else if (v === '--no-coach') a.coach = false;
    else if (v === '--shots') a.shots = argv[++i];
    else if (v === '--help' || v === '-h') a.help = true;
    else if (v.startsWith('-')) throw new Error(`Unknown option ${v}`);
    else a.codes.push(v);
  }
  if (!a.help && !a.all && !a.codes.length) throw new Error('Name a proposal (PS-15), or --all');
  return a;
}

/** The proposals with a walkthrough of their own (`proposals/<folder>/walkthrough.ts`), by code. */
async function walkedCodes() {
  const root = resolve('proposals');
  const codes = [];
  for (const folder of await readdir(root)) {
    const meta = await readFile(resolve(root, folder, 'proposal.json'), 'utf8').then(JSON.parse, () => null);
    const walked = await readFile(resolve(root, folder, 'walkthrough.ts'), 'utf8').then(() => true, () => false);
    if (meta?.code && walked) codes.push(meta.code);
  }
  return codes;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${e.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (args.help) return console.log(USAGE);

  const app = await designer();
  const browser = await launch();
  const base = app.base.replace(/\/+$/, '');
  const where = args.devices ? `devices=${args.devices}` : `device=${args.device}`;
  let problems = 0;
  try {
    const page = await newPage(browser.cdp);
    await page.viewport(VIEWPORT.w, VIEWPORT.h, 1);
    await page.reducedMotion();
    /** The hash's query now, with some params changed (null drops one). */
    const hashWith = (patch) =>
      page.eval(`(() => { const [p, q] = location.hash.slice(1).split('?'); const s = new URLSearchParams(q); for (const [k, v] of Object.entries(${JSON.stringify(patch)})) v === null ? s.delete(k) : s.set(k, v); location.hash = p + '?' + s; })()`);
    const probe = () => page.eval('window.__hcWalk ?? null');

    const codes = args.all ? await walkedCodes() : args.codes;

    for (const code of codes) {
      console.log(`\n${code}`);
      await page.goto(`${base}/#/?proposal=${code}&${where}`);
      try {
        await page.waitFor('window.__hcWalkSteps?.length', 30000, 'its walkthrough');
      } catch {
        console.log('  no walkthrough');
        problems++;
        continue;
      }
      const steps = await page.eval('window.__hcWalkSteps');
      const shot = async (name) => {
        if (!args.shots) return;
        const dir = resolve(args.shots, code);
        await mkdir(dir, { recursive: true });
        await writeFile(resolve(dir, `${name}.png`), await page.png({ x: 0, y: 0, width: VIEWPORT.w, height: VIEWPORT.h }, { inView: true }));
      };
      /** Waits for a step to be on screen with its way in done; its probe, or null. */
      const arrive = async (id) => {
        const end = Date.now() + ARRIVE_MS;
        while (Date.now() < end) {
          const p = await probe();
          if (p?.step === id && !p.busy) {
            // What it opened settles (a sheet rising): its marks show within a moment, or they're missing.
            await wait(SETTLE_MS);
            const until = Date.now() + MARKS_MS;
            let q = await probe();
            while (q?.marks.some((m) => !m.at) && Date.now() < until) {
              await wait(150);
              q = await probe();
            }
            return q;
          }
          await wait(150);
        }
        return null;
      };
      const marksLine = (p) => {
        const lost = p.marks.filter((m) => !m.at).map((m) => `"${m.target}"`);
        return { ok: !lost.length, text: `marks ${p.marks.length - lost.length}/${p.marks.length}${lost.length ? ` (not on screen: ${lost.join(', ')})` : ''}` };
      };

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const issues = [];
        // From a link: away from the walkthrough first, so the same step named again is put in its state.
        await hashWith({ walk: null });
        await wait(200);
        await hashWith({ walk: s.id, ...(args.coach && s.n === 1 ? { coach: '1' } : {}) });
        const p = await arrive(s.id);
        if (!p) issues.push('from a link: never got there (its actions still running, or the step left the address)');
        else {
          if (p.missing) issues.push(`from a link: stopped, "${p.missing}" isn't on the screen`);
          const m = marksLine(p);
          if (!m.ok) issues.push(`from a link: ${m.text}`);
          // Where the Coach was opened first (a story's first step): it must have closed, unless the step opens it.
          const coach = args.coach && s.n === 1 && !s.sidePanel && (await page.eval(`new URLSearchParams(location.hash.split('?')[1]).get('coach')`));
          if (coach) issues.push('the Coach stayed open');
          await shot(`${String(i + 1).padStart(2, '0')}-${s.id}`);

          // By a tap on what it marks as its next: a real click, then the next step from what the tap did.
          const nextMark = p.marks.find((m) => m.next);
          const after = steps[i + 1];
          if (nextMark && (!after || after.story !== s.story)) issues.push('marks a next, but it is the last of its story');
          if (nextMark && after && after.story === s.story) {
            if (!nextMark.at) issues.push(`by a tap: "${nextMark.target}" isn't on the screen to tap`);
            else {
              // Where it is once it stays put (a scroll or a sheet may still be moving it).
              let at = nextMark.at;
              for (let k = 0; k < 20; k++) {
                await wait(150);
                const again = (await probe())?.marks.find((m) => m.next)?.at;
                if (again && Math.abs(again[0] - at[0]) < 1 && Math.abs(again[1] - at[1]) < 1) break;
                if (again) at = again;
              }
              await page.click(at[0], at[1]);
              const q = await arrive(after.id);
              if (!q) issues.push(`by a tap on "${nextMark.target}": didn't go on to ${after.id}`);
              else {
                const m2 = marksLine(q);
                if (!m2.ok) issues.push(`by a tap, at ${after.id}: ${m2.text} (from a link it may differ: the tap left the app elsewhere)`);
                await shot(`${String(i + 2).padStart(2, '0')}-${after.id}-tapped`);
              }
            }
          }
        }
        problems += issues.length;
        console.log(`  ${issues.length ? '✗' : '✓'} ${s.n}/${s.of} ${s.id}${issues.map((x) => `\n      ${x}`).join('')}`);
      }
    }
  } finally {
    await browser.close();
    await app.close();
  }
  console.log(problems ? `\n${problems} problem(s)` : '\nAll steps get there, with every mark on the screen.');
  process.exit(problems ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
