// Maps computed colors back to token names: the screens' aliases in theme.css and the app's color tokens
// (`--app-*`: src/kit/tokens.css, app/theme.css), per theme.
import themeCss from '../theme/theme.css?raw';
import { TOKEN_GROUPS } from './tokenCatalog';

const APP_COLORS = TOKEN_GROUPS.flatMap((g) => g.tokens.filter((t) => t.kind === 'color').map((t) => `--${t.name}`));
const ALIASES = [...new Set([...themeCss.matchAll(/^\s*(--(?:pg|sf|tx)):/gm)].map((m) => m[1]))];

/** The aliases first, then the app's tokens. */
const rank = (name: string) => (APP_COLORS.includes(name) ? 1 : 0);

const cache = new Map<string, Map<string, string[]>>();

/** rgb()/rgba() string → token names, for one theme. */
function tokenMap(theme: 'light' | 'dark'): Map<string, string[]> {
  const hit = cache.get(theme);
  if (hit) return hit;
  // A var that is missing or not a color makes `color` inherit; the sentinel on the wrapper catches that.
  const SENTINEL = 'rgb(1, 2, 3)';
  const wrap = document.createElement('div');
  wrap.style.cssText = `display:none;color:${SENTINEL}`;
  const probe = document.createElement('div');
  probe.className = theme;
  probe.setAttribute('data-theme', theme);
  wrap.appendChild(probe);
  document.body.appendChild(wrap);
  const map = new Map<string, string[]>();
  for (const name of [...ALIASES, ...APP_COLORS]) {
    probe.style.color = '';
    probe.style.color = `var(${name})`;
    const v = getComputedStyle(probe).color;
    if (!v || v === SENTINEL) continue;
    map.set(v, [...(map.get(v) ?? []), name]);
  }
  wrap.remove();
  for (const names of map.values()) names.sort((a, b) => rank(a) - rank(b));
  cache.set(theme, map);
  return map;
}

export type ColorRole = 'text' | 'fill' | 'border' | 'icon';

const ROLE_PREFIX: Record<ColorRole, string[]> = {
  text: ['--app-text', '--app-on-', '--app-icon'],
  fill: ['--app-page', '--app-surface', '--app-primary', '--app-secondary'],
  border: ['--app-border'],
  icon: ['--app-icon', '--app-text'],
};

/** Token names for a computed color, best first: theme aliases, then the app's tokens for that role, then the rest. */
export function colorTokens(color: string, theme: 'light' | 'dark', role: ColorRole): string[] {
  const names = tokenMap(theme).get(color) ?? [];
  // Earlier prefixes in ROLE_PREFIX rank higher (--text-* before --icons-*).
  const fit = (n: string) => ROLE_PREFIX[role].findIndex((p) => n.startsWith(p));
  const score = (n: string) => (ALIASES.includes(n) ? 0 : fit(n) >= 0 ? 1 + fit(n) / 10 : 2);
  return [...names].sort((a, b) => score(a) - score(b));
}

export function isVisibleColor(c: string): boolean {
  return !!c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)';
}
