// The screens' theme (`?theme=`), Light / Dark, at the canvas's top right in the prototype, Flow and a
// component's examples. It changes the devices and the examples only; the canvas follows the interface's theme (uiTheme).
import { Icon } from '../components/Icon';
import { APP_THEME_PARAM, findAppTheme } from './appThemes';
import { useUrlParams, useUrlState } from './SimContext';
import styles from './ThemeSwitch.module.css';

/** `floating`: at the canvas's top right; else placed by `className`. */
export function ThemeSwitch({ floating, className }: { floating?: boolean; className?: string }) {
  const [picked, setTheme] = useUrlState<'light' | 'dark'>('theme', 'light');
  // An app theme that forces light or dark (Scenarios › Theme) holds the switch on it.
  const appTheme = findAppTheme(useUrlParams()(APP_THEME_PARAM));
  const forced = appTheme?.scheme;
  const theme = forced ?? picked;
  return (
    <span className={`${styles.seg} ${floating ? styles.floating : ''} ${className ?? ''}`} role="group" aria-label="Theme" data-canvas-ui data-tour="screen-theme">
      {(['light', 'dark'] as const).map((t) => (
        <button key={t} className={t === theme ? styles.on : ''} disabled={!!forced && t !== forced} title={forced && t !== forced ? `${appTheme!.name} is ${forced}: pick another theme in Scenarios` : undefined} onClick={() => setTheme(t)}>
          <Icon name={t === 'light' ? 'light_mode' : 'dark_mode'} size={14} />
          <span>{t === 'light' ? 'Light' : 'Dark'}</span>
        </button>
      ))}
    </span>
  );
}
