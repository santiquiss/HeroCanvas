// HeroCanvas's public API: all an app (app/) and its proposals (proposals/) import from the tool, as
// `from 'herocanvas'` — the same import once the tool is a package. This file is the contract's tool side: what's
// here holds still between releases (a change is in CHANGELOG.md); anything not here is the tool's own business.

// What the app gives the tool (app/index.ts).
export type { AppConfig, AppNavigation, DeviceTargets, LaunchConfig, Persona, ScreenLayout } from './contract';
export type { FlowDef, PageDef, PageProps } from './nav/types';

// Instrumenting components and their stories.
export { useComponent } from './design/component';
export { declareProps } from './design/simulatorProps';
export { stories, type Args, type Control, type FrameWidth, type Story, type StoryContext, type StoryModule } from './design/storyFormat';

// The kit: the overlays and buttons the simulator presents with, on the app's tokens. And the icons.
export * from './kit';
export { Icon } from './components/Icon';

// The simulator, as a screen sees it: its layout and state, the language, the navigation.
export { useHeaderInset, usePadL, usePadR, useSharedState, useSim, useUrlState } from './sim/SimContext';
export { useLanguage } from './sim/language';
export { useActionSheet } from './sim/actionSheet';
export { useNav, useNavRoot, useSplit } from './nav/context';
export { useFlow } from './nav/flow';
export { useLaunchPhase, type LaunchPhase } from './sim/launchPhase';

// Proposals (proposals/<slug>/pages.tsx).
export { overridable } from './design/overridable';
export { proposal, type ProposalCode } from './proposals/types';
