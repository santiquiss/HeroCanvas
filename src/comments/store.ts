// The comments in memory, per design (Live or a proposal): one request loads a design's comments for every reader
// (the panel, the pins, the Flow cards, the tab's count), and they refresh together. No connection kept open: they
// load again when the window comes back to the front and, while someone is reading them (the panel open, commenting),
// every 30 s. Adding and resolving show at once and are sent after (undone if the store refuses them); editing and
// deleting wait for the store, which checks the comment is yours.
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { BACKEND, type Backend } from './backend';
import { myOwner, ownerSecret } from './owner';
import type { Comment } from './types';

export interface CommentsState {
  comments: Comment[];
  status: 'loading' | 'ready' | 'error';
  error: string | null;
}

const POLL_MS = 30_000;
/** Coming back to the window refreshes what's older than this. */
const STALE_MS = 10_000;
const EMPTY: CommentsState = { comments: [], status: 'loading', error: null };

let backend: Backend = BACKEND;
const states = new Map<string, CommentsState>();
const loadedAt = new Map<string, number>();
const inflight = new Map<string, Promise<void>>();
/** Sent but not confirmed: kept through a refresh that doesn't have them yet. */
const pending = new Map<string, Comment>();
const listeners = new Map<string, Set<() => void>>();
/** Readers that want it fresh (the panel, comment mode), per design. */
const live = new Map<string, number>();

/** Whether everyone sees the comments, or only this browser (no shared store connected yet). */
export const commentsShared = () => backend.kind === 'shared';

/** For the tests: another backend, and nothing in memory. */
export function setBackendForTests(b: Backend) {
  backend = b;
  states.clear();
  loadedAt.clear();
  inflight.clear();
  pending.clear();
}

function set(design: string, next: Partial<CommentsState>) {
  states.set(design, { ...(states.get(design) ?? EMPTY), ...next });
  listeners.get(design)?.forEach((l) => l());
}

export function refresh(design: string): Promise<void> {
  const running = inflight.get(design);
  if (running) return running;
  const p = backend
    .list(design)
    .then((list) => {
      const ids = new Set(list.map((c) => c.id));
      for (const id of ids) pending.delete(id);
      const waiting = [...pending.values()].filter((c) => c.design === design);
      loadedAt.set(design, Date.now());
      set(design, { comments: [...list, ...waiting], status: 'ready', error: null });
    })
    .catch((e: unknown) => set(design, { status: 'error', error: e instanceof Error ? e.message : String(e) }))
    .finally(() => inflight.delete(design));
  inflight.set(design, p);
  return p;
}

function subscribe(design: string, l: () => void) {
  let ls = listeners.get(design);
  if (!ls) listeners.set(design, (ls = new Set()));
  ls.add(l);
  startWatching();
  return () => {
    ls.delete(l);
  };
}

// One listener and one timer for every design read: the window coming back refreshes what's stale; the timer
// refreshes what's read live, while the window is visible.
let watching = false;
function startWatching() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  const onFront = () => {
    if (document.visibilityState !== 'visible') return;
    for (const [design, ls] of listeners) if (ls.size && Date.now() - (loadedAt.get(design) ?? 0) > STALE_MS) void refresh(design);
  };
  window.addEventListener('focus', onFront);
  document.addEventListener('visibilitychange', onFront);
  window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    for (const [design, n] of live) if (n > 0) void refresh(design);
  }, POLL_MS);
}

/** The first reader of a design loads it when the browser is idle (the screens come first). */
function useLoad(designs: string[]) {
  useEffect(() => {
    const todo = designs.filter((d) => !states.has(d) && !inflight.has(d));
    if (!todo.length) return;
    const id = requestIdleCallback(() => todo.forEach((d) => void refresh(d)), { timeout: 2000 });
    return () => cancelIdleCallback(id);
  }, [designs]);
}

/** A reader that wants them kept up to date (polling while it's mounted); opening it shows what's new. */
function useFresh(designs: string[], fresh: boolean) {
  useEffect(() => {
    if (!fresh) return;
    for (const d of designs) {
      live.set(d, (live.get(d) ?? 0) + 1);
      if (Date.now() - (loadedAt.get(d) ?? 0) > STALE_MS && states.has(d)) void refresh(d);
    }
    return () => {
      for (const d of designs) live.set(d, (live.get(d) ?? 1) - 1);
    };
  }, [designs, fresh]);
}

