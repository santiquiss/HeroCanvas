// A shot's "Before" (liveNav.ts): the address under Live, and telling two renders of a screen apart.
import { describe, expect, it } from 'vitest';
import { composePages } from '../../nav/manifest';
import type { Nav } from '../../nav/context';
import type { Proposal } from '../../proposals/types';
import { liveNavFor, visualSignature } from './liveNav';

/** The navigation under a proposal (any: liveNavFor only reads that there is one), or under Live. */
const navWith = (code: string | null) => {
  const proposal = code ? ({ id: code } as Proposal) : null;
  return { proposal, pages: composePages(null), stack: [] } as unknown as Nav;
};

describe('liveNavFor', () => {
  it('reads the address with Live’s pages', () => {
    const live = liveNavFor(navWith('PT-1'), '/profile', new URLSearchParams('proposal=PT-1'))!;
    expect(live.proposal).toBeNull();
    expect(live.stack.at(-1)?.id).toBe('profile');
    expect(live.pages).toBe(composePages(null));
    expect(live.change('profile')).toBeNull();
  });
  it('has no Before for a page the proposal adds, or without a proposal', () => {
    expect(liveNavFor(navWith('PT-1'), '/not-in-live', new URLSearchParams('proposal=PT-1'))).toBeNull();
    expect(liveNavFor(navWith(null), '/profile', new URLSearchParams())).toBeNull();
  });
});

describe('visualSignature', () => {
  it('ignores the ids React makes up, not what shows', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    a.innerHTML = '<label for=":r1:">Name</label><input id=":r1:" aria-describedby=":r2:">';
    b.innerHTML = '<label for=":r7:">Name</label><input id=":r7:" aria-describedby=":r8:">';
    expect(visualSignature(a)).toBe(visualSignature(b));
    b.innerHTML = '<label for=":r7:">Surname</label><input id=":r7:">';
    expect(visualSignature(a)).not.toBe(visualSignature(b));
  });
});
