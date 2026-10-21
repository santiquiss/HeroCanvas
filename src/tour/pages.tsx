// The tour's manifest: HeroCanvas's own app, shown while no app is connected (nav/pages.tsx), declared as any app's
// pages are: three tabs (Welcome, what it is; Tour, its steps; Get Started, how to connect yours) and a pushed page per
// step, each linking on to the next, so Pages, Flow, Inspect, Layers and Capture all have something real to show.
import type { LaunchConfig, ScreenLayout } from '../contract';
import type { PageDef } from '../nav/types';
import { GetStartedScreen, stepScreen, TourScreen, WelcomeScreen } from './screens';
import { STEPS } from './steps';

/**
 * The tour's launch, declared as any app's: the emblem alone on the brand's blue springs in with a sheen, holds a
 * moment, and flies onto the emblem of Welcome's AppIcon as the blue fades, crossfading into the icon.
 */
/** The tour's rail shows its tabs' labels, as an iPad sidebar does: wider than an icons-only one. */
export const TOUR_LAYOUT: ScreenLayout = { railWidth: 200 };

export const TOUR_LAUNCH: LaunchConfig = {
  background: 'radial-gradient(120% 80% at 50% 35%, #2f86ff 0%, #0a5cff 45%, #0035b8 100%)',
  icon: `${import.meta.env.BASE_URL}tour/emblem.png`,
  iconSize: 200,
  iconShape: 'none',
  enter: 'shine',
  hold: 500,
  exit: { to: 'AppIcon' },
};

export const TOUR_PAGES: Record<string, PageDef> = {
  start: {
    path: '/start',
    level: 'tab',
    title: 'Welcome',
    component: WelcomeScreen,
    tab: { label: 'Welcome', short: 'Welcome', icon: 'home' },
    status: 'done',
    note: 'What HeroCanvas is, its goal and how it works',
    links: [
      { to: 'tour', label: 'Take the Tour' },
      { to: 'getStarted', label: 'Get Started' },
    ],
  },
  tour: {
    path: '/tour',
    level: 'tab',
    title: 'Tour',
    component: TourScreen,
    tab: { label: 'Tour', short: 'Tour', icon: 'explore' },
    status: 'done',
    note: 'What each part of HeroCanvas does, a page each',
    links: STEPS.map((s) => ({ to: s.id, label: s.title })),
  },
  getStarted: {
    path: '/get-started',
    level: 'tab',
    title: 'Get Started',
    component: GetStartedScreen,
    tab: { label: 'Get Started', short: 'Start', icon: 'rocket_launch' },
    status: 'done',
    note: 'How to connect your app: its code, or a Figma file',
  },
  ...Object.fromEntries(
    STEPS.map((s, i) => [
      s.id,
      {
        path: `/tour/${s.id}`,
        level: 'push',
        title: s.title,
        component: stepScreen(s),
        parent: 'tour',
        status: 'done',
        note: s.line,
        links: [STEPS[i + 1] ? { to: STEPS[i + 1].id, label: `Next: ${STEPS[i + 1].title}` } : { to: 'getStarted', label: 'Get Started' }],
      } satisfies PageDef,
    ]),
  ),
};
