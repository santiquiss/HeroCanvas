// An element picked on its own in Inspect (not a component instance): what kind of layer it is, in a layout vocabulary
// every stack shares (Row, Column, Text, Image; sizes as Fill, Hug or Fixed, as a design tool says them),
// and the layers a component is made of (Layers' drill-down).
import { CATALOG } from './catalog';
import { componentTier } from './figma';
import { t } from '../i18n/ui';

/**
 * - `text`: it holds text itself.
 * - `icon`: an icon font's glyph.
 * - `image`: a picture (img, canvas, video).
 * - `graphic`: a drawing as a whole (an `<svg>`: a chart, an illustration); `shape` is a piece inside one.
 * - `shape`: a box that only paints — a dot, a bar, a divider, a swatch — with nothing in it. Figma's Rectangle or
 *   Ellipse; in code a `DecoratedBox` / `ColoredBox`.
 * - `container`: a box that paints (a fill, a border, a shadow) and has content. Figma's Frame with a fill; in code a
 *   `Container`.
 * - `group`: a box that only lays out its children, named by how: Row, Column, Grid, or Box.
 */
export type ElementKind = 'text' | 'icon' | 'image' | 'graphic' | 'shape' | 'container' | 'group';

const LABEL: Record<Exclude<ElementKind, 'group'>, string> = { text: t('Text'), icon: t('Icon'), image: t('Image'), graphic: t('Graphic'), shape: t('Shape'), container: t('Container') };

/** Material Symbol for a kind (Layers). */
export const KIND_ICON: Record<ElementKind, string> = { text: 'title', icon: 'star', image: 'image', graphic: 'show_chart', shape: 'circle', container: 'crop_square', group: 'view_agenda' };

/** Whether the element has a text node of its own (not only in its children). */
export function hasOwnText(el: Element): boolean {
  return [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim());
}

const painted = (c: string) => !!c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)';

// A link in a text is one of its runs (a TextSpan with a tap).
const PHRASING = new Set(['SPAN', 'B', 'STRONG', 'EM', 'I', 'SMALL', 'SUB', 'SUP', 'MARK', 'A']);
const isIconFont = (cs: CSSStyleDeclaration) => cs.fontFamily.includes('Material Symbols');

/**
 * A run of a text (a TextSpan): an inline element with only text in it — a bold count, a muted "/ 12 done" —
 * not an icon, a dot or a box.
 */
export function isTextSpan(el: Element): boolean {
  if (!(el instanceof HTMLElement) || !PHRASING.has(el.tagName) || el.childElementCount || !el.textContent?.trim()) return false;
  const cs = getComputedStyle(el);
  return !isIconFont(cs) && (cs.display === 'inline' || cs.display === '');
}

/**
 * Text beside something that isn't text (a button's icon and its label, a legend's dot and its name). The code has no
 * loose text: that's a Row with an Icon and a Text, so the box is what arranges them. The app's code gives every such
 * text an element of its own (src/test/looseText.test.tsx); Layers still shows one that's loose as a layer of its own.
 * Text with runs of text beside it ("**3** tasks left today") is one text, a Text.rich.
 */
/** An inline run with nothing in it (a `<b>` around a value that's empty): nothing on screen, nothing beside the text. */
const isEmptyRun = (el: Element) => PHRASING.has(el.tagName) && !el.childElementCount && !el.textContent?.trim();

export const mixesText = (el: Element) => el instanceof HTMLElement && el.childElementCount > 0 && hasOwnText(el) && [...el.children].some((c) => !isTextSpan(c) && !isEmptyRun(c));

export function elementKind(el: Element): ElementKind {
  if (el instanceof SVGSVGElement) return 'graphic';
  if (el instanceof SVGElement) return 'shape';
  if (el instanceof HTMLImageElement || el instanceof HTMLCanvasElement || el instanceof HTMLVideoElement) return 'image';
  const cs = getComputedStyle(el);
  if (hasOwnText(el) && !mixesText(el)) return isIconFont(cs) ? 'icon' : 'text';
  return boxKind(el, cs);
}

/** The kind it shows as in Layers and Inspect. */
export const layerKind = elementKind;

/** A text layer's words: all of a Text.rich's runs; a loose text's own words, without what's beside it. */
export const textOf = (el: Element) => (mixesText(el) ? ownText(el) : (el.textContent ?? '').trim());

