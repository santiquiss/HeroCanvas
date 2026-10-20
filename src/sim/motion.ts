// Motion: one curve and a few durations for the whole app (pages, panels, the keyboard, section swaps). theme.css's
// --ease is the same curve, for CSS.

export const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
/** Pages and panels sliding, gliding or fading in and out. */
export const PAGE_MS = 380;
/** A layer leaving stays mounted this long: its animation plus a frame. */
export const EXIT_MS = PAGE_MS + 20;
/** A section (tab) fading up as it comes in. */
export const TAB_IN_MS = 300;
/** The system keyboard's slide: bars over it move and widen with it. */
export const KEYBOARD_MS = 320;
export const KEYBOARD_MOTION = `${KEYBOARD_MS}ms ${EASE}`;

/**
 * Swapping a panel's section for another: the old one shrinks a little and fades quickly; the new one, a beat later,
 * grows to size as it fades in (an even curve, so the growth shows while it appears, not before).
 */
export const SWAP = {
  scale: 0.98,
  in: 'transform 420ms cubic-bezier(0.2, 0, 0, 1) 40ms, opacity 280ms ease 40ms',
  out: 'transform 240ms ease-out, opacity 200ms ease',
};
