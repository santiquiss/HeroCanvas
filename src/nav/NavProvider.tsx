import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { SIDE_PANEL_PAGE, SIDE_PANEL_PARAM } from './sidePanel';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { appConfig } from '@app/config';
import { findProposal } from '../proposals';
import { NavCtx, type Nav } from './context';
import { composePages, pageChange } from './manifest';
import { HOME } from './pages';
import { chainFor, nextQuery, pageTitle, parsePath, parseStack, sameRef, SIM_PARAMS, stackUrl, stateKeys } from './stack';
import type { PageRef, StateParams } from './types';

/** Tabs keep their state when another is picked (appConfig.layout.keepTabs). */
const KEEP_TABS = !!appConfig.layout?.keepTabs;

export function NavProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const proposal = findProposal(search.get('proposal'));
  // A link from before proposals had codes names the folder: it becomes the code, which is what everything reads.
  const named = search.get('proposal');
  const code = proposal?.id;
  useEffect(() => {
    if (!code || named === code) return;
    const q = new URLSearchParams(search);
    q.set('proposal', code);
    navigate({ pathname, search: `?${q}` }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [named, code]);
  const pages = composePages(proposal);
  // Each tab's pages and state as it was left (keepTabs).
  const kept = useRef<Record<string, { stack: PageRef[]; state: Record<string, string> }>>({});
  // An empty or unknown URL opens Home, or the proposal's start page (a welcome flow).
  const start = proposal?.start;
  const stack = useMemo(
    () => (start && !parsePath(pages, pathname) ? chainFor(pages, { id: start, params: {} }, HOME) : parseStack(pages, pathname, search, HOME)),
    [pages, pathname, search, start],
  );

  const setStack = useCallback(
    (next: PageRef[], state?: StateParams) => {
      const q = nextQuery(pages, search, stack, next, state);
      const qs = q.toString();
      navigate(stackUrl(pages, next).path + (qs ? `?${qs}` : ''));
    },
    [navigate, search, stack, pages],
  );

  // The side panel is a state over the tabs (nav/sidePanel), not a page of the stack: a link to its page opens Home
  // with it on.
  useEffect(() => {
    if (!SIDE_PANEL_PAGE || !SIDE_PANEL_PARAM || stack[0].id !== SIDE_PANEL_PAGE) return;
    const q = new URLSearchParams(search);
    q.set(SIDE_PANEL_PARAM, '1');
    navigate(`${stackUrl(pages, [{ id: HOME, params: {} }]).path}?${q}`, { replace: true });
  }, [stack, search, pages, navigate]);

  const nav = useMemo<Nav>(() => {
    const top = stack.length - 1;
    return {
      stack,
      pages,
      tabs: Object.keys(pages).filter((id) => pages[id].level === 'tab'),
      boots: Object.keys(pages).filter((id) => pages[id].level === 'boot'),
      proposal,
      change: (id) => pageChange(id, proposal),
      setStack,
      push: (id, params = {}, opts = {}) => {
        const ref = { id, params };
        const from = opts.from ?? top;
        // Already showing right above `from`: nothing to do.
        if (sameRef(stack[from + 1], ref) && from + 1 === top) return;
        setStack([...stack.slice(0, from + 1), ref], opts.state);
      },
      pop: (from = top) => {
        if (from <= 0) return;
        setStack(stack.slice(0, from));
      },
      goTab: (id, state) => {
        // Tabs that keep their state (appConfig.layout.keepTabs): the one left remembers its pages and their state, the
        // one picked comes back as it was left. Picking the tab on screen goes back to its root, as iOS and Android do.
        const here = stack[0]?.id;
        if (!KEEP_TABS || here === id || pages[here]?.level !== 'tab') return setStack([{ id, params: {} }], state);
        const keys = (refs: PageRef[]) => [...new Set(refs.flatMap((r) => stateKeys(pages[r.id])))];
        kept.current[here] = { stack, state: Object.fromEntries(keys(stack).flatMap((k) => (search.get(k) != null ? [[k, search.get(k)!]] : []))) };
        const back = kept.current[id];
        // What the tab left behind is cleared, what the picked one had comes back.
        const clear = Object.fromEntries(keys(stack).map((k) => [k, null]));
        if (back) return setStack(back.stack, { ...clear, ...back.state, ...state });
        setStack([{ id, params: {} }], { ...clear, ...state });
      },
      open: (id, params = {}, state) => setStack(chainFor(pages, { id, params }, HOME), state),
      def: (id) => pages[id],
      title: (ref) => pageTitle(pages, ref),
      href: (s) => {
        const { path, stack: st } = stackUrl(pages, s);
        const q = new URLSearchParams();
        for (const k of SIM_PARAMS) {
          const v = search.get(k);
          if (v != null) q.set(k, v);
        }
        if (st) q.set('stack', st);
        const qs = q.toString();
        return `#${path}${qs ? `?${qs}` : ''}`;
      },
    };
  }, [stack, pages, proposal, setStack, search]);

  return <NavCtx.Provider value={nav}>{children}</NavCtx.Provider>;
}
