// Where a sheet that floats by its control (a drop-down, a popover) hangs from: the tapped control's counterpart on
// another screen of the canvas showing the same sheet (Compare, light and dark side by side, a device set to another
// version), so a ⋯ a phone opened is found on the tablet beside it; and that control's box in its screen.
import type { AnchorRect } from '../kit';

/** What a control can be (sim/sheetPresentation's tappedControl reads the same). */
const CONTROLS = 'button, a, [role="button"], [role="menuitem"]';

/** A control's name as a screen reader says it: its label, its tooltip, or its text. */
function nameOf(el: Element): string {
  return (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
}

/**
 * `el`'s counterpart in `screen`: the control with the same name, in the same order among those with that name ("Lunch
 * options", the second "Remove"), which holds across layouts (a phone's tab bar and a tablet's rail build their screens
 * apart); or, for a control with no name, or a name the screens have a different number of, the element at the same
 * place in the tree (two of the same device). Null where neither finds it.
 */
export function counterpartIn(el: HTMLElement, screen: HTMLElement): HTMLElement | null {
  const own = el.closest('[data-device-screen]');
  if (!own) return null;
  const name = el.matches(CONTROLS) ? nameOf(el) : '';
  if (name) {
    const named = (root: Element) => [...root.querySelectorAll<HTMLElement>(CONTROLS)].filter((c) => nameOf(c) === name);
    const mine = named(own);
    const theirs = named(screen);
    if (theirs.length === mine.length && mine.includes(el)) return theirs[mine.indexOf(el)];
  }
  const path: number[] = [];
  for (let n: Element = el; n !== own && n.parentElement; n = n.parentElement) path.unshift(Array.prototype.indexOf.call(n.parentElement.children, n));
  let m: Element | undefined = screen;
  for (const i of path) m = m?.children[i];
  return m instanceof HTMLElement ? m : null;
}

/**
 * An element's box within the device screen as it shows: offsets (so the canvas scale, zoom and frame rotation don't
 * matter), less how far the page and any list it's in have scrolled.
 */
export function boxInScreen(el: HTMLElement): AnchorRect | null {
  const root = el.closest('[data-theme]');
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n && n !== root; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
    if (!n.offsetParent) return null;
  }
  for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
    x -= p.scrollLeft;
    y -= p.scrollTop;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}
