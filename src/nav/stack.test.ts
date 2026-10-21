// Every page's URL leads back to it (with its params): links, reloads and shared URLs open the same screen.
import { describe, expect, it } from 'vitest';
import { composePages } from './manifest';
import { buildPath, parsePath } from './stack';

const pages = composePages(null);
const refs = Object.entries(pages).flatMap(([id, def]) => {
  const variants = def.variants?.() ?? [];
  return variants.length ? variants.map((v) => ({ id, params: v.params })) : [{ id, params: { ...def.defaults } }];
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
