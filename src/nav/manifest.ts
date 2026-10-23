// The effective manifest: base pages, plus the active proposal's new / replaced pages.
import type { Proposal } from '../proposals/types';
import { BASE_PAGES } from './pages';
import type { Manifest } from './stack';

const cache = new Map<string, Manifest>();

export function composePages(p: Proposal | null): Manifest {
  if (!p) return BASE_PAGES;
  let m = cache.get(p.id);
  if (!m) {
    m = { ...BASE_PAGES };
    // Added and replaced pages; `null` removes one.
    for (const [id, def] of Object.entries(p.pages)) {
      if (def) m[id] = def;
      else delete m[id];
    }
    cache.set(p.id, m);
  }
  return m;
}

export type PageChange = 'new' | 'changed' | null;

/** How a page differs from the base under a proposal: new page, replaced page or screen config, or unchanged. */
export function pageChange(id: string, p: Proposal | null): PageChange {
  if (!p) return null;
  if (!BASE_PAGES[id]) return 'new';
  if (p.pages[id] || (p.config[id] && Object.keys(p.config[id]).length)) return 'changed';
  return null;
}

/**
 * A flow's steps a proposal adds to a page (in its flow, not in the base page's): new screens of that flow, marked new
 * as a new page is. None for a page the proposal adds whole (the page is new).
 */
export function newSteps(id: string, p: Proposal | null): string[] {
  const def = p?.pages[id];
  const base = BASE_PAGES[id];
  if (!def?.flow || !base) return [];
  const had = new Set((base.flow?.steps ?? []).map((st) => st.id));
  return def.flow.steps.filter((st) => !had.has(st.id)).map((st) => st.id);
}
