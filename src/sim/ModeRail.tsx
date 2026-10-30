// The designer's mode rail (Preline's mini sidebar, our way): a column at the left edge, light like the toolbar, with the logo at the top
// and the modes as icons below it. A mode's name shows in a tooltip beside it on hover or keyboard focus (its
// aria-label too); the current one is lit. At the bottom, HeroCanvas itself (ⓘ: the About page, its version in the
// tooltip; the rail is too narrow for any version number) over the interface's light / dark switch (uiTheme). Capture is the prototype's (`?capture=1`), listed as one more mode.
import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import type { Mode } from './modes';
import { setUiTheme, useUiTheme } from './uiTheme';
import { t } from '../i18n/ui';
import { can, leaveView, showsMode } from '../share/view';
import { useCanLeave } from '../share/ViewBadge';
import styles from './ModeRail.module.css';

type RailMode = Mode | 'capture';

export const MODES: { mode: RailMode; label: string; icon: string }[] = [
  { mode: 'prototype', label: t('Prototype'), icon: 'smartphone' },
  { mode: 'flow', label: t('Flow'), icon: 'account_tree' },
  { mode: 'components', label: t('Components'), icon: 'widgets' },
  { mode: 'tokens', label: t('Tokens'), icon: 'palette' },
  // The device as an image for marketing, turned in 3D; the right panel becomes its settings (src/capture).
  { mode: 'capture', label: t('Capture'), icon: 'photo_camera' },
];

/** The modes the view keeps (src/share/view.ts). */
const RAIL_MODES = MODES.filter((m) => showsMode(m.mode));

export function ModeRail({ mode, onMode }: { mode: Mode; onMode: (m: Mode, extra?: Record<string, string>) => void }) {
  const [search, setSearch] = useSearchParams();
  const capture = mode === 'prototype' && search.get('capture') === '1';
  const current: RailMode = capture ? 'capture' : mode;
  const ui = useUiTheme();
  const canLeave = useCanLeave();
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
    <nav className={styles.rail} aria-label={t('Modes')}>
      {/* The logo (herocanvas.config.ts) at 64px, made by scripts/vite/brand.ts: a square app icon, rounded like one. */}
      {/* In a guest's view, for someone of the team (useCanLeave), the logo goes back to the whole designer. */}
      {canLeave ? (
        <button className={`${styles.brand} ${styles.brandBtn}`} title={t('Back to the whole designer')} aria-label={t('Back to the whole designer')} onClick={() => void leaveView()}>
          <img src={`${import.meta.env.BASE_URL}assets/logo-64.png`} alt="" width={28} height={28} style={{ borderRadius: 7 }} />
        </button>
      ) : (
        <span className={styles.brand} title="HeroCanvas">
          <img src={`${import.meta.env.BASE_URL}assets/logo-64.png`} alt="HeroCanvas" width={28} height={28} style={{ borderRadius: 7 }} />
        </span>
      )}
      <ul className={styles.items}>
        {/* A guest's view keeps only its modes; with one, the rail lists none. */}
        {RAIL_MODES.length > 1 && RAIL_MODES.map(({ mode: m, label, icon }) => (
          <li key={m}>
            <button data-tour={`mode-${m}`} className={`${styles.item} ${current === m ? styles.on : ''}`} aria-label={label} aria-current={current === m ? 'page' : undefined} onClick={() => go(m)}>
              <Icon name={icon} size={20} fill={current === m} />
              <span className={styles.tip} role="tooltip">
                {m === 'capture' && capture ? t('Capture · Esc to leave') : label}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {/* At the bottom: HeroCanvas itself, opening its page (About: version, credits, license, changelog). */}
      {can('about') && (
      <button className={`${styles.item} ${styles.end} ${current === 'about' ? styles.on : ''}`} aria-label={t('About HeroCanvas {version}', { version: __HC_VERSION__ })} aria-current={current === 'about' ? 'page' : undefined} onClick={() => go('about')}>
        <Icon name="info" size={20} fill={current === 'about'} />
        <span className={styles.tip} role="tooltip">
          {t('About HeroCanvas {version}', { version: __HC_VERSION__ })}
        </span>
      </button>
      )}
      {/* The interface's theme (not the screens': the view bar's Light / Dark). */}
      <button data-tour="ui-theme" className={`${styles.item} ${can('about') ? '' : styles.end}`} aria-label={ui === 'dark' ? t('Light interface') : t('Dark interface')} onClick={() => setUiTheme(ui === 'dark' ? 'light' : 'dark')}>
        <Icon name={ui === 'dark' ? 'light_mode' : 'dark_mode'} size={20} />
        <span className={styles.tip} role="tooltip">
          {ui === 'dark' ? t('Light interface') : t('Dark interface')}
        </span>
      </button>
    </nav>
  );
}
