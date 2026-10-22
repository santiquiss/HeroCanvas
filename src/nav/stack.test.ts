// Every page's URL leads back to it (with its params): links, reloads and shared URLs open the same screen.
import { describe, expect, it } from 'vitest';
import { composePages } from './manifest';
import { buildPath, isVariantState, parsePath, variantState } from './stack';

const pages = composePages(null);
const refs = Object.entries(pages).flatMap(([id, def]) => {
  const variants = def.variants?.() ?? [];
  return variants.length ? variants.map((v) => ({ id, params: v.params ?? { ...def.defaults } })) : [{ id, params: { ...def.defaults } }];
});

describe('page URLs', () => {
  it.each(refs.map((r) => [`${r.id} ${JSON.stringify(r.params)}`, r]))('%s round-trips', (_, ref) => {
    const path = buildPath(pages, ref);
    // No empty segment, no trailing slash (the root itself is `/`).
    if (path !== '/') expect(path).not.toMatch(/\/\/|\/$/);
    expect(parsePath(pages, path)).toEqual(ref);
  });
  it('a page whose path needs a param opens on its default without one (a project: work)', () => {
    // A manifest of its own: the pages loaded (the tour's) may have no path with a param.
    const withParam = { ...pages, project: { ...Object.values(pages)[0], path: '/projects/:id', defaults: { id: 'work' } } } as typeof pages;
    expect(parsePath(withParam, buildPath(withParam, { id: 'project', params: {} }))).toEqual({ id: 'project', params: { id: 'work' } });
  });
  it('no two pages share a path', () => {
    const paths = Object.values(pages).map((d) => d.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('a variant by state', () => {
  const def = { state: ['type', 'q'] } as unknown as Parameters<typeof variantState>[0];
  it('replaces the page’s state, the rest cleared', () => {
    expect(variantState(def, { state: { type: 'car' } })).toEqual({ type: 'car', q: null });
    expect(variantState(def, {})).toBeUndefined();
  });
  it('is the one shown only while the URL holds exactly its state', () => {
    const get = (q: string) => (k: string) => new URLSearchParams(q).get(k);
    expect(isVariantState(def, get('type=car'), { state: { type: 'car' } })).toBe(true);
    expect(isVariantState(def, get('type=car&q=x'), { state: { type: 'car' } })).toBe(false);
    expect(isVariantState(def, get('type=car'), { state: {} })).toBe(false);
    // A control of the app's it turns on (not the page's state) has to hold too.
    expect(isVariantState(def, get('type=car'), { state: { type: 'car', with_x: '1' } })).toBe(false);
  });
});
