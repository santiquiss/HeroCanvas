// The app's hidden developer gesture: quick taps on a marked element — e.g. the version at the bottom of a
// settings page — open something for the team. A screen only marks the element; what the taps
// open is up to whoever listens (real mode: the designer's controls).
import { useEffect } from 'react';

/** Marks an element as a hidden developer spot; its value is the app's namespace for it (e.g. `settings.appversion`). */
export const DEVELOPER_HIDDEN = 'data-developer-hidden';
/** Taps that discover it. The app asks for 5; fewer here, where it's the only way to the controls. */
export const DISCOVER_TAPS = 3;
/** The taps start over after this long without one, as the app's. */
export const TAP_RESET_MS = 500;

/**
 * Counts taps: `tap(now)` says whether this one discovers it (the count starts over then, and after TAP_RESET_MS
 * without a tap).
 */
export function tapCounter(needed = DISCOVER_TAPS, resetMs = TAP_RESET_MS) {
  let taps = 0;
  let last = -Infinity;
  return (now: number): boolean => {
    taps = now - last > resetMs ? 1 : taps + 1;
    last = now;
    if (taps < needed) return false;
    taps = 0;
    return true;
  };
}

/** Calls `onDiscover` when a hidden developer spot inside `root` gets its taps. */
export function useDeveloperHidden(root: HTMLElement | null, onDiscover: (namespace: string) => void) {
  useEffect(() => {
    if (!root) return;
    const counters = new Map<string, ReturnType<typeof tapCounter>>();
    const onClick = (e: MouseEvent) => {
      const spot = (e.target as Element | null)?.closest?.(`[${DEVELOPER_HIDDEN}]`);
      const namespace = spot?.getAttribute(DEVELOPER_HIDDEN);
      if (!namespace) return;
      if (!counters.has(namespace)) counters.set(namespace, tapCounter());
      if (counters.get(namespace)!(performance.now())) onDiscover(namespace);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);
}
