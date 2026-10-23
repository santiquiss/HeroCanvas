// A proposal's code (proposals/code.ts): every proposal has one, no two share it, and links by it or by the old
// folder name both find the proposal.
import { describe, expect, it } from 'vitest';
import { findProposal, listedProposals, PROPOSALS } from './index';
import { authorLetters, defaultAuthorLetters, isProposalCode, nextProposalCode, parseProposalCode } from './code';

describe('every proposal', () => {
  it.each(PROPOSALS.map((p) => [p.folder, p] as const))('%s has a code (npm run proposal:code gives the next one)', (_folder, p) => {
    expect(isProposalCode(p.meta.code)).toBe(true);
    expect(p.id).toBe(p.meta.code);
  });
  it('has a code of its own', () => {
    const codes = PROPOSALS.map((p) => p.meta.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it('is listed by the pickers unless archived, or when it is the one picked', () => {
    const archived = PROPOSALS.filter((p) => p.meta.archived);
    expect(listedProposals()).toEqual(PROPOSALS.filter((p) => !archived.includes(p)));
    for (const p of archived) expect(listedProposals(p.id)).toContain(p);
  });
  it.each(PROPOSALS.map((p) => [p.folder, p] as const))('%s is found by its code and by its folder (an old link)', (_folder, p) => {
    expect(findProposal(p.id)).toBe(p);
    expect(findProposal(p.folder)).toBe(p);
  });
});

describe('isProposalCode', () => {
  it('is P, one to three capitals, a dash and a number from 1', () => {
    for (const yes of ['PJ-1', 'PJ-12', 'PJD-3', 'PABC-1204']) expect(isProposalCode(yes)).toBe(true);
    for (const no of ['P-12', 'PJ-0', 'PJ-012', 'pj-1', 'PJ1', 'PABCD-1', 'J-1', 'PJ-', '', null, 12]) expect(isProposalCode(no)).toBe(false);
  });
});

describe('authorLetters', () => {
  it('keeps up to three letters, as capitals without accents', () => {
    expect(authorLetters('j')).toBe('J');
    expect(authorLetters('jd')).toBe('JD');
    expect(authorLetters('Ángela')).toBe('ANG');
    expect(authorLetters(' 1-2 ')).toBe('');
  });
  it('by default an author is the first letter of their name', () => {
    expect(defaultAuthorLetters('Jane Doe')).toBe('J');
    expect(defaultAuthorLetters('')).toBe('');
  });
});

describe('nextProposalCode', () => {
  it('starts each author at 1', () => {
    expect(nextProposalCode([], 'T')).toBe('PT-1');
    expect(nextProposalCode(['PJ-1', 'PJ-2'], 'C')).toBe('PC-1');
  });
  it('is one more than the author\'s highest, whatever the others have', () => {
    expect(nextProposalCode(['PJ-1', 'PJ-2', 'PJ-5', 'PC-9'], 'J')).toBe('PJ-6');
    expect(nextProposalCode(['PJ-7', 'PJ-2'], 'j')).toBe('PJ-8');
  });
  it('does not reuse a retired code (a proposal deleted once done)', () => {
    expect(nextProposalCode(['PJ-1', 'PJ-2'], 'J', ['PJ-3'])).toBe('PJ-4');
  });
  it('does not reuse the number of a proposal that was removed in between', () => {
    expect(nextProposalCode(['PJ-1', 'PJ-4'], 'J')).toBe('PJ-5');
  });
  it('keeps the series of J and of JD apart', () => {
    expect(nextProposalCode(['PJ-5', 'PJD-2'], 'JD')).toBe('PJD-3');
  });
  it('needs an author', () => {
    expect(() => nextProposalCode([], '')).toThrow();
  });
});

describe('parseProposalCode', () => {
  it('reads whose it is and its number', () => {
    expect(parseProposalCode('PJD-12')).toEqual({ author: 'JD', number: 12 });
    expect(parseProposalCode('nope')).toBeNull();
  });
});
