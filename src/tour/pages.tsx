// The tour's manifest: HeroCanvas's own app, shown while no app is connected (nav/pages.tsx), declared as any app's
// pages are: three tabs (Welcome, what it is; Tour, its steps; Get Started, how to connect yours) and a pushed page per
// step, each linking on to the next, so Pages, Flow, Inspect, Layers and Capture all have something real to show.
import type { PageDef } from '../nav/types';
import { GetStartedScreen, stepScreen, TourScreen, WelcomeScreen } from './screens';
import { STEPS } from './steps';

export const TOUR_PAGES: Record<string, PageDef> = {
  start: {
    path: '/start',
    level: 'tab',
    title: 'Welcome',
    component: WelcomeScreen,
    tab: { label: 'Welcome', short: 'Welcome', icon: 'home' },
    status: 'done',
    note: 'What HeroCanvas is, its goal and how it works; it opens with a launch animation',
    controls: [
      {
        param: 'launch',
        label: 'Launch',
        note: 'The splash and its transition into the screen',
        options: [
          { value: 'once', label: 'Once' },
          { value: 'always', label: 'Every time' },
        ],
      },
    ],
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
