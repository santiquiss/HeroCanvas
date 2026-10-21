// The tour's steps: one page each, about a part of HeroCanvas, with something to try on this very screen. In order:
// each step's page links to the next (Flow draws the path).

import type { Tint } from './TourKit';

export interface TourStep {
  id: string;
  /** A Material Symbol. */
  icon: string;
  /** Its icon tile's system color. */
  tint: Tint;
  title: string;
  /** One line for the tour's list. */
  line: string;
  /** What it is, a paragraph or two. */
  body: string[];
  /** What to do now, on the interface around the device. */
  tryIt: string;
  /** What `tryIt` names on the interface (their `data-tour`): a beacon pulses on each while the step is open. */
  spots: string[];
}

export const STEPS: TourStep[] = [
  {
    id: 'agent',
    tint: 'green',
    icon: 'auto_awesome',
    title: 'Working with your agent',
    line: 'Every change is asked for, not drawn',
    body: [
      'HeroCanvas is AI first: there’s nothing to drag or draw here, as in Figma. Your screens are code, and your AI agent writes it. You ask, it builds, and the canvas shows the result.',
      'Ask the way you’d brief a designer or a developer: in words, with a screenshot or a sketch, a reference from another app, or a link to a Figma frame. The agent reads them and turns them into components, tokens and pages.',
      'HeroCanvas is where you look, compare and decide: the devices, the themes, the scenarios, the versions of a proposal. Inspect and comments help you say precisely what to change next.',
    ],
    tryIt: 'Open your agent (Claude Code, or any that reads AGENTS.md) in this folder and ask it about this screen, like “Which components is the Tour tab made of?”. Then ask it to connect your app: Get Started has the words.',
    spots: [],
  },
  {
    id: 'devices',
    tint: 'blue',
    icon: 'devices',
    title: 'Devices',
    line: 'Every phone, foldable and tablet, side by side',
    body: [
      'Each screen shows at the real size of the device it’s on, with its safe areas, keyboard and navigation: a bar at the bottom on phones, a rail on tablets.',
      'Compare the same page on several devices at once to see how it adapts.',
    ],
    tryIt: 'Pick another device in the menu above the canvas, turn it with the arrow beside it, or press + beside the device to add a second one.',
    spots: ['device-menu', 'rotate', 'add-device'],
  },
  {
    id: 'themes',
    tint: 'indigo',
    icon: 'dark_mode',
    title: 'Light and dark',
    line: 'The screens in both themes, and HeroCanvas’s own',
    body: ['The screens follow the app’s tokens: switch their theme and every color changes as the code says it does.', 'HeroCanvas has its own theme too, apart from the screens’.'],
    tryIt: 'Use Light / Dark at the top right of the canvas for the screens; the moon at the bottom of the left rail for HeroCanvas.',
    spots: ['screen-theme', 'ui-theme'],
  },
  {
    id: 'inspect',
    tint: 'orange',
    icon: 'ads_click',
    title: 'Inspect and Layers',
    line: 'What every element is, as the code names it',
    body: [
      'Screens are built from components with the names and props of your app’s code. Inspect tells you which one is under the cursor, its props and its tokens.',
      'Layers shows the screen as a tree of components, nested as the code nests them.',
    ],
    tryIt: 'Press Inspect at the top right (or the I key) and point at this card. Then open Layers, on the left, beside Pages.',
    spots: ['inspect', 'panel-layers'],
  },
  {
    id: 'pages',
    tint: 'green',
    icon: 'account_tree',
    title: 'Pages and Flow',
    line: 'Every screen of the app, and how they connect',
    body: [
      'Pages lists the app’s screens the way its navigation has them: tabs, what opens over them, what comes before the app. Here, the screens of this tour.',
      'Flow lays them all out on one canvas, linked as they navigate.',
    ],
    tryIt: 'Open another page from Pages, on the left. Then pick Flow in the left rail: this tour, step by step.',
    spots: ['panel-pages', 'mode-flow'],
  },
  {
    id: 'scenarios',
    tint: 'purple',
    icon: 'science',
    title: 'Scenarios',
    line: 'The app as different people, languages and text sizes',
    body: ['Personas show the app with different people’s data: someone new, someone with a lot. Languages and the system text size apply to every screen.', 'Each page can add its own states too: empty, loading, an error.'],
    tryIt: 'Open Scenarios, on the right, and drag the text size: this screen grows with it.',
    spots: ['panel-scenarios'],
  },
  {
    id: 'proposals',
    tint: 'pink',
    icon: 'call_split',
    title: 'Proposals and comments',
    line: 'Changes kept apart, to compare and hand off',
    body: [
      'Live, at the top, is the app as it is. A proposal is a change to it, kept apart: new screens or components, versions A and B, and a handoff written in your code’s terms.',
      'Comments pin notes for your team on a spot of a screen.',
    ],
    tryIt: 'Open the Live menu at the top to see where proposals list, and Comment to leave a note on this screen.',
    spots: ['proposals', 'comment'],
  },
  {
    id: 'capture',
    tint: 'teal',
    icon: 'photo_camera',
    title: 'Capture',
    line: 'Images and videos of any screen',
    body: ['Any screen as a picture or a video: the device turned in 3D, its color, light and shadow, or the screen alone. For a deck, a store page, a post.'],
    tryIt: 'Pick the camera in the left rail, then Image or Video on the right, and export.',
    spots: ['mode-capture'],
  },
];