/** What a box is apart from any text of its own: a container when it paints, a shape when it's empty, else a group. */
export function boxKind(el: Element, cs: CSSStyleDeclaration = getComputedStyle(el)): ElementKind {
  const border = cs.borderStyle !== 'none' && cs.borderWidth !== '0px';
  const paints = painted(cs.backgroundColor) || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none' || border;
  if (!paints) return 'group';
  return el.childElementCount ? 'container' : 'shape';
}

/** The layer's name: its kind, a group by its layout (Row, Column, Grid; Box when it's none of them). */
export function kindLabel(el: Element, kind: ElementKind = layerKind(el)): string {
  return kind !== 'group' ? LABEL[kind] : GROUP_LABEL[groupLayout(el)];
}

/** How a group lays out its children, in English (an icon's key): Row, Column, Grid, or Box when it's none of them. */
export type GroupLayout = 'Row' | 'Column' | 'Grid' | 'Box';

export function groupLayout(el: Element): GroupLayout {
  const cs = getComputedStyle(el);
  if (cs.display.includes('flex')) return cs.flexDirection.startsWith('column') ? 'Column' : 'Row';
  return cs.display.includes('grid') ? 'Grid' : 'Box';
}

const GROUP_LABEL: Record<GroupLayout, string> = { Row: t('Row'), Column: t('Column'), Grid: t('Grid'), Box: t('Box') };

/** The element's size in device points: its layout box, or (an SVG shape, which has none) what it measures at `scale`. */
export function elementSize(el: Element, scale: number): { w: number; h: number } {
  if (el instanceof HTMLElement) return { w: el.offsetWidth, h: el.offsetHeight };
  const r = el.getBoundingClientRect();
  const round = (v: number) => Math.round((v / scale) * 10) / 10;
  return { w: round(r.width), h: round(r.height) };
}

/** A shape's corners: fully round (a circle, a pill), rounded, or square. */
export type Corners = 'full' | 'rounded' | 'square';

/** How a shape's corners are cut: a radius of half its short side or more is fully round. */
export function shapeCorners(el: Element): Corners {
  if (el instanceof SVGCircleElement || el instanceof SVGEllipseElement) return 'full';
  const r = el.getBoundingClientRect();
  const half = Math.min(r.width, r.height) / 2;
  // An SVG rect's radius is its `rx`; a box's is its first corner's (px, or a share of its side).
  const raw = el instanceof SVGRectElement ? getComputedStyle(el).rx : el instanceof SVGElement ? '0' : getComputedStyle(el).borderTopLeftRadius;
  const first = (raw || '0').split(' ')[0];
  // Both on screen, where the frame is scaled: a share of the side as measured, px by the box's own scale.
  const scale = el instanceof HTMLElement && el.offsetWidth ? r.width / el.offsetWidth : 1;
  const radius = first.endsWith('%') ? (parseFloat(first) / 100) * r.width : (parseFloat(first) || 0) * scale;
  if (radius <= 0) return 'square';
  return radius >= half - 0.5 ? 'full' : 'rounded';
}

/** A layer's own text, for its row ("Breakfast"). */
export const ownText = (el: Element) =>
  [...el.childNodes]
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent?.trim())
    .filter(Boolean)
    .join(' ');


/** A component's kind (its catalog tier) as an icon: Layers' rows, the gallery's list. One not in the catalog: `widgets`. */
export const TIER_ICON: Record<string, string> = { atom: 'radio_button_checked', molecule: 'hub', organism: 'grid_view', token: 'palette' };

/** A component's icon by name: Figma's tier (as its page's badge), else the catalog's. */
export const componentIcon = (name: string) => TIER_ICON[componentTier(name) ?? CATALOG.get(name)?.tier ?? ''] ?? 'widgets';

/** Sides of a box placed by itself. */
export type Side = 'top' | 'right' | 'bottom' | 'left';
const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

/**
 * The sides an absolute or fixed box is anchored by, with their offsets (device points), as a Positioned
 * takes them; null for a box in its parent's layout. Read from the computed value (Typed OM), where an unset side is
 * still `auto`: getComputedStyle resolves it to where the box ended up (`top: 736px` for one pinned to the bottom).
 * Without Typed OM (Firefox), every side reads as set.
 */
