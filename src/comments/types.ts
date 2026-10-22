// Comments on the designs: anyone who opens the designer (the team, the reviewers) leaves them on a screen, replies and
// resolves them. A thread is a root comment (with the pin) and its replies.

/** What a comment is about: the reader filters by it (a dev reads Handoff, a reviewer Design). */
export type CommentKind = 'design' | 'handoff' | 'copy' | 'dev' | 'question';

export const KINDS: { id: CommentKind; label: string; color: string }[] = [
  { id: 'design', label: 'Design', color: '#8b5cf6' },
  { id: 'handoff', label: 'Handoff', color: '#0d99ff' },
  { id: 'copy', label: 'Copy', color: '#f59e0b' },
  { id: 'dev', label: 'Dev / Bug', color: '#ef4444' },
  { id: 'question', label: 'Question', color: '#10b981' },
];

export const kindOf = (id: string): (typeof KINDS)[number] => KINDS.find((k) => k.id === id) ?? KINDS[0];

/** Where Live's comments go (a proposal's go under its code, `PJ-12`). */
export const LIVE = 'live';

/** A component's page in the gallery, as a comment's `page` (the app's pages are their ids). */
const COMPONENT_PAGE = 'component:';
export const componentPage = (name: string) => COMPONENT_PAGE + name;
/** The component a comment's page is, or null when it's one of the app's pages. */
export const componentOfPage = (page: string): string | null => (page.startsWith(COMPONENT_PAGE) ? page.slice(COMPONENT_PAGE.length) : null);

/**
 * Where a pin sits: on a component of a page (the nth of its name in the page, at a point of it), so it follows the
 * component when the screen scrolls or the layout changes; `x`/`y` place it on the page when the component isn't
 * found (the design changed since). Every fraction is 0–1 of the box. `device` / `display`: the device it was left on
 * (devices/devices.ts), where its pin shows; none (older comments) shows on every device. `overlay`: the component is on
 * a sheet, dialog or popover over the page (comments/anchor), and the pin shows only while it's open; `sheet`: that
 * sheet's id, when it has one, so opening the comment opens it (sim/sheetLinks). `story`: on a component's page in the
 * gallery, the example it was left on (its pin follows that one).
 */
export interface CommentAnchor {
  component: string | null;
  nth: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
  device?: string | null;
  display?: string | null;
  overlay?: boolean;
  sheet?: string;
  story?: string;
}

export interface Comment {
  id: string;
  /** ISO date. */
  createdAt: string;
  /** `live` or a proposal's code. */
  design: string;
  /** The proposal's version it was left on (`b`), or null (Live, or a proposal without versions). */
  variant: string | null;
  /** The page id (app/pages.tsx), or a component's in the gallery (componentPage). */
  page: string;
  /** The view it was left on (route + query), to open it again. */
  link: string;
  /** Root comments only: where its pin goes. */
  anchor: CommentAnchor | null;
  /** A reply's thread; null for a root comment. */
  parentId: string | null;
  kind: CommentKind;
  author: string;
  body: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  /** Who may edit or delete it: the SHA-256 of the secret of the browser it was left from (comments/owner); none on
   * comments from before 0.34.0. */
  owner?: string | null;
  /** ISO date of its last edit, if it was edited. */
  editedAt?: string | null;
}

export const MAX_BODY = 4000;
export const MAX_AUTHOR = 60;
