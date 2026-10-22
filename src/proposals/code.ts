// A proposal's code: its permanent reference (`PJ-12`), in its proposal.json. Links carry the code (`?proposal=`),
// so a proposal can change its title, and its folder its name, without breaking them.
// `P`, the author's letters, and that author's next number — as an issue tracker numbers its issues: short, easy to
// say, and it tells how old a proposal is. The series is per author so two people creating proposals on two branches
// never take the same number (one person on two branches can: `npm test` fails on the duplicate, and the newer
// proposal takes the next number).
// No imports: `npm run proposal:code` (scripts/proposal-code.mjs) runs this file in Node.

export const CODE_PREFIX = 'P';
/** The author's letters in a code: one to three capitals. */
export const MAX_AUTHOR_LETTERS = 3;

const CODE = new RegExp(`^${CODE_PREFIX}([A-Z]{1,${MAX_AUTHOR_LETTERS}})-([1-9]\\d*)$`);

export const isProposalCode = (value: unknown): value is string => typeof value === 'string' && CODE.test(value);

/**
 * An author's letters from what they typed: capitals without accents, three at most ("j" → "J", "Jd" → "JD").
 * Empty when there is no letter in it.
 */
export function authorLetters(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, MAX_AUTHOR_LETTERS);
}

/** The letter an author gets when they do not pick: the first of their name ("Jane Doe" → "J"). */
export const defaultAuthorLetters = (name: string): string => authorLetters(name).slice(0, 1);

/** The parts of a code: whose it is and its number in their series. */
export function parseProposalCode(code: string): { author: string; number: number } | null {
  const m = CODE.exec(code);
  return m ? { author: m[1], number: Number(m[2]) } : null;
}

/**
 * The codes of proposals deleted once done, as the team keeps them (proposals/retired.json: `[{ "code": "PJ-3",
 * "note": "…" }]`), so the next one doesn't take theirs: a code is never reused. Their record: git and the changelog.
 */
export interface RetiredCode {
  code: string;
  /** What it was and where it went (merged into Live in 0.4.0). */
  note?: string;
}

/** The author's next code: one more than their highest so far (the retired ones too, `retired`), from 1. */
export function nextProposalCode(taken: readonly string[], author: string, retired: readonly string[] = []): string {
  const letters = authorLetters(author);
  if (!letters) throw new Error('a proposal code needs the author\'s letters');
  const numbers = [...taken, ...retired].map(parseProposalCode).filter((c) => c?.author === letters).map((c) => c!.number);
  return `${CODE_PREFIX}${letters}-${Math.max(0, ...numbers) + 1}`;
}
