// Locate a component on a screen: open a page with `locate(name)` and the device, once the page is drawn, marks every
// instance of that component on it with a striped violet overlay that pulses and fades (`data-locate`, ~2.5 s) and scrolls the
// first into view. An overlay over the component, not a border around it: a border gets clipped by the containers.
// From the gallery's "Used in" list. A request, not URL state: it's a moment, not something to share or reload.
import { useEffect } from 'react';
import { componentInstance } from '../design/component';
import './locate.css';

/** How long a request waits for its component to appear (the page mounting, its data settling). */
const WAIT_MS = 4000;
/** How long the outline stays. */
const FLASH_MS = 2600;
/** A marked element that was static, made relative for its overlay (restored after). */
const MADE_RELATIVE = 'locatePos';

let request: { name: string; at: number } | null = null;

/** Ask the next screen drawn to find `name` and point at it. */
export function locate(name: string) {
  request = { name, at: Date.now() };
}

/** On a device screen: answers a fresh request (each screen on the canvas, the same component). */
export function LocateFlash({ screen }: { screen: HTMLElement | null }) {
  useEffect(() => {
    if (!screen || !request || Date.now() - request.at > WAIT_MS) return;
    const { name, at } = request;
    let clear = 0;
    const find = () => {
      // The page on top (the last layer drawn), not the ones under it.
      const pages = screen.querySelectorAll<HTMLElement>('[data-hc-page]');
      const top = pages[pages.length - 1] ?? screen;
      const isIt = (m: Element | null | undefined) => !!m && componentInstance((m as HTMLElement).dataset.hc)?.name === name;
      // Every instance, the outermost of each (one inside another of the same name is covered by it).
      const els = [...top.querySelectorAll<HTMLElement>('[data-hc]')].filter((m) => isIt(m) && !isIt(m.parentElement?.closest('[data-hc]')));
      if (!els.length) return false;
      scrollTo(els[0], screen);
      for (const el of els) {
        if (getComputedStyle(el).position === 'static') {
          el.style.position = 'relative';
          el.dataset[MADE_RELATIVE] = '';
        }
        el.setAttribute('data-locate', '');
      }
      clear = window.setTimeout(() => els.forEach(unmark), FLASH_MS);
      return true;
    };
    // Now, or when it appears (a page's content mounting after its transition).
    if (find()) return () => window.clearTimeout(clear);
    const mo = new MutationObserver(() => find() && stop());
    const give = window.setTimeout(() => stop(), Math.max(0, WAIT_MS - (Date.now() - at)));
    const stop = () => {
      mo.disconnect();
      window.clearTimeout(give);
    };
    mo.observe(screen, { childList: true, subtree: true });
    return () => {
      stop();
      window.clearTimeout(clear);
    };
  }, [screen]);
  return null;
}

function unmark(el: HTMLElement) {
  el.removeAttribute('data-locate');
  if (MADE_RELATIVE in el.dataset) {
    el.style.position = '';
    delete el.dataset[MADE_RELATIVE];
  }
}

/**
 * Scrolls the screen's own scroller (the nearest one around the element) so it's centered. Not scrollIntoView: that
 * would scroll the canvas and the frames around the screen too.
 */
function scrollTo(el: HTMLElement, screen: HTMLElement) {
  for (let p = el.parentElement; p && p !== screen; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) {
      const pr = p.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      // The device is scaled on the canvas: rects are in screen pixels, scrollTop in the page's.
      const k = pr.height / (p.offsetHeight || 1);
      p.scrollBy({ top: (er.top - pr.top) / k - (p.clientHeight - er.height / k) / 2, behavior: 'smooth' });
      return;
    }
  }
}
