// The connected app's pages (app/pages.tsx) and navigation, as the tools read them. With none (no app connected yet:
// a fresh copy), HeroCanvas's own tour stands in (src/tour): a small app of its own, so every part of the
// designer has something real to show while explaining itself.
import { BASE_PAGES as APP_PAGES, navigation as APP_NAVIGATION } from '@app';
import type { AppNavigation } from '../contract';
import { TOUR_NAVIGATION } from '../tour/TourNav';
import { TOUR_PAGES } from '../tour/pages';
import type { PageDef } from './types';

/** No app connected: the app declares no pages. The designer shows the tour. */
export const NO_APP = Object.keys(APP_PAGES).length === 0;

export const BASE_PAGES: Record<string, PageDef> = NO_APP ? TOUR_PAGES : APP_PAGES;
export const NAVIGATION: AppNavigation = NO_APP ? TOUR_NAVIGATION : APP_NAVIGATION;
export { HOME } from './home';
