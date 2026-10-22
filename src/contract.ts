// What a connected app gives HeroCanvas. The tool reads the app only through this (app/index.ts): its pages, its
// navigation chrome, its languages and the people it's tried as. Everything else (screens, components, data, tokens)
// is the app's own business.
import type { ComponentType, ReactNode } from 'react';

export interface Persona {
  id: string;
  name: string;
  /** One line on who they are, for the Scenarios panel. */
  description?: string;
  /** Its photo, under public/ (`npm run persona:avatar` makes `personas/<id>.png`); none: their initials. */
  avatar?: string;
  /**
   * Its values for the app's controls (`AppConfig.controls`, by param): who they are, in the terms the screens read
   * (signed in, verified, on a paid plan). One left out takes the control's first option.
   */
  values?: Record<string, string>;
}

/**
 * One of the app's own conditions, for every page (Scenarios › App; `?<param>=`): something about the account or the
 * app that changes the screens, a feature flag, a backend state. Each persona has its value (`Persona.values`); the
 * panel can change it for a moment, and a link keeps it. The screens read it with `useAppControl(param)`.
 */
export interface AppControl {
  param: string;
  label: string;
  note?: string;
  /** The first is the default (a persona with no value of its own). */
  options: { value: string; label: string }[];
}

/**
 * The app's navigation, drawn over its pages per layout: a bar at the bottom (phones), a rail on the left (tablets,
 * open foldables), a column at the right (the iPhone Duo). Each reads the tabs with useTabs (app/nav).
 */
export interface AppNavigation {
  TabBar: ComponentType;
  SideRail: ComponentType;
  SideNav: ComponentType;
  /**
   * Around each device's screen, once (optional): where the app provides what all its pages share (its own overlay
   * host, its theme or session context), as its root does.
   */
  Screen?: ComponentType<{ children: ReactNode }>;
  /**
   * Over the pages, once per device (optional): what the app shows above any page (its own sheets' and dialogs' host,
   * a gate that asks to sign in). Positioned by the app, under z-index 85 (the snackbar), above the pages (up to 79).
   */
  Overlays?: ComponentType;
  /**
   * The iPhone Duo column's toolbar (optional): the page on top's back or close and its symbol-only actions, drawn
   * vertically under the corner status, as the app's own bar draws its controls. Pages hand them over with
   * useColumnBar. None: the kit's round buttons.
   */
  ColumnBar?: ComponentType<ColumnBarProps>;
}

/** An action of a page's toolbar that is only a symbol: its icon (Icon's name) and what a screen reader says. */
export interface ToolbarAction {
  icon: string;
  label: string;
  onPress?: () => void;
}

/** What the iPhone Duo column's toolbar draws (AppNavigation.ColumnBar): the controls that fit, back first. */
export interface ColumnBarProps {
  title: string;
  back?: { icon: 'back' | 'close'; onPress: () => void };
  actions: ToolbarAction[];
}

/** The app's settings: plain data, free of imports of its screens (the simulator reads it early). */
export interface AppConfig {
  /** Shown in the toolbar and the browser's tab. */
  name: string;
  /** The app's languages, its base first. None: English only. */
  languages?: { id: string; name: string }[];
  /** Who the app is tried as (Scenarios panel; `?persona=`), the default first. None: no picker. */
  personas?: Persona[];
  /** The app's own conditions for every page (AppControl), each persona with its values. */
  controls?: AppControl[];
  /**
   * The app's own themes, beyond light and dark (palettes its user picks in its settings), the default first
   * (Scenarios › Theme; `?apptheme=`; the app picks one with useAppTheme). None: just light and dark.
   */
  themes?: AppTheme[];
  /**
   * The app's appearance setting (follow the system, or always light or dark), its three options as the app names
   * them. The designer's Light / Dark is the system's; the app's choice, when light or dark, overrides it on the
   * screens (Scenarios › Appearance; `?appearance=`; the app reads and sets it with useAppearance). Not a theme: no
   * palette of its own. None: the screens follow the designer's switch.
   */
  appearance?: { system: string; light: string; dark: string };
  /** The tab an empty or unknown URL opens. */
  home: string;
  /**
   * Stylesheets with the fonts its screens use (a Google Fonts `css2` URL, a font's own CSS), loaded with the designer:
   * the app's own typeface, not the designer's.
   */
  fonts?: string[];
  /**
   * A page that opens beside the others rather than over them (an assistant, a chat), as a state over the tabs:
   * `?<param>=1` (`param`: the page's id when unset), which only its own toggles turn off. On phones and narrow layouts it
   * takes the base, over the tab the user was on; where the screen splits (a tablet, the open iPhone Duo) it's a panel
   * fixed on the right and the app keeps its area on the left. A link to the page opens it so, over Home. The page
   * reads whether it's the panel with useInPanel; the app's navigation opens and closes it with useSidePanel.
   */
  sidePanel?: { page: string; param?: string };
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
 * One of the app's own themes: its tokens in app/theme.css under `[data-app-theme='<id>']` (after the light and dark
 * blocks). `scheme`: the light or dark it forces, as SwiftUI's `preferredColorScheme` (a dark palette); none: it
 * follows the device's.
 */
export interface AppTheme {
  id: string;
  name: string;
  scheme?: 'light' | 'dark';
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
  /**
   * The app has only a phone layout (an Android app without a tablet one, an iPhone-only app run on an iPad): tablets
   * and open foldables draw it too, its bar at the bottom and one column, stretched to the screen's width.
   */
  compactOnly?: boolean;
  /**
   * The height of the app's bar at the bottom (its TabBar, floating or not), in points, over the bottom inset: what a
   * tab's content keeps room for (usePadB), and where the snackbar and toasts sit. None: the tour's bar and search pill.
   */
  tabBarHeight?: number;
  /**
   * Tabs keep their state, as a tab bar's do on iOS and Android: going to another tab and back finds the pages it had
   * open and their state (a filter, a scroll's step, a search) as it was left. Picking the tab on screen goes back to
   * its root.
   */
  keepTabs?: boolean;
  /**
   * How a section (a tab) comes in when it's picked: at once (default), as iOS and Android switch tabs; or `fade`, a
   * short fade up, for an app that animates it.
   */
  tabTransition?: 'none' | 'fade';
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
