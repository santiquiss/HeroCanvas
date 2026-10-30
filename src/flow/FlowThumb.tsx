// One of Flow's thumbnails: the page as a still picture (src/sim/screenStill.tsx), the app live only where there's
// none. The picture is the screen as the thumbnail would draw it: its page, the layout it's drawn on, its state.
import { useContext, useMemo } from 'react';
import { useNavRoot } from '../nav/context';
import { HOME } from '../nav/pages';
import { useSidePanel } from '../nav/sidePanel';
import { stepQuery } from '../nav/flow';
import { chainFor, detailOpenFor, type Manifest } from '../nav/stack';
import type { PageRef, Params } from '../nav/types';
import type { Layout } from '../sim/layout';
import { screenSpec, ScreenStill, type ScreenSpec } from '../sim/screenStill';
import { useSim } from '../sim/SimContext';
import { FlowRootCtx, LazyPreview } from './LazyPreview';
import { PreviewScreen } from './PreviewScreen';

type MakeLayout = (detailOpen: boolean, pageId?: string) => Layout;

/** The layout a page's thumbnail is drawn on (as PreviewScreen works it out). */
export const thumbLayout = (pages: Manifest, page: PageRef, makeLayout: MakeLayout, panelOn: boolean) => makeLayout(detailOpenFor(pages, chainFor(pages, page, HOME), panelOn), page.id);

/**
 * Every screen Flow can show for these pages (each variant of a page, each variant of a flow's steps), as pictures'
 * specs: what a deployed site's build draws ahead (scripts/flow/prerender.mjs).
 */
export function flowSpecs(pages: Manifest, ids: string[], makeLayout: MakeLayout, panelOn: boolean, theme: 'light' | 'dark'): ScreenSpec[] {
  const out: ScreenSpec[] = [];
  const add = (page: PageRef, over?: URLSearchParams | Params) => {
    const spec = screenSpec(pages, page, thumbLayout(pages, page, makeLayout, panelOn), theme, over);
    if (spec) out.push(spec);
  };
  for (const id of ids) {
    const def = pages[id];
    const variants = def.variants?.() ?? [];
    for (const v of variants.length ? variants : [undefined]) {
      const page = { id, params: v?.params ?? {} };
      if (def.flow) for (const step of def.flow.steps) for (const sv of step.variants?.length ? step.variants : [undefined]) add(page, stepQuery(def, step, sv));
      else add(page, v?.state);
    }
  }
  return out;
}

export function FlowThumb({ page, state, query, makeLayout }: { page: PageRef; state?: Params; query?: URLSearchParams; makeLayout: MakeLayout }) {
  const pages = useNavRoot().pages;
  const panelOn = useSidePanel().on;
  const { theme } = useSim();
  const root = useContext(FlowRootCtx);
  const key = `${page.id}:${JSON.stringify(page.params)}:${JSON.stringify(state ?? null)}:${query?.toString() ?? ''}`;
  const spec = useMemo(
    () => screenSpec(pages, page, thumbLayout(pages, page, makeLayout, panelOn), theme, state ?? query),
    [pages, key, makeLayout, panelOn, theme], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return <ScreenStill spec={spec} root={root} live={() => <LazyPreview>{() => <PreviewScreen page={page} state={state} query={query} makeLayout={makeLayout} still />}</LazyPreview>} />;
}
