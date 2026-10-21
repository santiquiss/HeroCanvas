// The connected app's pages (app/pages.tsx), as the tools read them. With none (no app connected yet: the `empty`
// branch), one page of the tool's own stands in, so the whole designer still shows, each part saying what it's for.
import { BASE_PAGES as APP_PAGES } from '@app';
import { NoAppScreen } from '../sim/NoAppScreen';
import type { PageDef } from './types';

/** No app connected: the app declares no pages. The designer shows in its empty mode. */
export const NO_APP = Object.keys(APP_PAGES).length === 0;

/** The page that stands in for the app's while there's none: its screens' place on the devices. */
const START: Record<string, PageDef> = {
  start: { path: '/start', level: 'tab', title: 'Your app', component: NoAppScreen, status: 'placeholder' },
};

export const BASE_PAGES: Record<string, PageDef> = NO_APP ? START : APP_PAGES;
export { HOME } from './home';
