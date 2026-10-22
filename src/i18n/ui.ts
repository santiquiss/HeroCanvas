// HeroCanvas's own interface in the team's language (herocanvas.config.ts `language`): `t('Inspect')` gives the text in
// it, from a catalog keyed by the English text (es/*.json, one file per area of the interface), or the English itself
// when there's no catalog or no entry.
// The English is the key, so the code reads as it shows. Variables go in braces: `t('{count} selected', { count })`.
// Only the designer's interface: the app's screens keep their own languages (app/config.ts, sim/language).

export type UiLanguage = 'en' | 'es';

/** A language's catalog: its files merged (es/*.json). */
const merge = (files: Record<string, Record<string, string>>) => Object.assign({}, ...Object.values(files)) as Record<string, string>;

/** Spanish, every area's file merged. */
export const ES: Record<string, string> = merge(import.meta.glob<Record<string, string>>('./es/*.json', { eager: true, import: 'default' }));

const CATALOGS: Partial<Record<UiLanguage, Record<string, string>>> = { es: ES };

/** The interface's language, as the team set it. */
export const UI_LANGUAGE: UiLanguage = __HC_LANGUAGE__ === 'es' ? 'es' : 'en';

const catalog = CATALOGS[UI_LANGUAGE] ?? {};

/** `text` (English) in the interface's language, its `{name}`s filled from `vars`. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const out = catalog[text] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? String(vars[k]) : all)) : out;
}

/** One or the other by a count: `plural(n, '{n} page', '{n} pages')`, each translated. */
export function plural(n: number, one: string, other: string, vars: Record<string, string | number> = {}): string {
  return t(n === 1 ? one : other, { n, ...vars });
}
