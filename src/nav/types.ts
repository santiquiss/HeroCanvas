// Navigation types, shared by the manifest, the URL codec and the screens.
// Kept free of runtime imports so screens can depend on it without import cycles.
import type { ComponentType } from 'react';

export type Params = Record<string, string>;
/** Query params a navigation sets along with the new stack; `null` drops one that would otherwise be kept. */
export type StateParams = Record<string, string | null>;

/**
 * How a page is presented.
 *   tab   → base layer, picked from the nav bar / rail. Always the bottom of the stack, except under a boot page.
 *   push  → slides in from the right on phones and tablet portrait; fills the right panel in tablet split.
 *   cover → full screen above everything, including the nav (a settings page). Pages pushed after a cover stay full screen.
 *   boot  → where the app starts before its tabs (welcome, sign-in, restore…): the bottom of
 *           its own stack, full screen, no tab under it and no nav. Pages pushed after it stay full screen.
 */
export type Level = 'tab' | 'push' | 'cover' | 'boot';

/** Covers and boot pages span the whole screen, above (or without) the nav. */
export const isFullScreen = (level: Level) => level === 'cover' || level === 'boot';

/** Build state, shown in the Pages panel. */
export type PageStatus = 'done' | 'pending' | 'placeholder';

export interface PageProps {
  params: Params;
}

export interface PageDef {
  /** URL pattern; `:name` segments become params, e.g. `/projects/:id`. */
  path: string;
  level: Level;
  title: string | ((params: Params) => string);
  /**
   * The title the app's header shows, in the screen's language (the app's own key): what its AppBar writes over the
   * page. Unset: `title` (the designer's name for the page, English).
   */
  appTitle?: (language: string, params: Params) => string;
  /** Name in the Pages panel and inspector when `title` depends on params. */
  name?: string;
  component: ComponentType<PageProps>;
  /**
   * Page underneath for deep links and the Pages tree. Tabs and boot pages have none; a page with none otherwise is a
   * root of its own (a settings page, opened over whatever section from the avatar).
   */
  parent?: string;
  /**
   * A page that opens from more than one section (a task's detail from Today or from its
   * project): the page under it, from its params, for deep links. `parent` stays where the Pages tree lists it.
   */
  parentOf?: (params: Params) => string;
  /**
   * Another mode of that page's screen, its own entry in the stack only because it can sit above it (a search
   * picking items for a form that's over that same search): the Pages panel lists it with that page, as a state of it.
   */
  modeOf?: string;
  /** Params of the parent in the default chain (e.g. a page under /projects/work). */
  parentParams?: Params;
  /** Query params owned by this page; they survive navigation while the page stays in the stack. */
  state?: string[];
  /**
   * Path params it opens with when none are given (the Pages panel, a link without them): a page whose path needs
   * one (`:id`) and has no variants still opens on a sample one. Without it the path has an empty segment.
   */
  defaults?: Params;
  /** Concrete instances listed in the Pages panel (for pages with path params). */
  variants?: () => { label: string; params: Params }[];
  /**
   * Nav bar / rail entry (tabs only). `icon`: a Material Symbol, or one of the app's own glyphs, as its tab bar
   * takes one. `search`: a search pill floats over it. `section`: the sidebar's section it's listed under (the rail
   * draws them). `sidebarOnly`: only in the rail (a tablet's sidebar), not in a phone's tab bar, as SwiftUI's
   * `.sidebarAdaptable` tabs hidden when compact: a screen without the rail opens on the home tab instead.
   */
  tab?: { label: string; short: string; icon: string; search?: boolean; section?: string; sidebarOnly?: boolean };
  status?: PageStatus;
  /** Where this page navigates to, drawn as arrows in the Flow view. A page nobody links to gets an arrow from its parent. */
  links?: PageLink[];
  /** Master–detail on wide screens (iPad Settings style). Overridable per link from the Page panel. */
  split?: SplitConfig;
  /** iPhone Duo right column for this page. */
  sideColumn?: SideColumn;
  /**
   * The page has the + in a bar of its own (a search bar): while it's on top the iPhone Duo column drops its +, so
   * there aren't two (it fades out and the column's other controls settle down into its place).
   */
  ownPlus?: boolean;
  /**
   * Covers: the page's background (any CSS background), drawn across the whole screen — on the iPhone Duo it goes on
   * under the right column, where the content doesn't. Unset: the page color, and the column keeps its own.
   */
  background?: string;
  /**
   * Whether this page supports landscape: per size class (compact / regular), with exceptions per display, or one
   * value for all. Unset: the display's default (phones stay portrait; tablets and foldable inner displays rotate).
   * Off: portrait only, the frame turns but the page doesn't. Overridable from the Page panel.
   */
  landscape?: Landscape;
  /** One line for the Pages panel and the page inspector. */
  note?: string;
  /**
   * A page that's a flow (a welcome, a sign-up): several screens, one at a time, picked by a state param. The Pages
   * panel lists its steps, the inspector steps through them, the Flow view lays them out with their transitions, and
   * the page runs them with `useFlow` (nav/flow.ts).
   */
  flow?: FlowDef;
  /**
   * Conditions to try the page in (Scenarios panel): content, special cases. Each sets one of the page's state params,
   * which the page reads as usual (added to its state for you). Who's using the app goes for every page (the app's personas).
   */
  controls?: PageControl[];
}