export function anchors(el: Element): Partial<Record<Side, number>> | null {
  if (!(el instanceof HTMLElement)) return null;
  const cs = getComputedStyle(el);
  if (cs.position !== 'absolute' && cs.position !== 'fixed') return null;
  const typed = el.computedStyleMap?.();
  const out: Partial<Record<Side, number>> = {};
  for (const side of SIDES) {
    const v = typed ? typed.get(side)?.toString() : cs[side];
    if (v && v !== 'auto') out[side] = Math.round((parseFloat(cs[side]) || 0) * 10) / 10;
  }
  return out;
}

/** Whether a dimension is set (a width, a height) and not `auto`; null when it can't be told (no Typed OM). */
const declared = (el: HTMLElement, dim: 'width' | 'height'): boolean | null => {
  const v = el.computedStyleMap?.().get(dim)?.toString();
  return v == null ? null : v !== 'auto';
};

/** How a box is sized on an axis: stretched to its parent, its content's size, or set (Figma's Fill, Hug, Fixed). */
export type Sizing = 'fill' | 'hug' | 'fixed';

const px = (v: string) => parseFloat(v) || 0;

/**
 * Fill: it grows along a flex parent's main axis, or it's stretched across the parent's content box (the parent's
 * cross-axis stretch, a block's width). Hug: it measures what its content does. Fixed: anything else (a set width or height). The
 * content's size is measured by laying the box out once with an intrinsic size (inline styles set and restored, no
 * DOM change): done for the element Inspect shows, not for a tree.
 */
export function sizing(el: Element, axis: 'w' | 'h'): Sizing | null {
  const parent = el.parentElement;
  if (!(el instanceof HTMLElement) || !parent) return null;
  const cs = getComputedStyle(el);
  if (cs.display === 'inline') return 'hug';
  const pcs = getComputedStyle(parent);
  const w = axis === 'w';
  // Placed by itself: anchored on both sides of the axis, with no size of its own, it spans between them.
  const pinned = anchors(el);
  if (pinned && (w ? pinned.left != null && pinned.right != null : pinned.top != null && pinned.bottom != null) && declared(el, w ? 'width' : 'height') === false) return 'fill';
  const size = w ? el.offsetWidth : el.offsetHeight;
  const flex = pcs.display.includes('flex');
  const main = flex && w === pcs.flexDirection.startsWith('row');
  if (main && px(cs.flexGrow) > 0) return 'fill';
  const content = w ? parent.clientWidth - px(pcs.paddingLeft) - px(pcs.paddingRight) : parent.clientHeight - px(pcs.paddingTop) - px(pcs.paddingBottom);
  const margins = w ? px(cs.marginLeft) + px(cs.marginRight) : px(cs.marginTop) + px(cs.marginBottom);
  // Taking the parent's content box fills only where something stretches it: the parent's cross-axis stretch, or a
  // block's width. Elsewhere being as big as the parent is the parent hugging it (a row as tall as its buttons).
  const stretched = flex
    ? !main && ['stretch', 'normal', 'auto'].includes(cs.alignSelf) && ['stretch', 'normal'].includes(pcs.alignItems)
    : w && !pcs.display.includes('grid') && ['block', 'flex', 'grid', 'flow-root', 'list-item', 'table'].includes(cs.display);
  const absolute = cs.position === 'absolute' || cs.position === 'fixed';
  if (stretched && !absolute && Math.abs(size + margins - content) < 1) return 'fill';
  const saved = el.getAttribute('style');
  el.style.setProperty(w ? 'width' : 'height', w ? 'max-content' : 'auto', 'important');
  el.style.setProperty('flex', 'none', 'important');
  if (flex && !main) el.style.setProperty('align-self', 'flex-start', 'important');
  const intrinsic = w ? el.offsetWidth : el.offsetHeight;
  if (saved == null) el.removeAttribute('style');
  else el.setAttribute('style', saved);
  return Math.abs(intrinsic - size) < 1 ? 'hug' : 'fixed';
}

