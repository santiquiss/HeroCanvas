// Putting a screen back as Interact with the screen left it: its lists' scroll and the taps that left something open.
// No React or styles here: the dev server's headless Chrome loads this module alone to draw a screenshot's screen
// (scripts/vite/screenCache.ts), as the canvas does.
import type { ScrollAt, Tap } from './shots';

/** What can scroll on a screen, in the document's order: its lists, by where they are. */
export function scrollersIn(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('*')].filter((el) => {
    const cs = getComputedStyle(el);
    return /(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX);
  });
}

/** Each list's scroll that isn't at its start. */
export function readScroll(root: ParentNode): ScrollAt[] {
  return scrollersIn(root)
    .map((el, i) => ({ i, top: Math.round(el.scrollTop), left: Math.round(el.scrollLeft) }))
    .filter((s) => s.top || s.left);
}

/**
 * A scroll this far or further means the list's end, whatever its length on each size (a store image showing a page's
 * last section on every device), rather than room added to reach it.
 */
export const SCROLL_END = 99999;

/** Puts each list back where it was; whether all of them could be (a list not drawn yet can't). */
export function applyScroll(root: ParentNode, at: ScrollAt[]): boolean {
  if (!at.length) return true;
  const els = scrollersIn(root);
  let all = true;
  for (const s of at) {
    const el = els[s.i];
    if (!el) {
      all = false;
      continue;
    }
    // To its end (SCROLL_END): as far as the list goes on this size, no room added past it.
    if (s.top >= SCROLL_END) {
      el.scrollTop = el.scrollHeight;
      el.scrollLeft = s.left;
      continue;
    }
    roomFor(el, s.top);
    el.scrollTop = s.top;
    el.scrollLeft = s.left;
    if (Math.abs(el.scrollTop - s.top) > 1) all = false;
  }
  return all;
}

/**
 * A list shorter than a store image's scroll gets the room under its content to go that far (as a longer page would
 * have), so a screen whose content fits can still show what's below its top: a spacer at its end, set once.
 */
function roomFor(el: HTMLElement, top: number) {
  if (top <= 0) return;
  const existing = el.querySelector<HTMLElement>(':scope > [data-hc-room]');
  const base = el.scrollHeight - (existing?.offsetHeight ?? 0) - el.clientHeight;
  const need = Math.ceil(top - base);
  if (need <= 0) return existing?.remove();
  const room = existing ?? Object.assign(document.createElement('div'), { ariaHidden: 'true' });
  room.dataset.hcRoom = '';
  room.style.cssText = `flex: none; height: ${need}px; pointer-events: none;`;
  if (!existing) el.append(room);
}

/** The screen's root (DeviceScreen's): where a tap's place is counted from. */
export const screenRootIn = (root: ParentNode): Element | null => root.querySelector('[data-hc-screen]');

/** What can be tapped: a control, or what's made one. */
const TAPPABLE = 'button, a, input, select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], [tabindex]';
const labelOf = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
const sameAs = (screen: Element, tag: string, label: string) => [...screen.querySelectorAll(TAPPABLE)].filter((c) => c.tagName.toLowerCase() === tag && labelOf(c) === label);

/** A tap on the screen as what it tapped (the control it's in); null outside the screen or on no control. */
export function tapOf(screen: Element, target: Element): Tap | null {
  const el = target.closest(TAPPABLE);
  if (!el || !screen.contains(el)) return null;
  const tag = el.tagName.toLowerCase();
  const label = labelOf(el);
  return { tag, label, n: sameAs(screen, tag, label).indexOf(el) };
}

const TAP_WAIT_MS = 100;
const TAP_WAIT_TRIES = 25;

/** Taps a screen again, in order (each once the last has drawn what it opened); whether all were found. */
export async function replayTaps(root: ParentNode, taps: Tap[], alive: () => boolean = () => true): Promise<boolean> {
  let all = true;
  for (const tap of taps) {
    // A control the page draws a moment after its root (once its data or layout settles) is waited for, a little.
    let el: Element | undefined;
    for (let i = 0; !el && alive() && i < TAP_WAIT_TRIES; i++) {
      const screen = screenRootIn(root);
      el = screen ? sameAs(screen, tap.tag, tap.label)[tap.n] : undefined;
      if (!el) await new Promise((r) => setTimeout(r, TAP_WAIT_MS));
    }
    // A screen let go of meanwhile (drawn again) is tapped by its new copy, not twice.
    if (!alive()) return false;
    if (!el) {
      all = false;
      continue;
    }
    const opts = { bubbles: true, cancelable: true, composed: true };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    (el as HTMLElement).click();
    // What it opened, drawn (a sheet's content mounts a frame or two later).
    await new Promise((r) => setTimeout(r, 120));
  }
  return all;
}
