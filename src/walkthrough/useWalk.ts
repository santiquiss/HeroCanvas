// The walkthrough on screen: the proposal's steps, the one that's open, and going to another. Going there by the
// list, an arrow, a link or the browser's Back puts the prototype in that step's state (its place, then its actions,
// from the app as it opens); going there by tapping what the step before marked leaves the prototype as that tap left it.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useNavRoot } from '../nav/context';
import { SIDE_PANEL_PARAM } from '../nav/sidePanel';
import { findProposal } from '../proposals';
import type { WalkMark } from '../proposals/types';
import { APP_CONTROLS } from '../sim/persona';
import { RESET_APP_EVENT, useUrlParams, useUrlPatch } from '../sim/SimContext';
import { actionTarget, findTarget, flatSteps, runActions, screens, scrollToTarget, WALK_MARKS_PARAM, WALK_PARAM, type FlatStep } from './engine';

/** After the place has opened and its page has come in. */
const SETTLE_MS = 450;
/** After a tap goes on: how long the next step's first mark is looked for, and how often. */
const FOLLOW_MS = 12000;
const LOOK_MS = 300;

/**
 * The walk, shared by the panel and the marks: the replay under way (a newer one cancels it), the step the prototype
 * was last put in, or reached by a tap (so the address naming it again isn't a reason to put it back), and what the
 * replay couldn't find, or that it's still under way.
 */
const walk = { run: 0, applied: null as string | null, status: { busy: false, missing: null as string | null } };
const listeners = new Set<() => void>();
const setStatus = (status: typeof walk.status) => {
  walk.status = status;
  listeners.forEach((l) => l());
};
/** The walk's status as it is now, not as of the last render (a script's probe reads it between renders). */
export const walkStatus = () => walk.status;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * Brings a step's marks into view: each that isn't on the screen yet but is on its page (under the fold, under the
 * keyboard or a floating bar) is scrolled to, one at a time, until all show or `ms` is up (what a tap opened may take a
 * while: a reply). Then it's left to the person.
 */
async function followMarks(marks: WalkMark[], cancelled: () => boolean, ms = FOLLOW_MS) {
  const until = Date.now() + ms;
  while (!cancelled() && Date.now() < until) {
    const screen = screens()[0];
    const lost = screen ? marks.filter((m) => !findTarget(screen, m.target)) : marks;
    if (!lost.length) return;
    const moved = !!screen && lost.some((m) => scrollToTarget(screen, m.target));
    await new Promise((r) => window.setTimeout(r, moved ? SETTLE_MS : LOOK_MS));
  }
}

export function useWalk() {
  const get = useUrlParams();
  const patch = useUrlPatch();
  const nav = useNavRoot();
  const proposal = findProposal(get('proposal'));
  const stories = proposal?.walkthrough;
  const steps = useMemo(() => flatSteps(stories ?? []), [stories]);
  const status = useSyncExternalStore(subscribe, () => walk.status);
  const id = get(WALK_PARAM);
  const index = steps.findIndex((s) => s.id === id);
  const open = useCallback(
    (step: FlatStep) => {
      const mine = ++walk.run;
      walk.applied = step.id;
      window.dispatchEvent(new Event(RESET_APP_EVENT));
      // The page from its own state alone: what the prototype was left at (another day picked, a flow's step, a
      // scenario, the side panel open: the Coach) is put back to its default unless the step says otherwise.
      // Every page's, not only this one's: a page under it (the Dashboard under a paywall) reads its own too.
      const defs = Object.values(nav.pages);
      const keys = [...defs.flatMap((d) => [...(d.state ?? []), ...(d.controls ?? []).map((c) => c.param)]), ...APP_CONTROLS.map((c) => c.param), ...(SIDE_PANEL_PARAM ? [SIDE_PANEL_PARAM] : [])];
      const cleared = Object.fromEntries(keys.map((k) => [k, null]));
      nav.open(step.place.page, step.place.params ?? {}, { ...cleared, ...step.place.state, [WALK_PARAM]: step.id });
      // Busy until the step is still: its actions done, and what it points at first scrolled into view.
      setStatus({ busy: true, missing: null });
      const cancelled = () => mine !== walk.run;
      window.setTimeout(async () => {
        const failed = step.actions?.length ? await runActions(step.actions, cancelled) : null;
        if (cancelled()) return;
        // What the step points at, in view: a row under the fold, or under the keyboard, scrolled to as a person would.
        if (failed === null && step.marks?.length) await followMarks(step.marks, cancelled, SETTLE_MS * 4);
        if (!cancelled()) setStatus({ busy: false, missing: failed === null ? null : actionTarget(step.actions![failed]) });
      }, SETTLE_MS);
    },
    [nav],
  );
  const stop = () => {
    walk.run++;
    if (walk.status.busy || walk.status.missing) setStatus({ busy: false, missing: null });
  };
  return {
    proposal,
    stories: stories ?? [],
    steps,
    step: index < 0 ? null : steps[index],
    index,
    /** The replay is under way, or stopped at a target it couldn't find (`missing`). */
    status,
    /** Whether the step on screen was put in its state here, or reached by a tap: else (a link, Back) it needs to be. */
    applied: (stepId: string) => walk.applied === stepId,
    /** No step on screen (the address dropped it): the next one named is put in its state, even the same one again. */
    forget: () => {
      walk.applied = null;
    },
    marksOn: get(WALK_MARKS_PARAM) !== '0',
    setMarksOn: (on: boolean) => patch({ [WALK_MARKS_PARAM]: on ? null : '0' }),
    open,
    /** The step after or before in its story, in its state. */
    move: (by: 1 | -1) => {
      const next = steps[index + by];
      if (next && next.story === steps[index]?.story) open(next);
    },
    /**
     * The step after this one in its story (none at its end): where a tap on the screen goes on to.
     */
    nextId: steps[index + 1]?.story === steps[index]?.story ? (steps[index + 1]?.id ?? null) : null,
    /**
     * A step by its id, the prototype left as it is: what the person just tapped took it there. Written into the
     * address as it is now (the app's own navigation may have dropped the step from it).
     */
    show: (stepId: string) => {
      stop();
      walk.applied = stepId;
      patch({ [WALK_PARAM]: stepId });
      // What it points at, in view, as from a link: once what the tap opened shows (a reply may take a while).
      const marks = steps.find((st) => st.id === stepId)?.marks ?? [];
      const mine = walk.run;
      window.setTimeout(() => void followMarks(marks, () => mine !== walk.run), SETTLE_MS);
    },
    close: () => {
      stop();
      walk.applied = null;
      patch({ [WALK_PARAM]: null });
    },
  };
}
