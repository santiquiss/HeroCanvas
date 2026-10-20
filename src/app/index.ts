// The connected app: what HeroCanvas shows. Replace this folder with your app's mirror (or point it elsewhere) and
// the tool follows: its settings (config.ts), its pages (pages.tsx) and its navigation (nav/). See AppConfig and
// AppNavigation (types.ts) for the contract.
import { SideNav, SideRail, TabBar } from './nav/AppNav';
import type { AppNavigation } from './types';

export { appConfig } from './config';
export { BASE_PAGES } from './pages';
export type { AppConfig, AppNavigation, Persona } from './types';

export const navigation: AppNavigation = { TabBar, SideRail, SideNav };
