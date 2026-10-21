// The tour's manifest: HeroCanvas's own app, shown while no app is connected (nav/pages.tsx), declared as any app's
// pages are: two tabs (Welcome, how to connect yours; Tour, its steps) and a pushed page per step, each linking on to
// the next, so Pages, Flow, Inspect, Layers and Capture all have something real to show.
import type { PageDef } from '../nav/types';
import { stepScreen, TourScreen, WelcomeScreen } from './screens';
import { STEPS } from './steps';

export const TOUR_PAGES: Record<string, PageDef> = {
  start: {
    path: '/start',
    level: 'tab',
    title: 'Welcome',
    component: WelcomeScreen,
    tab: { label: 'Welcome', short: 'Welcome', icon: 'waving_hand' },
    status: 'done',
    note: 'How to connect your app: its code, or a Figma file',
    links: [{ to: 'tour', label: 'Take the tour' }],
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
        links: [STEPS[i + 1] ? { to: STEPS[i + 1].id, label: `Next: ${STEPS[i + 1].title}` } : { to: 'start', label: 'Connect your app' }],
      } satisfies PageDef,
    ]),
  ),
};
