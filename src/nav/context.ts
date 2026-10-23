// Navigation API for screens and tools. The provider lives in NavProvider.tsx (it owns the manifest).
import { createContext, useContext } from 'react';
import type { Proposal } from '../proposals/types';
import type { PageChange } from './manifest';
import type { Manifest } from './stack';
import type { PageDef, PageRef, Params, StateParams } from './types';

export interface Nav {
  stack: PageRef[];
  /** The effective manifest (base + active proposal). */
  pages: Manifest;
  /** Tab ids, in manifest order. */
  tabs: string[];
  /** Boot page ids (where the app starts before its tabs: a welcome), in manifest order. */
  boots: string[];
  /** The active proposal (`?proposal=`), or null for the base design. */
  proposal: Proposal | null;
  /** How a page differs from the base under the active proposal. */
  change: (id: string) => PageChange;
  /** Push a page above `from` (stack index), closing anything above it. Defaults to the top. */
  push: (id: string, params?: Params, opts?: { from?: number; state?: StateParams }) => void;
  /** Close the page at `from` and everything above it. Defaults to the top page. */
  pop: (from?: number) => void;
  /** Reset to a tab. `state` sets that tab's state params (e.g. a day picker's day). */
  goTab: (id: string, state?: StateParams) => void;
  /** Open a page with its default chain underneath (deep-link behavior). */
  open: (id: string, params?: Params, state?: StateParams) => void;
  /** Replace the whole stack. */
  setStack: (stack: PageRef[], state?: StateParams) => void;
  def: (id: string) => PageDef;
  title: (ref: PageRef) => string;
  href: (stack: PageRef[]) => string;
}

export const NavCtx = createContext<Nav | null>(null);

export function useNavRoot(): Nav {
  const n = useContext(NavCtx);
  if (!n) throw new Error('useNav outside <NavProvider>');
  return n;
}

/** Inside a master–detail page: which pane this is and which child the detail pane shows. */
export interface SplitScope {
  role: 'master' | 'detail';
  /** Stack index of the master page. */
  masterIndex: number;
  masterId: string;
  /** The child opened from the master (its row is highlighted); the detail pane may show a page deeper than it. */
  selected: PageRef;
  /** The detail pane shows the configured default (nothing selected yet). */
  isDefault: boolean;
}

export const SplitCtx = createContext<SplitScope | null>(null);

/** Whether the current layer reaches the screen's right edge (where the reserved corner is). */
export const RightEdgeCtx = createContext(true);

/**
 * A page that reaches under the rail (layout.navOverPages: the base and pushed pages, not a cover over the rail): its
 * content keeps clear of it (usePadL).
 */
export const UnderRailCtx = createContext(false);

/** Pages in the tablet split's right panel (beside the base page): their left padding is half the column gap. */
export const DetailPanelCtx = createContext(false);
/** Whether this page is in the tablet split's panel, beside another (not a screen of its own). */
export const useInPanel = () => useContext(DetailPanelCtx);

export function useSplit(): SplitScope | null {
  return useContext(SplitCtx);
}

/** The page a component is rendered in (index in the stack). Null outside the device (tools, chrome). */
export const PageScope = createContext<{ index: number; ref: PageRef } | null>(null);

/**
 * Navigation from inside a page: pushes go above *this* page (so tapping a list item while a
 * detail is open in the split panel replaces that detail), and `back` closes this page.
 */
export function useNav() {
  const nav = useNavRoot();
  const scope = useContext(PageScope);
  const index = scope?.index ?? nav.stack.length - 1;
  const ref = scope?.ref ?? nav.stack[nav.stack.length - 1];
  return {
    ...nav,
    index,
    ref,
    push: (id: string, params?: Params, state?: StateParams) => nav.push(id, params, { from: index, state }),
    back: () => nav.pop(index),
  };
}
