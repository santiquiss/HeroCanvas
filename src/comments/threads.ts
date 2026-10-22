// Pure helpers over a design's comments: threads, what's open, counts per page, how a date reads.
import type { Comment, CommentKind } from './types';
import { t } from '../i18n/ui';

export interface Thread {
  root: Comment;
  /** Oldest first. */
  replies: Comment[];
}

/** Root comments with their replies, the newest thread first. Replies whose root is missing are left out. */
export function threadsOf(comments: Comment[]): Thread[] {
  const byRoot = new Map<string, Thread>();
  for (const c of comments) if (!c.parentId) byRoot.set(c.id, { root: c, replies: [] });
  for (const c of comments) if (c.parentId) byRoot.get(c.parentId)?.replies.push(c);
  for (const t of byRoot.values()) t.replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return [...byRoot.values()].sort((a, b) => b.root.createdAt.localeCompare(a.root.createdAt));
}

export interface ThreadFilter {
  /** A page id: only its threads. */
  page?: string | null;
  kinds?: CommentKind[];
  resolved?: boolean;
  /** A proposal's version: its threads and those left on no version. */
  variant?: string | null;
}

export function filterThreads(threads: Thread[], f: ThreadFilter): Thread[] {
  return threads.filter(
    ({ root }) =>
      (!f.page || root.page === f.page) &&
      (!f.kinds?.length || f.kinds.includes(root.kind)) &&
      (f.resolved || !root.resolvedAt) &&
      (f.variant === undefined || !root.variant || !f.variant || root.variant === f.variant),
  );
}

const counted = new WeakMap<Comment[], Map<string, number>>();

/** Open threads per page id (the Flow cards). Counted once per list, however many cards read it. */
export function openByPage(comments: Comment[]): Map<string, number> {
  let counts = counted.get(comments);
  if (counts) return counts;
  counts = new Map();
  for (const c of comments) if (!c.parentId && !c.resolvedAt) counts.set(c.page, (counts.get(c.page) ?? 0) + 1);
  counted.set(comments, counts);
  return counts;
}

/** "now", "5m", "3h", "2d", then the date: short, for a list. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return t('now');
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** One or two letters for a pin: "Agustina Salas" → "AS", "Jacob" → "J". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** What a link to a comment keeps of the view: everything but the zoom (the viewer's own). */
export function commentLink(pathname: string, search: string): string {
  const q = new URLSearchParams(search);
  q.delete('zoom');
  const s = q.toString();
  return pathname + (s ? `?${s}` : '');
}

/** Threads by number, in the order they were left (#1 the first), as Figma numbers them: a stable way to name one. */
export function threadNumbers(threads: Thread[]): Map<string, number> {
  const roots = threads.map((t) => t.root).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return new Map(roots.map((r, i) => [r.id, i + 1]));
}

/** Whether a thread has the text in its comments, its authors or its page. */
export function threadMatches(t: Thread, query: string, pageLabel = ''): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [t.root, ...t.replies].some((c) => c.body.toLowerCase().includes(q) || c.author.toLowerCase().includes(q)) || pageLabel.toLowerCase().includes(q);
}

/** A person's color for their avatar: the same name, the same color, in every browser. */
const PEOPLE = ['#0d99ff', '#8b5cf6', '#f97316', '#10b981', '#e11d74', '#0ea5e9', '#a16207', '#6366f1'];
export function personColor(name: string): string {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PEOPLE[h % PEOPLE.length];
}

/** Who resolved a thread when they gave no name: stored as is, in no language, and shown in the interface's. */
export const UNKNOWN_RESOLVER = 'Someone';

/** A thread's resolver as the interface shows them. */
export const resolverName = (by: string | null): string => (!by || by === UNKNOWN_RESOLVER ? t('someone') : by);
