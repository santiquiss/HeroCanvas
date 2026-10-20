// A list of actions opened from a control (a ⋯, a row, a title): an action sheet, and on large screens
// (sim/sheetPresentation) the same actions hanging from that control as a drop-down menu, its destructive ones after a
// divider. One call for both, so no screen writes its menu twice.
import { ActionSheet, DropDownMenu, MENU_DIVIDER, type ActionSheetAction, type MenuEntry } from '../kit';
import { useSim, type SheetSpec } from './SimContext';

export interface ActionSheetOptions extends Pick<SheetSpec, 'id' | 'anchor' | 'dropdownAlign' | 'onClose'> {
  actions: ActionSheetAction[];
  destructiveActions?: ActionSheetAction[];
  headerLabel?: string;
}

/** The action sheet's actions as drop-down items: each group in order, a divider between them. Disabled ones are left out. */
export function dropDownItemsOf(actions: ActionSheetAction[], destructiveActions: ActionSheetAction[] = []): MenuEntry[] {
  const item = (a: ActionSheetAction, destructive: boolean) => ({ text: a.label, icon: a.icon, isDestructive: destructive || a.style === 'destructive', onTap: a.onTap });
  const groups = [actions.filter((a) => a.enabled !== false).map((a) => item(a, false)), destructiveActions.filter((a) => a.enabled !== false).map((a) => item(a, true))].filter((g) => g.length);
  return groups.flatMap((g, i) => (i ? [MENU_DIVIDER, ...g] : g));
}

export function useActionSheet() {
  const { openSheet } = useSim();
  return ({ actions, destructiveActions, headerLabel, ...spec }: ActionSheetOptions) =>
    openSheet({
      ...spec,
      kind: 'actions',
      render: (frame) => <ActionSheet {...frame} width="medium" actions={actions} destructiveActions={destructiveActions} headerLabel={headerLabel} />,
      content: (close) => <DropDownMenu onClose={close} items={dropDownItemsOf(actions, destructiveActions)} />,
    });
}
