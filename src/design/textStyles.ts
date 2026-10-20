// The connected app's text styles: its `--app-font-*` tokens (font shorthands), for Inspect and the Tokens view. A
// text takes one as `font: var(--app-font-body)`; Inspect names a text by the style it's written with.
import kitCss from '../kit/tokens.css?raw';
import { declaredValue } from './declared';

const appCss = Object.values(import.meta.glob('../app/**/theme.css', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>).join('\n');

export interface CodeTextStyle {
  /** The CSS variable, without `--` (`app-font-body`). */
  name: string;
  /** How the app's code names it (a connector's); the CSS name until then. */
  code: string;
  /** The component the app writes the text with (a connector's); the CSS name until then. */
  widget: string;
  /** Its name in the design file: `Body`. */
  figma: string;
  size: number;
  line: number;
  weight: number;
}

const VARS = new Map([...(kitCss + '\n' + appCss).matchAll(/--(app-font-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()] as const));

/** `600 20px/26px Inter, …` → weight, size, line height. */
function parse(font: string): { weight: number; size: number; line: number } | null {
  const m = font.match(/^(\d{3})?\s*([\d.]+)px\s*\/\s*([\d.]+)px/);
  return m ? { weight: Number(m[1] ?? 400), size: Number(m[2]), line: Number(m[3]) } : null;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const CODE_TEXT_STYLES: CodeTextStyle[] = [...VARS.entries()].flatMap(([name, value]) => {
  const p = parse(value);
  return p ? [{ name, code: name, widget: name, figma: cap(name.replace(/^app-font-/, '')), ...p }] : [];
});

/** The text styles a computed text is: its size, line height and weight (some styles share all three). */
export function textStylesOf(cs: CSSStyleDeclaration): CodeTextStyle[] {
  const size = parseFloat(cs.fontSize);
  const line = cs.lineHeight === 'normal' ? NaN : Math.round(parseFloat(cs.lineHeight));
  const weight = Number(cs.fontWeight);
  return CODE_TEXT_STYLES.filter((s) => s.size === size && Math.round(s.line) === line && s.weight === weight);
}

/**
 * The text style the code gives a text: the nearest rule (on it or up) that sets its type, `font: var(--app-font-body)`
 * naming the style; `style` null when that rule writes a size of its own, `declared` false when no rule sets one.
 * `weight`: a weight it sets over the style.
 */
export function declaredTextStyle(el: Element): { style: CodeTextStyle | null; declared: boolean; weight: number | null } {
  const hit = seen.get(el);
  if (hit) return hit;
  const out = lookUp(el);
  seen.set(el, out);
  return out;
}

const seen = new WeakMap<Element, ReturnType<typeof lookUp>>();

function lookUp(el: Element): { style: CodeTextStyle | null; declared: boolean; weight: number | null } {
  for (let at: Element | null = el; at; at = at.parentElement) {
    const font = declaredValue(at, 'font');
    const size = declaredValue(at, 'font-size');
    if (!font && !size) continue;
    const name = font?.match(/var\(--(app-font-[\w-]+)\)/)?.[1];
    const style = (name && CODE_TEXT_STYLES.find((s) => s.name === name)) || null;
    const w = Number(getComputedStyle(el).fontWeight);
    return { style, declared: true, weight: style && w !== style.weight ? w : null };
  }
  return { style: null, declared: false, weight: null };
}
