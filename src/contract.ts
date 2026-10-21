// What a connected app gives HeroCanvas. The tool reads the app only through this (app/index.ts): its pages, its
// navigation chrome, its languages and the people it's tried as. Everything else (screens, components, data, tokens)
// is the app's own business.
import type { ComponentType } from 'react';

export interface Persona {
  id: string;
  name: string;
  /** One line on who they are, for the Scenarios panel. */
  description?: string;
  /** Its photo, under public/ (`npm run persona:avatar` makes `personas/<id>.png`); none: their initials. */
  avatar?: string;
}

/**
 * The app's navigation, drawn over its pages per layout: a bar at the bottom (phones), a rail on the left (tablets,
 * open foldables), a column at the right (the iPhone Duo). Each reads the tabs with useTabs (app/nav).
 */
export interface AppNavigation {
  TabBar: ComponentType;
  SideRail: ComponentType;
  SideNav: ComponentType;
}

/** The app's settings: plain data, free of imports of its screens (the simulator reads it early). */
export interface AppConfig {
  /** Shown in the toolbar and the browser's tab. */
  name: string;
  /** The app's languages, its base first. None: English only. */
  languages?: { id: string; name: string }[];
  /** Who the app is tried as (Scenarios panel; `?persona=`), the default first. None: no picker. */
  personas?: Persona[];
  /** The tab an empty or unknown URL opens. */
  home: string;
  /** What the app shows while it starts (LaunchConfig). None: it opens straight on its first screen. */
  launch?: LaunchConfig;
  /** The room its screens give its navigation (ScreenLayout): a wider rail, one that folds. None: the defaults. */
  layout?: ScreenLayout;
  /**
   * The devices the app is made for (DeviceTargets): the designer offers only those, in every menu, Compare and Capture.
   * None: every device.
   */
  devices?: DeviceTargets;
}

/**
 * Which devices an app is for, by platform and by kind; what's left out of either isn't offered. `{ platforms: ['ios']
 * }`: iPhones and iPads; `{ types: ['tablet'] }`: tablets of both; `{ platforms: ['android'], types: ['phone',
 * 'foldable'] }`: Android phones and foldables.
 */
export interface DeviceTargets {
  /** iOS (iPhone and iPad) and/or Android. None: both. */
  platforms?: ('ios' | 'android')[];
  /** Phones, foldables, tablets. None: all three. */
  types?: ('phone' | 'foldable' | 'tablet')[];
}

/**
 * The room the screens give what a component can't change from inside: the tablet rail's width (a rail with labels is
 * wider), and the like. The app declares its own (`appConfig.layout`); a proposal's version can change it.
 */
export interface ScreenLayout {
  /**
   * The tablet rail's width (pt; 72 by default): the content moves over by it. `0`: the app has no rail (a sidebar
   * app, one with tabs only on phones): nothing is kept for one at the left.
   */
  railWidth?: number;
  /** A rail that folds (a sidebar): its width folded (`?rail=folded`). */
  railFoldedWidth?: number;
  /** The rail shows the user (a sidebar's account): the screens drop their own way to them (a header's avatar). */
  userInRail?: boolean;
  /** The room between the rail and the left column when a page shows two (list and detail; 16 by default), and
   * between the right one and the screen's edge. */
  splitGap?: number;
}

/**
 * The app's launch, the same four phases on every platform: the **screen** the system draws while the app loads
 * (iOS's launch screen, Android's splash screen: a background, the icon, a brand mark), how its icon **enter**s, how
 * long it **hold**s while the app loads, and how it **exit**s into the first screen. HeroCanvas plays it on a cold
 * start (Scenarios › Launch); screens learn when it's over with useLaunchPhase().
 */
export interface LaunchConfig {
  /** The screen's background, a CSS color or gradient, per theme or one for both. */
  background: string | { light: string; dark: string };
  /** The icon, under public/ (iOS: the launch screen's image; Android: windowSplashScreenAnimatedIcon). */
  icon?: string;
  /** Its side (its width, for a shape of its own), in points. Default 120. */
  iconSize?: number;
  /** `rounded` (default): cut as an app icon. `none`: the image's own shape (a logo, an emblem on transparency). */
  iconShape?: 'rounded' | 'none';
  /** Android's icon background: a circle behind the icon, in this color. None: the icon alone, rounded as an app icon. */
  iconBackground?: string;
  /** A brand mark near the bottom, under public/ (Android's windowSplashScreenBrandingImage). */
  branding?: string;
  /** How the icon appears: at once, fading, springing in, or springing in with a sheen across it. Default none. */
  enter?: 'none' | 'fade' | 'spring' | 'shine';
  /** How long it stays once in, in ms, standing for the app's loading (Android's setKeepOnScreenCondition). Default 600. */
  hold?: number;
  /**
   * How it gives way to the first screen (Android's setOnExitAnimationListener; on iOS, a view of the app's own that
   * continues the launch screen): fading, the icon zooming through, sliding up, or the icon flying to a component of
   * the first screen (`{ to: 'AppIcon' }`, by its name) while the background fades, crossfading into it as it lands.
   * It lands on the component's `data-launch-anchor` element when it has one (where the icon sits inside it: an
   * emblem inside an app icon), else on the component. Default fade.
   */
  exit?: 'fade' | 'zoom' | 'slide' | { to: string };
}
