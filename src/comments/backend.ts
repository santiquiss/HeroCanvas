// Where comments are kept. Shared: a Supabase table (supabase.json, schema in supabase.sql), read and written with
// plain fetch through its REST API — no client library. Until supabase.json has a key (and in the tests): this
// browser's storage, so the plugin works before the shared store is connected.
//
// supabase.json is public by design: the key is Supabase's publishable key, and what it may do is set by the table's
// policies (read, add, resolve; edit or delete only your own, through two functions that check the browser's secret). The repository is private and the deployed site is behind the
// team password, so the key isn't out in the open either.
import config from './supabase.json';
import { sha256Hex } from './owner';
import type { Comment } from './types';

export interface Backend {
  /** `shared`: everyone sees the same comments; `local`: only this browser. */
  kind: 'shared' | 'local';
  list(design: string): Promise<Comment[]>;
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
});

export function supabaseBackend(url: string, key: string): Backend {
  const root = `${url.replace(/\/$/, '')}/rest/v1`;
  // A legacy anon key is a JWT and goes in Authorization too; a publishable key (sb_publishable_…) only in apikey.
  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json', ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}) };
  const call = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(root + path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
    if (!r.ok) throw new Error(`Comments: ${r.status} ${await r.text().catch(() => '')}`.trim());
    return r;
  };
  const rpc = (fn: string, args: Record<string, unknown>) => call(`/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  return {
    kind: 'shared',
    async list(design) {
      const r = await call(`/comments?design=eq.${encodeURIComponent(design)}&order=created_at.asc&limit=2000`);
      return ((await r.json()) as Row[]).map(fromRow);
    },
    async add(c) {
      const r = await call('/comments', { method: 'POST', headers: { prefer: 'return=representation' }, body: JSON.stringify(toRow(c)) });
      return fromRow(((await r.json()) as Row[])[0]);
    },
    async resolve(id, by, at) {
      await call(`/comments?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ resolved_at: at, resolved_by: by }) });
    },
    async edit(id, body, secret) {
      const r = await rpc('edit_comment', { comment_id: id, secret, new_body: body });
      return fromRow((await r.json()) as Row);
    },
    async remove(id, secret) {
      await rpc('delete_comment', { comment_id: id, secret });
    },
  };
}

/** This browser only (localStorage), or memory where there's no storage. */
export function localBackend(storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()): Backend {
  const KEY = 'hc.comments';
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
    if (!c || !c.owner || c.owner !== (await sha256Hex(secret))) throw new Error('Not your comment');
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

/** The tests never reach the network: they keep comments in memory. */
export const BACKEND: Backend =
  config.key && import.meta.env.MODE !== 'test' ? supabaseBackend(config.url, config.key) : localBackend(import.meta.env.MODE === 'test' ? null : undefined);
