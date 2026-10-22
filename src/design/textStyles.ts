// The connected app's text styles, for Inspect and the Tokens view: the ones its tokens connector lists (how its code
// names each and the widget that writes a text with it), or else its `--app-font-*` tokens (font shorthands). A text
// takes one as `font: var(--<name>)`; Inspect names a text by the style it's written with.
import { TOKEN_CSS } from './appTokens';
import { declaredValue } from './declared';
import { TOKENS_CONNECTOR } from './tokensConnector';

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

const VARS = new Map([...TOKEN_CSS.join('\n').matchAll(/--(app-font-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()] as const));

/** `600 20px/26px Inter, …` → weight, size, line height. */
function parse(font: string): { weight: number; size: number; line: number } | null {
  const m = font.match(/^(\d{3})?\s*([\d.]+)px\s*\/\s*([\d.]+)px/);
  return m ? { weight: Number(m[1] ?? 400), size: Number(m[2]), line: Number(m[3]) } : null;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const CODE_TEXT_STYLES: CodeTextStyle[] = TOKENS_CONNECTOR?.textStyles
  ? TOKENS_CONNECTOR.textStyles.map((s) => ({ ...s, widget: s.widget ?? s.code, figma: s.figma ?? s.name }))
  : [...VARS.entries()].flatMap(([name, value]) => {
      const p = parse(value);
      return p ? [{ name, code: name, widget: name, figma: cap(name.replace(/^app-font-/, '')), ...p }] : [];
    });

const BY_NAME = new Map(CODE_TEXT_STYLES.map((s) => [s.name, s]));

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
    const name = font?.match(/var\(--([\w-]+)\)/)?.[1];
    const style = (name && BY_NAME.get(name)) || null;
    const w = Number(getComputedStyle(el).fontWeight);
    return { style, declared: true, weight: style && w !== style.weight ? w : null };
  }
  return { style: null, declared: false, weight: null };
}
