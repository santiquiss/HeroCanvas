// The screens' theme, at the canvas's top right in the prototype, Flow and a component's examples: Light / Dark side
// by side for an app with no themes of its own; with them (appConfig.themes), a dropdown of every one (THEME_MODES),
// each with its page and accent. It changes the devices and the examples only; the canvas follows the interface's
// theme (uiTheme).
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../components/Icon';
import { modeSwatch } from '../design/tokenCatalog';
import { modeIn, modeParams, THEME_MODES, type ThemeMode } from '../design/themeModes';
import { useUrlParams, useUrlPatch } from './SimContext';
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
    <span className={`${styles.seg} ${place}`} role="group" aria-label="Theme" data-canvas-ui data-tour="screen-theme">
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
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // Listeners only while open; the picked theme takes focus so the arrows start there.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      root.current?.querySelector<HTMLElement>('button')?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
      const i = rows.indexOf(document.activeElement as HTMLElement);
      rows[(i + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length]?.focus();
    }
  };
  return (
    <span ref={root} className={`${styles.dropdown} ${className}`} data-canvas-ui data-tour="screen-theme" onKeyDown={open ? onKey : undefined}>
      <button className={styles.trigger} aria-haspopup="listbox" aria-expanded={open} aria-label={`Theme: ${current.label}`} onClick={() => setOpen((o) => !o)}>
        <Swatch mode={current} />
        <span>{current.label}</span>
        <Icon name="expand_more" size={16} />
      </button>
      {open && (
        <div ref={list} className={styles.menu} role="listbox" aria-label="Theme">
          {THEME_MODES.map((m) => (
            <button
              key={m.id}
              role="option"
              aria-selected={m.id === current.id}
              className={styles.option}
              onClick={() => {
                onPick(m);
                setOpen(false);
              }}
            >
              <Swatch mode={m} />
              <span className={styles.optionLabel}>{m.label}</span>
              <Icon name={m.scheme === 'light' ? 'light_mode' : 'dark_mode'} size={14} className={styles.scheme} />
              <Icon name="check" size={16} style={{ visibility: m.id === current.id ? 'visible' : 'hidden' }} />
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
