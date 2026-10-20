// `npm run shot`'s arguments (scripts/shot/args.mjs): argv to shots, and the address each one opens.
import { describe, expect, it } from 'vitest';
import { SHOT_COMPARE_PARAM, SHOT_GAP_PARAM, SHOT_PADDING_PARAM, SHOT_PARAM, SHOT_THEMES_PARAM } from '../../src/capture/shot/params';
import { batchShots, outPath, parseArgs, routeOf, shotUrl, slug } from './args.mjs';

describe('parseArgs', () => {
  it('reads a route, its options and its steps in order', () => {
    const { shots } = parseArgs(['/today?proposal=PJ-3', '--theme', 'light', '--scale', '3', '--fill', 'Groceries', '--into', 'input', '--scroll', 'end', '--click', 'Save', '-o', 'a.png']);
    expect(shots).toEqual([
      { route: '/today?proposal=PJ-3', theme: 'light', scale: 3, out: 'a.png', steps: [{ fill: 'Groceries', into: 'input' }, { scroll: 'end' }, { click: 'Save' }] },
    ]);
  });
  it('says what is wrong', () => {
    expect(() => parseArgs([])).toThrow('Missing the route');
    expect(() => parseArgs(['/a', '--theme', 'sepia'])).toThrow('--theme');
    expect(() => parseArgs(['/a', '--into', 'x'])).toThrow('--into');
    expect(() => parseArgs(['/a', '/b'])).toThrow('One route');
    expect(() => parseArgs(['/a', '--nope'])).toThrow('--nope');
    expect(() => parseArgs(['/a', '--scale'])).toThrow('Missing the value');
  });
  it('takes a batch instead of a route', () => {
    expect(parseArgs(['--batch', 'b.json', '--out-dir', 'x'])).toMatchObject({ batch: 'b.json', outDir: 'x', shots: [] });
  });
});

describe('batchShots', () => {
  it('applies the file’s defaults to every shot', () => {
    expect(batchShots({ theme: 'dark', shots: [{ route: '/a' }, { route: '/b', theme: 'light' }] })).toEqual([
      { theme: 'dark', route: '/a', steps: [] },
      { theme: 'light', route: '/b', steps: [] },
    ]);
    expect(() => batchShots([{ name: 'x' }])).toThrow('has no route');
  });
});

describe('shotUrl', () => {
  it('opens the route in shot mode, without the designer’s own views', () => {
    const url = shotUrl('http://localhost:5173/', { route: 'https://designer.example.com/#/today?proposal=PJ-3&capture=1&theme=dark', theme: 'light', padding: 24, device: 'ip17' });
    const [base, hash] = url.split('#');
    expect(base).toBe('http://localhost:5173/');
    const q = new URLSearchParams(hash.split('?')[1]);
    expect(hash.startsWith('/today?')).toBe(true);
    expect(q.get(SHOT_PARAM)).toBe('1');
    expect(q.get(SHOT_THEMES_PARAM)).toBe('light');
    expect(q.get(SHOT_PADDING_PARAM)).toBe('24');
    expect(q.get(SHOT_GAP_PARAM)).toBeNull();
    expect(q.get('device')).toBe('ip17');
    expect(q.get('proposal')).toBe('PJ-3');
    expect(q.has('capture') || q.has('theme')).toBe(false);
  });
  it('compares before and after in light unless asked, and needs a proposal', () => {
    const q = (shot) => new URLSearchParams(shotUrl('http://x', shot).split('?')[1]);
    expect(parseArgs(['/p?proposal=PJ-3', '--compare']).shots[0].compare).toBe(true);
    expect(q({ route: '/p?proposal=PJ-3', compare: true }).get(SHOT_COMPARE_PARAM)).toBe('1');
    expect(q({ route: '/p?proposal=PJ-3', compare: true }).get(SHOT_THEMES_PARAM)).toBeNull();
    expect(q({ route: '/p?proposal=PJ-3', compare: true, theme: 'dark' }).get(SHOT_THEMES_PARAM)).toBe('dark');
    expect(q({ route: '/p?proposal=PJ-3', compare: true, theme: 'both' }).get(SHOT_THEMES_PARAM)).toBe('light,dark');
    expect(() => shotUrl('http://x', { route: '/p', compare: true })).toThrow('proposal');
  });
  it('leaves both themes unset', () => {
    expect(shotUrl('http://x', { route: '/a' })).toBe('http://x/#/a?shot=1');
  });
});

describe('file names', () => {
  it('come from the route, or the shot’s name', () => {
    expect(routeOf('#/a?b=1')).toBe('/a?b=1');
    expect(slug('/projects/work?proposal=PJ-3&persona=sam')).toBe('projects-work-pj-3-sam');
    expect(slug('/')).toBe('home');
    expect(outPath({ route: '/a', name: 'Café menu' }, 'shots/')).toBe('shots/cafe-menu.png');
    expect(outPath({ route: '/a', out: 'x.png' }, 'shots')).toBe('x.png');
  });
});
