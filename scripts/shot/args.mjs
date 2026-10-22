// `npm run shot`'s arguments (scripts/shot.mjs): which screens to shoot, how, and the steps before each picture. Pure:
// argv in, a plan out; the URL each shot opens. Tested in args.test.mjs.

export const DEFAULTS = { scale: 2, theme: 'both', base: null, outDir: 'shots' };

/**
 * One shot: `route` (the app's, as the designer's address writes it after `#`: `/today?proposal=PJ-3`), its options
 * and its steps (src/capture/shot/shotActions.ts).
 * @typedef {{ route: string, name?: string, out?: string, device?: string, display?: string, land?: boolean,
 *   theme?: 'light' | 'dark' | 'both', compare?: boolean, scale?: number, padding?: number, gap?: number, steps?: object[] }} Shot
 */

export const USAGE = `Usage: npm run shot -- <route> [options] [steps]
       npm run shot -- --batch shots.json

  <route>              the screen, as the designer's address writes it after #:
                       "/today?proposal=PJ-3&persona=sam" (the whole URL works too)

Options
  -o, --out <file>     the PNG (default shots/<route>.png)
  --theme <t>          light, dark or both (default: both, side by side)
  --compare            before and after: Live ("Before") beside the route's proposal ("After"),
                       in light unless --theme; a screen that is new or unchanged comes out alone
  --device <id>        the device (ip17, gs25…; default the designer's)
  --display <key>      a foldable's display
  --land               landscape
  --scale <n>          pixels per point (default 2)
  --padding <pt>       room around (default 40)
  --gap <pt>           room between the two (default 40)
  --base <url>         the designer (default: this project's dev server, wherever it runs; else one is started)
  --out-dir <folder>   with --batch: where the PNGs go (default shots/)

Steps, in order, before the picture (on every screen)
  --click <text>       taps the element with that text (or "css:<selector>")
  --fill <text>        types into the focused field, or the first
  --into <selector>    the field of the --fill, --focus or --press before
  --focus              focuses the first field (the keyboard shows)
  --press <key>        presses a key in the focused field, or the first (Enter submits a search)
  --scroll <y|end>     scrolls the screen
  --wait <ms>          waits`;

const NUM = new Set(['--scale', '--padding', '--gap', '--wait']);

/** argv (after the script) → `{ shots, batch, base, outDir, help }`. Throws with a message on a bad argument. */
export function parseArgs(argv) {
  /** @type {Shot} */
  const shot = { route: '', steps: [] };
  const out = { shots: [shot], batch: null, base: DEFAULTS.base, outDir: DEFAULTS.outDir, help: false };
  const value = (i, flag) => {
    const v = argv[i + 1];
    if (v === undefined || (v.startsWith('--') && !/^--?\d/.test(v))) throw new Error(`Missing the value of ${flag}`);
    if (NUM.has(flag) && !Number.isFinite(Number(v))) throw new Error(`${flag} takes a number`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '-h':
      case '--help':
        out.help = true;
        break;
      case '-o':
      case '--out':
        shot.out = value(i++, a);
        break;
      case '--out-dir':
        out.outDir = value(i++, a);
        break;
      case '--batch':
        out.batch = value(i++, a);
        break;
      case '--base':
        out.base = value(i++, a);
        break;
      case '--theme': {
        const t = value(i++, a);
        if (!['light', 'dark', 'both'].includes(t)) throw new Error('--theme is light, dark or both');
        shot.theme = t;
        break;
      }
      case '--device':
        shot.device = value(i++, a);
        break;
      case '--display':
        shot.display = value(i++, a);
        break;
      case '--land':
        shot.land = true;
        break;
      case '--compare':
        shot.compare = true;
        break;
      case '--scale':
      case '--padding':
      case '--gap':
        shot[a.slice(2)] = Number(value(i++, a));
        break;
      case '--click':
        shot.steps.push({ click: value(i++, a) });
        break;
      case '--fill':
        shot.steps.push({ fill: value(i++, a) });
        break;
      case '--focus':
        shot.steps.push({ focus: true });
        break;
      case '--press':
        shot.steps.push({ press: value(i++, a) });
        break;
      case '--into': {
        const last = shot.steps.at(-1);
        if (!last || !('fill' in last || 'focus' in last || 'press' in last)) throw new Error('--into goes after --fill, --focus or --press');
        last.into = value(i++, a);
        break;
      }
      case '--scroll': {
        const v = value(i++, a);
        if (v !== 'end' && !Number.isFinite(Number(v))) throw new Error('--scroll is a number or end');
        shot.steps.push({ scroll: v === 'end' ? 'end' : Number(v) });
        break;
      }
      case '--wait':
        shot.steps.push({ wait: Number(value(i++, a)) });
        break;
      default:
        if (a.startsWith('-')) throw new Error(`Unknown option ${a}`);
        if (shot.route) throw new Error(`One route per shot ("${a}" is extra); for several, --batch`);
        shot.route = a;
    }
  }
  if (!out.help && !out.batch && !shot.route) throw new Error('Missing the route');
  if (out.batch) out.shots = [];
  return out;
}

