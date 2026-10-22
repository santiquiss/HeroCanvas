// How a menu floating over the page (the drop-down, the popover) closes from outside it: a tap, as a transparent layer
// does on iOS and Android, and a scroll (a wheel or trackpad, or a finger dragging), as Flutter's MenuAnchor and UIKit's
// menus close when the page under them scrolls, so a menu never stays hanging away from the control it came from. The
// layer stops catching once it closes (pass `open`), so the rest of the scroll reaches the page as it fades.
import { useRef, type CSSProperties, type PointerEvent } from 'react';

/** How far a finger moves before it's a scroll, not a tap (Flutter's kTouchSlop). */
const TOUCH_SLOP = 18;

/** The catcher's props: its handlers and its pointer-events, `auto` while open. */
export function useDismissOutside(onClose: (() => void) | undefined, open: boolean) {
  const down = useRef<{ id: number; x: number; y: number } | null>(null);
  const close = () => {
    down.current = null;
    onClose?.();
  };
  return {
    onClick: close,
    onWheel: close,
    onPointerDown: (e: PointerEvent) => {
      // A mouse dragging isn't scrolling: only a finger or a pen moves the page.
      down.current = e.pointerType === 'mouse' ? null : { id: e.pointerId, x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: PointerEvent) => {
      const d = down.current;
      if (d && d.id === e.pointerId && Math.hypot(e.clientX - d.x, e.clientY - d.y) > TOUCH_SLOP) close();
    },
    onPointerUp: () => (down.current = null),
    onPointerCancel: () => (down.current = null),
    style: { pointerEvents: open ? 'auto' : 'none' } satisfies CSSProperties,
  };
}
