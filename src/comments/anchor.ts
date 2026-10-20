// Where a pin goes on the device: anchored to the component under the click (found again by its name and order in the
// page), so it follows it when the screen scrolls or the layout changes; else at the same point of the page.
import { componentInstance } from '../design/component';
import { SHEET_ATTR } from '../sim/sheetLinks';
import type { CommentAnchor } from './types';

/** The page layers carry their page id (sim/DeviceScreen). */
export const PAGE_ATTR = 'data-page-id';

/**
 * A device frame on the canvas (one, in a set, side by side): which device and display it is, and the version it shows
 * when it isn't the toolbar's (a set's device can show its own: `live`, `PJ-12`, `PJ-12~b`). Comments are left on it
 * and their pins show on it.
 */
export interface CanvasScreen {
  device: string;
  display: string;
  design?: string;
}

export function screenAttrs(s: CanvasScreen): Record<string, string> {
  return { 'data-comment-device': s.device, 'data-comment-display': s.display, ...(s.design ? { 'data-comment-design': s.design } : {}) };
}

/** The device frame an element is on, and the frame's element. */
export function screenOf(el: Element): { el: HTMLElement; screen: CanvasScreen } | null {
  const f = el.closest<HTMLElement>('[data-comment-device]');
  if (!f) return null;
  return { el: f, screen: { device: f.dataset.commentDevice!, display: f.dataset.commentDisplay ?? '', design: f.dataset.commentDesign } };
}

/** Every device frame inside a canvas, in order. */
export function screensIn(stage: Element): { el: HTMLElement; screen: CanvasScreen }[] {
  return [...stage.querySelectorAll<HTMLElement>('[data-comment-device]')].map((f) => screenOf(f)!);
}

/** Whether a pin left on a device shows on a frame: the same device and display, or any when it names none. */
export const showsOn = (a: Pick<CommentAnchor, 'device' | 'display'>, s: CanvasScreen) => !a.device || (a.device === s.device && (!a.display || a.display === s.display));

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const frac = (v: number, from: number, size: number) => (size > 0 ? Math.min(1, Math.max(0, (v - from) / size)) : 0);

/** A point in a box, as fractions of it (0–1, clamped). */
export function fractionIn(r: Rect, x: number, y: number): { fx: number; fy: number } {
  return { fx: frac(x, r.left, r.width), fy: frac(y, r.top, r.height) };
}

/** The point at fractions of a box. */
export function pointIn(r: Rect, fx: number, fy: number): { x: number; y: number } {
  return { x: r.left + fx * r.width, y: r.top + fy * r.height };
}

const nameOf = (el: Element) => componentInstance((el as HTMLElement).dataset.hc)?.name ?? null;

/**
 * The instrumented elements of one name in a page, in document order; for `overlay`, those over the pages of the screen
 * instead (`scope` is then the device frame).
 */
function instances(scope: Element, name: string, overlay = false): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>('[data-hc]')].filter((el) => nameOf(el) === name && (!overlay || !el.closest(`[${PAGE_ATTR}]`)));
}

/** The page on top of a device frame's stack: the last page layer that isn't hidden under another. */
function topPage(frame: Element): HTMLElement | null {
  const all = [...frame.querySelectorAll<HTMLElement>(`[${PAGE_ATTR}]`)].filter((el) => el.style.visibility !== 'hidden');
  return all[all.length - 1] ?? null;
}

/**
 * The anchor for a click at (x, y) on `target`, on the device frame `frame`. Null where there's no page (a boot page).
 * A sheet, dialog or popover isn't inside its page's layer — it goes over the whole screen (sim/screenLayer) — so a
 * click on one is on the page under it, and its pin follows the overlay's component (`overlay`).
 */
export function anchorAt(frame: Element, target: Element, x: number, y: number): { page: string; anchor: CommentAnchor } | null {
  const own = target.closest<HTMLElement>(`[${PAGE_ATTR}]`);
  const pageEl = own && frame.contains(own) ? own : topPage(frame);
  const page = pageEl?.getAttribute(PAGE_ATTR);
  if (!pageEl || !page) return null;
  const overlay = !own;
  // On a sheet with an id, its components are counted in it (anchorElement finds them there again).
  const sheetEl = overlay ? target.closest(`[${SHEET_ATTR}]`) : null;
  const sheet = sheetEl?.getAttribute(SHEET_ATTR);
  const scope = sheetEl ?? (overlay ? frame : pageEl);
  const { fx, fy } = fractionIn(pageEl.getBoundingClientRect(), x, y);
  const hit = target.closest('[data-hc]');
  const name = hit && scope.contains(hit) ? nameOf(hit) : null;
  // Off any component, a pin stays at its point of the page (an overlay's too: there's nothing of it to follow).
  if (!hit || !name) return { page, anchor: { component: null, nth: 0, ox: 0, oy: 0, x: fx, y: fy } };
  const o = fractionIn(hit.getBoundingClientRect(), x, y);
  const nth = Math.max(0, instances(scope, name, overlay).indexOf(hit as HTMLElement));
  // Which sheet, when it has an id: opening the comment opens it again (sim/sheetLinks).
  return { page, anchor: { component: name, nth, ox: o.fx, oy: o.fy, x: fx, y: fy, ...(overlay ? { overlay: true } : {}), ...(sheet ? { sheet } : {}) } };
}

/** The page layer of a page on the screen (the topmost, if it's in the stack twice). */
export function pageLayer(screen: Element, page: string): HTMLElement | null {
  const all = screen.querySelectorAll<HTMLElement>(`[${PAGE_ATTR}="${CSS.escape(page)}"]`);
  return all[all.length - 1] ?? null;
}

/** The page layers stacked over `pageEl` on its frame (after it, in order): a pin under one of them doesn't show. */
export function pagesAbove(frame: Element, pageEl: HTMLElement): HTMLElement[] {
  return [...frame.querySelectorAll<HTMLElement>(`[${PAGE_ATTR}]`)].filter((el) => el !== pageEl && !!(pageEl.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) && !pageEl.contains(el));
}

/** Whether a point is under one of these layers (shown, and over it). */
export function coveredAt(layers: HTMLElement[], x: number, y: number): boolean {
  return layers.some((el) => {
    if (!el.isConnected || el.style.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  });
}

/**
 * The element a pin follows: its component when it's still there, else its page. Null for a pin on an overlay that
 * isn't open: it shows again with it.
 */
export function anchorElement(frame: Element, pageEl: HTMLElement, a: CommentAnchor): { el: HTMLElement; onComponent: boolean } | null {
  // A sheet is its page's while that page is on top, and its pin is on that sheet (by its id) when it has one.
  if (a.overlay && topPage(frame) !== pageEl) return null;
  const sheet = a.overlay && a.sheet ? frame.querySelector(`[${SHEET_ATTR}="${CSS.escape(a.sheet)}"]`) : null;
  if (a.overlay && a.sheet && !sheet) return null;
  const el = a.component ? instances(sheet ?? (a.overlay ? frame : pageEl), a.component, a.overlay)[a.nth] : undefined;
  if (el) return { el, onComponent: true };
  return a.overlay ? null : { el: pageEl, onComponent: false };
}
