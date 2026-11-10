// The effective manifest: base pages, plus the active proposal's new / replaced pages.
import type { Proposal } from '../proposals/types';
import { placesOf } from '../proposals';
import { BASE_PAGES } from './pages';
import { pageTitle, type Manifest } from './stack';
import type { Nav } from './context';

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

/**
 * The navigation as Live has it, from a proposal's: Live's pages and no proposal, for screens drawn as Live beside the
 * proposal's (a shot's Before, the where-used scan). Its stack and its moves stay the caller's.
 */
export function liveNav(nav: Nav): Nav {
  const pages = composePages(null);
  return {
    ...nav,
    pages,
    proposal: null,
    tabs: Object.keys(pages).filter((id) => pages[id].level === 'tab'),
    boots: Object.keys(pages).filter((id) => pages[id].level === 'boot'),
    change: () => null,
    def: (id) => pages[id],
    title: (ref) => pageTitle(pages, ref),
  };
}

export type PageChange = 'new' | 'changed' | null;

/** How a page differs from the base under a proposal: new page, replaced page or screen config, or unchanged. */
export function pageChange(id: string, p: Proposal | null): PageChange {
  if (!p) return null;
  if (!BASE_PAGES[id]) return 'new';
  if (p.pages[id] || (p.config[id] && Object.keys(p.config[id]).length)) return 'changed';
  // A changed component shows on it (`show`, any version's).
  if (Object.values(p.show ?? {}).some((places) => places.some((pl) => pl.page === id))) return 'changed';
  if (p.variants.some((v) => Object.values(placesOf(v.show)).some((places) => places.some((pl) => pl.page === id)))) return 'changed';
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

/** What a proposal does to one step of a page's flow: adds it (new), changes its screen (its flow says so), or nothing. */
export function stepChange(id: string, stepId: string, p: Proposal | null): 'new' | 'changed' | null {
  if (newSteps(id, p).includes(stepId)) return 'new';
  return p?.pages[id]?.flow?.steps.find((st) => st.id === stepId)?.change ?? null;
}
