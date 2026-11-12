// The screen the prototype was last on (its page and scenario): what App Store Assets adds as a screenshot, or as a
// device layer, so a screen is set up in Prototype (persona, theme, state) and then brought here.
import { useMemo } from 'react';
import { useNavRoot } from '../nav/context';
import { parsePath } from '../nav/stack';
import type { PageRef } from '../nav/types';
import { LANG_PARAM } from '../sim/language';
import { lastPrototypeUrl } from '../sim/modes';
import { REAL_PARAM, SYSTEM_PARAM } from '../sim/realDevice';
import { LAYER_PARAM, SHOT_PARAM, SIZE_PARAM } from './route';

/** Designer params that say where and how the designer shows a screen, not what the screen is: left out. */
const VIEW_PARAMS = ['device', 'devices', 'display', 'arrange', 'sort', 'compare', 'zoom', 'land', 'capture', 'rail', 'where', 'changes', 'proposal', 'variant', LANG_PARAM, SIZE_PARAM, SHOT_PARAM, LAYER_PARAM];

/** A screen's query without the designer's own params (where and how it's shown, real mode). */
export function cleanQuery(q: URLSearchParams): string {
  for (const k of [...VIEW_PARAMS, REAL_PARAM, SYSTEM_PARAM]) q.delete(k);
  return q.toString();
}

export function useLastScreen(): { page: PageRef; query: string } | null {
  const pages = useNavRoot().pages;
  return useMemo(() => {
    const url = lastPrototypeUrl();
    if (!url) return null;
    const [path, query = ''] = url.split('?');
    const page = parsePath(pages, path);
    if (!page) return null;
    return { page, query: cleanQuery(new URLSearchParams(query)) };
  }, [pages]);
}
