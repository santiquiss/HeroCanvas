// A live, static copy of a page as it looks in the prototype: its own navigation stack (the page's default
// chain) and layout, rendered by the real DeviceScreen in preview mode. `query`: a fixed state the page reads instead
// of the URL (a flow's step). `still`: frozen, for thumbnails. `overlays`: with the sheets and dialogs the page opens (where-used thumbnails, which show
// what opening them shows).
import { useMemo } from 'react';
import { NavCtx, useNavRoot, type Nav } from '../nav/context';
import { HOME } from '../nav/pages';
import { chainFor, detailOpenFor, pageTitle, stackUrl } from '../nav/stack';
import type { PageRef, Params } from '../nav/types';
import { DeviceScreen } from '../sim/DeviceScreen';
import type { Layout } from '../sim/layout';
import { StillCtx } from '../kit/motion';
import { liveSearch, SimProvider, UrlOverride, useSim } from '../sim/SimContext';

const noop = () => {};

export function PreviewScreen({
  page,
  query,
  makeLayout,
  overlays = false,
  still = false,
  state,
}: {
  page: PageRef;
  query?: URLSearchParams;
  makeLayout: (detailOpen: boolean, pageId?: string) => Layout;
  overlays?: boolean;
  /** A still copy: no animation (CSS or JS), every element at its end state (Flow, the where-used rail). */
  still?: boolean;
  /** State params the page shows (a variant by state), over `query`. */
  state?: Params;
}) {
  const { theme } = useSim();
  // Same manifest and proposal as the app, with a static stack for this page.
  const root = useNavRoot();
  const PAGES = root.pages;
  const stack = useMemo(() => chainFor(PAGES, page, HOME), [PAGES, page]);
  const nav = useMemo<Nav>(
    () => ({
      ...root,
      stack,
      push: noop,
      pop: noop,
      goTab: noop,
      open: noop,
      setStack: noop,
      def: (id) => PAGES[id],
      title: (r) => pageTitle(PAGES, r),
      href: (s) => '#' + stackUrl(PAGES, s).path,
    }),
    [root, PAGES, stack],
  );
  const layout = useMemo(() => makeLayout(detailOpenFor(PAGES, stack), page.id), [makeLayout, stack, PAGES, page.id]);
  const screen = (
    <NavCtx.Provider value={nav}>
      <SimProvider layout={layout} theme={theme}>
        {layout.rotLocked ? (
          // A portrait-only page in a landscape thumbnail: the portrait screen turned to fill it, like the device frame.
          <div style={{ position: 'relative', width: layout.vh, height: layout.vw }}>
            <div style={{ position: 'absolute', top: 0, left: layout.vh, transformOrigin: 'top left', transform: 'rotate(90deg)' }}>
              <DeviceScreen preview overlays={overlays} />
            </div>
          </div>
        ) : (
          <DeviceScreen preview overlays={overlays} />
        )}
      </SimProvider>
    </NavCtx.Provider>
  );
  const fixed = useMemo(() => {
    if (!state) return query;
    const q = new URLSearchParams(query ?? liveSearch());
    for (const [k, v] of Object.entries(state)) q.set(k, v);
    return q;
  }, [query, state]);
  const shown = fixed ? <UrlOverride value={fixed}>{screen}</UrlOverride> : screen;
  return still ? (
    <StillCtx.Provider value>
      <div data-still style={{ display: 'contents' }}>
        {shown}
      </div>
    </StillCtx.Provider>
  ) : (
    shown
  );
}
