// Flutter's PopScope for what the simulator presents (a sheet, its dialog, drop-down or popover): the content says
// whether it may close now, and what to do when it may not (ask first). It guards the closes that come from outside
// the content: a tap on the shim, a swipe down, Escape. The content's own `close` always closes: it's the content's
// decision already.
import { createContext, useContext, useEffect, useRef, type MutableRefObject } from 'react';

export interface PopScope {
  /** False while closing would lose something (an edit not saved). */
  canPop: boolean;
  /** A close was asked for while `canPop` was false (the sheet stays): ask the person, then close if they say so. */
  onPopBlocked?: () => void;
}

/** The guard of the sheet open now: SheetBody's, read when something outside the content asks to close it. */
export const PopScopeCtx = createContext<MutableRefObject<PopScope | null> | null>(null);

/** Guards the sheet this content is in, as Flutter's PopScope (`canPop`, `onPopInvokedWithResult` when it didn't). */
export function usePopScope(scope: PopScope) {
  const guard = useContext(PopScopeCtx);
  const latest = useRef(scope);
  latest.current = scope;
  useEffect(() => {
    if (!guard) return;
    guard.current = { get canPop() { return latest.current.canPop; }, onPopBlocked: () => latest.current.onPopBlocked?.() };
    return () => {
      guard.current = null;
    };
  }, [guard]);
}