export interface PageControl {
  param: string;
  label: string;
  note?: string;
  /** The first is the default: the param's value when it's unset (its fallback in the page). */
  options: { value: string; label: string }[];
}

export interface FlowDef {
  /** State param holding the current step (the first step when unset). Added to the page's state for you. */
  param: string;
  steps: FlowStep[];
}

/** `screen`: waits for the user. `loading`: an interstitial that moves on by itself (`auto`). */
export type FlowStepKind = 'screen' | 'loading';

export interface FlowStep {
  /** The param's value. */
  id: string;
  label: string;
  kind?: FlowStepKind;
  note?: string;
  /** Other state params this step needs to look as designed (e.g. which tasks are done). */
  state?: Params;
  /** The same step in other states, like a page's variants (e.g. a checklist with none, some or all done). */
  variants?: { label: string; state: Params }[];
  /** Where each action goes. No `to`: it leaves the flow. `when`: only on some layouts (e.g. "phone", "tablet"). */
  next?: FlowNext[];
  /** Loaders: on to `to` after `ms`, unless the step was opened to look at (held). */
  auto?: { to: string; ms: number };
}

export interface FlowNext {
  to?: string;
  label: string;
  when?: string;
}

export interface PageLink {
  to: string;
  params?: Params;
  /** What the user taps, e.g. "See All". */
  label?: string;
}

/**
 * List–detail (Apple: split view with sidebar + detail columns; Material: list-detail panes). When the page is
 * at least `minWidth` wide, the pages pushed above it open in a detail pane beside it instead of a new layer,
 * and `defaultChild` fills that pane when nothing is selected.
 */
export interface SplitConfig {
  minWidth: number;
  /**
   * `equal`: 50 / 50 (Apple `.balanced`). `detail`: the list keeps `masterWidth` and the detail takes the rest
   * (Material list-detail; Apple's column width).
   */
  ratio: 'equal' | 'detail';
  /** Width of the list pane in `detail` ratio. */
  masterWidth: number;
  defaultChild: PageRef;
}

/**
 * iPhone Duo right column (status, Dynamic Island, nav): `nav` shows the navigation there, `empty` keeps the
 * column reserved and blank. Default: `empty` for covers, `nav` otherwise.
 */
export type SideColumn = 'nav' | 'empty';

/**
 * Landscape support of a page. Resolved per display: its exception, else its size class's rule, else the display's
 * default. `true` / `false` set every display. Exceptions are for designing; in code they need a condition (e.g.
 * "compact and near-square"), not a device name.
 */
export type Landscape =
  | boolean
  | {
      compact?: boolean;
      regular?: boolean;
      /** Exceptions by display id (`device:display`, e.g. `ipduo:outer`). */
      displays?: Record<string, boolean>;
    };

/** One entry of the navigation stack. */
export interface PageRef {
  id: string;
  params: Params;
}
