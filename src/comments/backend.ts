// Where comments are kept. Shared: a Supabase table (its address and key in herocanvas.config.ts `comments`, schema in
// supabase.sql), read and written with plain fetch through its REST API — no client library. Until the config has a
// key (and in the tests): this browser's storage, so the plugin works before the shared store is connected. The
// connection is the team's, not the tool's: in its config, an update never empties it.
//
// The key is public by design: the key is Supabase's publishable key, and what it may do is set by the table's
// policies (read, add, resolve; edit or delete only your own, through two functions that check the browser's secret). The repository is private and the deployed site is behind the
// team password, so the key isn't out in the open either.
import { sha256Hex } from './owner';
import type { Comment } from './types';
import { t } from '../i18n/ui';

export interface Backend {
  /** `shared`: everyone sees the same comments; `local`: only this browser. */
  kind: 'shared' | 'local';
  list(design: string): Promise<Comment[]>;
  /** Every design's comments together (Live's and every proposal's, even one archived or merged since). */
  listAll(): Promise<Comment[]>;
  add(c: Comment): Promise<Comment>;
  resolve(id: string, by: string | null, at: string | null): Promise<void>;
  /** Your comment's new text (`secret`: this browser's, comments/owner); refused when it isn't yours. */
  edit(id: string, body: string, secret: string): Promise<Comment>;
  /** Delete your comment; a thread's first one takes its replies with it. */
  remove(id: string, secret: string): Promise<void>;
}

/** The table's columns (snake_case) ↔ a Comment. */
interface Row {
  id: string;
  created_at: string;
  design: string;
  variant: string | null;
  page: string;
  link: string;
  anchor: Comment['anchor'];
  parent_id: string | null;
  kind: Comment['kind'];
  author: string;
  body: string;
  resolved_at: string | null;
  resolved_by: string | null;
  owner?: string | null;
  edited_at?: string | null;
  mentions?: string[] | null;
}

const fromRow = (r: Row): Comment => ({
  id: r.id,
  createdAt: r.created_at,
  design: r.design,
  variant: r.variant,
  page: r.page,
  link: r.link,
  anchor: r.anchor,
  parentId: r.parent_id,
  kind: r.kind,
  author: r.author,
  body: r.body,
  resolvedAt: r.resolved_at,
  resolvedBy: r.resolved_by,
  owner: r.owner ?? null,
  editedAt: r.edited_at ?? null,
  mentions: r.mentions ?? null,
});

const toRow = (c: Comment): Row => ({
  id: c.id,
  created_at: c.createdAt,
  design: c.design,
  variant: c.variant,
  page: c.page,
  link: c.link,
  anchor: c.anchor,
  parent_id: c.parentId,
  kind: c.kind,
  author: c.author,
  body: c.body,
  resolved_at: c.resolvedAt,
  resolved_by: c.resolvedBy,
  owner: c.owner ?? null,
  // Only when it mentions someone: a table from before mentions (supabase.sql) still takes every other comment.
  ...(c.mentions?.length ? { mentions: c.mentions } : {}),
});

/** A shared store also takes the comments a browser kept before it was connected (uploadBrowserComments). */
export interface SharedBackend extends Backend {
  upload(cs: Comment[]): Promise<void>;
}

export function supabaseBackend(url: string, key: string): SharedBackend {
  const root = `${url.replace(/\/$/, '')}/rest/v1`;
  // A legacy anon key is a JWT and goes in Authorization too; a publishable key (sb_publishable_…) only in apikey.
  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json', ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}) };
  const call = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(root + path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
    if (!r.ok) throw new Error(`Comments: ${r.status} ${await r.text().catch(() => '')}`.trim());
    return r;
  };
  const rpc = (fn: string, args: Record<string, unknown>) => call(`/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  const resolve = (id: string, by: string | null, at: string | null) =>
    call(`/comments?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ resolved_at: at, resolved_by: by }) });
  return {
    kind: 'shared',
    async list(design) {
      const r = await call(`/comments?design=eq.${encodeURIComponent(design)}&order=created_at.asc&limit=2000`);
      return ((await r.json()) as Row[]).map(fromRow);
    },
    async listAll() {
      const r = await call('/comments?order=created_at.asc&limit=5000');
      return ((await r.json()) as Row[]).map(fromRow);
    },
    async add(c) {
      const r = await call('/comments', { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify(toRow(c)) });
      return fromRow(((await r.json()) as Row[])[0]);
    },
    async resolve(id, by, at) {
      await resolve(id, by, at);
    },
    async edit(id, body, secret) {
      const r = await rpc('edit_comment', { comment_id: id, secret, new_body: body });
      return fromRow((await r.json()) as Row);
    },
    async remove(id, secret) {
      await rpc('delete_comment', { comment_id: id, secret });
    },
    async upload(cs) {
      // One that's already there is skipped, so sending again (another tab, a retry) adds nothing twice.
      const send = (rows: Row[]) =>
        rows.length ? call('/comments?on_conflict=id', { method: 'POST', headers: { prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(rows) }) : null;
      // The table takes a comment open and unedited (supabase.sql); a resolved thread is resolved after.
      const open = (c: Comment, at?: string): Row => ({ ...toRow(c), resolved_at: null, resolved_by: null, ...(at ? { created_at: at } : {}) });
      // Threads before their replies (a reply points to its thread).
      for (const batch of [cs.filter((c) => !c.parentId), cs.filter((c) => c.parentId)]) {
        try {
          await send(batch.map((c) => open(c)));
        } catch {
          // The table only takes comments dated about now (supabase.sql): sent again dated now, their order kept.
          const now = Date.now();
          await send(batch.map((c, i) => open(c, new Date(now - (batch.length - i) * 1000).toISOString())));
        }
      }
      for (const c of cs) if (!c.parentId && c.resolvedAt) await resolve(c.id, c.resolvedBy, c.resolvedAt);
    },
  };
}

