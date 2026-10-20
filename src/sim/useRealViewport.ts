// What the device in hand reports (sim/realDevice): the window's size, its safe area, how it's turned, and the
// system keyboard's height while it's up.
import { useEffect, useState } from 'react';
import type { RealViewport } from './realDevice';

/** The safe area can't be read from script: an element padded with it can be measured. */
function safeProbe(): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;inset:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(el);
  return el;
}

function measure(probe: HTMLElement | null): RealViewport & { angle: number } {
  const s = probe ? getComputedStyle(probe) : null;
  const px = (v: string | undefined) => Math.round(parseFloat(v ?? '') || 0);
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    safe: { top: px(s?.paddingTop), right: px(s?.paddingRight), bottom: px(s?.paddingBottom), left: px(s?.paddingLeft) },
    angle: window.screen?.orientation?.angle ?? 0,
  };
}

const same = (a: RealViewport & { angle: number }, b: RealViewport & { angle: number }) =>
  a.w === b.w && a.h === b.h && a.angle === b.angle && a.safe.top === b.safe.top && a.safe.right === b.safe.right && a.safe.bottom === b.safe.bottom && a.safe.left === b.safe.left;

/** The window and its safe area, kept up to date as the device turns or the browser's bars come and go. */
export function useRealViewport(): RealViewport & { angle: number } {
  const [view, setView] = useState(() => measure(null));
  useEffect(() => {
    const probe = safeProbe();
    const update = () => setView((prev) => {
      const next = measure(probe);
      return same(prev, next) ? prev : next;
    });
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      probe.remove();
    };
  }, []);
  return view;
}

/** Under this, the visible area shrinking isn't a keyboard (a browser's bar). */
const MIN_KEYBOARD = 120;

/**
 * The system keyboard's height while it's up (0 otherwise, or when `on` is false): what it hides of the window. The
 * system also scrolls the page to show the field; the app's bars already move above the keyboard, so it's put back.
 */
export function useRealKeyboard(on: boolean): number {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!on || !vv) return;
    const update = () => {
      const hidden = Math.round(window.innerHeight - vv.height);
      setKb(hidden >= MIN_KEYBOARD ? hidden : 0);
      if (vv.offsetTop) window.scrollTo(0, 0);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setKb(0);
    };
  }, [on]);
  return on ? kb : 0;
}
