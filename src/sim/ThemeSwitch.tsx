// The screens' theme, at the canvas's top right in the prototype, Flow and a component's examples: Light / Dark side
// by side for an app with no themes of its own; with them (appConfig.themes), a dropdown of every one (THEME_MODES),
// each with its page and accent. It changes the devices and the examples only; the canvas follows the interface's
// theme (uiTheme). The dropdown is ui-sdk's Select (try-ui-library), its rows ours.
import { Select, SelectContent, SelectItem, SelectTrigger } from '@ui-sdk/react/select';
import { Icon } from '../components/Icon';
import { modeSwatch } from '../design/tokenCatalog';
import { modeIn, modeParams, THEME_MODES, type ThemeMode } from '../design/themeModes';
import { useUrlParams, useUrlPatch } from './SimContext';
import { t } from '../i18n/ui';
import styles from './ThemeSwitch.module.css';

const OWN_THEMES = THEME_MODES.some((m) => m.appTheme);

/** `floating`: at the canvas's top right; else placed by `className`. */
export function ThemeSwitch({ floating, className }: { floating?: boolean; className?: string }) {
  const current = modeIn(useUrlParams());
  const patch = useUrlPatch();
  const pick = (m: ThemeMode) => patch(modeParams(m));
  const place = `${floating ? styles.floating : ''} ${className ?? ''}`;
  if (OWN_THEMES) return <ThemeDropdown current={current} onPick={pick} className={place} />;
  return (
    <span className={`${styles.seg} ${place}`} role="group" aria-label={t('Theme')} data-canvas-ui data-tour="screen-theme">
      {THEME_MODES.map((m) => (
        <button key={m.id} className={m.id === current.id ? styles.on : ''} onClick={() => pick(m)}>
          <Icon name={m.scheme === 'light' ? 'light_mode' : 'dark_mode'} size={14} />
          <span>{m.label}</span>
        </button>
      ))}
    </span>
  );
}

/** A mode's swatch: its page color with its accent in a corner. */
function Swatch({ mode }: { mode: ThemeMode }) {
  const [page, accent] = modeSwatch(mode.id);
  return (
    <span className={styles.swatch} style={{ background: page }}>
      <span style={{ background: accent }} />
    </span>
  );
}

function ThemeDropdown({ current, onPick, className }: { current: ThemeMode; onPick: (m: ThemeMode) => void; className: string }) {
  return (
    <span className={`${styles.dropdown} ${className}`} data-canvas-ui data-tour="screen-theme">
      <Select
        value={current.id}
        onValueChange={(id) => {
          const m = THEME_MODES.find((x) => x.id === id);
          if (m) onPick(m);
        }}
      >
        <SelectTrigger className={styles.trigger} aria-label={t('Theme: {theme}', { theme: current.label })}>
          <Swatch mode={current} />
          <span>{current.label}</span>
          <Icon name="expand_more" size={16} />
        </SelectTrigger>
        <SelectContent className={styles.menu} sideOffset={6} align="end" aria-label={t('Theme')}>
          {THEME_MODES.map((m) => (
            <SelectItem key={m.id} value={m.id} label={m.label} className={styles.option}>
              <Swatch mode={m} />
              <span className={styles.optionLabel}>{m.label}</span>
              <Icon name={m.scheme === 'light' ? 'light_mode' : 'dark_mode'} size={14} className={styles.scheme} />
              <Icon name="check" size={16} className={styles.check} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
}
