// The system back, as Android has it (`BackHandler`, `OnBackPressedDispatcher`) and iOS's swipe back acts: a screen
// takes the back with `useBackHandler(enabled, onBack)`; the enabled handler that mounted last wins (a sheet over a
// page, a step over its flow); with none, the device goes back (the keyboard first, then an open dialog or sheet,
// then the page). The simulated devices have no back button or gesture, so the designer sends it: Alt+←, Esc while
// the focus is in a screen, or the device header's back on Android.
//
//   useBackHandler(step !== 'login', () => goTo('login'));
//
// Each device screen has its own dispatcher; what matters is shared (the URL, shared state), so one screen taking the
// back moves every screen on the canvas.
import { createContext, useContext, useEffect, useRef } from 'react';

interface Handler {
  /** Mount order: later wins. */
  order: number;
  onBack: () => void;
}

export interface BackDispatcher {
  /** Adds an enabled handler; returns its removal. */
  add: (handler: Handler) => () => void;
  /** Sends a back: the top-most enabled handler, else `fallback`. True when something took it. */
  back: () => boolean;
}

/** `fallback`: what the device does when no handler is enabled; it answers whether it did anything. */
export function createBackDispatcher(fallback: () => boolean = () => false): BackDispatcher {
  const handlers = new Set<Handler>();
  return {
    add(handler) {
      handlers.add(handler);
      return () => void handlers.delete(handler);
    },
    back() {
      let top: Handler | null = null;
      for (const h of handlers) if (!top || h.order > top.order) top = h;
      if (!top) return fallback();
      top.onBack();
      return true;
    },
  };
}

export const BackDispatcherCtx = createContext<BackDispatcher | null>(null);

// Parents render before their children, so a counter read on the first render orders handlers as they nest (an
// effect wouldn't: children's effects run first).
let nextOrder = 0;

/**
 * The screen takes the system back while `enabled` (Android's `BackHandler`). Outside a device screen (a component's
 * examples, a Flow thumbnail) it does nothing.
 */
export function useBackHandler(enabled: boolean, onBack: () => void): void {
  const dispatcher = useContext(BackDispatcherCtx);
  const order = useRef(-1);
  if (order.current < 0) order.current = nextOrder++;
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (!enabled || !dispatcher) return;
    return dispatcher.add({ order: order.current, onBack: () => latest.current() });
  }, [enabled, dispatcher]);
}

// ---- The designer's side: which screens take the back.

interface Target {
  back: () => boolean;
  /** The screen being worked on, not a copy of it in a device set. */
  primary: boolean;
}
const targets: Target[] = [];

/** A device screen offers itself to the system back while it's mounted. */
export function registerBackTarget(back: () => boolean, primary: boolean): () => void {
  const target = { back, primary };
  targets.push(target);
  return () => {
    const i = targets.indexOf(target);
    if (i >= 0) targets.splice(i, 1);
  };
}

/**
 * The system back, once: the primary screen takes it, else the first on the canvas (a device set's screens share the
 * navigation, so one is enough). False when there's nothing to go back to.
 */
export function systemBack(): boolean {
  const target = targets.find((t) => t.primary) ?? targets[0];
  return target ? target.back() : false;
}
