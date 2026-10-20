// The app's text styles (its `--app-font-*` tokens) under the system's text settings (sim/systemText): the custom
// properties a screen sets on its root so every text written with a style follows the size the user picked and Bold
// Text. A size written in px doesn't: that's how a fixed size shows.
import kitCss from '../kit/tokens.css?raw';
import { boldWeight, scaleSize, textSizeFor, type TextSystem } from '../sim/systemText';

const appCss = Object.values(import.meta.glob('../app/**/theme.css', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>).join('\n');

/** The sizes the two scales for off-style text are taken at: body text, and display text. */
const BODY = 15;
const DISPLAY = 30;

const round = (n: number) => Math.round(n * 100) / 100;

/** `--app-font-body: 400 16px/22px Inter, …` → its weight, size, line height and family (the app's last wins). */
const STYLES = [
  ...new Map(
    [...(kitCss + '\n' + appCss).matchAll(/(--app-font-[\w-]+):\s*(\d{3})?\s*([\d.]+)px\s*\/\s*([\d.]+)px\s+([^;]+);/g)].map((m) => [
      m[1],
      { name: m[1], weight: Number(m[2] ?? 400), size: Number(m[3]), line: Number(m[4]), family: m[5].trim() },
    ]),
  ).values(),
];

/**
 * The styles at a text size and with Bold Text, as custom properties (none at the default size without bold). A line
 * height grows with its size.
 */
export function systemTextVars(system: TextSystem, textSize: string, bold: boolean): Record<string, string> {
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
  for (const s of STYLES) {
    const fs = size(s.size);
    vars[s.name] = `${bold ? boldWeight(s.weight) : s.weight} ${fs}px/${round((s.line * fs) / s.size)}px ${s.family}`;
  }
  return vars;
}
