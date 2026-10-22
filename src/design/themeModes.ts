// The screens' themes as the designer lists them, one "mode" each: Light and Dark for an app with no themes of its
// own; else each of its themes (appConfig.themes), one that forces light or dark as one mode, one that follows the
// device as two (Name · Light, Name · Dark). The theme picker and the Tokens view's columns both read this list.
import { appConfig } from '@app/config';

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
  ? THEMES.flatMap((t) =>
      t.scheme
        ? [{ id: t.id, label: t.name, scheme: t.scheme, appTheme: t.id }]
        : (['light', 'dark'] as const).map((s) => ({ id: `${t.id}-${s}`, label: `${t.name} · ${s === 'light' ? 'Light' : 'Dark'}`, scheme: s, appTheme: t.id })),
    )
  : [
      { id: 'light', label: 'Light', scheme: 'light' },
      { id: 'dark', label: 'Dark', scheme: 'dark' },
    ];

/** The mode the screens show, from the URL's app theme (`?apptheme=`, none: the first) and scheme (`?theme=`). */
export function modeIn(get: (key: string) => string | null): ThemeMode {
  const scheme = get('theme') === 'dark' ? 'dark' : 'light';
  if (!THEMES.length) return THEME_MODES.find((m) => m.scheme === scheme)!;
  const theme = THEMES.find((t) => t.id === get('apptheme')) ?? THEMES[0];
  return THEME_MODES.find((m) => m.appTheme === theme.id && (theme.scheme || m.scheme === scheme))!;
}

/** The URL params that show a mode (null: the default, dropped). */
export const modeParams = (m: ThemeMode): Record<string, string | null> => ({
  apptheme: m.appTheme && m.appTheme !== THEMES[0]?.id ? m.appTheme : null,
  theme: m.scheme === 'dark' ? 'dark' : null,
});
