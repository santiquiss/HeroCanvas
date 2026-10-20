// A shot's "Before" (ShotShell, `?shot_compare=1`): the same address under Live, the app without the proposal. The
// navigation the screens read, with Live's pages and the stack Live makes of the address; moving still goes through
// the proposal's navigation (the address is one). No Before when the page doesn't exist in Live: the proposal adds it.
import { composePages } from '../../nav/manifest';
import { HOME } from '../../nav/home';
import { pageTitle, parsePath, parseStack } from '../../nav/stack';
import type { Nav } from '../../nav/context';

export function liveNavFor(nav: Nav, pathname: string, search: URLSearchParams): Nav | null {
  if (!nav.proposal) return null;
  const pages = composePages(null);
  // A proposal that opens on a page of its own (a welcome flow) starts there: Live has no such start.
  if (!parsePath(pages, pathname)) return null;
  let stack;
  try {
    stack = parseStack(pages, pathname, search, HOME);
  } catch {
    return null;
  }
  // A page under it that only the proposal has (`?stack=`): Live can't show this screen as it is.
  if (stack.some((ref) => !pages[ref.id])) return null;
  return {
    ...nav,
    stack,
    pages,
    proposal: null,
    tabs: Object.keys(pages).filter((id) => pages[id].level === 'tab'),
    boots: Object.keys(pages).filter((id) => pages[id].level === 'boot'),
    change: () => null,
    def: (id) => pages[id],
    title: (ref) => pageTitle(pages, ref),
  };
}

/**
 * What a frame shows, for telling Before from After: its markup without the ids React makes up (`useId`) and the
 * attributes that carry them, so two renders of the same screen compare equal.
 */
export function visualSignature(el: Element): string {
  return el.innerHTML.replace(/\s(?:id|for|aria-[\w-]+|data-[\w-]+)="[^"]*"/g, '');
}
