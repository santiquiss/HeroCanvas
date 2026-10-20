// Flow's thumbnails mount a few at a time, when the browser is idle, the ones on screen first: a live screen each, so
// all of them at once (~90) blocked the main thread for seconds when Flow opened. A thumbnail asks once it comes near
// the viewport, and stays mounted.
import { startTransition, useEffect, useState, type RefObject } from 'react';
import { whenIdle } from '../sim/idle';

/** Thumbnails mounted per idle task. */
const PER_TASK = 2;

const queue: (() => void)[] = [];
let cancel: (() => void) | null = null;

function pump() {
  cancel = null;
  const batch = queue.splice(0, PER_TASK);
  // A transition: React can stop rendering them for a click or a pan.
  startTransition(() => batch.forEach((mount) => mount()));
  if (queue.length) cancel = whenIdle(pump);
}

/** Whether `el` (in the scrolling or panning `root`) should render its content yet. */
export function useLazyMount(el: RefObject<Element | null>, root: RefObject<Element | null>): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const target = el.current;
    if (on || !target) return;
    let queued: (() => void) | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        if (queued || !entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        queued = () => setOn(true);
        queue.push(queued);
        cancel ??= whenIdle(pump);
      },
      { root: root.current, rootMargin: '400px' },
    );
    io.observe(target);
    return () => {
      io.disconnect();
      // Gone before its turn: out of the queue.
      const i = queued ? queue.indexOf(queued) : -1;
      if (i >= 0) queue.splice(i, 1);
    };
  }, [on, el, root]);
  return on;
}
