// A proposal's walkthrough, as the panel and the marks read it: its stories' steps in one list, the one on screen (`?walk=`),
// and finding on a screen what a step points at.
import { fillField, hold, tap } from '../capture/shot/shotActions';
import { componentInstance } from '../design/component';
import type { WalkAction, WalkStep, WalkStory, WalkTarget } from '../proposals/types';

/** The step on screen, by its id; unset, no walkthrough. */
export const WALK_PARAM = 'walk';
/** `0`: its numbers hidden. */
export const WALK_MARKS_PARAM = 'walkmarks';

export interface FlatStep extends WalkStep {
  /** Its story, by place. */
  story: number;
  /** Its place in the story, from 1, and how many the story has. */
  n: number;
  of: number;
}

export const flatSteps = (stories: WalkStory[]): FlatStep[] => stories.flatMap((st, si) => st.steps.map((s, i) => ({ ...s, story: si, n: i + 1, of: st.steps.length })));

const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
const drawn = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
/** Not under something else (a sheet's shim, a dialog): what's at its middle is itself, or inside or around it. */
export function onTop(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!at && (el.contains(at) || at.contains(el));
}

/**
 * Its middle within the screen's own box: a row scrolled under the fold is clipped away, yet the browser's hit test may
 * still find it there.
 */
function inScreen(screen: Element, el: Element): boolean {
  const s = screen.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  return x >= s.left && x <= s.right && y >= s.top && y <= s.bottom;
}

/**
 * What draws an element: itself, or for a wrapper with no box of its own (`display: contents`, a component's root that
 * only marks it), its first child that has one.
 */
function boxed(el: Element): Element {
  if (el.getClientRects().length || getComputedStyle(el).display !== 'contents') return el;
  for (const child of el.children) {
    const b = boxed(child);
    if (b.getClientRects().length) return b;
  }
  return el;
}

/** Every element of a screen a target names, in the document's order. */
function candidates(screen: Element, target: WalkTarget): Element[] {
  if (target.startsWith('css:')) return [...screen.querySelectorAll(target.slice(4))].map(boxed);
  if (target.startsWith('component:')) {
    const name = target.slice(10);
    return [...screen.querySelectorAll<HTMLElement>('[data-hc]')].filter((el) => componentInstance(el.dataset.hc!)?.name === name).map(boxed);
  }
  // A text: the innermost elements that read exactly that.
  const all = [...screen.querySelectorAll('*')].filter((el) => norm(el.textContent) === target);
  return all.filter((el) => !all.some((other) => other !== el && el.contains(other)));
}

/** What a target points at on a screen: the first drawn and not covered (`#2`: the second), or nothing yet. */
export function findTarget(screen: Element, target: WalkTarget): Element | null {
  const nth = /#(\d+)$/.exec(target);
  const name = nth ? target.slice(0, nth.index) : target;
  const found = candidates(screen, name).filter((el) => drawn(el) && inScreen(screen, el) && onTop(el));
  return found[nth ? Number(nth[1]) - 1 : 0] ?? null;
}

/** Whether React gave the element a tap handler (its props, as React keeps them on the node). */
function takesTaps(el: Element): boolean {
  const key = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  const props = key ? (el as unknown as Record<string, { onClick?: unknown; onPointerDown?: unknown; onPointerUp?: unknown }>)[key] : null;
  return !!props && [props.onClick, props.onPointerDown, props.onPointerUp].some((f) => typeof f === 'function');
}

/**
 * What takes a tap on a target: the nearest thing around it with a tap of its own (a card for its title, the pencil
 * for itself, not the card the pencil's in), else the control or component it's in; the target itself when nothing
 * around it is that small (within the screen, and no taller than a part of it). Where a mark that goes on points its
 * line, and where a tap goes on from. The simulator draws its own pointer over the screens, so the cursor can't tell:
 * React's handler on the element does.
 */
export function tapArea(screen: Element, el: Element): Element {
  const s = screen.getBoundingClientRect();
  const fits = (at: Element) => {
    const r = at.getBoundingClientRect();
    return r.height <= s.height * 0.3 && r.width <= s.width;
  };
  for (let at: Element | null = el; at && at !== screen && screen.contains(at); at = at.parentElement) {
    if (takesTaps(at)) return fits(at) ? at : el;
  }
  const around = el.closest('button, a, [role="button"], [role="radio"], [data-hc]');
  return around && around !== screen && screen.contains(around) && fits(around) ? around : el;
}

/** The box of a target's tap area (`tapArea`): what a mark that goes on points at whole. */
export const markBox = (screen: Element, el: Element): DOMRect => tapArea(screen, el).getBoundingClientRect();

/**
 * The screens on the canvas, the selected device's first: where the numbers point and a step's actions are done (what
 * they open is the canvas's, so every device shows it). None selected (All devices): the first.
 */
