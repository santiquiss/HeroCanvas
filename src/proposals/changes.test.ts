// What a proposal changes (the toolbar's chip, the Proposal panel, the changes popover): pages, the components it
// replaces, the ones it adds parameters to, and the ones it adds to the code's library. Against a proposal built here:
// the repository may have none.
import { describe, expect, it } from 'vitest';
import { changeCounts } from '../design/ChangeCounts';
import { componentKind } from '../gallery/route';
import { BASE_PAGES } from '../nav/pages';
import { findProposal, listedProposals, proposalChanges, PROPOSALS } from './index';
import type { Proposal } from './types';

const Stub = () => null;

function fixture(over: Partial<Proposal> = {}): Proposal {
  return {
    id: 'PT-1',
    folder: '2026-01-test',
    meta: { code: 'PT-1', title: 'Test', status: 'draft', created: '2026-01-01' },
    pages: {},
    components: {},
    notes: {},
    params: {},
    widgets: [],
    variants: [],
    config: {},
    layout: {},
    ...over,
  };
}

describe('proposalChanges', () => {
  // A replaced component is changed when Live has it (a story, overridable, in the code), else new: by componentKind.
  it('counts a component it replaces once, with its note', () => {
    const c = proposalChanges(fixture({ components: { ListTile: Stub }, notes: { ListTile: 'Two lines' } }), null, BASE_PAGES);
    expect(c.components).toEqual([{ name: 'ListTile', scope: 'shared', note: 'Two lines' }]);
    expect(changeCounts(c)[componentKind('ListTile')]).toBe(1);
  });
  it('counts a component it adds parameters to once, with them', () => {
    const c = proposalChanges(fixture({ params: { AppBar: ['centerTitle'] } }), null, BASE_PAGES);
    const bar = c.components.find((x) => x.name === 'AppBar');
    expect(bar?.scope).toBe('params');
    expect(bar?.params).toContain('centerTitle');
    expect(changeCounts(c)[componentKind('AppBar')]).toBe(1);
  });
  it('counts a component it adds to the library, and draws as proposed, as new', () => {
    const c = proposalChanges(fixture({ components: { EmptyState: Stub }, widgets: ['EmptyState'] }), null, BASE_PAGES);
    expect(c.components.map((x) => [x.name, x.scope])).toEqual([['EmptyState', 'added']]);
    expect(changeCounts(c).new).toBe(1);
  });
  it('lists a component it replaces once, not again with its parameters', () => {
    const names = proposalChanges(fixture({ components: { Button: Stub }, params: { Button: ['tone'] } }), null, BASE_PAGES).components.map((x) => x.name);
    expect(names).toEqual(['Button']);
  });
  it('takes a version’s own components over the shared ones', () => {
    const p = fixture({ components: { Button: Stub }, variants: [{ id: 'b', label: 'B', description: 'Wide', components: { ListTile: Stub } }] });
    expect(proposalChanges(p, 'b', BASE_PAGES).components.map((x) => [x.name, x.scope])).toEqual([
      ['Button', 'shared'],
      ['ListTile', 'version'],
    ]);
  });
  it('tells new, changed and removed pages apart', () => {
    // Two of Live's pages, whichever are loaded (the tour's, or the app's).
    const [a, b] = Object.keys(BASE_PAGES);
    const p = fixture({ pages: { [a]: { ...BASE_PAGES[a], title: 'Now' }, [b]: null, inbox: { ...BASE_PAGES[a], path: '/inbox' } } });
    const pages = Object.fromEntries(proposalChanges(p, null, BASE_PAGES).pages.map((x) => [x.id, x]));
    expect(pages[a]).toMatchObject({ kind: 'changed', details: ['Settings changed: title'] });
    expect(pages[b].kind).toBe('removed');
    expect(pages.inbox.kind).toBe('new');
  });
});

describe('with no proposals', () => {
  it('finds none and lists none', () => {
    if (PROPOSALS.length) return;
    expect(findProposal('PT-1')).toBeNull();
    expect(findProposal(null)).toBeNull();
    expect(listedProposals()).toEqual([]);
  });
});
