// Where a component is, on its own or inside others (the gallery's Used in and the usage stats).
import { describe, expect, it } from 'vitest';
import { BASE_PAGES } from '../nav/pages';
import type { Proposal } from '../proposals/types';
import { mergeIndex, nesting, pagesToDraw, type PageIndex, type PagePlace } from './pageIndex';

describe('nesting', () => {
  it('splits the instances into on the page and inside each other component, most first', () => {
    const places: PagePlace[] = [
      { id: 'a', params: {}, count: 5, inside: { TaskRow: 3 } },
      { id: 'b', params: {}, count: 4, inside: { ListTile: 4 } },
      { id: 'c', params: {}, count: 2 },
    ];
    expect(nesting(places)).toEqual({ own: 4, inside: [['ListTile', 4], ['TaskRow', 3]] });
  });
  it('a place without a count counts once', () => {
    expect(nesting([{ id: 'a', params: {} }])).toEqual({ own: 1, inside: [] });
  });
});

// A proposal's scan from Live's index: what it draws again, and how the two become its index.
describe('a proposal from Live’s index', () => {
  const Stub = () => null;
  const proposal = (over: Partial<Proposal>): Proposal =>
    ({ id: 'PT-1', folder: '2026-01-test', meta: { code: 'PT-1', title: 'Test', status: 'draft', created: '2026-01-01' }, pages: {}, components: {}, notes: {}, params: {}, widgets: [], config: {}, variants: [], show: {}, ...over }) as Proposal;
  const [first, second] = Object.keys(BASE_PAGES);
  const live: PageIndex = { Row: [{ id: 'a', params: {} }, { id: 'b', params: {}, sheet: 'more' }], Card: [{ id: 'c', params: {} }] };

  it('draws the pages it changes or adds, and those where a component it replaces shows in Live', () => {
    if (!first) return;
    const p = proposal({ pages: { [first]: { ...BASE_PAGES[first] }, added: { ...BASE_PAGES[first] }, ...(second ? { [second]: null } : {}) }, components: { Row: Stub } });
    const ids = pagesToDraw(p, live);
    expect([...ids].sort()).toEqual([first, 'a', 'added', 'b'].sort());
  });
  it('draws the pages of a component only one of its versions replaces', () => {
    const p = proposal({ variants: [{ id: 'b', label: 'B', components: { Card: Stub } }] as never });
    expect([...pagesToDraw(p, live)]).toEqual(['c']);
  });
  it('keeps Live’s places on the pages left alone, its own on the ones drawn again, in the pages’ order', () => {
    const own: PageIndex = { Row: [{ id: 'a', params: {}, count: 3 }], New: [{ id: 'a', params: {} }] };
    const merged = mergeIndex({ ...live, Gone: [{ id: 'removed', params: {} }] }, own, new Set(['a', 'b']), { a: 1, b: 1, c: 1 });
    expect(merged).toEqual({ Row: [{ id: 'a', params: {}, count: 3 }], Card: [{ id: 'c', params: {} }], New: [{ id: 'a', params: {} }] });
    const order = mergeIndex({ Row: [{ id: 'c', params: {} }] }, { Row: [{ id: 'a', params: {} }] }, new Set(['a']), { a: 1, b: 1, c: 1 });
    expect(order.Row.map((pl) => pl.id)).toEqual(['a', 'c']);
  });
});
