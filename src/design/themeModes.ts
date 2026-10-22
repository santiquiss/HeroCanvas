// The screens' themes as the designer lists them, one "mode" each: Light and Dark for an app with no themes of its
// own; else each of its themes (appConfig.themes), one that forces light or dark as one mode, one that follows the
// device as two (Name · Light, Name · Dark). The theme picker and the Tokens view's columns both read this list.
import { appConfig } from '@app/config';
import { t } from '../i18n/ui';
import { APPEARANCE_PARAM, appearanceIn } from '../sim/appThemes';

export interface ThemeMode {
  /** `light`, `dark`, an app theme's id, or `<id>-light` / `<id>-dark`. */
  id: string;
  label: string;
  scheme: 'light' | 'dark';
  /** The app theme it is (`?apptheme=`), when the app has themes. */
  appTheme?: string;
}

const THEMES = appConfig.themes ?? [];

export const THEME_MODES: ThemeMode[] = THEMES.length
  ? THEMES.flatMap((th) =>
      th.scheme
        ? [{ id: th.id, label: th.name, scheme: th.scheme, appTheme: th.id }]
        : (['light', 'dark'] as const).map((s) => ({ id: `${th.id}-${s}`, label: `${th.name} · ${s === 'light' ? t('Light') : t('Dark')}`, scheme: s, appTheme: th.id })),
    )
  : [
      { id: 'light', label: t('Light'), scheme: 'light' },
      { id: 'dark', label: t('Dark'), scheme: 'dark' },
    ];

/** The mode the screens show, from the URL's app theme (`?apptheme=`, none: the first) and scheme (`?theme=`). */
export function modeIn(get: (key: string) => string | null): ThemeMode {
  // What the screens show: the app's appearance setting, when light or dark, over the system's.
  const appearance = appearanceIn(get);
  const scheme = appearance !== 'system' ? appearance : get('theme') === 'dark' ? 'dark' : 'light';
  if (!THEMES.length) return THEME_MODES.find((m) => m.scheme === scheme)!;
  const theme = THEMES.find((t) => t.id === get('apptheme')) ?? THEMES[0];
  return THEME_MODES.find((m) => m.appTheme === theme.id && (theme.scheme || m.scheme === scheme))!;
}

/**
 * The URL params that show a mode (null: the default, dropped). Picked in the designer, it's the system's: the app's
 * appearance setting goes back to following it.
 */
export const modeParams = (m: ThemeMode): Record<string, string | null> => ({
  [APPEARANCE_PARAM]: null,
  apptheme: m.appTheme && m.appTheme !== THEMES[0]?.id ? m.appTheme : null,
  theme: m.scheme === 'dark' ? 'dark' : null,
});
