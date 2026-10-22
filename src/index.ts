// HeroCanvas's public API: all an app (app/) and its proposals (proposals/) import from the tool, as
// `from 'herocanvas'` — the same import once the tool is a package. This file is the contract's tool side: what's
// here holds still between releases (a change is in CHANGELOG.md); anything not here is the tool's own business.

// What the app gives the tool (app/index.ts).
export type { AppConfig, AppControl, AppNavigation, AppTheme, DeviceTargets, LaunchConfig, Persona, ScreenLayout } from './contract';
export type { FlowDef, PageControl, PageDef, PageProps, PageVariant, Params, StateParams } from './nav/types';

// Instrumenting components and their stories.
export { useComponent } from './design/component';
export { declareProps } from './design/simulatorProps';
export { stories, type Args, type Control, type FrameWidth, type Story, type StoryContext, type StoryModule } from './design/storyFormat';

// The kit: the overlays and buttons the simulator presents with, on the app's tokens. And the icons.
export * from './kit';
export { hasSymbol, Icon } from './components/Icon';

// The simulator, as a screen sees it: its layout and state, the language, the navigation.
export { useHeaderInset, usePadB, usePadL, usePadR, useScreenInsets, useSharedState, useSim, useUrlParams, useUrlPatch, useUrlState } from './sim/SimContext';
export { useBackHandler } from './sim/back';
export { useKeyboardInset } from './sim/keyboard';
export { useAppControl, usePersona } from './sim/persona';
export { useLanguage } from './sim/language';
export { useAppTheme } from './sim/appThemes';
export { useActionSheet } from './sim/actionSheet';
export { useNav, useNavRoot, useSplit } from './nav/context';
export { useFlow } from './nav/flow';
export { useLaunchPhase, type LaunchPhase } from './sim/launchPhase';

// Proposals (proposals/<slug>/pages.tsx).
export { overridable } from './design/overridable';
export { proposal, type ProposalCode } from './proposals/types';
