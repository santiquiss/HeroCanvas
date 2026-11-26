// A proposal's walkthrough, checked as written: what `npm run walk` can't tell from the screen. Every step has its own
// id; a step goes on by a tap on at most one mark, never past its story's end; and the step a tap goes on to is the
// same from a link: its way in is the step's own, then that tap (where both are on the same page).
import { describe, expect, it } from 'vitest';
import { PROPOSALS } from '../proposals';
import type { WalkAction } from '../proposals/types';

const stories = (p: (typeof PROPOSALS)[number]) => p.walkthrough ?? [];
const walked = PROPOSALS.filter((p) => stories(p).length);
const same = (a: WalkAction, b: WalkAction) => JSON.stringify(a) === JSON.stringify(b);

describe.runIf(walked.length)('every walkthrough', () => {
  it.each(walked.map((p) => [p.id, p] as const))('%s: its step ids are unique', (_id, p) => {
    const ids = stories(p).flatMap((s) => s.steps.map((st) => st.id));
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it.each(walked.map((p) => [p.id, p] as const))('%s: every story has steps, and each step a title and a text', (_id, p) => {
    for (const story of stories(p)) {
      expect(story.steps.length, story.title).toBeGreaterThan(0);
      for (const st of story.steps) expect(!!st.title && !!st.body, st.id).toBe(true);
    }
  });

  it.each(walked.map((p) => [p.id, p] as const))('%s: a step goes on by one mark at most, and not at its story’s end', (_id, p) => {
    for (const story of stories(p))
      story.steps.forEach((st, i) => {
        const nexts = (st.marks ?? []).filter((m) => m.next);
        expect(nexts.length, `${st.id}: marks to go on`).toBeLessThanOrEqual(1);
        if (i === story.steps.length - 1) expect(nexts.length, `${st.id}: the last of its story goes on`).toBe(0);
      });
  });

  it.each(walked.map((p) => [p.id, p] as const))('%s: the step a tap goes on to starts as that tap leaves it', (_id, p) => {
    for (const story of stories(p))
      story.steps.forEach((st, i) => {
        const next = (st.marks ?? []).find((m) => m.next);
        const after = story.steps[i + 1];
        // A tap that opens another page: the step after starts on that page, its own way. One with no actions is
        // declared by its state (a Scenarios param), not replayed.
        if (!next || !after || after.place.page !== st.place.page || !after.actions?.length) return;
        // What changes the app: a scroll or a wait only places it.
        const acts = (list: WalkAction[]) => list.filter((a) => typeof a === 'string' || !('scroll' in a || 'wait' in a));
        const want = acts([...(st.actions ?? []), next.target]);
        const got = acts(after.actions);
        const starts = want.every((a, k) => got[k] !== undefined && same(a, got[k]));
        expect(starts, `${after.id}: its actions should start with ${JSON.stringify(want)} (${st.id}'s, then the tap on its mark), not ${JSON.stringify(got)}`).toBe(true);
      });
  });
});
