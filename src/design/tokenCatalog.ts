// The connected app's design tokens, for the Tokens view and Inspect: each `--app-*` variable the screens are drawn
// with (src/kit/tokens.css, and the app's own theme, app/theme.css, which overrides it), its value in light and
// dark, and the token it points to. Grouped by what they are: colors, space, corners, type, effects.
//
// `figma` and `code`: the token's name in the design file and in the app's code, when a connector gives them
// (none yet: the token's own name, and null).
import { APP_THEME_CSS } from './appTheme';
import kitCss from '../kit/tokens.css?raw';
import { CODE_TEXT_STYLES, type CodeTextStyle } from './textStyles';

const appCss = APP_THEME_CSS;

export type TokenKind = 'color' | 'number' | 'text';
export type Mode = 'light' | 'dark';

export interface Token {
  /** The CSS variable, without `--`: `app-primary`. */
  name: string;
  /** Its name in the design file (the CSS name until a connector maps it). */
  figma: string;
  kind: TokenKind;
  /** Resolved (aliases followed), per mode. */
  value: Record<Mode, string>;
  /** The variable it points to, per mode, when it's an alias. */
  alias: Record<Mode, string | null>;
  /** How the app's code reads it, when a connector gives it; null otherwise. */
  code: string | null;
}

export interface TextStyleToken {
  name: string;
  figma: string;
  props: { family?: Token; size?: Token; weight?: Token; lineHeight?: Token; letterSpacing?: Token };
  code: string | null;
}

export interface ElevationToken {
  name: string;
  figma: string;
  shadows: Record<Mode, string>;
  code: string | null;
}

export interface TokenGroup {
  id: string;
  title: string;
  section: 'Colors' | 'Dimensions' | 'Type' | 'Effects' | 'Other';
  note: string;
  tokens: Token[];
  textStyles?: TextStyleToken[];
  /** The app's text styles (its `--app-font-*` tokens). */
  codeTextStyles?: CodeTextStyle[];
  elevations?: ElevationToken[];
  /** Subgroups for the view. */
  sub: (t: Token) => string;
  /** Names the app's code has in this group that no token matches (from a connector). */
  codeOnly?: string[];
  /** How the app's code reaches the group (from a connector). */
  codeAccess?: string;
}

// ---------------------------------------------------------------- reading the stylesheets

/** Every `--app-*` declaration in the blocks whose selector matches, the app's after the kit's (so it wins). */
function block(selector: RegExp): Map<string, string> {
  const out = new Map<string, string>();
  for (const css of [kitCss, appCss])
    // Comments out first: one before a block would be read as part of its selector.
    for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!selector.test(m[1].trim())) continue;
      for (const d of m[2].matchAll(/--(app-[\w-]+)\s*:\s*([^;]+);/g)) out.set(d[1], d[2].trim());
    }
  return out;
}

const BOTH = block(/^\[data-theme\]$/);
const MODES: Record<Mode, Map<string, string>> = { light: block(/^\[data-theme='light'\]$/), dark: block(/^\[data-theme='dark'\]$/) };

const raw = (name: string, mode: Mode) => MODES[mode].get(name) ?? BOTH.get(name);
const target = (v: string | undefined) => v?.match(/^var\(--([\w-]+)\)$/)?.[1] ?? null;

function resolve(name: string, mode: Mode, depth = 0): string {
  const v = raw(name, mode) ?? '';
  const t = target(v);
  return t && depth < 10 ? resolve(t, mode, depth + 1) : v;
}

const NAMES = [...new Set([...BOTH.keys(), ...MODES.light.keys(), ...MODES.dark.keys()])];

