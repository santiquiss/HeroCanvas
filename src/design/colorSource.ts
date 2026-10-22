// Where an element's color comes from, for Inspect: the rule that sets it (`background: var(--sf)`), followed through
// the app's aliases (its token stylesheets: `--sf: var(--app-surface)`) to a token of its catalog. Read from the
// stylesheets, not matched by value: two tokens can share a color, and the one the code names is the one to hand off.
import { TOKEN_BLOCKS } from './appTokens';
import { declaredValue } from './declared';
import { findToken, type TokenPlace } from './tokenCatalog';

export type ColorProp = 'color' | 'background-color' | 'border-color' | 'fill' | 'stroke';

export type ColorSource =
  /**
   * A token: one the app's code has (`code`, from a connector) or the app's stylesheet token (`figma`). `via`: the theme
   * alias it was named by. `alpha`: the opacity it's used at (`color-mix(… 20%, transparent)`), or null.
   */
  | { kind: 'code' | 'figma'; token: TokenPlace; via: string | null; alpha: number | null }
  /** A value written as is: in a stylesheet, or in an alias with no token (`via`). */
  | { kind: 'raw'; value: string; via: string | null }
  /** Nothing in the stylesheets sets it (a default, a value set from script). */
  | { kind: 'unknown' };

/** Each variable's value as the app's token stylesheets write it, per theme (`--name` keys). */
const ALIAS: Record<'light' | 'dark', Map<string, string>> = (() => {
  const dashed = (m: Map<string, string>) => [...m].map(([k, v]) => [`--${k}`, v] as const);
  return {
    light: new Map([...dashed(TOKEN_BLOCKS.all), ...dashed(TOKEN_BLOCKS.light)]),
    dark: new Map([...dashed(TOKEN_BLOCKS.all), ...dashed(TOKEN_BLOCKS.dark)]),
  };
})();

const firstVar = (v: string) => v.match(/var\(\s*(--[\w-]+)/)?.[1] ?? null;

/**
 * The opacity a value gives the token it names, as the stylesheets write a token at an opacity:
 * `color-mix(in srgb, var(--x) 20%, transparent)` (either order) → 0.2. Null for a token used as it is.
 */
export function tokenAlpha(value: string): number | null {
  const m =
    value.match(/color-mix\(\s*in\s+[\w-]+\s*,\s*var\(\s*--[\w-]+\s*\)\s+([\d.]+)%\s*,\s*transparent\s*\)/) ??
    value.match(/color-mix\(\s*in\s+[\w-]+\s*,\s*transparent(?:\s+[\d.]+%)?\s*,\s*var\(\s*--[\w-]+\s*\)\s+([\d.]+)%\s*\)/);
  return m ? Number(m[1]) / 100 : null;
}

/** The value the element's own rules (or its inline style, or an SVG attribute) give a color property. */
function declared(el: Element, prop: ColorProp): string | null {
  const shorthand = { 'background-color': 'background', 'border-color': 'border', color: null, fill: null, stroke: null }[prop];
  return declaredValue(el, prop, shorthand) ?? (prop === 'fill' || prop === 'stroke' ? el.getAttribute(prop) : null);
}

const cache = new WeakMap<Element, Map<string, ColorSource>>();

/**
 * Where `prop`'s color comes from. Text color is inherited: the nearest element (itself or up) whose rules set it.
 * Looked up once per element and theme (the stylesheets don't change while it's inspected).
 */
export function colorSource(el: Element, prop: ColorProp, theme: 'light' | 'dark'): ColorSource {
  const key = `${prop} ${theme}`;
  const hit = cache.get(el)?.get(key);
  if (hit) return hit;
  let value: string | null = null;
  for (let at: Element | null = el; at && !value; at = prop === 'color' ? at.parentElement : null) value = declared(at, prop);
  const out = resolve(value, theme);
  cache.set(el, (cache.get(el) ?? new Map()).set(key, out));
  return out;
}

function resolve(value: string | null, theme: 'light' | 'dark'): ColorSource {
  if (!value) return { kind: 'unknown' };
  let name = firstVar(value);
  if (!name) return { kind: 'raw', value, via: null };
  let alpha = tokenAlpha(value);
  // Through the aliases (an alias can name another) to a token, or to the value an alias has instead.
  let via: string | null = null;
  // A token of the catalog stops it: its own value isn't an alias.
  for (let i = 0; i < 6 && !findToken(name) && ALIAS[theme].has(name); i++) {
    via ??= name;
    const next = ALIAS[theme].get(name)!;
    const inner = firstVar(next);
    if (!inner) return { kind: 'raw', value: next, via };
    alpha ??= tokenAlpha(next);
    name = inner;
  }
  const token = findToken(name);
  if (!token) return { kind: 'raw', value, via };
  return { kind: token.code ? 'code' : 'figma', token, via, alpha };
}
