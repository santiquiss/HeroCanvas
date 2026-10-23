// The app's side panel (appConfig.sidePanel): a page that opens beside the others, as a state over the tabs kept in the
// URL (`?<param>=1`), not a page of the stack. DeviceScreen places it (sim/regions); NavProvider turns a link to its
// page into Home with it on.
import { appConfig } from '@app/config';
import { useUrlState } from '../sim/SimContext';

/** The panel's page, or null when the app has none. */
export const SIDE_PANEL_PAGE: string | null = appConfig.sidePanel?.page ?? null;
/** The URL param that turns it on. */
export const SIDE_PANEL_PARAM: string | null = SIDE_PANEL_PAGE && (appConfig.sidePanel?.param ?? SIDE_PANEL_PAGE);

export const sidePanelOnIn = (search: URLSearchParams | ((k: string) => string | null)): boolean =>
  !!SIDE_PANEL_PARAM && (typeof search === 'function' ? search(SIDE_PANEL_PARAM) : search.get(SIDE_PANEL_PARAM)) === '1';

/**
 * The page in front: the side panel's while it's on (it opens over or beside the tabs, the last one opened), else the
 * stack's top. What Pages highlights and the Page inspector shows.
 */
export function pageInFront<R extends { id: string; params: Record<string, string> }>(stack: R[], search: URLSearchParams | ((k: string) => string | null)): R | { id: string; params: Record<string, string> } {
  return SIDE_PANEL_PAGE && sidePanelOnIn(search) ? { id: SIDE_PANEL_PAGE, params: {} } : stack[stack.length - 1];
}

/** The side panel: whether it's on, and its toggles (the app's navigation). */
export function useSidePanel() {
  const [v, set] = useUrlState<string>(SIDE_PANEL_PARAM ?? 'sidepanel', '');
  const on = !!SIDE_PANEL_PARAM && v === '1';
  return { on, open: () => set('1'), close: () => set(null), toggle: () => set(on ? null : '1') };
}
