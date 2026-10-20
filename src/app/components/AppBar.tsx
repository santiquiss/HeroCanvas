// The demo app's app bar: back (or close) on the left, the title centered, actions on the right, all 40 tall so every
// page's header buttons line up (layout.headerY). Pure: props in, callbacks out.
import { useComponent } from '../../design/component';
import { IconButton } from '../../kit';
import styles from './AppBar.module.css';

export interface AppBarAction {
  /** A Material Symbol. */
  icon: string;
  semanticLabel: string;
  onPressed?: () => void;
}

export interface AppBarProps {
  title: string;
  /** None: no back button (a tab's root, a pane's root). */
  onNavigateBack?: () => void;
  backIcon?: 'arrow_back' | 'close';
  actions?: AppBarAction[];
}

export function AppBar({ title, onNavigateBack, backIcon = 'arrow_back', actions = [] }: AppBarProps) {
  const mf = useComponent('AppBar', { title, onNavigateBack, backIcon, actions: actions.map((a) => a.semanticLabel) });
  return (
    <header {...mf} className={styles.bar}>
      <div className={styles.side}>{onNavigateBack && <IconButton icon={backIcon} elevated tooltip={backIcon === 'close' ? 'Close' : 'Back'} onTap={onNavigateBack} />}</div>
      <span className={styles.title}>{title}</span>
      <div className={`${styles.side} ${styles.end}`}>
        {actions.map((a) => (
          <IconButton key={a.semanticLabel} icon={a.icon} elevated tooltip={a.semanticLabel} onTap={a.onPressed} />
        ))}
      </div>
    </header>
  );
}
