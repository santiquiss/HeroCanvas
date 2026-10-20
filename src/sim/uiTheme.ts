// The designer's interface theme (light, or dark like Figma's): a viewer's preference, kept in their browser and set as
// `data-ui` on the root, where theme.css's `--ui-*` colors read it. The app's screens keep their own theme (`?theme=`).
import { useSyncExternalStore } from 'react';

export type UiTheme = 'light' | 'dark';

const KEY = 'hc.ui';
const listeners = new Set<() => void>();

function read(): UiTheme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

let current: UiTheme = typeof window === 'undefined' ? 'light' : read();
const apply = () => {
  if (typeof document !== 'undefined') document.documentElement.dataset.ui = current;
};
// At load, before the first paint: no flash of the light interface.
apply();

export function setUiTheme(t: UiTheme) {
  current = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* storage unavailable: this visit only */
  }
  apply();
  listeners.forEach((l) => l());
}

export function useUiTheme(): UiTheme {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
    () => 'light',
  );
}
