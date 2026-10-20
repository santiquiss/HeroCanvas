// What an agent's shot does on the screens before the picture (`npm run shot`, scripts/shot.mjs): tap a text, type in
// a field, scroll, wait. The same steps on every frame of the shot (light and dark), except what they share: the
// navigation and the overlays (sheets, dialogs) are one for all the frames, so a step whose effect already shows on
// the others isn't repeated there.

export type ShotStep =
  /** Taps the element with this text (exact, else the smallest that contains it), or a CSS selector as `css:…`. */
  | { click: string }
  /** Types into a field: `into` (a CSS selector), else the focused one, else the first. Replaces its value. */
  | { fill: string; into?: string }
  /** Puts the focus in a field (the system keyboard shows): `into`, else the first. */
  | { focus: true; into?: string }
  /** Scrolls the screen's scrolling areas (or the one `in` selects) to `y` points, or to their end. */
  | { scroll: number | 'end'; in?: string }
  /** Waits, in milliseconds. */
  | { wait: number };

const FIELDS = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea';
const CLICKABLE = 'button, a, [role=button], [role=tab], [role=menuitem], [role=option], [role=switch], [role=checkbox], label';

/** The element `target` names inside `root`: `css:` a selector, else a text. */
export function findTarget(root: Element, target: string): HTMLElement | null {
  if (target.startsWith('css:')) return root.querySelector<HTMLElement>(target.slice(4));
  const want = target.replace(/\s+/g, ' ').trim();
  const clickable = (el: HTMLElement) => {
    const c = el.closest<HTMLElement>(CLICKABLE);
    return c && root.contains(c) ? c : null;
  };
  const exact: HTMLElement[] = [];
  let containing: HTMLElement | null = null;
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text.includes(want)) continue;
    if (text === want) exact.push(el);
    // In document order a later match inside the current one is deeper: the smallest that contains the text.
    else if (!containing || containing.contains(el)) containing = el;
  }
  // The same text twice (a title and its button): the one that can be tapped.
  const hit = exact.find(clickable) ?? exact.at(-1) ?? containing;
  return hit ? (clickable(hit) ?? hit) : null;
}

/** A tap: the pointer events the screens' gestures listen to, then the click. */
export function tap(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, isPrimary: true, button: 0 };
  el.dispatchEvent(new PointerEvent('pointerdown', at));
  el.dispatchEvent(new PointerEvent('pointerup', at));
  el.click();
}

/** Sets a field's value as typing would: React reads it from its `input` event. */
export function fillField(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function field(root: Element, into?: string) {
  if (into) return root.querySelector<HTMLInputElement | HTMLTextAreaElement>(into);
  const active = document.activeElement;
  if (active && root.contains(active) && active.matches(FIELDS)) return active as HTMLInputElement;
  return root.querySelector<HTMLInputElement | HTMLTextAreaElement>(FIELDS);
}

/** The areas that scroll inside `root`. */
function scrollers(root: Element, selector?: string): HTMLElement[] {
  if (selector) return [...root.querySelectorAll<HTMLElement>(selector)];
  return [...root.querySelectorAll<HTMLElement>('*')].filter((el) => {
    const oy = getComputedStyle(el).overflowY;
    return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1;
  });
}

/** Does one step on one frame. Throws when what it names isn't there. */
export function runStep(root: HTMLElement, step: ShotStep) {
  if ('click' in step) {
    const el = findTarget(root, step.click);
    if (!el) throw new Error(`Can't find "${step.click}" on the screen`);
    tap(el);
  } else if ('fill' in step) {
    const el = field(root, step.into);
    if (!el) throw new Error(`No field${step.into ? ` "${step.into}"` : ''} on the screen`);
    fillField(el, step.fill);
  } else if ('focus' in step) {
    const el = field(root, step.into);
    if (!el) throw new Error(`No field${step.into ? ` "${step.into}"` : ''} on the screen`);
    el.focus();
  } else if ('scroll' in step) {
    for (const el of scrollers(root, step.in)) el.scrollTop = step.scroll === 'end' ? el.scrollHeight : step.scroll;
  }
}

/** A cheap fingerprint of what a frame shows, to tell whether a step on another frame reached it too. */
export function fingerprint(el: Element): string {
  const html = el.innerHTML;
  let h = 0;
  for (let i = 0; i < html.length; i++) h = (Math.imul(h, 31) + html.charCodeAt(i)) | 0;
  return `${html.length}:${h}`;
}