export function screens(): Element[] {
  const all = [...document.querySelectorAll('[data-hc-screen]')];
  const active = all.find((el) => el.hasAttribute('data-hc-active'));
  return active ? [active, ...all.filter((el) => el !== active)] : all;
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** How long an action waits for what it names to show (a page coming in, a sheet rising), and how often it looks. */
const FIND_MS = 3000;
const LOOK_MS = 100;
/** How long a target must stay put before it's tapped. */
const STILL_MS = 120;
/** After an action, for what it opened to settle (a sheet's rise, a page's push). */
const SETTLE_MS = 450;
/** Between two letters typed. */
const LETTER_MS = 45;

const FIELDS = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea';
const TAPPABLE = 'button, a, label, [role=button], [role=tab], [role=radio], [role=switch], [role=checkbox], [role=option], [role=menuitem]';

/**
 * A target that's on the screen's page but scrolled out of its view (a row under the fold): brought into it, as a
 * person would scroll to it. False when there's none, or it's in view already (covered by something else, then).
 */
export function scrollToTarget(screen: Element, target: WalkTarget): boolean {
  const nth = /#(\d+)$/.exec(target);
  const name = nth ? target.slice(0, nth.index) : target;
  const el = candidates(screen, name).filter(drawn)[nth ? Number(nth[1]) - 1 : 0];
  if (!el) return false;
  const s = screen.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  // Sideways first: a card past a carousel's edge, brought in by the carousel.
  const midX = r.left + r.width / 2;
  if (midX < s.left || midX > s.right) {
    for (let at = el.parentElement; at && at !== screen && screen.contains(at); at = at.parentElement) {
      if (!/auto|scroll/.test(getComputedStyle(at).overflowX) || at.scrollWidth <= at.clientWidth + 1) continue;
      at.scrollBy({ left: midX - (s.left + s.width / 2), behavior: 'smooth' });
      return true;
    }
  }
  // In view and on top: nothing to do. In view but under something that floats over the page (the keyboard, a
  // floating input bar), it's scrolled to the middle too.
  if (r.top >= s.top && r.bottom <= s.bottom && onTop(el)) return false;
  // The area that scrolls around it, inside the screen (the page's list, a sheet's body), by as much as brings its
  // middle to the screen's.
  for (let at = el.parentElement; at && at !== screen && screen.contains(at); at = at.parentElement) {
    if (!/auto|scroll/.test(getComputedStyle(at).overflowY) || at.scrollHeight <= at.clientHeight + 1) continue;
    const by = r.top + r.height / 2 - (s.top + s.height / 2);
    const room = by > 0 ? at.scrollHeight - at.clientHeight - at.scrollTop : -at.scrollTop;
    if (Math.abs(room) < 1) continue;
    at.scrollBy({ top: by > 0 ? Math.min(by, room) : Math.max(by, room), behavior: 'smooth' });
    return true;
  }
  return false;
}

/** Whether an element stays where it is for a moment: no scroll or animation moving it. */
async function still(el: Element): Promise<boolean> {
  const a = el.getBoundingClientRect();
  await wait(STILL_MS);
  const b = el.getBoundingClientRect();
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5;
}

/** Waits for a target on the first screen: drawn and on top, scrolled to if it's out of view. Null once it gives up. */
async function waitFor(target: WalkTarget, cancelled: () => boolean): Promise<Element | null> {
  for (let waited = 0; waited <= FIND_MS; waited += LOOK_MS) {
    if (cancelled()) return null;
    const screen = screens()[0];
    const el = screen ? findTarget(screen, target) : null;
    // Still: a list still scrolling to it (or a sheet still rising) takes a touch as a stop, not a tap.
    if (el && (await still(el))) return el;
    if (el) continue;
    if (screen && scrollToTarget(screen, target)) await wait(SETTLE_MS);
    else await wait(LOOK_MS);
  }
  return null;
}

/** The field a target names: itself, the one inside it, or the one in the component or label around it. */
function fieldOf(el: Element): HTMLInputElement | HTMLTextAreaElement | null {
  if (el.matches(FIELDS)) return el as HTMLInputElement;
  const inside = el.querySelector<HTMLInputElement>(FIELDS);
  if (inside) return inside;
  for (let at = el.parentElement; at && !at.hasAttribute('data-hc-screen'); at = at.parentElement) {
    const f = at.querySelector<HTMLInputElement>(FIELDS);
    if (f) return f;
  }
  return null;
}

/** The field an action types in: `into`'s, else the focused one, else the first on the screen. */
async function fieldFor(into: WalkTarget | undefined, cancelled: () => boolean): Promise<HTMLInputElement | HTMLTextAreaElement | null> {
  if (into) {
    const el = await waitFor(into, cancelled);
    return el && fieldOf(el);
  }
  const screen = screens()[0];
  const active = document.activeElement;
  if (screen && active && screen.contains(active) && active.matches(FIELDS)) return active as HTMLInputElement;
  return screen?.querySelector<HTMLInputElement>(FIELDS) ?? null;
}

/** What an action names, for the panel when it isn't there. */
export function actionTarget(a: WalkAction): string {
  if (typeof a === 'string') return a;
  if ('hold' in a) return a.hold;
  if ('focus' in a) return a.focus;
  if ('type' in a || 'press' in a) return a.into ?? 'a field';
  if ('scroll' in a) return a.in ?? 'the screen';
  if ('swipe' in a) return a.on ?? 'something to swipe';
  return '';
}

/** One action on the first screen. False when what it names never showed. */
async function act(a: WalkAction, cancelled: () => boolean): Promise<boolean> {
  if (typeof a === 'string' || 'hold' in a) {
    const target = typeof a === 'string' ? a : a.hold;
    const el = await waitFor(target, cancelled);
    if (!el) return false;
    // The control it's in takes the tap, as a finger on its text would: the pointer events first (the screens'
    // gestures listen to them), then the click.
    // What a finger on it would tap: the nearest thing with a tap of its own (a goal's row, not the card it's in), as
    // a mark points; else the control it's in.
    const screen = el.closest('[data-hc-screen]');
    const area = screen ? tapArea(screen, el) : el;
    const around = area === el ? el.closest<HTMLElement>(TAPPABLE) : null;
    const at = (around && screen?.contains(around) ? around : area) as HTMLElement;
    if (typeof a === 'string') tap(at);
    else await hold(at);
    return true;
  }
  if ('focus' in a || 'type' in a || 'press' in a) {
    const f = await fieldFor('focus' in a ? a.focus : a.into, cancelled);
    if (!f) return false;
    if (document.activeElement !== f) f.focus();
    if ('type' in a) {
      // A letter at a time, so the person sees it typed.
      fillField(f, '');
      for (let i = 1; i <= a.type.length; i++) {
        if (cancelled()) return true;
        fillField(f, a.type.slice(0, i));
        await wait(LETTER_MS);
      }
    } else if ('press' in a) {
      const key = { key: a.press, code: a.press, bubbles: true, cancelable: true };
      f.dispatchEvent(new KeyboardEvent('keydown', key));
      f.dispatchEvent(new KeyboardEvent('keyup', key));
    }
    return true;
  }
  if ('swipe' in a) {
    // A pager or carousel: what scrolls sideways at the target (or the first on the screen), a page over, driven as a
    // finger's would be (down, the scroll, up), since a pager takes only the scrolls the viewer drives.
    const screen = screens()[0];
    if (!screen) return false;
    const from = a.on ? await waitFor(a.on, cancelled) : screen;
    if (!from) return false;
    const sideways = (el: Element) => /auto|scroll/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1;
    let area: HTMLElement | null = null;
    for (let at: Element | null = from; at && at !== screen.parentElement && !area; at = at.parentElement) if (sideways(at)) area = at as HTMLElement;
    area ??= [...from.querySelectorAll<HTMLElement>('*')].find(sideways) ?? null;
    if (!area) return false;
    const r = area.getBoundingClientRect();
    const at = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, isPrimary: true, button: 0 };
    area.dispatchEvent(new PointerEvent('pointerdown', at));
    area.scrollBy({ left: (a.swipe === 'left' ? 1 : -1) * area.clientWidth, behavior: 'smooth' });
    await wait(SETTLE_MS);
    area.dispatchEvent(new PointerEvent('pointerup', at));
    window.dispatchEvent(new PointerEvent('pointerup', at));
    return true;
  }
  if ('scroll' in a) {
    const screen = screens()[0];
    if (!screen) return false;
    const areas = a.in
      ? [...screen.querySelectorAll<HTMLElement>(a.in)]
      : [...screen.querySelectorAll<HTMLElement>('*')].filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1);
    for (const el of areas) el.scrollTo({ top: a.scroll === 'end' ? el.scrollHeight : a.scroll, behavior: 'smooth' });
    return areas.length > 0;
  }
  await wait(a.wait);
  return true;
}

/**
 * Does a step's way in, one action after the other, on the first screen (what an action opens is the canvas's: every
 * device shows it). Each waits for what it names, then for what it did to settle. Stops at one whose target never
 * shows, and says which (its index); null when all were done, or when a newer step cancelled it.
 */
export async function runActions(actions: WalkAction[], cancelled: () => boolean): Promise<number | null> {
  for (let i = 0; i < actions.length; i++) {
    if (cancelled()) return null;
    const done = await act(actions[i], cancelled);
    if (cancelled()) return null;
    if (!done) return i;
    if (typeof actions[i] !== 'object' || !('wait' in (actions[i] as object))) await wait(SETTLE_MS);
  }
  return null;
}