/** A flex box's alignment, along its axis (`main`) and across it (`cross`): start, center, end, spaceBetween… */
export function flexAlignment(cs: CSSStyleDeclaration): { main: string; cross: string } {
  const main: Record<string, string> = { center: 'center', 'flex-end': 'end', end: 'end', right: 'end', 'space-between': 'spaceBetween', 'space-around': 'spaceAround', 'space-evenly': 'spaceEvenly' };
  const cross: Record<string, string> = { 'flex-start': 'start', start: 'start', center: 'center', 'flex-end': 'end', end: 'end', baseline: 'baseline' };
  return { main: main[cs.justifyContent] ?? 'start', cross: cross[cs.alignItems] ?? 'stretch' };
}

/**
 * Whether a text's look depends on its box spanning the parent: centered, to the end or justified. An ellipsis doesn't:
 * a Text in code is cut at the width its parent allows it (maxLines, overflow), with no width of its own.
 */
function textUsesWidth(cs: CSSStyleDeclaration): boolean {
  const start = cs.direction === 'rtl' ? ['right', 'start'] : ['left', 'start', '-webkit-auto'];
  return !start.includes(cs.textAlign);
}

/**
 * A box's size on an axis, and how it gets it: Fill (the room left in its parent's row or column, stretched across
 * it, pinned to two sides, or its parent's size), Hug (its content's: nothing set), or Fixed (a set width or height).
 */
export function codeSizing(el: Element, axis: 'w' | 'h'): { sizing: Sizing; code: string } | null {
  const s = sizing(el, axis);
  if (!s || !(el instanceof HTMLElement)) return null;
  const w = axis === 'w';
  const cs = getComputedStyle(el);
  const pcs = getComputedStyle(el.parentElement!);
  const parentFlex = pcs.display.includes('flex');
  const parentMain = parentFlex && w === pcs.flexDirection.startsWith('row');
  const ownMain = cs.display.includes('flex') && w === cs.flexDirection.startsWith('row');
  const pinned = anchors(el);
  // A text that fills its parent only because CSS blocks do: aligned to the start, it reads the same at its own width
  // (and is cut at the parent's), as a Text with no width set is written.
  if (s === 'fill' && w && !pinned && !parentFlex && elementKind(el) === 'text' && !textUsesWidth(cs)) return { sizing: 'hug', code: t('Hug · its content') };
  // In words every stack has (a design tool's Fill, Hug, Fixed), and how: not one framework's names.
  const code = (() => {
    if (s === 'fill' && pinned) return w ? t('Fill · pinned to its parent’s left and right') : t('Fill · pinned to its parent’s top and bottom');
    if (s === 'fill') {
      if (parentMain && px(cs.flexGrow) > 0) return t('Fill · the room left in its parent');
      if (ownMain) return w ? t('Fill · its parent’s width') : t('Fill · its parent’s height');
      if (parentFlex && !parentMain) return t('Fill · stretched by its parent');
      return w ? t('Fill · its parent’s width') : t('Fill · its parent’s height');
    }
    if (s === 'hug') return t('Hug · its content');
    return t('Fixed · {size}', { size: w ? el.offsetWidth : el.offsetHeight });
  })();
  return { sizing: s, code };
}

/**
 * How a text gives way when it doesn't fit: how many lines it keeps, and whether it ends with “…” or is just cut: one line cut (`white-space: nowrap` with `text-overflow`), or several (`-webkit-line-clamp`). Read on the
 * text or the box that cuts it (a few levels up); `cut`: it's cut right now. Null when it just wraps.
 */
export function textOverflowOf(el: Element): { maxLines: number; overflow: 'ellipsis' | 'clip'; cut: boolean } | null {
  for (let at: Element | null = el, i = 0; at instanceof HTMLElement && i < 3; at = at.parentElement, i++) {
    const cs = getComputedStyle(at);
    const clamp = parseInt(cs.webkitLineClamp || cs.getPropertyValue('line-clamp'), 10);
    if (clamp > 0) return { maxLines: clamp, overflow: 'ellipsis', cut: at.scrollHeight > at.clientHeight + 1 };
    if (cs.overflowX !== 'visible' && (cs.whiteSpace === 'nowrap' || cs.whiteSpace === 'pre' || cs.textWrap === 'nowrap')) {
      return { maxLines: 1, overflow: cs.textOverflow === 'ellipsis' ? 'ellipsis' : 'clip', cut: at.scrollWidth > at.clientWidth + 1 };
    }
  }
  return null;
}
