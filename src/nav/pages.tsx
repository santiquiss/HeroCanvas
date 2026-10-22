// The connected app's pages (app/pages.tsx) and navigation, as the tools read them. With none (no app connected yet:
// a fresh copy), HeroCanvas's own tour stands in (src/tour): a small app of its own, so every part of the
// designer has something real to show while explaining itself.
import { BASE_PAGES as APP_PAGES, navigation as APP_NAVIGATION } from '@app';
import { appConfig } from '@app/config';
import type { AppNavigation, LaunchConfig } from '../contract';
import { TOUR_NAVIGATION } from '../tour/TourNav';
import { TOUR_LAUNCH, TOUR_LAYOUT, TOUR_PAGES } from '../tour/pages';
import { LIVE_LAYOUT } from '../design/overridableRegistry';
import { setAppKit } from '../kit/appKit';
import type { PageDef } from './types';

import { NO_APP } from './noApp';

export { NO_APP };

export const BASE_PAGES: Record<string, PageDef> = NO_APP ? TOUR_PAGES : APP_PAGES;
export const NAVIGATION: AppNavigation = NO_APP ? TOUR_NAVIGATION : APP_NAVIGATION;
// What the simulator presents with: the app's own components over the kit's (kit/appKit).
setAppKit(NAVIGATION.kit);
/** The app's launch (the tour's with none), or none: it opens straight on its first screen. */
export const LAUNCH: LaunchConfig | undefined = NO_APP ? TOUR_LAUNCH : appConfig.launch;
// The app's layout, under a proposal's: read by every computeLayout, through design/overridableRegistry.
LIVE_LAYOUT.current = (NO_APP ? TOUR_LAYOUT : appConfig.layout) ?? {};
export { HOME } from './home';