/** Where a browser keeps its comments while no shared store is connected (localBackend). */
const LOCAL_KEY = 'hc.comments';

/**
 * The comments this browser kept before the shared store was connected, sent to it: everyone sees them from then on.
 * Once they're in, the browser's copy moves aside (`hc.comments.uploaded`), kept in case one is ever missed; when
 * sending fails, it stays and is tried again on the next load. How many were sent.
 */
export async function uploadBrowserComments(
  shared: Pick<SharedBackend, 'upload'>,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = safeStorage(),
): Promise<number> {
  const read = (key: string): Comment[] => {
    try {
      return JSON.parse(storage?.getItem(key) || '[]') as Comment[];
    } catch {
      return [];
    }
  };
  const cs = read(LOCAL_KEY);
  if (!storage || !cs.length) return 0;
  await shared.upload(cs);
  storage.setItem(`${LOCAL_KEY}.uploaded`, JSON.stringify([...read(`${LOCAL_KEY}.uploaded`), ...cs]));
  storage.removeItem(LOCAL_KEY);
  return cs.length;
}

/** This browser only (localStorage), or memory where there's no storage. */
export function localBackend(storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): Backend {
  const KEY = LOCAL_KEY;
  let memory: Comment[] = [];
  const read = (): Comment[] => {
    try {
      return storage ? (JSON.parse(storage.getItem(KEY) || '[]') as Comment[]) : memory;
    } catch {
      return [];
    }
  };
  const write = (all: Comment[]) => {
    memory = all;
    try {
      storage?.setItem(KEY, JSON.stringify(all));
    } catch {
      /* storage full or unavailable: kept in memory */
    }
  };
  return {
    kind: 'local',
    list: async (design) => read().filter((c) => c.design === design),
    listAll: async () => read(),
    add: async (c) => {
      write([...read(), c]);
      return c;
    },
    resolve: async (id, by, at) => write(read().map((c) => (c.id === id ? { ...c, resolvedAt: at, resolvedBy: by } : c))),
    // The same check as the table's.
    edit: async (id, body, secret) => {
      const c = await own(id, secret);
      const edited = { ...c, body, editedAt: new Date().toISOString() };
      write(read().map((x) => (x.id === id ? edited : x)));
      return edited;
    },
    remove: async (id, secret) => {
      await own(id, secret);
      write(read().filter((x) => x.id !== id && x.parentId !== id));
    },
  };
  async function own(id: string, secret: string): Promise<Comment> {
    const c = read().find((x) => x.id === id);
    if (!c || !c.owner || c.owner !== (await sha256Hex(secret))) throw new Error(t('Not your comment'));
    return c;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const SHARED = __HC_COMMENTS__?.key && import.meta.env.MODE !== 'test' ? supabaseBackend(__HC_COMMENTS__.url, __HC_COMMENTS__.key) : null;

/** The tests never reach the network: they keep comments in memory. */
export const BACKEND: Backend = SHARED ?? localBackend(import.meta.env.MODE === 'test' ? null : undefined);

/** Settles once this browser's earlier comments are in the shared store (or there were none, or it failed). */
export const BACKEND_READY: Promise<void> = SHARED
  ? uploadBrowserComments(SHARED).then(
      (n) => void (n && console.info(`Comments: ${n} kept in this browser, now shared.`)),
      (e: unknown) => console.warn('Comments: this browser’s comments weren’t shared yet; tried again next time.', e),
    )
  : Promise.resolve();
