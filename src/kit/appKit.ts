// What the simulator presents an app's sheets, dialogs, popovers, menus and snackbars with: the kit's, or the app's own
// where it gives them (AppNavigation.kit, set by nav/pages). Looked up when they draw, so an app's components (its
// library's bottom sheet, its dialog) present what its screens open, named as its code names them in Inspect and Layers.
import type { ComponentType } from 'react';
import { Dialog, type DialogProps } from './Dialog';
import { ActionSheet, DropDownMenu, type ActionSheetProps, type DropDownMenuProps } from './Menu';
import { Popover, type PopoverProps } from './Popover';
import { Sheet, type SheetProps } from './Sheet';
import { Snackbar, type SnackbarProps } from './Snackbar';

/** The components the simulator presents with; an app gives any of them (AppNavigation.kit) with the kit's props. */
export interface AppKit {
  Sheet: ComponentType<SheetProps>;
  ActionSheet: ComponentType<ActionSheetProps>;
  DropDownMenu: ComponentType<DropDownMenuProps>;
  Dialog: ComponentType<DialogProps>;
  Popover: ComponentType<PopoverProps>;
  Snackbar: ComponentType<SnackbarProps>;
}

export const KIT: AppKit = { Sheet, ActionSheet, DropDownMenu, Dialog, Popover, Snackbar };

/** The app's components over the kit's (nav/pages, once the app is read). */
export function setAppKit(own: Partial<AppKit> | undefined) {
  Object.assign(KIT, own ?? {});
}
