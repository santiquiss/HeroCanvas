// The connected app's design tokens, for the Tokens view and Inspect, as the app organizes them: its value in each of
// the screens' themes (THEME_MODES: light and dark, or the app's own), read from its token stylesheets (design/appTokens),
// and the token it points to.
//
// With a tokens connector (app/connectors/tokens.json, TokensConnector: the app's own groups, each token's name in the
// design file and in the code, its text styles and elevations), the catalog is the app's. Without one, the `--app-*`
// variables the kit and the screens draw with, grouped by what they are: colors, space, corners, type, effects.
import { TOKEN_BLOCKS } from './appTokens';
import { TOKENS_CONNECTOR, type TokensConnector } from './tokensConnector';

export type { TokensConnector };
import { CODE_TEXT_STYLES, type CodeTextStyle } from './textStyles';
import { THEME_MODES, type ThemeMode } from './themeModes';
import { t } from '../i18n/ui';

export { THEME_MODES, type ThemeMode };

export type TokenKind = 'color' | 'number' | 'text';
/** A theme mode's id (THEME_MODES). */
export type Mode = string;

export interface Token {
  /** The CSS variable, without `--`: `app-primary`. */
  name: string;
  /** Its name in the design file (the CSS name until a connector maps it). */
  figma: string;
  kind: TokenKind;
  /** Resolved (aliases followed), per mode. */
  value: Record<Mode, string>;
  /** Its value in the first mode (the default theme): what a single value shows. */
  base: string;
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

const BOTH = TOKEN_BLOCKS.all;
// A mode: its scheme's block, then its app theme's (`[data-app-theme='<id>']`), which wins, as on the screens.
const MODES: Record<Mode, Map<string, string>> = Object.fromEntries(
  THEME_MODES.map((m) => [m.id, new Map([...TOKEN_BLOCKS[m.scheme], ...(m.appTheme ? (TOKEN_BLOCKS.appThemes.get(m.appTheme) ?? []) : [])])]),
);
const FIRST = THEME_MODES[0].id;
const perMode = <T,>(f: (m: Mode) => T): Record<Mode, T> => Object.fromEntries(THEME_MODES.map((m) => [m.id, f(m.id)]));

const raw = (name: string, mode: Mode) => MODES[mode].get(name) ?? BOTH.get(name);
const target = (v: string | undefined) => v?.match(/^var\(--([\w-]+)\)$/)?.[1] ?? null;

function resolve(name: string, mode: Mode, depth = 0): string {
  const v = raw(name, mode) ?? '';
  const t = target(v);
  if (t) return depth < 10 ? resolve(t, mode, depth + 1) : v;
  // A token inside a value (a shadow in the theme's shadow color): its value in this mode.
  return depth < 10 ? v.replace(/var\(--([\w-]+)\)/g, (all, inner: string) => resolve(inner, mode, depth + 1) || all) : v;
}

// Without a connector, the `--app-*` variables (the kit's and the app's).
const NAMES = [...new Set([...BOTH.keys(), ...Object.values(MODES).flatMap((m) => [...m.keys()])])].filter((n) => n.startsWith('app-'));

function token(name: string, own: { figma?: string; code?: string | null; kind?: TokenKind } = {}): Token {
  const base = resolve(name, FIRST);
  return {
    name,
    figma: own.figma ?? name,
    kind: own.kind ?? (/^(rgb|#|hsl)/.test(base) ? 'color' : /^-?[\d.]+(px)?$/.test(base) ? 'number' : 'text'),
    value: perMode((m) => resolve(name, m)),
    base,
    alias: perMode((m) => target(raw(name, m))),
    code: own.code ?? null,
  };
}

/** A shadow from its parts' variables, in a mode. */
const shadowIn = (parts: Partial<Record<'x' | 'y' | 'blur' | 'spread' | 'color', string>>[], m: Mode) =>
  parts.map((p) => `${resolve(p.x ?? '', m) || 0}px ${resolve(p.y ?? '', m) || 0}px ${resolve(p.blur ?? '', m) || 0}px ${resolve(p.spread ?? '', m) || 0}px ${resolve(p.color ?? '', m) || 'transparent'}`).join(', ');

/** The app's own catalog, from its connector. */
export function fromConnector(c: TokensConnector): TokenGroup[] {
  return c.groups.map((g) => {
    const subs = new Map((g.tokens ?? []).map((tk) => [tk.name, tk.sub ?? '']));
    return {
      id: g.id,
      title: g.title,
      section: g.section,
      note: g.note ?? '',
      tokens: (g.tokens ?? []).map((tk) => token(tk.name, tk)),
      textStyles: g.textStyles?.map((st) => ({
        name: st.name,
        figma: st.figma ?? st.name,
        code: st.code ?? null,
        props: Object.fromEntries(Object.entries(st.props).map(([k, v]) => [k, token(v!)])),
      })),
      codeTextStyles: g.codeTextStyles ? CODE_TEXT_STYLES : undefined,
      elevations: g.elevations?.map((e) => ({ name: e.name, figma: e.figma ?? e.name, code: e.code ?? null, shadows: perMode((m) => shadowIn(e.shadows, m)) })),
      sub: (tk: Token) => subs.get(tk.name) ?? '',
      codeOnly: g.codeOnly,
      codeAccess: g.codeAccess,
    };
  });
}

const used = new Set<string>();
const take = (pred: (n: string) => boolean) => NAMES.filter((n) => !used.has(n) && pred(n)).map((n) => (used.add(n), n));
const px = (t: Token) => parseFloat(t.base);

function build(): TokenGroup[] {
  const groups: TokenGroup[] = [];
  const space = take((n) => n.startsWith('app-space-')).map((n) => token(n));
  const radius = take((n) => n.startsWith('app-radius-')).map((n) => token(n));
  const fonts = take((n) => n.startsWith('app-font-'));
  const elevation = take((n) => n === 'app-elevation' || n.startsWith('app-elevation-'));
  const colors = take((n) => token(n).kind === 'color' || n === 'app-scrim').map((n) => token(n));
  groups.push({ id: 'colors', title: t('Colors'), section: 'Colors', note: t('Pages, surfaces, text, icons, actions and states'), tokens: colors, sub: () => '' });
  groups.push({ id: 'spacing', title: t('Space'), section: 'Dimensions', note: t('Gaps and padding, on a 4-point scale'), tokens: space.sort((a, b) => px(a) - px(b)), sub: () => '' });
  groups.push({ id: 'radius', title: t('Corner radius'), section: 'Dimensions', note: t('Corners'), tokens: radius.sort((a, b) => px(a) - px(b)), sub: () => '' });
  groups.push({ id: 'text-styles', title: t('Text styles'), section: 'Type', note: t('Titles, headings, body, labels and captions'), tokens: fonts.map((n) => token(n)), codeTextStyles: CODE_TEXT_STYLES, sub: () => '' });
  groups.push({
    id: 'elevation',
    title: t('Elevation'),
    section: 'Effects',
    note: t('Shadows'),
    tokens: [],
    elevations: elevation.map((n) => ({ name: n, figma: n, shadows: perMode((m) => resolve(n, m)), code: null })),
    sub: () => '',
  });
  const rest = take(() => true);
  if (rest.length) groups.push({ id: 'other', title: t('Other'), section: 'Other', note: t('The app’s other variables'), tokens: rest.map((n) => token(n)), sub: (t) => t.name.split('-')[1] ?? '' });
  return groups;
}

export const TOKEN_GROUPS: TokenGroup[] = TOKENS_CONNECTOR ? fromConnector(TOKENS_CONNECTOR) : build();
/** Whether a code connector says how the code names the tokens: until one does, no token is "not in the code". */
export const TOKENS_CODE_LINKED = TOKEN_GROUPS.some((g) => !!g.codeAccess || g.tokens.some((t) => t.code !== null));
export const findTokenGroup = (id: string | null | undefined) => TOKEN_GROUPS.find((g) => g.id === id) ?? null;
/** How many entries a group shows (tokens, text styles or elevations). */
export const groupSize = (g: TokenGroup) => g.tokens.length + (g.codeTextStyles?.length ?? 0) + (g.textStyles?.length ?? 0) + (g.elevations?.length ?? 0);
/** The code version the tokens' code names were read from (a connector's). */
export const CODE_TOKENS_COMMIT: string | null = TOKENS_CONNECTOR?.version ?? null;

/** A token's place in the catalog: its group and the name its row is marked by (the Tokens view's `token`). */
export interface TokenPlace {
  group: string;
  name: string;
  /** Its value (the first mode's), to show beside the name. */
  value: string | null;
  figma: string;
  code: string | null;
}

/** A mode's look in two colors: its page and its accent (the theme picker's swatch). */
export const modeSwatch = (m: Mode): [string, string] => [resolve('app-page', m), resolve('app-primary', m)];

const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const PLACES = (() => {
  const out = new Map<string, TokenPlace>();
  for (const g of TOKEN_GROUPS) {
    // By any of its names (the CSS variable, the design file's, the code's); a group's earlier claim stands, so a name
    // in Other doesn't shadow one of the system's.
    const add = (keys: (string | null)[], place: TokenPlace) => keys.forEach((k) => k && !out.has(alnum(k)) && out.set(alnum(k), place));
    for (const t of g.tokens) add([t.name, t.figma, t.code], { group: g.id, name: t.name, value: t.base, figma: t.figma, code: t.code });
    for (const s of g.codeTextStyles ?? []) add([s.name, s.figma, s.code], { group: g.id, name: s.name, value: `${s.weight} ${s.size}/${s.line}`, figma: s.figma, code: s.code });
    for (const s of g.textStyles ?? []) add([s.name, s.figma], { group: g.id, name: s.name, value: null, figma: s.figma, code: s.code });
    for (const e of g.elevations ?? []) add([e.name, e.figma, e.code], { group: g.id, name: e.name, value: null, figma: e.figma, code: e.code });
  }
  return out;
})();

/** Where a token (as Inspect names it: `--app-primary`, `app-primary`) is in the catalog; null when it isn't one. */
export const findToken = (name: string): TokenPlace | null => PLACES.get(alnum(name)) ?? null;
