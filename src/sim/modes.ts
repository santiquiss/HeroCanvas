// Designer modes, chosen by URL path:
//   prototype  → the app on a device (any app path)
//   components → #/components[/Name]  (gallery)
//   flow       → #/flow               (all pages on a canvas)
//   tokens     → #/tokens[/group]      (the design tokens; #/components/tokens… still opens them)
//   about      → #/about               (HeroCanvas itself: its version, license and changelog)
import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { HOME } from '../nav/home';
import { SIM_PARAMS } from '../nav/stack';

export type Mode = 'prototype' | 'components' | 'flow' | 'tokens' | 'about';

export const MODE_PATHS: Record<Exclude<Mode, 'prototype'>, string> = { components: '/components', flow: '/flow', tokens: '/tokens', about: '/about' };

/** The tokens' routes: `#/tokens…`, and the gallery's from before (`#/components/tokens…`). */
export const isTokensPath = (pathname: string) => /^\/(components\/)?tokens(\/|$)/.test(pathname);
const LAST_PROTO = 'hc.lastProto';
/** Each mode's last place (path + query), so switching back returns there: the prototype's screen, the component open. */
const lastKey = (mode: Mode) => (mode === 'prototype' ? LAST_PROTO : `hc.last.${mode}`);

export function modeOf(pathname: string): Mode {
  if (isTokensPath(pathname)) return 'tokens';
  if (pathname.startsWith(MODE_PATHS.components)) return 'components';
  if (pathname.startsWith(MODE_PATHS.flow)) return 'flow';
  if (pathname === MODE_PATHS.about) return 'about';
  return 'prototype';
}

/** Path + query of a mode's last place (default: the prototype's screen) before switching to another mode. */
export function lastPrototypeUrl(mode: Mode = 'prototype'): string | null {
  try {
    return sessionStorage.getItem(lastKey(mode));
  } catch {
    return null;
  }
}

export function useMode(): Mode {
  return modeOf(useLocation().pathname);
}

/** Query string with only the simulator params (device, theme…) plus extras. */
export function useSimQuery() {
  const [search] = useSearchParams();
  return useCallback(
    (extra: Record<string, string> = {}) => {
      const q = new URLSearchParams();
      for (const k of SIM_PARAMS) {
        const v = search.get(k);
        if (v != null) q.set(k, v);
      }
      for (const [k, v] of Object.entries(extra)) q.set(k, v);
      const s = q.toString();
      return s ? `?${s}` : '';
    },
    [search],
  );
}

/** Remember where a mode is (its path + query), so switching back to it returns there. */
export function rememberPrototype(location: { pathname: string; search: string }) {
  try {
    sessionStorage.setItem(lastKey(modeOf(location.pathname)), location.pathname + location.search);
  } catch {
    /* storage unavailable */
  }
}

/** Remembers the current mode's place on every move, however it's left (the mode switch, a link to a page, Back). */
export function useRememberMode() {
  const location = useLocation();
  useEffect(() => rememberPrototype(location), [location]);
}

/** Switch modes, keeping device / theme (and `extra` params), back where each mode was. */
export function useSetMode() {
  const navigate = useNavigate();
  const location = useLocation();
  const sim = useSimQuery();
  return (to: Mode, extra: Record<string, string> = {}) => {
    const from = modeOf(location.pathname);
    if (to === from) return;
    rememberPrototype(location);
    // Capture (`?capture=1`) is the prototype's: switching modes leaves it, unless it's asked for (the rail's Capture).
    const go = (path: string, params: Record<string, string>) => {
      const q = new URLSearchParams(sim(params));
      if (!extra.capture) q.delete('capture');
      const s = q.toString();
      navigate(path + (s ? `?${s}` : ''));
    };
    const last = lastPrototypeUrl(to);
    if (to !== 'prototype' && !last) return go(MODE_PATHS[to], extra);
    const path = last ? last.split('?')[0] : `/${HOME}`;
    const keep = new URLSearchParams(last?.split('?')[1] ?? '');
    for (const k of SIM_PARAMS) keep.delete(k);
    go(path, { ...Object.fromEntries(keep), ...extra });
  };
}
