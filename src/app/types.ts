// What a connected app gives HeroCanvas. The tool reads the app only through this (src/app/index.ts): its pages, its
// navigation chrome, its languages and the people it's tried as. Everything else (screens, components, data, tokens)
// is the app's own business.
import type { ComponentType } from 'react';

export interface Persona {
  id: string;
  name: string;
  /** One line on who they are, for the Scenarios panel. */
  description?: string;
  /** An image under public/ (a 256 px JPEG is plenty). */
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
}