/** A design's comments, and whether they've loaded. `fresh`: keep them up to date while this reader is mounted. */
export function useComments(design: string, { fresh = false }: { fresh?: boolean } = {}): CommentsState {
  const state = useSyncExternalStore(
    (l) => subscribe(design, l),
    () => states.get(design) ?? EMPTY,
    () => EMPTY,
  );
  const designs = useMemo(() => [design], [design]);
  useLoad(designs);
  useFresh(designs, fresh);
  return state;
}

const NONE: Comment[] = [];

/** The comments of several designs together (a set of devices, each showing its own version). */
export function useCommentsOf(designs: string[], { fresh = false }: { fresh?: boolean } = {}): Comment[] {
  const key = [...new Set(designs)].sort().join('\n');
  const list = useMemo(() => (key ? key.split('\n') : []), [key]);
  // The same array while none of them changed, so readers don't re-render.
  const last = useRef<{ parts: (CommentsState | undefined)[]; value: Comment[] }>({ parts: [], value: NONE });
  const get = useCallback(() => {
    const parts = list.map((d) => states.get(d));
    const prev = last.current;
    if (parts.length === prev.parts.length && parts.every((p, i) => p === prev.parts[i])) return prev.value;
    last.current = { parts, value: parts.flatMap((p) => p?.comments ?? NONE) };
    return last.current.value;
  }, [list]);
  const sub = useCallback(
    (l: () => void) => {
      const offs = list.map((d) => subscribe(d, l));
      return () => offs.forEach((off) => off());
    },
    [list],
  );
  const value = useSyncExternalStore(sub, get, () => NONE);
  useLoad(list);
  useFresh(list, fresh);
  return value;
}

/** Leave a comment (or a reply): it's yours — this browser's (comments/owner). */
export async function addComment(comment: Comment): Promise<void> {
  const c: Comment = { ...comment, owner: await myOwner(), editedAt: null };
  const before = states.get(c.design)?.comments ?? [];
  pending.set(c.id, c);
  set(c.design, { comments: [...before, c] });
  try {
    const saved = await backend.add(c);
    pending.delete(c.id);
    set(c.design, { comments: (states.get(c.design)?.comments ?? []).map((x) => (x.id === c.id ? saved : x)) });
  } catch (e) {
    pending.delete(c.id);
    set(c.design, { comments: (states.get(c.design)?.comments ?? []).filter((x) => x.id !== c.id) });
    throw e;
  }
}

/** Resolve a thread (`by`: who), or open it again (`by` null). */
export async function setResolved(design: string, id: string, by: string | null): Promise<void> {
  const at = by ? new Date().toISOString() : null;
  const patch = (resolvedAt: string | null, resolvedBy: string | null) =>
    set(design, { comments: (states.get(design)?.comments ?? []).map((c) => (c.id === id ? { ...c, resolvedAt, resolvedBy } : c)) });
  const was = states.get(design)?.comments.find((c) => c.id === id);
  patch(at, by);
  try {
    await backend.resolve(id, by, at);
  } catch (e) {
    patch(was?.resolvedAt ?? null, was?.resolvedBy ?? null);
    throw e;
  }
}

/** Your comment's new text. */
export async function editComment(c: Comment, body: string): Promise<void> {
  const saved = await backend.edit(c.id, body, ownerSecret());
  set(c.design, { comments: (states.get(c.design)?.comments ?? []).map((x) => (x.id === c.id ? { ...x, body: saved.body, editedAt: saved.editedAt } : x)) });
}

/** Delete your comment; a thread's first one takes its replies with it. */
export async function deleteComment(c: Comment): Promise<void> {
  await backend.remove(c.id, ownerSecret());
  set(c.design, { comments: (states.get(c.design)?.comments ?? []).filter((x) => x.id !== c.id && x.parentId !== c.id) });
}

export const newCommentId = () => crypto.randomUUID();
