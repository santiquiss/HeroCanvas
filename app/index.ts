// The connected app: what HeroCanvas shows. Replace this folder with your app's mirror (or point it elsewhere) and
// the tool follows: its settings (config.ts), its pages (pages.tsx) and its navigation (nav/). See AppConfig and
// AppNavigation (`herocanvas`, src/contract.ts) for the contract.
import type { AppNavigation } from 'herocanvas';
import { SideNav, SideRail, TabBar } from './nav/AppNav';

export { appConfig } from './config';
export { BASE_PAGES } from './pages';

export const navigation: AppNavigation = { TabBar, SideRail, SideNav };
