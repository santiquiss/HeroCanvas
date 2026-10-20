// The screens' theme (`?theme=`), Light / Dark, at the canvas's top right in the prototype, Flow and a
// component's examples. It changes the devices and the examples only; the canvas follows the interface's theme (uiTheme).
import { Icon } from '../components/Icon';
import { useUrlState } from './SimContext';
import styles from './ThemeSwitch.module.css';

/** `floating`: at the canvas's top right; else placed by `className`. */
export function ThemeSwitch({ floating, className }: { floating?: boolean; className?: string }) {
  const [theme, setTheme] = useUrlState<'light' | 'dark'>('theme', 'light');
  return (
    <span className={`${styles.seg} ${floating ? styles.floating : ''} ${className ?? ''}`} role="group" aria-label="Theme" data-canvas-ui>
      {(['light', 'dark'] as const).map((t) => (
        <button key={t} className={t === theme ? styles.on : ''} onClick={() => setTheme(t)}>
          <Icon name={t === 'light' ? 'light_mode' : 'dark_mode'} size={14} />
          <span>{t === 'light' ? 'Light' : 'Dark'}</span>
        </button>
      ))}
    </span>
  );
}
