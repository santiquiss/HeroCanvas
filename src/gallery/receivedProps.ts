// What a component really receives in the gallery's examples: the props its instances record (useComponent) once drawn. A
// story's args are its controls — some go to the component, some only set the example up (a switch that adds a
// callback, the text of a child, a sheet's `open`) — so the Props tab tells them apart by this, not by the args.
import { useEffect, useState } from 'react';
import { componentInstance } from '../design/component';

/** The prop names the drawn instances of `component` received, or null until they're drawn. */
export function receivedProps(component: string, root: ParentNode = document): Set<string> | null {
  let found = false;
  const keys = new Set<string>();
  for (const el of root.querySelectorAll<HTMLElement>('[data-hc]')) {
    const inst = componentInstance(el.dataset.hc);
    if (inst?.name !== component) continue;
    found = true;
    // Empty too: a prop the component takes, unset in this example (a sheet's `surface`), is still its own.
    for (const k of Object.keys(inst.props)) keys.add(k);
  }
  return found ? keys : null;
}

/** `receivedProps`, read again after each change of the examples (`deps`), once they've drawn. */
export function useReceivedProps(component: string, deps: unknown[]): Set<string> | null {
  const [keys, setKeys] = useState<Set<string> | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => setKeys(receivedProps(component)));
    return () => cancelAnimationFrame(id);
  }, [component, ...deps]);
  return keys;
}
