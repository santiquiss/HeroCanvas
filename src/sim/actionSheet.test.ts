import { describe, expect, it } from 'vitest';
import { MENU_DIVIDER } from '../kit';
import { dropDownItemsOf } from './actionSheet';

describe('an action sheet’s actions as a drop-down', () => {
  it('keeps the actions, then a divider and the destructive ones, in the danger color', () => {
    const items = dropDownItemsOf([{ label: 'Edit Project', icon: 'edit' }], [{ label: 'Delete Project', icon: 'delete' }]);
    expect(items).toEqual([
      { text: 'Edit Project', icon: 'edit', isDestructive: false, onTap: undefined },
      MENU_DIVIDER,
      { text: 'Delete Project', icon: 'delete', isDestructive: true, onTap: undefined },
    ]);
  });

  it('has no divider with one group, marks an action styled destructive, and leaves disabled ones out', () => {
    const items = dropDownItemsOf([
      { label: 'Remove Apple', icon: 'delete', style: 'destructive' },
      { label: 'Share', enabled: false },
    ]);
    expect(items).toEqual([{ text: 'Remove Apple', icon: 'delete', isDestructive: true, onTap: undefined }]);
  });
});
