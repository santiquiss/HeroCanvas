// How a sheet opened from a page (useSim().openSheet) shows: as the sheet it is on phones, or where anchored menus float
// (sim/layout anchoredFloats: 600pt wide or more; from the nav, every iPhone Duo display) as what fits what it holds — a
// drop-down or a popover hanging from the control that opened it, or a dialog. One rule for every sheet.
import type { SheetLayout } from '../kit';

/**
 * What a sheet holds, which decides what it becomes on a large screen:
 * - `actions`: only rows that each do one thing and close (ActionSheet's actions, a list to pick one from).
 * - `content`: anything else that acts at once, with no Save or Cancel (the + menu, a range).
 * - `task`: something to fill in and confirm (Save, Copy, Done), type into, or go through in steps.
 */
export type SheetKind = 'actions' | 'content' | 'task';

/** How it shows. A `content(close, as)` sheet is told which, to draw itself for it. */
export type SheetPresentation = 'sheet' | 'dropdown' | 'popover' | 'dialog';

export interface SheetRuleInput {
  kind?: SheetKind;
  /** The Sheet layout its opener chose (none: Bottom Content). */
  layout?: SheetLayout;
  /** Whether there's a control on this screen it can hang from. */
  hasAnchor: boolean;
  /** Whether this screen floats anchored menus (sim/layout anchoredFloats). */
  floats: boolean;
}

/**
 * On large screens a sheet takes the shape of what it holds. Actions hang from their control as a drop-down
 * (ActionSheet's rows, its destructive ones after a divider); content points at it in a popover; a task is a dialog
 * in the middle, whatever opened it, as is content with no control to come from. Actions with no control stay the
 * sheet they are (an action sheet has nothing else to hang from). Phones keep their sheets, and so does a sheet that
 * doesn't say what it holds, or whose opener chose where it sits elsewhere than the bottom edge (Top Content: a
 * day picker comes down from the top at every size, as designed).
 */
/** The layouts that rise from the bottom edge, the ones the rule moves: Bottom Content, and Bottom Expanded (an
 * editor, a dialog on large screens). */
const RISES_FROM_BOTTOM: SheetLayout[] = ['bottomContent', 'bottomExpanded'];

export function sheetPresentation(s: SheetRuleInput): SheetPresentation {
  if (!s.floats || !s.kind || (s.layout && !RISES_FROM_BOTTOM.includes(s.layout))) return 'sheet';
  if (s.kind === 'task') return 'dialog';
  if (s.kind === 'actions') return s.hasAnchor ? 'dropdown' : 'sheet';
  return s.hasAnchor ? 'popover' : 'dialog';
}

/**
 * The control the click being handled was on, for a sheet to hang from: what the app reads from the tapped widget's
 * context. Through `window.event`, the one way to reach it without threading the event through every component's
 * callback (onMorePressed, onTitle…); null outside a click (a sheet opened by a timer, after a scan).
 */
export function tappedControl(): HTMLElement | null {
  const e = typeof window === 'undefined' ? undefined : window.event;
  if (!e || (e.type !== 'click' && e.type !== 'pointerup')) return null;
  const target = e.target instanceof Element ? e.target : null;
  return target?.closest<HTMLElement>('button, a, [role="button"], [role="menuitem"]') ?? null;
}
