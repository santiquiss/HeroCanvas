// The kit's alert and snackbar. An alert: a message with its level's icon, inline among cards or floating. A snackbar:
// a floating alert over the bottom of the screen, fading in as it rises (useSim().showSnackbar times it and mounts it).
// Pure: props in, callbacks out.
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { useComponent } from '../design/component';
import { IconButton } from './Button';
import { useEntered } from './motion';
import styles from './Snackbar.module.css';

export type AlertLevel = 'info' | 'success' | 'danger';

export interface AlertProps {
  text?: string;
  children?: ReactNode;
  level: AlertLevel;
  /** Over the page (a border in the level's color, lifted), or among the page's cards. */
  floating?: boolean;
  onClose?: () => void;
  /** An icon button before the close one that acts on the message (Retry). */
  action?: { icon: string; semanticLabel: string; onPressed: () => void };
}

const LEVEL: Record<AlertLevel, { icon: string; color: string }> = {
  info: { icon: 'info', color: 'var(--app-info)' },
  success: { icon: 'check_circle', color: 'var(--app-success)' },
  danger: { icon: 'error', color: 'var(--app-danger)' },
};

export function Alert({ text, children, level, floating = false, onClose, action }: AlertProps) {
  const mf = useComponent('Alert', { text, level, floating, onClose, action: action?.semanticLabel });
  const { icon, color } = LEVEL[level];
  return (
    <div {...mf} role="status" className={`${styles.alert} ${floating ? styles.floating : ''}`} style={{ '--alert-accent': color } as CSSProperties}>
      <Icon name={icon} size={24} fill color={color} />
      <span className={styles.text}>{text ?? children}</span>
      {action && <IconButton icon={action.icon} size="small" tooltip={action.semanticLabel} onTap={action.onPressed} />}
      {onClose && <IconButton icon="close" size="small" tooltip="Close" onTap={onClose} />}
    </div>
  );
}

/** Its largest width on a large screen, centered. */
export const SNACKBAR_MAX_WIDTH = 480;
/** In and out. */
export const SNACKBAR_MS = 250;
/** How long it shows by default. */
export const SNACKBAR_DURATION = 4000;

export interface SnackbarProps {
  text: string;
  level?: AlertLevel;
  action?: AlertProps['action'];
  open?: boolean;
  /** The screen's bottom safe area. */
  bottomInset?: number;
  /** A column at the screen's end (the iPhone Duo's): it stays beside it. */
  endInset?: number;
}

export function Snackbar({ text, level = 'info', action, open = true, bottomInset = 0, endInset = 0 }: SnackbarProps) {
  const mf = useComponent('Snackbar', { level });
  const on = useEntered(open);
  return (
    <div {...mf} className={`${styles.snackbar} ${on ? styles.on : ''}`} style={{ bottom: bottomInset, right: endInset, ['--snackbar-max' as string]: `${SNACKBAR_MAX_WIDTH}px` }}>
      <Alert text={text} level={level} action={action} floating />
    </div>
  );
}
