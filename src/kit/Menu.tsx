// A list of actions or choices, in its two shapes: an action sheet from the bottom (phones), and a drop-down menu hanging
// from the control that opened it (large screens: sim/sheetPresentation). sim/actionSheet opens one or the other from
// the same actions. Pure: props in, callbacks out.
import type { CSSProperties } from 'react';
import { Icon } from '../components/Icon';
import { useComponent } from '../design/component';
import { Sheet, type SheetWidth } from './Sheet';
import styles from './Menu.module.css';

// ---------------------------------------------------------------- Drop-down menu

export interface MenuItem {
  text: string;
  /** A choice's state: a ✓ at its end. Unset on every item: a list of actions, no ✓ slot. */
  isSelected?: boolean;
  onTap?: () => void;
  /** A Material Symbol before the text. */
  icon?: string;
  /** In the danger color (Remove, Delete). */
  isDestructive?: boolean;
  /** A line under the text. */
  subtitle?: string;
}

/** A line between groups of items: `items: [a, b, MENU_DIVIDER, remove]`. */
export const MENU_DIVIDER = { divider: true } as const;
export type MenuEntry = MenuItem | typeof MENU_DIVIDER;

export interface DropDownMenuProps {
  items: MenuEntry[];
  /** The narrowest it gets; longer items widen it. */
  width?: number;
  /** After a pick (the layer closes it on a tap outside). */
  onClose?: () => void;
  className?: string;
  style?: CSSProperties;
}

const isDivider = (e: MenuEntry): e is typeof MENU_DIVIDER => 'divider' in e;

export function DropDownMenu({ items, width = 150, onClose, className, style }: DropDownMenuProps) {
  const mf = useComponent('DropDownMenu', { items: items.map((i) => (isDivider(i) ? '—' : i.text)), width });
  const marks = items.some((i) => !isDivider(i) && i.isSelected !== undefined);
  return (
    <div {...mf} role="menu" className={`${styles.menu} ${className ?? ''}`} style={{ minWidth: width, ...style }}>
      {items.map((item, i) =>
        isDivider(item) ? (
          <span key={`d${i}`} className={styles.divider} role="separator" />
        ) : (
          <button
            key={item.text}
            role="menuitem"
            aria-checked={item.isSelected}
            className={`${styles.item} ${item.isDestructive ? styles.destructive : ''}`}
            // Closes, then acts: what the item opens (another sheet) isn't closed with the menu.
            onClick={() => {
              onClose?.();
              item.onTap?.();
            }}
          >
            {item.icon && <Icon name={item.icon} size={24} />}
            {item.subtitle ? (
              <span className={styles.texts}>
                <span className={styles.text}>{item.text}</span>
                <span className={styles.subtitle}>{item.subtitle}</span>
              </span>
            ) : (
              <span className={styles.text}>{item.text}</span>
            )}
            {marks && <span className={styles.mark}>{item.isSelected && <Icon name="check" size={20} />}</span>}
          </button>
        ),
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Action sheet

export interface ActionSheetAction {
  label: string;
  /** A Material Symbol. */
  icon?: string;
  onTap?: () => void;
  enabled?: boolean;
  style?: 'normal' | 'destructive';
}

export interface ActionSheetProps {
  actions: ActionSheetAction[];
  /** In a list of their own, in the danger color. */
  destructiveActions?: ActionSheetAction[];
  /** A muted, uppercased label above the actions ("Sort by"). */
  headerLabel?: string;
  open?: boolean;
  onClose?: () => void;
  bottomInset?: number;
  width?: SheetWidth;
}

/** Lists of actions on the page's color with a handle, 12 apart. A tap closes the sheet, then runs the action. */
export function ActionSheet({ actions, destructiveActions = [], headerLabel, open = true, onClose, bottomInset = 0, width }: ActionSheetProps) {
  const mf = useComponent('ActionSheet', { actions: actions.map((a) => a.label), destructiveActions: destructiveActions.map((a) => a.label), headerLabel });
  const lists = [actions.map((a) => ({ ...a, destructive: a.style === 'destructive' })), destructiveActions.map((a) => ({ ...a, destructive: true }))].filter((l) => l.length);
  return (
    <Sheet
      layout="bottomContent"
      showPadding={false}
      open={open}
      onClose={onClose}
      width={width}
      sheetStyle={{ background: 'var(--app-page)', borderRadius: '24px 24px 0 0', minHeight: 0, padding: `40px 16px ${Math.max(24, bottomInset + 22)}px` }}
    >
      <div {...mf} className={styles.actionSheet}>
        <span className={styles.handle} />
        {headerLabel && <span className={styles.header}>{headerLabel.toUpperCase()}</span>}
        {lists.map((list, li) => (
          <div key={li} className={styles.list}>
            {list.map((a) => {
              const enabled = a.enabled !== false && !!a.onTap;
              return (
                <button
                  key={a.label}
                  className={`${styles.action} ${a.destructive ? styles.destructive : ''}`}
                  disabled={!enabled}
                  onClick={() => {
                    onClose?.();
                    a.onTap?.();
                  }}
                >
                  {a.icon && <Icon name={a.icon} size={24} />}
                  <span className={styles.text}>{a.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
