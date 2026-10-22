// HeroCanvas's public API: all an app (app/) and its proposals (proposals/) import from the tool, as
// `from 'herocanvas'` — the same import once the tool is a package. This file is the contract's tool side: what's
// here holds still between releases (a change is in CHANGELOG.md); anything not here is the tool's own business.

// What the app gives the tool (app/index.ts).
export type { AppConfig, AppControl, AppNavigation, ColumnBarProps, ToolbarAction, AppTheme, DeviceTargets, LaunchConfig, Persona, ScreenLayout } from './contract';
export type { FlowDef, PageControl, PageDef, PageProps, PageRef, PageVariant, Params, StateParams } from './nav/types';

// Instrumenting components and their stories.
export { Component, useComponent, type ComponentProps } from './design/component';
export { declareProps } from './design/simulatorProps';
export { stories, type Args, type Control, type FrameWidth, type Story, type StoryContext, type StoryModule } from './design/storyFormat';

// The kit: the overlays and buttons the simulator presents with, on the app's tokens. And the icons.
export * from './kit';
export { hasSymbol, Icon } from './components/Icon';

// The simulator, as a screen sees it: its layout and state, the language, the navigation.
export { liveSearch, useHeaderInset, usePadB, usePadL, usePadR, useScreenInsets, useSharedState, useSim, useUrlNumber, useUrlParams, useUrlPatch, useUrlState } from './sim/SimContext';
export { useBackHandler } from './sim/back';
export { holdKeyboard, inputBar, KEYBOARD_GAP, useKeyboardInset } from './sim/keyboard';
export { useAppControl, usePersona } from './sim/persona';
export { useLanguage } from './sim/language';
export { useAppearance, useAppTheme, type Appearance } from './sim/appThemes';
export { dropDownItemsOf, useActionSheet } from './sim/actionSheet';
export { NAV_COMPACT_ATTR, NAV_SAVING_ATTR, SIDE_NAV_ATTR, useColumnBar, useColumnCompact, useColumnNav, usePageOpen, type InColumn } from './sim/columnBar';
export { useInPanel, useNav, useNavRoot, useSplit, type Nav } from './nav/context';
export { useFlow } from './nav/flow';
export { useLaunchPhase, type LaunchPhase } from './sim/launchPhase';

// The simulator's services a richer screen reaches for: the system's camera and photo picker, a sheet of a page's own
// (OnScreen) and its link (useSheetLink), shared-element motion (useMorph), an overlay's mount and exit, a developer's
// hidden spot, the layout's and the motion's measures, and a page drawn on its own (PreviewScreen, a device's layout).
export { SystemCamera } from './sim/SystemCamera';
export { SystemPhotoPicker } from './sim/SystemPhotoPicker';
export { OnScreen } from './sim/screenLayer';
export { useSheetLink } from './sim/sheetLinks';
export { useMorph } from './sim/morph';
export { useOverlay } from './sim/useOverlay';
export { DEVELOPER_HIDDEN } from './sim/developerHidden';
export type { DropDownAlign } from './sim/DropDownLayer';
export { EASE, KEYBOARD_MOTION, KEYBOARD_MS, PAGE_MS } from './sim/motion';
export { computeLayout, CONTENT_MAX_W, SEARCH_BAR_H, TAB_BAR_ROOM, tallSheetTop, tasksKeepNav, type Layout } from './sim/layout';
export { findDevice, findDisplay, type Display } from './devices/devices';
export { PreviewScreen } from './flow/PreviewScreen';
export { RAIL_PARAM } from './design/overridableRegistry';

// Proposals (proposals/<slug>/pages.tsx).
export { overridable } from './design/overridable';
export { proposal, type ProposalCode } from './proposals/types';
