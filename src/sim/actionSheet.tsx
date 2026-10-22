// A list of actions opened from a control (a ⋯, a row, a title): an action sheet, and on large screens
// (sim/sheetPresentation) the same actions hanging from that control as a drop-down menu, its destructive ones after a
// divider. A long menu may split its actions into groups (`actions` as a list of lists): a divider between each in the
// drop-down, one list in the sheet. One call for both, so no screen writes its menu twice.
import { MENU_DIVIDER, type ActionSheetAction, type MenuEntry } from '../kit';
import { KIT } from '../kit/appKit';
import { useSim, type SheetSpec } from './SimContext';

export interface ActionSheetOptions extends Pick<SheetSpec, 'id' | 'anchor' | 'dropdownAlign' | 'onClose'> {
  /** The actions, or the same in groups: the drop-down puts a divider between groups. */
  actions: ActionSheetAction[] | ActionSheetAction[][];
  destructiveActions?: ActionSheetAction[];
  headerLabel?: string;
}

/** The actions as groups: one group when they come as a list. */
const groupsOf = (actions: ActionSheetAction[] | ActionSheetAction[][]): ActionSheetAction[][] =>
  actions.length && Array.isArray(actions[0]) ? (actions as ActionSheetAction[][]) : [actions as ActionSheetAction[]];

/**
 * The action sheet's actions as drop-down items: each group in order (the actions' groups, then the destructive ones), a
 * divider between them. Disabled ones are left out, and a group they empty with them.
 */
export function dropDownItemsOf(actions: ActionSheetAction[] | ActionSheetAction[][], destructiveActions: ActionSheetAction[] = []): MenuEntry[] {
  const item = (a: ActionSheetAction, destructive: boolean) => ({ text: a.label, icon: a.icon, isDestructive: destructive || a.style === 'destructive', onTap: a.onTap });
  const groups = [...groupsOf(actions).map((g) => g.filter((a) => a.enabled !== false).map((a) => item(a, false))), destructiveActions.filter((a) => a.enabled !== false).map((a) => item(a, true))].filter((g) => g.length);
  return groups.flatMap((g, i) => (i ? [MENU_DIVIDER, ...g] : g));
}

export function useActionSheet() {
  const { openSheet } = useSim();
  return ({ actions, destructiveActions, headerLabel, ...spec }: ActionSheetOptions) =>
    openSheet({
      ...spec,
      kind: 'actions',
      render: (frame) => <KIT.ActionSheet {...frame} width="medium" actions={groupsOf(actions).flat()} destructiveActions={destructiveActions} headerLabel={headerLabel} />,
      content: (close) => <KIT.DropDownMenu onClose={close} items={dropDownItemsOf(actions, destructiveActions)} />,
    });
}
