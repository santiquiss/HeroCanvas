// Proposals: design explorations / new features on top of the base design.
//
//   proposals/<slug>/
//     proposal.json        meta: title, status, author, created, description   (editable from the app)
//     config.json          screen config overrides for this proposal            (saved from the app)
//     pages.tsx            optional: `export default proposal({ pages, components, params, variants })`: new or
//                          replaced pages; components replaced on every screen (those exported with
//                          `overridable`); parameters added to the code's components; and versions of it to compare
//                          (`variants`: each its own components, picked in the toolbar)
//     components/          optional: new or replaced components + *.stories.tsx (shown in the gallery when active)
//
// A proposal never copies the base: it only declares what it adds or changes.
import type { ReactNode } from 'react';
import type { ScreenLayout } from '../contract';
import type { PageDef } from '../nav/types';
import type { ScreenConfig } from '../nav/screenConfig';
import { t } from '../i18n/ui';

/**
 * Where a proposal is: being designed, waiting for someone to review it, or with its ticket for the developers. Built
 * in the app, it's merged into Live and its folder goes; dropped, it's `archived` (a flag, not a status).
 */
export type ProposalStatus = 'draft' | 'review' | 'handed-off';

export const STATUSES: { id: ProposalStatus; label: string; color: string }[] = [
  { id: 'draft', label: t('Draft'), color: '#9aa0a8' },
  // Someone has to look at it (a design review, often with a ticket of its own).
  { id: 'review', label: t('In review'), color: '#f59e0b' },
  // Its ticket for whoever builds it is created (`ticket`): ready to build.
  { id: 'handed-off', label: t('Dev handoff'), color: '#0d99ff' },
];

/** How an archived proposal shows where a status would. */
export const ARCHIVED = { label: t('Archived'), color: '#c4c8ce' };

/**
 * A proposal.json as written before 0.50 (six statuses) in today's terms: approved is still in review, merged is past
 * the handoff (its folder should go), archived is the flag.
 */
export function normalizeMeta(raw: ProposalMeta): ProposalMeta {
  const status = raw.status as string;
  if (status === 'approved') return { ...raw, status: 'review' };
  if (status === 'merged') return { ...raw, status: 'handed-off' };
  if (status === 'archived') return { ...raw, status: 'draft', archived: true };
  return STATUSES.some((s) => s.id === status) ? raw : { ...raw, status: 'draft' };
}

export interface ProposalMeta {
  /** Its permanent reference (`PJ-12`, proposals/code.ts): what links carry. Never changes; the title and the folder may. */
  code: string;
  title: string;
  status: ProposalStatus;
  /** Dropped or superseded: out of the pickers and the panel's list, still opens from a link (`?proposal=PJ-5`). */
  archived?: boolean;
  author?: string;
  /** ISO date. */
  created: string;
  /** What it changes, in one short sentence: the head of the changes popover (sim/ChangesMenu). */
  summary?: string;
  description?: string;
  /**
   * The ticket it's built from, once created: its status is then `handed-off`. Its id (`APP-12`) or its address in the
   * issue tracker; an address makes it a link.
   */
  ticket?: string;
}

/** A ticket's page: the ticket itself when it's an address; none for a bare id (the tracker isn't known here). */
export const ticketUrl = (ticket: string): string | undefined => (/^https?:\/\//.test(ticket) ? ticket : undefined);

/** What a proposal's version changes in the screens' layout (sim/layout computeLayout), over the app's own. */
export type ProposalLayout = ScreenLayout;

/** What a proposal's pages.tsx exports. */
export interface ProposalCode {
  /** New pages, base pages replaced by id (spread the base entry to change only some fields), or removed (`null`). */
  pages?: Record<string, PageDef | null>;
  /**
   * The page the prototype opens on when the proposal is picked, or for an empty URL (e.g. a sign-up flow). Unset: the
   * picker keeps the page on screen and an empty URL opens Home, as in the base.
   */
  start?: string;
  /**
   * Components replaced wherever they're used, by name (`ListTile: MyVersion`): the component must be exported
   * with `overridable` (design/overridable). The replacement gets the same props.
   */
  components?: Record<string, Replacement>;
  /** What a replaced component changes, in a few words (the changes popover): `{ Button: 'Adds variant test' }`. */
  notes?: Record<string, string>;
  /**
   * Parameters the proposal adds to a component of the code, by the simulator's prop names:
   * `{ AppBar: ['centerTitle', 'subtitle'] }`. Wherever a screen sets one — in Live too — Inspect marks the instance
   * Differs and names the proposal, so a developer sees what the widget needs before that screen can use it.
   */
  params?: Record<string, string[]>;
  /**
   * Components it adds to the code's library that Live already draws (the app hand-builds them), and that it also replaces on
   * the screens (`components`) to draw them as proposed: they count as new, not changed. One with a story alone is new
   * already.
   */
  widgets?: string[];
  /**
   * Versions of the proposal to compare (A, B, C…), in order: each replaces components of its own, over the shared
   * ones above. The first is the default; the toolbar switches them (`?variant=`).
   */
  variants?: Record<string, ProposalVariant>;
  /** Its layout (every version's, unless a version has its own). */
  layout?: ProposalLayout;
}

/** A component that replaces one of the app's: a function of the same props (`never`: any props fit). */
export type Replacement = (props: never) => ReactNode;

/** One version of a proposal. */
export interface ProposalVariant {
  /** A few words: "Wide button". */
  label: string;
  /** What it tries, for the Proposal panel. */
  description?: string;
  components?: Record<string, Replacement>;
  /** This version's layout, over the proposal's. */
  layout?: ProposalLayout;
}

export function proposal(code: ProposalCode): ProposalCode {
  return code;
}

export interface Proposal {
  /** Its code (`meta.code`): the proposal's identity everywhere in the designer and in `?proposal=`. */
  id: string;
  /** Its folder in proposals/: where its files are. A name for people; it can be renamed. */
  folder: string;
  meta: ProposalMeta;
  pages: Record<string, PageDef | null>;
  components: Record<string, Replacement>;
  notes: Record<string, string>;
  /** Parameters it adds to the code's components (`ProposalCode.params`). */
  params: Record<string, string[]>;
  /** Components it adds to the code's library that it also draws on the screens (`ProposalCode.widgets`): new. */
  widgets: string[];
  /** Its versions, in order (none: a single version). */
  variants: (ProposalVariant & { id: string })[];
  config: ScreenConfig;
  start?: string;
  layout: ProposalLayout;
}
