// The handoff file of a proposal (design/proposalHandoff.ts): what it says, over a proposal and a code API built here
// (the repository may have neither), and every real proposal's specification.
import { describe, expect, it } from 'vitest';
import type { ApiWidget, Library } from './library';
import { codeSignature, notesFor, proposalHandoff, statesFor, type HandoffInput } from './proposalHandoff';
import { BASE_PAGES } from '../nav/pages';
import { proposalChanges, PROPOSALS } from '../proposals';
import type { Proposal } from '../proposals/types';
import { hasProposalNotes } from '../proposals/sources';

// A proposal with two takes on the rail (NavigationRail, in the code) and a component the code doesn't have
// (EmptyState), that also adds a screen; and its specification, a part for each version.
const RAIL = () => null;
const NOTES = [
  'The tablet rail names its sections.',
  '### Version A',
  'A glass column of tall ovals.',
  '### Version B',
  'A surface down the edge, as Material draws it.',
  '### What stays',
  'The phone bar.',
].join('\n');
const PROPOSAL: Proposal = {
  id: 'PT-5',
  folder: '2026-10-rail-labels',
  meta: { code: 'PT-5', title: 'Rail with labels', status: 'review', created: '2026-10-01' },
  pages: { inbox: { ...BASE_PAGES.today, path: '/inbox', title: 'Inbox' } },
  components: { EmptyState: RAIL },
  notes: {},
  params: {},
  widgets: [],
  variants: [
    { id: 'a', label: 'Labels, aligned', description: 'Ovals in a glass column.', components: { NavigationRail: RAIL } },
    { id: 'b', label: 'Material rail', description: 'M3’s rail on a surface.', components: { NavigationRail: RAIL } },
  ],
  config: {},
  layout: {},
};
const RAIL_WIDGET: ApiWidget = {
  name: 'NavigationRail',
  tier: 'organism',
  part: false,
  file: 'components/navigation_rail.ts',
  summary: null,
  constructors: [],
  params: [{ name: 'items', type: 'List<NavItem>', required: true, default: null }],
};
const LIBRARY: Library = { version: 'abc1234 2026-10-01', widget: (n) => (n === 'NavigationRail' ? RAIL_WIDGET : undefined) };

function versions(variantId: string | null, extra: Partial<HandoffInput> = {}): HandoffInput {
  return {
    proposal: PROPOSAL,
    variantId,
    changes: proposalChanges(PROPOSAL, variantId, BASE_PAGES),
    basePages: BASE_PAGES,
    library: LIBRARY,
    libraryCommit: LIBRARY.version,
    notes: NOTES,
    stories: [{ component: 'NavigationRail', names: ['A · Labels, aligned', 'B · Material rail', 'Rail'] }],
    link: 'https://example.test/#/today?proposal=PT-5',
    date: '2026-10-19',
    ...extra,
  };
}

describe('proposalHandoff', () => {
  it('names the version, the component in the code and its constructor', () => {
    const text = proposalHandoff(versions('b'));
    expect(text).toMatch(/^# Handoff PT-5: Rail with labels/);
    expect(text).toContain('in `src/proposals/2026-10-rail-labels/`');
    expect(text).toContain('**Version to implement**: B · Material rail');
    expect(text).toContain('### Changed component: `NavigationRail`');
    expect(text).toContain('- In the code: `components/navigation_rail.ts`');
    expect(text).toContain('NavigationRail({');
  });
  it('names a component it adds and the screens it changes', () => {
    const text = proposalHandoff(versions(null));
    expect(text).toContain('### New component: `EmptyState`');
    expect(text).toContain('### New screen: Inbox (`inbox`)');
  });
  it('hands off the first version when none is picked', () => {
    expect(proposalHandoff(versions(null))).toContain('**Version to implement**: A · Labels, aligned');
  });
  it('carries the specification of the version it is for, and no code of the simulator', () => {
    const a = proposalHandoff(versions('a'));
    expect(a).toContain('## Specification');
    expect(a).toContain('A glass column of tall ovals.');
    expect(a).toContain('The phone bar.');
    expect(a).not.toContain('as Material draws it');
    expect(a).not.toMatch(/```(tsx|css)/);
    expect(proposalHandoff(versions('b'))).toContain('as Material draws it');
  });
  it('is about the version it is for alone: the others are not named, and their states are left out', () => {
    const b = proposalHandoff(versions('b'));
    expect(b).toContain('- [ ] `NavigationRail` in each state: B · Material rail · Rail');
    expect(b).toContain('This file is about version B alone');
    // After the proposal's own description (what its author wrote), no other version is mentioned.
    const rest = b.slice(b.indexOf('**Version B · Material rail.**'));
    for (const other of ['Labels, aligned', 'Version A']) expect(rest).not.toContain(other);
  });
  it('says so when the proposal has no specification', () => {
    expect(proposalHandoff(versions('a', { notes: null }))).toContain('has no specification yet');
  });
});

// The handoff file is only as good as the specification: a proposal that changes something has to have one.
describe.runIf(PROPOSALS.length)('every proposal', () => {
  it.each(PROPOSALS.map((p) => [p.folder, p] as const))('%s has a handoff.md', (_folder, p) => {
    const changes = proposalChanges(p, null, BASE_PAGES);
    if (changes.components.length || changes.pages.length) expect(hasProposalNotes(p.folder)).toBe(true);
  });
});

describe('notesFor', () => {
  const notes = ['Shared intro.', '## Version A', 'Only A.', '### Detail of A', 'More A.', '## Version B', 'Only B.', '## Data', 'Shared data.'].join('\n');
  it("keeps the shared parts and the version's own", () => {
    expect(notesFor(notes, 'a')).toBe(['Shared intro.', '## Version A', 'Only A.', '### Detail of A', 'More A.', '## Data', 'Shared data.'].join('\n'));
    expect(notesFor(notes, 'B')).toBe(['Shared intro.', '## Version B', 'Only B.', '## Data', 'Shared data.'].join('\n'));
  });
  it('drops every version section when there is no version', () => {
    expect(notesFor(notes, null)).toBe(['Shared intro.', '## Data', 'Shared data.'].join('\n'));
  });
});

describe('statesFor', () => {
  it("drops the stories named after another version, and keeps the shared ones", () => {
    expect(statesFor(['A · Wide', 'B · Ring', 'Countdown', 'Big · bold'], ['a', 'c'])).toEqual(['B · Ring', 'Countdown', 'Big · bold']);
    expect(statesFor(['A · Wide', 'B · Ring'], [])).toEqual(['A · Wide', 'B · Ring']);
  });
});

describe('codeSignature', () => {
  it('writes required parameters and defaults as the constructor does', () => {
    expect(
      codeSignature({
        name: 'Chip',
        params: [
          { name: 'label', type: 'String', required: true, default: null },
          { name: 'selected', type: 'bool', required: false, default: 'false' },
          { name: 'onPressed', type: null, required: false, default: null },
        ],
      }),
    ).toBe('Chip({\n  required String label,\n  bool selected = false,\n  dynamic onPressed,\n})');
    expect(codeSignature({ name: 'Divider', params: [] })).toBe('Divider()');
  });
});
