// The app's own themes (appConfig.themes): palettes beyond light and dark, as an app whose settings offer several.
// Picked in Scenarios › Theme or by the app itself (useAppTheme, from its settings), kept in the URL (`?apptheme=`,
// none: the first). A theme that forces light or dark sets the screens' scheme over the designer's switch.
import { appConfig } from '@app/config';
import type { AppTheme } from '../contract';
import { useUrlParams, useUrlPatch } from './SimContext';

export const APP_THEME_PARAM = 'apptheme';

export const APP_THEMES: AppTheme[] = appConfig.themes ?? [];

export const findAppTheme = (id: string | null | undefined): AppTheme | undefined => APP_THEMES.find((t) => t.id === id) ?? APP_THEMES[0];

/** The screens' light or dark: the app theme's when it forces one, else the designer's switch (`?theme=`). */
export function schemeIn(get: (key: string) => string | null): 'light' | 'dark' {
  return findAppTheme(get(APP_THEME_PARAM))?.scheme ?? (get('theme') === 'dark' ? 'dark' : 'light');
}

/** The app's theme in the screen this renders in, and picking another (as the app's settings do). None: no themes. */
export function useAppTheme(): [AppTheme | undefined, (id: string) => void] {
  const get = useUrlParams();
  const patch = useUrlPatch();
  const pick = (id: string) => patch({ [APP_THEME_PARAM]: id === APP_THEMES[0]?.id ? null : id });
  return [findAppTheme(get(APP_THEME_PARAM)), pick];
}
