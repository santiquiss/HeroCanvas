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
import { t } from '../i18n/ui';

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
}

export const TOOLS: ToolDef[] = [
  { id: 'pages', title: t('Pages'), icon: 'account_tree', side: 'left', component: PagesPanel, modes: ['prototype'] },
  { id: 'components', title: t('Components'), icon: 'widgets', side: 'left', component: ComponentsPanel, modes: ['components'] },
  { id: 'tokens', title: t('Tokens'), icon: 'palette', side: 'left', component: TokensPanel, modes: ['tokens'] },
  // The layers of what's on the canvas: a screen in the prototype, the component's examples in Components.
  { id: 'layers', title: t('Layers'), icon: 'layers', side: 'left', component: LayersPanel, modes: ['prototype', 'components'] },
  // A component's page, in Components: what to know about it, then its props to read and to change.
  { id: 'info', title: t('Info'), icon: 'info', side: 'right', component: ComponentInfoPanel, modes: ['components'], badge: ComponentStateBadge },
  { id: 'props', title: t('Props'), icon: 'tune', side: 'right', component: ControlsPanel, modes: ['components'] },
  { id: 'inspect', title: t('Inspect'), icon: 'ads_click', side: 'right', component: InspectPanel, whileInspecting: true },
  { id: 'page', title: t('Page'), icon: 'info', side: 'right', component: PageInspector, modes: ['prototype'] },
  { id: 'scenarios', title: t('Scenarios'), icon: 'science', side: 'right', component: ScenariosPanel, modes: ['prototype', 'flow'] },
  // Its panel loads when the tab opens; the tab counts the open threads. In Components, on a component's examples.
  { id: 'comments', title: t('Comments'), icon: 'chat_bubble', side: 'right', component: CommentsTool, modes: ['prototype', 'flow', 'components'], badge: CommentsBadge },
  { id: 'proposal', title: t('Proposal'), icon: 'call_split', side: 'right', component: ProposalPanel, modes: ['prototype', 'flow'], badge: ProposalChangeCounts },
];
