// The app's own themes (appConfig.themes): palettes beyond light and dark, as an app whose settings offer several.
// Picked in Scenarios › Theme or by the app itself (useAppTheme, from its settings), kept in the URL (`?apptheme=`,
// none: the first). A theme that forces light or dark sets the screens' scheme over the designer's switch.
// The app's appearance setting (appConfig.appearance) is here too: not a palette, only light or dark over the system's.
import { appConfig } from '@app/config';
import type { AppTheme } from '../contract';
import { useUrlParams, useUrlPatch } from './SimContext';

export const APP_THEME_PARAM = 'apptheme';

export const APP_THEMES: AppTheme[] = appConfig.themes ?? [];

export const findAppTheme = (id: string | null | undefined): AppTheme | undefined => APP_THEMES.find((t) => t.id === id) ?? APP_THEMES[0];

/** The app's appearance setting (appConfig.appearance): `system` follows the designer's switch (the system's). */
export type Appearance = 'system' | 'light' | 'dark';

export const APPEARANCE_PARAM = 'appearance';

/** The appearance the app's user picked (`?appearance=`, none: the system's); always `system` for an app without it. */
export function appearanceIn(get: (key: string) => string | null): Appearance {
  const v = get(APPEARANCE_PARAM);
  return appConfig.appearance && (v === 'light' || v === 'dark') ? v : 'system';
}

/**
 * The screens' light or dark: the app theme's when it forces one, then the app's appearance setting, else the
 * designer's switch (`?theme=`, the system's).
 */
export function schemeIn(get: (key: string) => string | null): 'light' | 'dark' {
  const appearance = appearanceIn(get);
  return findAppTheme(get(APP_THEME_PARAM))?.scheme ?? (appearance !== 'system' ? appearance : get('theme') === 'dark' ? 'dark' : 'light');
}

/** The app's appearance setting in the screen this renders in, and changing it (as the app's settings do). */
export function useAppearance(): [Appearance, (a: Appearance) => void] {
  const get = useUrlParams();
  const patch = useUrlPatch();
  return [appearanceIn(get), (a) => patch({ [APPEARANCE_PARAM]: a === 'system' ? null : a })];
}

/** The app's theme in the screen this renders in, and picking another (as the app's settings do). None: no themes. */
export function useAppTheme(): [AppTheme | undefined, (id: string) => void] {
  const get = useUrlParams();
  const patch = useUrlPatch();
  const pick = (id: string) => patch({ [APP_THEME_PARAM]: id === APP_THEMES[0]?.id ? null : id });
  return [findAppTheme(get(APP_THEME_PARAM)), pick];
}