function token(name: string): Token {
  const light = resolve(name, 'light');
  return {
    name,
    figma: name,
    kind: /^(rgb|#|hsl)/.test(light) ? 'color' : /^-?[\d.]+(px)?$/.test(light) ? 'number' : 'text',
    value: { light, dark: resolve(name, 'dark') },
    alias: { light: target(raw(name, 'light')), dark: target(raw(name, 'dark')) },
    code: null,
  };
}

const used = new Set<string>();
const take = (pred: (n: string) => boolean) => NAMES.filter((n) => !used.has(n) && pred(n)).map((n) => (used.add(n), n));
const px = (t: Token) => parseFloat(t.value.light);

function build(): TokenGroup[] {
  const groups: TokenGroup[] = [];
  const space = take((n) => n.startsWith('app-space-')).map(token);
  const radius = take((n) => n.startsWith('app-radius-')).map(token);
  const fonts = take((n) => n.startsWith('app-font-'));
  const elevation = take((n) => n === 'app-elevation' || n.startsWith('app-elevation-'));
  const colors = take((n) => token(n).kind === 'color' || n === 'app-scrim').map(token);
  groups.push({ id: 'colors', title: 'Colors', section: 'Colors', note: 'Pages, surfaces, text, icons, actions and states', tokens: colors, sub: () => '' });
  groups.push({ id: 'spacing', title: 'Space', section: 'Dimensions', note: 'Gaps and padding, on a 4-point scale', tokens: space.sort((a, b) => px(a) - px(b)), sub: () => '' });
  groups.push({ id: 'radius', title: 'Corner radius', section: 'Dimensions', note: 'Corners', tokens: radius.sort((a, b) => px(a) - px(b)), sub: () => '' });
  groups.push({ id: 'text-styles', title: 'Text styles', section: 'Type', note: 'Titles, headings, body, labels and captions', tokens: fonts.map(token), codeTextStyles: CODE_TEXT_STYLES, sub: () => '' });
  groups.push({
    id: 'elevation',
    title: 'Elevation',
    section: 'Effects',
    note: 'Shadows',
    tokens: [],
    elevations: elevation.map((n) => ({ name: n, figma: n, shadows: { light: resolve(n, 'light'), dark: resolve(n, 'dark') }, code: null })),
    sub: () => '',
  });
  const rest = take(() => true);
  if (rest.length) groups.push({ id: 'other', title: 'Other', section: 'Other', note: 'The app’s other variables', tokens: rest.map(token), sub: (t) => t.name.split('-')[1] ?? '' });
  return groups;
}

export const TOKEN_GROUPS: TokenGroup[] = build();
/** Whether a code connector says how the code names the tokens: until one does, no token is "not in the code". */
export const TOKENS_CODE_LINKED = TOKEN_GROUPS.some((g) => !!g.codeAccess || g.tokens.some((t) => t.code !== null));
export const findTokenGroup = (id: string | null | undefined) => TOKEN_GROUPS.find((g) => g.id === id) ?? null;
/** How many entries a group shows (tokens, text styles or elevations). */
export const groupSize = (g: TokenGroup) => g.tokens.length + (g.textStyles?.length ?? 0) + (g.elevations?.length ?? 0);
/** The code version the tokens' code names were read from (a connector's). */
export const CODE_TOKENS_COMMIT: string | null = null;

/** A token's place in the catalog: its group and the name its row is marked by (the Tokens view's `token`). */
export interface TokenPlace {
  group: string;
  name: string;
  /** Its value (light), to show beside the name. */
  value: string | null;
  figma: string;
  code: string | null;
}

const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const PLACES = (() => {
  const out = new Map<string, TokenPlace>();
  for (const g of TOKEN_GROUPS) {
    for (const t of g.tokens) out.set(alnum(t.name), { group: g.id, name: t.name, value: t.value.light, figma: t.figma, code: t.code });
    for (const e of g.elevations ?? []) out.set(alnum(e.name), { group: g.id, name: e.name, value: null, figma: e.figma, code: e.code });
  }
  return out;
})();

/** Where a token (as Inspect names it: `--app-primary`, `app-primary`) is in the catalog; null when it isn't one. */
export const findToken = (name: string): TokenPlace | null => PLACES.get(alnum(name)) ?? null;
