// What `npm run update` does with each tool file and with package.json (scripts/update/plan.mjs).
import { describe, expect, it } from 'vitest';
import { changesBetween, mergePackage, newer, plan, versions } from './plan.mjs';

const m = (o) => new Map(Object.entries(o));
const actions = (steps) => Object.fromEntries(steps.map((s) => [s.path, s.action]));

describe('the update plan', () => {
  it('replaces what the team left alone, merges what both changed, keeps what only they changed', () => {
    const base = m({ untouched: 'a1', both: 'b1', mine: 'c1', gone: 'd1', goneMine: 'e1', same: 'f1' });
    const target = m({ untouched: 'a2', both: 'b2', mine: 'c1', added: 'g1', same: 'f1' });
    const local = m({ untouched: 'a1', both: 'bX', mine: 'cX', gone: 'd1', goneMine: 'eX', same: 'f1', ownFile: 'h1' });
    expect(actions(plan(base, target, local))).toEqual({
      untouched: 'write',
      both: 'merge',
      mine: 'keep',
      gone: 'delete',
      goneMine: 'keep',
      added: 'write',
      ownFile: 'keep',
    });
  });
  it('restores a tool file deleted here, and skips one already at the new version', () => {
    expect(actions(plan(m({ a: '1' }), m({ a: '2', b: '3' }), m({ b: '3' })))).toEqual({ a: 'write' });
  });
});

describe('package.json', () => {
  it('takes the new scripts and dependencies, keeping the team’s own, and their version', () => {
    const base = { name: 'x', version: '0.1.0', scripts: { dev: 'vite', old: 'a' }, dependencies: { react: '19.0.0', gone: '1' } };
    const target = { name: 'herocanvas', version: '0.2.0', scripts: { dev: 'vite --open', update: 'node u' }, dependencies: { react: '19.1.0' } };
    const local = { name: 'acme-design', version: '0.1.0', scripts: { dev: 'vite', old: 'a', mine: 'b' }, dependencies: { react: '19.0.0', gone: '1', zod: '3' } };
    expect(mergePackage(local, base, target)).toEqual({
      name: 'acme-design',
      version: '0.1.0',
      scripts: { dev: 'vite --open', mine: 'b', update: 'node u' },
      dependencies: { react: '19.1.0', zod: '3' },
    });
  });
  it('keeps a value the team changed when the update doesn’t change it', () => {
    const base = { version: '1.0.0', scripts: { dev: 'vite' } };
    expect(mergePackage({ version: '1.0.0', scripts: { dev: 'vite --host' } }, base, { version: '1.1.0', scripts: { dev: 'vite' } }).scripts.dev).toBe('vite --host');
  });
});

describe('versions and the changelog', () => {
  it('orders tags by version, newest first, ignoring others', () => {
    expect(versions(['v0.2.0', 'v0.10.0', 'latest', 'v0.9.1'])).toEqual(['0.10.0', '0.9.1', '0.2.0']);
    expect(newer('0.10.0', '0.9.0')).toBe(true);
    expect(newer('0.9.0', '0.9.0')).toBe(false);
  });
  it('picks the sections after the installed version, up to the new one', () => {
    const log = '# Changelog\n\nintro\n\n## 0.3.0 — c\n\nthree\n\n## 0.2.1 — b\n\ntwo-one\n\n## 0.2.0 — a\n\ntwo\n';
    expect(changesBetween(log, '0.2.0', '0.3.0')).toBe('## 0.3.0 — c\n\nthree\n\n## 0.2.1 — b\n\ntwo-one');
    expect(changesBetween(log, '0.2.1', '0.2.1')).toBe('');
  });
});
