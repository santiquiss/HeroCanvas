// The app's token stylesheets, read as text for what reads tokens rather than draws with them (the Tokens view,
// Inspect's colors and text styles): app/theme.css and whatever is in app/theme/ (a design file's export, a size
// scale), after the kit's defaults (src/kit/tokens.css). Each custom property per where it applies, whatever the
// selectors' spelling: everywhere (`:root`, `[data-theme]`), in light or dark (`[data-theme='dark']`,
// `:root[data-theme="dark"]`), or in one of the app's own themes (`[data-app-theme='<id>']`).
import { NO_APP } from '../nav/noApp';
import kitCss from '../kit/tokens.css?raw';
import tourCss from '../tour/theme.css?raw';

const appFiles = import.meta.glob(['@app/**/theme.css', '@app/theme/**/*.css'], { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

/** The app's token stylesheets (the tour's with no app), after the kit's. */
export const TOKEN_CSS: string[] = [kitCss, ...(NO_APP ? [tourCss] : Object.values(appFiles))];

export interface TokenBlocks {
  /** Everywhere: `:root`, `[data-theme]`. */
  all: Map<string, string>;
  light: Map<string, string>;
  dark: Map<string, string>;
  /** An app theme's own (`[data-app-theme='<id>']`), by id. */
  appThemes: Map<string, Map<string, string>>;
}

/** Where a selector applies: `all`, `light`, `dark`, `app:<id>`, or null for any other selector. */
export function scopeOf(selector: string): string | null {
  const s = selector.replace(/\s+/g, '').replace(/["']/g, '').replace(/^(:root|html)(?=\[|$)/, '');
  if (s === '' || s === '[data-theme]') return 'all';
  const theme = s.match(/^\[data-theme=(light|dark)\]$/);
  if (theme) return theme[1];
  const app = s.match(/^\[data-app-theme=([\w-]+)\]$/);
  return app ? `app:${app[1]}` : null;
}

/** Every custom property of the stylesheets, by where it applies; a later one wins. */
export function readBlocks(sheets: string[]): TokenBlocks {
  const out: TokenBlocks = { all: new Map(), light: new Map(), dark: new Map(), appThemes: new Map() };
  for (const css of sheets)
    // Comments out first (one before a block would read as part of its selector); top-level rules only.
    for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(?<=^|})\s*([^{}@]+)\{([^{}]*)\}/g)) {
      for (const sel of m[1].split(',')) {
        const scope = scopeOf(sel);
        if (!scope) continue;
        const map = scope === 'all' ? out.all : scope === 'light' ? out.light : scope === 'dark' ? out.dark : out.appThemes.get(scope.slice(4)) ?? out.appThemes.set(scope.slice(4), new Map()).get(scope.slice(4))!;
        for (const d of m[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) map.set(d[1], d[2].trim());
      }
    }
  return out;
}

export const TOKEN_BLOCKS: TokenBlocks = readBlocks(TOKEN_CSS);
