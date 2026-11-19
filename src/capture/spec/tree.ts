// A screen's structure as data, for a proposal's spec (`npm run spec`): what Layers and Inspect show, read from the
// DOM once and written out so an agent can read the screen without running it. Every node says what it is (a component
// by its code name and props, or a row, a column, a text, an icon…), where it is (device points, from the screen's top
// left) and how it's built (its layout, spacing, fill, corner, text style: by token where the stylesheets name one).
import { componentInstance } from '../../design/component';
import { colorSource, type ColorProp } from '../../design/colorSource';
import { declaredValue } from '../../design/declared';
import { flexAlignment, groupLayout, layerKind, mixesText, showing, textOf, unseen } from '../../design/element';
import { declaredTextStyle } from '../../design/textStyles';
import { findToken } from '../../design/tokenCatalog';
import { colorTokens, isVisibleColor, type ColorRole } from '../../design/tokens';

export interface SpecNode {
  /** A page, a component, or a layer by its kind (a group by how it lays out: row, column, grid, box). */
  type: 'page' | 'component' | 'row' | 'column' | 'grid' | 'box' | 'container' | 'text' | 'icon' | 'image' | 'graphic' | 'shape';
  /** The component's name in the code, or the page's id. */
  name?: string;
  /** A component's props, as the code's would get them (callbacks and widgets as words). */
  props?: Record<string, unknown>;
  /** x, y, width, height in device points, from the screen's top left. */
  box: [number, number, number, number];
  /** A text's words; an icon's symbol. */
  text?: string;
  /** How it's built: only what's set. A value with a token reads `16 (spacingDimensions.x2)`. */
  style?: Record<string, string>;
  children?: SpecNode[];
}

const round = (n: number) => Math.round(n * 10) / 10;
const px = (v: string) => round(parseFloat(v) || 0);

/** A variable as the code names its token, else the variable's own name. */
const tokenName = (name: string) => {
  const t = findToken(name);
  return t?.code ?? t?.name ?? name.replace(/^--/, '');
};

/** A variable that is a token: in the catalog, or one of the app's scales (`--mf-space-x2`). Not a screen's own (`--padL`). */
const isToken = (name: string) => !!findToken(name) || /^--(mf|app)-/.test(name);

/**
 * A measure with the tokens its rule names: `16 (spacing.x2)`, `0 12 (0 spacing.x1-5)`. Only for a rule written with
 * tokens and plain numbers: one that computes (`calc(…)`) isn't a token's value.
 */
const withToken = (measure: string, declared: string | null) => {
  const parts = declared?.trim().split(/\s+/) ?? [];
  if (!parts.some((p) => p.startsWith('var(')) || !parts.every((p) => (/^var\(--[\w-]+\)$/.test(p) && isToken(p.slice(4, -1))) || /^-?[\d.]+(px)?$/.test(p))) return measure;
  return `${measure} (${parts.map((p) => (p.startsWith('var(') ? tokenName(p.slice(4, -1)) : p.replace(/px$/, ''))).join(' ')})`;
};

/** A color with where it comes from: the token (as the code names it), else the value. */
function color(el: Element, prop: ColorProp, value: string, theme: 'light' | 'dark'): string {
  const src = colorSource(el, prop, theme);
  if (src.kind === 'code' || src.kind === 'figma') return `${src.token.code ?? src.token.name}${src.alpha != null ? ` at ${Math.round(src.alpha * 100)}%` : ''}`;
  // No rule names one: the token with that value, if there is one (a guess by value, said as such).
  const role: ColorRole = prop === 'color' ? 'text' : prop === 'border-color' ? 'border' : 'fill';
  const byValue = colorTokens(value, theme, role)[0];
  return byValue ? `${tokenName(byValue)} (by value)` : value;
}

/** A box's four sides as one value when they're equal, else top right bottom left. */
const sides = (t: number, r: number, b: number, l: number) => (t === r && r === b && b === l ? `${t}` : t === b && r === l ? `${t} ${r}` : `${t} ${r} ${b} ${l}`);

function styleOf(el: Element, type: SpecNode['type'], theme: 'light' | 'dark'): Record<string, string> | undefined {
  const cs = getComputedStyle(el);
  const out: Record<string, string> = {};
  if (type === 'text' || type === 'icon') {
    if (type === 'text') {
      const ts = declaredTextStyle(el);
      out.textStyle = ts.style ? ts.style.code : `${px(cs.fontSize)}${cs.lineHeight === 'normal' ? '' : `/${px(cs.lineHeight)}`} ${cs.fontWeight}`;
      if (ts.style && ts.weight != null && ts.weight !== ts.style.weight) out.weight = String(ts.weight);
      if (cs.textAlign !== 'start' && cs.textAlign !== 'left') out.align = cs.textAlign;
    } else out.size = `${px(cs.fontSize)}`;
    out.color = color(el, 'color', cs.color, theme);
    return out;
  }
  const flex = cs.display.includes('flex');
  const grid = cs.display.includes('grid');
  if (flex || grid) {
    const gap = px(cs.rowGap === 'normal' ? '0' : flex && !cs.flexDirection.startsWith('column') ? cs.columnGap : cs.rowGap);
    if (gap) out.gap = withToken(`${gap}`, declaredValue(el, 'gap'));
    if (flex) {
      const a = flexAlignment(cs);
      if (a.main !== 'start') out.main = a.main;
      if (a.cross !== 'stretch') out.cross = a.cross;
      if (cs.flexWrap !== 'nowrap') out.wrap = 'true';
    }
  }
  const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map(px);
  if (pad.some(Boolean)) out.padding = withToken(sides(pad[0], pad[1], pad[2], pad[3]), declaredValue(el, 'padding'));
  if (isVisibleColor(cs.backgroundColor)) out.fill = color(el, 'background-color', cs.backgroundColor, theme);
  else if (cs.backgroundImage !== 'none') out.fill = cs.backgroundImage.startsWith('url') ? 'image' : 'gradient';
  const bw = px(cs.borderTopWidth);
  if (bw && cs.borderTopStyle !== 'none' && isVisibleColor(cs.borderTopColor)) out.border = `${bw} ${color(el, 'border-color', cs.borderTopColor, theme)}`;
  const radius = px(cs.borderTopLeftRadius);
  if (radius) out.radius = withToken(radius >= Math.min(el.clientWidth, el.clientHeight) / 2 && radius > 100 ? 'full' : `${radius}`, declaredValue(el, 'border-radius'));
  if (cs.boxShadow !== 'none') out.shadow = 'true';
  if (px(cs.opacity) !== 1) out.opacity = cs.opacity;
  if (/auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) out.scrolls = 'vertical';
  else if (/auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) out.scrolls = 'horizontal';
  // Pinned while its page scrolls (a header). How the mirror places the rest (absolute, fixed) isn't the app's.
  if (cs.position === 'sticky') out.pinned = 'true';
  if (el.matches('[disabled], [aria-disabled="true"]')) out.disabled = 'true';
  return Object.keys(out).length ? out : undefined;
}

