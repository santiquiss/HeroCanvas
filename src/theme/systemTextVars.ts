// The app's text styles under the system's text settings (sim/systemText): the custom properties a screen sets on its
// root so every text written with a style follows the size the user picked and Bold Text. The styles are the ones its
// tokens connector lists (with their parts and the type scale), or else its `--app-font-*` tokens. A size written in
// px doesn't follow: that's how a fixed size shows.
import { TOKEN_BLOCKS, TOKEN_CSS } from '../design/appTokens';
import { TOKENS_CONNECTOR } from '../design/tokensConnector';
import { boldWeight, scaleSize, textSizeFor, type TextSystem } from '../sim/systemText';

/** The sizes the two scales for off-style text are taken at: body text, and display text. */
const BODY = 15;
const DISPLAY = 30;

const round = (n: number) => Math.round(n * 100) / 100;

export interface Style {
  name: string;
  weight: number;
  size: number;
  line: number;
  family: string;
  parts?: { size?: string; line?: string; weight?: string };
}

/** A font shorthand's family: what follows its size and line height (`400 15px/22px var(--font)` → `var(--font)`). */
const familyOf = (shorthand: string | undefined) => shorthand?.match(/[\d.]+px\s*\/\s*[\d.]+px\s+(.+)$/)?.[1].trim() ?? 'inherit';

/** `--app-font-body: 400 16px/22px Inter, …` → its weight, size, line height and family (the app's last wins). */
const APP_FONTS: Style[] = [
  ...new Map(
    [...TOKEN_CSS.join('\n').matchAll(/(--app-font-[\w-]+):\s*(\d{3})?\s*([\d.]+)px\s*\/\s*([\d.]+)px\s+([^;]+);/g)].map((m) => [
      m[1],
      { name: m[1], weight: Number(m[2] ?? 400), size: Number(m[3]), line: Number(m[4]), family: m[5].trim() },
    ]),
  ).values(),
];

const STYLES: Style[] = TOKENS_CONNECTOR?.textStyles
  ? TOKENS_CONNECTOR.textStyles.map((s) => ({ name: `--${s.name}`, weight: s.weight, size: s.size, line: s.line, family: familyOf(TOKEN_BLOCKS.all.get(s.name)), parts: s.parts }))
  : APP_FONTS;
/** The type scale's own variables (a connector's), with their values. */
const scaleVars = (names: string[] | undefined) => (names ?? []).flatMap((n) => (TOKEN_BLOCKS.all.has(n) ? [[`--${n}`, parseFloat(TOKEN_BLOCKS.all.get(n)!)] as const] : []));
const SIZES = scaleVars(TOKENS_CONNECTOR?.typeScale?.sizes);
const WEIGHTS = scaleVars(TOKENS_CONNECTOR?.typeScale?.weights);

/**
 * The styles at a text size and with Bold Text, as custom properties (none at the default size without bold). A line
 * height grows with its size.
 */
export function systemTextVars(system: TextSystem, textSize: string, bold: boolean): Record<string, string> {
  return textVarsFor({ styles: STYLES, sizes: SIZES, weights: WEIGHTS }, system, textSize, bold);
}

/** systemTextVars for given styles and type scale (theirs: the app's). */
export function textVarsFor(
  { styles, sizes = [], weights = [] }: { styles: Style[]; sizes?: readonly (readonly [string, number])[]; weights?: readonly (readonly [string, number])[] },
  system: TextSystem,
  textSize: string,
  bold: boolean,
): Record<string, string> {
  const step = textSizeFor(system, textSize);
  const scaled = step.scale !== 1;
  if (!scaled && !bold) return {};
  const size = (v: number) => (scaled ? round(scaleSize(system, step, v)) : v);
  const vars: Record<string, string> = {};
  // Sizes with no style (`calc(22px * var(--text-scale-display, 1))`): what the scale does to body text, and to
  // display text, which Android grows less.
  if (scaled) {
    vars['--text-scale'] = String(round(size(BODY) / BODY));
    vars['--text-scale-display'] = String(round(size(DISPLAY) / DISPLAY));
  }
  const weight = (w: number) => (bold ? boldWeight(w) : w);
  if (scaled) for (const [k, v] of sizes) vars[k] = `${size(v)}px`;
  if (bold) for (const [k, w] of weights) vars[k] = String(weight(w));
  for (const s of styles) {
    const fs = size(s.size);
    const lh = round((s.line * fs) / s.size);
    vars[s.name] = `${weight(s.weight)} ${fs}px/${lh}px ${s.family}`;
    // A style's parts, for what's written with them (`font-size: var(--label-m-size)`).
    if (scaled && s.parts?.size) vars[`--${s.parts.size}`] = `${fs}px`;
    if (scaled && s.parts?.line) vars[`--${s.parts.line}`] = `${lh}px`;
    if (bold && s.parts?.weight) vars[`--${s.parts.weight}`] = String(weight(s.weight));
  }
  return vars;
}
