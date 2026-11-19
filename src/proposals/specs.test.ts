// What a proposal needs before it's shared or built: a handoff.md (its logic) and, once it's in review or handed off,
// its spec (`npm run spec`, the proposal-spec skill), generated: what the developers and their agents build from.
import { describe, expect, it } from 'vitest';
import { BASE_PAGES } from '../nav/pages';
import { PROJECT } from '../project';
import { proposalChanges, PROPOSALS } from '../proposals';
import { hasProposalNotes } from './sources';
import { specOf } from './specs';

/** The specs generated in public/spec, by their folder (`<CODE>-<key>`). */
const GENERATED = new Set(Object.keys(import.meta.glob('/public/spec/*/index.md')).map((f) => f.split('/')[3]));

/**
 * The team's proposals that were in review or handed off before specs existed (`proposals/specs-pending.json`): they
 * may go without one until they're touched again, then they get theirs and leave the list.
 */
const pending = Object.values(import.meta.glob('@proposals/specs-pending.json', { eager: true, import: 'default' }) as Record<string, { codes?: string[] }>)[0];
const BEFORE_SPECS = new Set(pending?.codes ?? []);

// Only where the handoff is a file: a project whose handoff is its code (herocanvas.config.ts `projects`, `handoff:
// 'code'`) has neither.
describe.runIf(PROPOSALS.length && PROJECT.handoff === 'file')('every proposal', () => {
  it.each(PROPOSALS.map((p) => [p.id, p] as const))('%s has a handoff.md if it changes something', (_id, p) => {
    const changes = proposalChanges(p, null, BASE_PAGES);
    if (changes.components.length || changes.pages.length) expect(hasProposalNotes(p.folder)).toBe(true);
  });

  const shared = PROPOSALS.filter((p) => !p.meta.archived && (p.meta.status === 'review' || p.meta.status === 'handed-off'));
  it.each(shared.map((p) => [p.id, p] as const))('%s, in review or handed off, has its spec generated', (id, p) => {
    if (BEFORE_SPECS.has(id)) return;
    const spec = specOf(p.folder, id);
    expect(spec, `${id} has no spec.json: list its screens and states, then npm run spec -- ${id}`).not.toBeNull();
    expect(spec!.path, `${id}'s spec was never generated: npm run spec -- ${id}`).not.toBeNull();
    expect(GENERATED.has(spec!.path!), `${id}'s spec isn't in public/spec: npm run spec -- ${id}`).toBe(true);
  });

  it('lists in specs-pending.json only proposals that still lack a spec', () => {
    const stale = [...BEFORE_SPECS].filter((id) => {
      const p = PROPOSALS.find((x) => x.id === id);
      return p && specOf(p.folder, id)?.path;
    });
    expect(stale, 'these have a spec now: take them out of proposals/specs-pending.json').toEqual([]);
  });
});
