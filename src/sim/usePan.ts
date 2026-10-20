// Middle-button drag to pan a scrolling canvas, like design tools (no browser autoscroll). Spread the returned
// handlers on the scroll container.
import { useRef, type MouseEvent, type PointerEvent } from 'react';

export function usePan() {
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 1) return;
      e.preventDefault();
      const el = e.currentTarget;
      pan.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const p = pan.current;
      if (!p) return;
      e.currentTarget.scrollLeft = p.left - (e.clientX - p.x);
      e.currentTarget.scrollTop = p.top - (e.clientY - p.y);
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => end(e),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => end(e),
    // Some browsers start autoscroll on the middle button's mousedown.
    onMouseDown: (e: MouseEvent<HTMLElement>) => {
      if (e.button === 1) e.preventDefault();
    },
  };

  function end(e: PointerEvent<HTMLElement>) {
    if (!pan.current) return;
    pan.current = null;
    e.currentTarget.style.cursor = '';
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
}