/** A batch file: a list of shots, or `{ defaults…, shots: [...] }` whose other keys apply to every shot. */
export function batchShots(json) {
  const list = Array.isArray(json) ? json : json.shots;
  if (!Array.isArray(list) || !list.length) throw new Error('The --batch file has no shots');
  const common = Array.isArray(json) ? {} : Object.fromEntries(Object.entries(json).filter(([k]) => k !== 'shots'));
  return list.map((s, i) => {
    if (!s.route) throw new Error(`Shot ${i + 1} has no route`);
    return { ...common, ...s, steps: s.steps ?? [] };
  });
}

/** The route alone (path and query), from what was given: `/x?y`, `#/x?y`, or a whole designer URL. */
export function routeOf(input) {
  const hash = input.indexOf('#');
  const r = hash >= 0 ? input.slice(hash + 1) : input;
  return r.startsWith('/') ? r : `/${r}`;
}

/** The address a shot opens: the route with shot mode and the shot's options in its query. */
export function shotUrl(base, shot) {
  const route = routeOf(shot.route);
  const q = route.indexOf('?');
  const path = q >= 0 ? route.slice(0, q) : route;
  const params = new URLSearchParams(q >= 0 ? route.slice(q + 1) : '');
  params.set('shot', '1');
  // A real-size or capture view in the copied address is the designer's, not the shot's.
  for (const k of ['real', 'capture', 'theme', 'devices', 'zoom']) params.delete(k);
  if (shot.device) params.set('device', shot.device);
  if (shot.display) params.set('display', shot.display);
  if (shot.land) params.set('land', '1');
  if (shot.compare) {
    if (!params.get('proposal')) throw new Error('--compare needs a proposal in the route (?proposal=PJ-…)');
    params.set('shot_compare', '1');
  }
  // Both themes is the plain shot's default, one (light) before and after's: say it when it isn't the default.
  const theme = shot.theme ?? (shot.compare ? 'light' : DEFAULTS.theme);
  if (theme !== (shot.compare ? 'light' : 'both')) params.set('shot_themes', theme === 'both' ? 'light,dark' : theme);
  if (shot.padding != null) params.set('shot_padding', String(shot.padding));
  if (shot.gap != null) params.set('shot_gap', String(shot.gap));
  return `${base.replace(/\/+$/, '')}/#${path}?${params}`;
}

/** A file name from a route: its path, then the values that tell two shots of it apart (proposal, persona…). */
export function slug(route) {
  const r = routeOf(route);
  const [path, query = ''] = r.split('?');
  const values = [...new URLSearchParams(query).values()];
  const name = [path.replace(/^\/+/, '') || 'home', ...values]
    .join('-')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return name.slice(0, 80) || 'shot';
}

/** Where a shot's PNG goes. */
export function outPath(shot, outDir) {
  if (shot.out) return shot.out;
  const name = shot.name ? slug(shot.name) : slug(shot.route);
  return `${outDir.replace(/\/+$/, '')}/${name}.png`;
}