/** A prop as data: what a reader can use of it. A callback only says it's set (the thing can be tapped). */
function plain(v: unknown, depth = 0): unknown {
  if (v == null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  // A color or a size given as the mirror's variable: the token it is.
  if (typeof v === 'string' && /^var\(--[\w-]+\)$/.test(v)) return tokenName(v.slice(4, -1));
  if (typeof v === 'string') return v.length > 200 ? `${v.slice(0, 200)}…` : v;
  if (typeof v === 'function') return '(callback)';
  if (typeof v !== 'object') return String(v);
  if ('$$typeof' in (v as object)) return '(widget)';
  if (depth > 2) return '…';
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => plain(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as object)) {
    const p = plain(x, depth + 1);
    if (p !== undefined) out[k] = p;
  }
  return out;
}

function propsOf(props: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) if (v !== undefined && k !== 'children') out[k] = plain(v);
  return Object.keys(out).length ? out : undefined;
}

const GROUP = { Row: 'row', Column: 'column', Grid: 'grid', Box: 'box' } as const;

/** A screen (a shot's frame) as a tree. `theme` names the colors' tokens. */
export function screenTree(screen: HTMLElement, theme: 'light' | 'dark'): SpecNode[] {
  const origin = screen.getBoundingClientRect();
  const boxOf = (el: Element): SpecNode['box'] => {
    const r = el.getBoundingClientRect();
    return [round(r.left - origin.left), round(r.top - origin.top), round(r.width), round(r.height)];
  };
  // Inside the screen: what's scrolled out of it, or in a page that's off it, isn't on the picture, but is still the
  // screen's content (a list's rows below the fold), so it stays in.
  /** Outside the pages (the nav, a banner): under a page drawn over it, so not on the screen. */
  const covered = (el: Element) => {
    if (el.closest('[data-hc-page]')) return false;
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && !el.contains(top) && !top.contains(el) && !!top.closest('[data-hc-page]');
  };
  const walk = (el: Element): SpecNode[] => {
    const out: SpecNode[] = [];
    for (const c of el.children) {
      const h = c as HTMLElement;
      // The device's own (its status bar, its home indicator): not the app's to build.
      if (h.dataset?.hcSystem != null) continue;
      if (h.dataset?.hcPage) {
        if (showing(h)) out.push({ type: 'page', name: h.dataset.hcPage, box: boxOf(h), children: walk(h) });
        continue;
      }
      if (unseen(c)) continue;
      const r = c.getBoundingClientRect();
      // Nothing to see: a box with no size and nothing in it, or one a page covers.
      if ((r.width === 0 || r.height === 0) && !c.querySelector('[data-hc], [data-hc-page]') && !(c.textContent ?? '').trim()) continue;
      if ((h.dataset?.hc || c.childElementCount) && covered(c)) continue;
      const inst = componentInstance(h.dataset?.hc);
      if (inst) {
        const kids = walk(c);
        out.push({ type: 'component', name: inst.name, props: propsOf(inst.props), box: boxOf(c), style: styleOf(c, 'container', theme), ...(kids.length ? { children: kids } : {}) });
        continue;
      }
      const kind = layerKind(c);
      // A box around a single thing adds nothing to read (as in Layers), unless it paints or pads.
      if (kind === 'group' && c.childElementCount <= 1 && !mixesText(c) && !styleOf(c, 'box', theme)) {
        out.push(...walk(c));
        continue;
      }
      if (kind === 'text' || kind === 'icon') out.push({ type: kind, box: boxOf(c), text: textOf(c), style: styleOf(c, kind, theme) });
      else if (kind === 'image' || kind === 'graphic') out.push({ type: kind, box: boxOf(c), ...(c.getAttribute('alt') || c.getAttribute('aria-label') ? { text: (c.getAttribute('alt') || c.getAttribute('aria-label'))! } : {}) });
      else {
        const type = kind === 'group' ? GROUP[groupLayout(c)] : kind;
        const kids = kind === 'shape' ? [] : walk(c);
        // A text beside other things in its box, with no element of its own: its words, on the box.
        const loose = mixesText(c) ? textOf(c) : undefined;
        out.push({ type, box: boxOf(c), ...(loose ? { text: loose } : {}), style: styleOf(c, type, theme), ...(kids.length ? { children: kids } : {}) });
      }
    }
    return out;
  };
  return walk(screen);
}
