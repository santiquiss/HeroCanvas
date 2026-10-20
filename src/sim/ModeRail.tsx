// The designer's mode rail (Preline's mini sidebar, our way): a column at the left edge, light like the toolbar, with the logo at the top
// and the modes as icons below it. A mode's name shows in a tooltip beside it on hover or keyboard focus (its
// aria-label too); the current one is lit. At the bottom, the interface's light / dark switch (uiTheme). Capture is the prototype's (`?capture=1`), listed as one more mode.
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import type { Mode } from './modes';
import { setUiTheme, useUiTheme } from './uiTheme';
import styles from './ModeRail.module.css';

type RailMode = Mode | 'capture';

export const MODES: { mode: RailMode; label: string; icon: string }[] = [
  { mode: 'prototype', label: 'Prototype', icon: 'smartphone' },
  { mode: 'flow', label: 'Flow', icon: 'account_tree' },
  { mode: 'components', label: 'Components', icon: 'widgets' },
  { mode: 'tokens', label: 'Tokens', icon: 'palette' },
  // The device as an image for marketing, turned in 3D; the right panel becomes its settings (src/capture).
  { mode: 'capture', label: 'Capture', icon: 'photo_camera' },
];

export function ModeRail({ mode, onMode }: { mode: Mode; onMode: (m: Mode, extra?: Record<string, string>) => void }) {
  const [search, setSearch] = useSearchParams();
  const capture = mode === 'prototype' && search.get('capture') === '1';
  const current: RailMode = capture ? 'capture' : mode;
  const ui = useUiTheme();
  const go = (to: RailMode) => {
    if (to === current) return;
    // Into or out of Capture from the prototype: only its param changes, the screen stays.
    if (mode === 'prototype' && (to === 'prototype' || to === 'capture'))
      return setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (to === 'capture') next.set('capture', '1');
          else next.delete('capture');
          return next;
        },
        { replace: true },
      );
    onMode(to === 'capture' ? 'prototype' : to, to === 'capture' ? { capture: '1' } : {});
  };
  // Esc leaves Capture, back to the prototype.
  useEffect(() => {
    if (!capture) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !(e.target as HTMLElement).closest('input, textarea, select') && go('prototype');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture]);
  return (
    <nav className={styles.rail} aria-label="Modes">
      {/* public/assets/logo-64.png, from brand/hc-logo.png: a square app icon, rounded like one. */}
      <span className={styles.brand} title="HeroCanvas">
        <img src="/assets/logo-64.png" alt="HeroCanvas" width={28} height={28} style={{ borderRadius: 7 }} />
      </span>
      <ul className={styles.items}>
        {MODES.map(({ mode: m, label, icon }) => (
          <li key={m}>
            <button className={`${styles.item} ${current === m ? styles.on : ''}`} aria-label={label} aria-current={current === m ? 'page' : undefined} onClick={() => go(m)}>
              <Icon name={icon} size={20} fill={current === m} />
              <span className={styles.tip} role="tooltip">
                {m === 'capture' && capture ? 'Capture · Esc to leave' : label}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* At the bottom: the interface's theme (not the screens': the view bar's Light / Dark). */}
      <button className={`${styles.item} ${styles.end}`} aria-label={ui === 'dark' ? 'Light interface' : 'Dark interface'} onClick={() => setUiTheme(ui === 'dark' ? 'light' : 'dark')}>
        <Icon name={ui === 'dark' ? 'light_mode' : 'dark_mode'} size={20} />
        <span className={styles.tip} role="tooltip">
          {ui === 'dark' ? 'Light interface' : 'Dark interface'}
        </span>
      </button>
    </nav>
  );
}
