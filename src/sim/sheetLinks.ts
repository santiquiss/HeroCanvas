// Sheets a link can open again. A sheet lives in memory (useSim().openSheet, or a page's own state), not in the URL,
// so a view's link opens the page without it. The screen that opens a sheet declares how (useSheetLink, by the sheet's
// id: SheetSpec `id`, OnScreen `id`), and whoever has a link to it — a comment left on the sheet — asks for it by id.
//
// Going to another page closes the sheet (SimContext), so a sheet asked for with its page opens once that page is on
// screen: when its opener registers (or re-registers) at the page's path, after the change has settled.
//
// The page index (sim/pageIndex) opens them too, to find what's in each page's sheets: a page it renders off screen
// registers its sheets in the scan's own scope (SheetLinkScope), never in the live screens' list; what the screen's
// chrome declares there (the nav's + menu, on every page) isn't the page's and is left out.
import { createContext, useContext, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { PageScope } from '../nav/context';

/** A sheet's id as people read it: `reportRange` → "Report range"; an id with spaces ("Sort by") as it is. */
export const sheetLabel = (id: string): string => {
  const words = id.includes(' ') ? id : id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The DOM attribute that marks a sheet's content with its id (DeviceScreen's SheetLayer, OnScreen). */
export const SHEET_ATTR = 'data-sheet-id';

interface Opener {
  path: string;
  open: () => void;
}

const openers = new Map<string, Set<Opener>>();
/** Asked for before its page was on screen; forgotten after a while (the page may not have it). */
let pending: { id: string; path?: string; until: number } | null = null;
const WAIT_MS = 4000;

/** Opens after the commit that put the page on screen, so the page change doesn't close it. */
const later = (open: () => void) => window.setTimeout(open, 0);

/** Where an off-screen copy of a page registers the sheets it can open: by the page's id, then the sheet's. */
export interface SheetLinkScope {
  add(pageId: string, id: string, open: () => void): () => void;
}
export const SheetLinkScopeCtx = createContext<SheetLinkScope | null>(null);

/** A scope that keeps the openers in a map (page id → sheet id → open), for the scanner to go through. */
export function sheetLinkScope(): SheetLinkScope & { openers: Map<string, Map<string, () => void>> } {
  const openers = new Map<string, Map<string, () => void>>();
  return {
    openers,
    add(pageId, id, open) {
      let page = openers.get(pageId);
      if (!page) openers.set(pageId, (page = new Map()));
      page.set(id, open);
      return () => {
        if (page.get(id) === open) page.delete(id);
      };
    },
  };
}

/** Declares that this screen can open sheet `id` (while it's mounted). */
export function useSheetLink(id: string, open: () => void) {
  const { pathname } = useLocation();
  const scope = useContext(SheetLinkScopeCtx);
  const page = useContext(PageScope)?.ref.id ?? null;
  const latest = useRef(open);
  latest.current = open;
  useEffect(() => {
    // Off screen (the page index): the page's own sheets, in the scan's scope; the chrome's, nowhere.
    if (scope) return page ? scope.add(page, id, () => latest.current()) : undefined;
    const opener: Opener = { path: pathname, open: () => latest.current() };
    let set = openers.get(id);
    if (!set) openers.set(id, (set = new Set()));
    set.add(opener);
    // Taken when it opens, not before: an effect run twice (StrictMode) still opens it once.
    const asked = () => pending && pending.id === id && (!pending.path || pending.path === pathname) && Date.now() < pending.until;
    const t = asked()
      ? later(() => {
          if (!asked()) return;
          pending = null;
          opener.open();
        })
      : undefined;
    return () => {
      set.delete(opener);
      window.clearTimeout(t);
    };
  }, [id, pathname, scope, page]);
}

/**
 * Opens sheet `id` on the page at `path`: now if that page is on screen with it (its openers register again at every
 * path change, so theirs is the router's), else once it is. No `path`: on the next page that has it (one just opened).
 */
export function openSheetLink(id: string, path?: string) {
  const here = path ? [...(openers.get(id) ?? [])].find((o) => o.path === path) : undefined;
  if (here) {
    pending = null;
    later(here.open);
  } else pending = { id, path, until: Date.now() + WAIT_MS };
}

