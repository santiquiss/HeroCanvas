// The simulated system keyboard's height while it's open (0 when closed), for content that has to stay above it
// (e.g. a search's bottom bar). DeviceScreen opens the keyboard when a text field inside it gets focus.
import { createContext, useContext } from 'react';

export const KeyboardInsetCtx = createContext(0);

export const useKeyboardInset = () => useContext(KeyboardInsetCtx);

/** Fields that bring up the text keyboard. */
export function isTextField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  return el instanceof HTMLInputElement && !el.readOnly && ['text', 'search', 'email', 'url', 'tel', 'number', 'password'].includes(el.type);
}

// ---------------------------------------------------------------- Bars over the keyboard (one rule for every input)

/** Space between the keyboard and an input bar floating above it. */
export const KEYBOARD_GAP = 12;
/** A floating input bar's width at rest (the phone tab bar's), centered; with the keyboard up it spans the content. */
const BAR_MAX_W = 390;
/** At rest a floating bar sits this far inside the content's padding; while typing it lines up with the content. */
const BAR_REST_INSET = 8;
/** The keyboard's slide (sim/motion): bars move and widen with it. */
export { KEYBOARD_MOTION } from './motion';

/**
 * Where a floating input bar sits: `restBottom` from the screen's bottom (or KEYBOARD_GAP above the keyboard), how
 * wide it may get (BAR_MAX_W at rest, the content's width while typing) and how far inside the screen's or panel's
 * side padding (`inset`: BAR_REST_INSET at rest; 0 while typing, so its edges are the padding: 16 on phones, 24 on
 * the iPhone Duo inner display).
 */
export function inputBar(kb: number, restBottom: number) {
  return {
    bottom: kb ? kb + KEYBOARD_GAP : restBottom,
    maxWidth: kb ? ('100%' as const) : BAR_MAX_W,
    inset: kb ? 0 : BAR_REST_INSET,
    typing: kb > 0,
  };
}

/**
 * For a tap that opens a field that mounts after it (a sheet's, with autofocus): iOS brings the keyboard up only for a
 * focus inside the tap's own handler, so a field focused once it mounts gets no keyboard on a real device. Called in
 * the tap, this focuses a stand-in field at once; the real one takes the focus as it mounts and the keyboard stays.
 * The stand-in goes after a moment. Not for opening without a tap (a link, the page index): it would take the focus.
 */
export function holdKeyboard() {
  const el = document.createElement('input');
  el.setAttribute('aria-hidden', 'true');
  el.tabIndex = -1;
  // 16px: iOS zooms into a focused field with smaller text.
  Object.assign(el.style, { position: 'fixed', top: '0', left: '0', width: '1px', height: '1px', opacity: '0', fontSize: '16px', pointerEvents: 'none' });
  document.body.appendChild(el);
  el.focus({ preventScroll: true });
  window.setTimeout(() => el.remove(), 1000);
}

// ---------------------------------------------------------------- Whose field takes the focus

/** The screen the last tap was on (a canvas shows several, each with the same sheet open). */
let tappedScreen: Element | null = null;
if (typeof document !== 'undefined')
  document.addEventListener('pointerdown', (e) => (tappedScreen = e.target instanceof Element ? e.target.closest('[data-device-screen]') : null), true);

/**
 * Whether a field that focuses itself as it shows (autofocus) should take the focus: only on the screen the person is
 * using (the last one tapped). The same sheet opens on every screen of the canvas; each would take the focus in turn
 * and the keyboard come up on the last one mounted. With no tap yet (a link, the page index), the first screen does.
 */
export function ownsFocus(el: Element): boolean {
  const screen = el.closest('[data-device-screen]');
  if (!screen) return true;
  if (tappedScreen && tappedScreen.isConnected) return tappedScreen === screen;
  return document.querySelector('[data-device-screen]') === screen;
}
