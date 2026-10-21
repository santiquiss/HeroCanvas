// Tool panels around the device. Add a tool = write a component and add one entry here.
// Panels render outside the device but can use useNavRoot() and useSim().
import { ProposalChangeCounts } from '../design/ChangeCounts';
import { CommentsBadge, CommentsTool } from '../comments';
import type { ComponentType } from 'react';
import type { Mode } from '../sim/modes';
import { ComponentsPanel } from './ComponentsPanel';
import { ControlsPanel } from './ControlsPanel';
import { InspectPanel } from './InspectPanel';
import { LayersPanel } from './LayersPanel';
import { PageInspector } from './PageInspector';
import { PagesPanel } from './PagesPanel';
import { ProposalPanel } from './ProposalPanel';
import { ScenariosPanel } from './ScenariosPanel';
import { TokensPanel } from './TokensPanel';
import { ComponentInfoPanel, ComponentStateBadge } from './ComponentInfoPanel';

export interface ToolDef {
  id: string;
  title: string;
  /** Material Symbol. */
  icon: string;
  side: 'left' | 'right';
  component: ComponentType;
  /** Modes the tool shows in (default: prototype and components). */
  modes?: Mode[];
  /** Routes that are this tool's content: opening one brings its tab up (a link straight to a token group). */
  claims?: (pathname: string) => boolean;
  /** Where its tab goes when the route isn't one it claims (the first time; then the last route it had). */
  home?: string;
  /** The tool of Inspect mode: its side shows it alone while Inspect is on, and not at all otherwise. */
  whileInspecting?: boolean;
  /** Drawn in its tab after the title: something to see without opening it (the proposal's change counts). */
  badge?: ComponentType;
  /** With no app connected: what it shows once there is one, in its place (EmptyHint), so the interface explains itself. */
  empty?: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'pages', title: 'Pages', icon: 'account_tree', side: 'left', component: PagesPanel, modes: ['prototype'], empty: 'Every screen of your app, one page each, the way its navigation has them: the tabs, what opens over them, what comes before the app. Pick one to see it on the devices.' },
  { id: 'components', title: 'Components', icon: 'widgets', side: 'left', component: ComponentsPanel, modes: ['components'], empty: 'Your app’s components, by the names its code uses, each with its stories.' },
  { id: 'tokens', title: 'Tokens', icon: 'palette', side: 'left', component: TokensPanel, modes: ['tokens'], empty: 'Your app’s design tokens by group: colors, spacing, radii, type.' },
  // The layers of what's on the canvas: a screen in the prototype, the component's examples in Components.
  { id: 'layers', title: 'Layers', icon: 'layers', side: 'left', component: LayersPanel, modes: ['prototype', 'components'], empty: 'The screen’s components as a tree, nested as your code nests them. Point at one to find it on the screen.' },
  // A component's page, in Components: what to know about it, then its props to read and to change.
  { id: 'info', title: 'Info', icon: 'info', side: 'right', component: ComponentInfoPanel, modes: ['components'], badge: ComponentStateBadge, empty: 'What to know about the picked component: where the app uses it, and how it matches the code and the design.' },
  { id: 'props', title: 'Props', icon: 'tune', side: 'right', component: ControlsPanel, modes: ['components'], empty: 'The picked component’s props, to read and to change while you look.' },
  { id: 'inspect', title: 'Inspect', icon: 'ads_click', side: 'right', component: InspectPanel, whileInspecting: true, empty: 'Point at anything on a screen: its component, props and tokens, as your code names them.' },
  { id: 'page', title: 'Page', icon: 'info', side: 'right', component: PageInspector, modes: ['prototype'], empty: 'The open page: its route and params, where it sits in the navigation, and how it lays out on phones and tablets.' },
  { id: 'scenarios', title: 'Scenarios', icon: 'science', side: 'right', component: ScenariosPanel, modes: ['prototype', 'flow'], empty: 'Who’s using the app (its personas), the language, the text size, and each page’s own states: try them all without touching code.' },
  // Its panel loads when the tab opens; the tab counts the open threads.
  { id: 'comments', title: 'Comments', icon: 'chat_bubble', side: 'right', component: CommentsTool, modes: ['prototype', 'flow'], badge: CommentsBadge, empty: 'Notes for your team, pinned on a spot of a screen: a thread each, resolved when it’s done.' },
  { id: 'proposal', title: 'Proposal', icon: 'call_split', side: 'right', component: ProposalPanel, modes: ['prototype', 'flow'], badge: ProposalChangeCounts, empty: 'Changes to your app, kept apart from it: new or changed screens, versions to compare side by side, and a handoff for whoever builds it.' },
];
