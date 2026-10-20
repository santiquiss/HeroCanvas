// A thumbnail's live screen, mounted when its turn comes (lazyMount): until then, the page color, so the canvas reads
// complete from the first frame.
import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { useLazyMount } from './lazyMount';

/** The element Flow pans inside: what "near the viewport" is measured against. */
export const FlowRootCtx = createContext<RefObject<Element | null>>({ current: null });

export function LazyPreview({ children }: { children: () => ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const on = useLazyMount(box, useContext(FlowRootCtx));
  return (
    <div ref={box} style={{ width: '100%', height: '100%', background: on ? undefined : 'var(--pg)' }}>
      {on && children()}
    </div>
  );
}
