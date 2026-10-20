import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { findProposal } from '../proposals';
import { NavCtx, type Nav } from './context';
import { composePages, pageChange } from './manifest';
import { HOME } from './pages';
import { chainFor, nextQuery, pageTitle, parsePath, parseStack, sameRef, SIM_PARAMS, stackUrl } from './stack';
import type { PageRef, StateParams } from './types';

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
      goTab: (id, state) => setStack([{ id, params: {} }], state),
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
