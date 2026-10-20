import { useEffect, useState } from 'react';

export interface Presence<T> {
  key: string;
  item: T;
  /** False while the item animates out; it is dropped after `ms`. */
  present: boolean;
  /** False for items that were there on first render (no enter animation on page load). */
  animateIn: boolean;
}

/** Keeps removed items mounted for `ms` so they can animate out. Leaving items keep their position. */
export function usePresence<T>(items: T[], keyOf: (item: T) => string, ms: number): Presence<T>[] {
  const sig = items.map(keyOf).join('|');
  const [list, setList] = useState<Presence<T>[]>(() => items.map((item) => ({ key: keyOf(item), item, present: true, animateIn: false })));
  const [lastSig, setLastSig] = useState(sig);

  // Adjust state during render when the set of items changes (no extra paint with stale layers).
  if (sig !== lastSig) {
    setLastSig(sig);
    const keys = new Set(items.map(keyOf));
    const next: Presence<T>[] = items.map((item) => {
      const key = keyOf(item);
      const old = list.find((p) => p.key === key);
      return { key, item, present: true, animateIn: old ? old.animateIn : true };
    });
    list.forEach((p, i) => {
      if (!keys.has(p.key)) next.splice(Math.min(i, next.length), 0, { ...p, present: false });
    });
    setList(next);
  }

  useEffect(() => {
    if (list.every((p) => p.present)) return;
    const t = window.setTimeout(() => setList((l) => l.filter((p) => p.present)), ms);
    return () => window.clearTimeout(t);
  }, [list, ms]);

  // Present items always render their latest value.
  const byKey = new Map(items.map((item) => [keyOf(item), item]));
  return list.map((p) => (p.present && byKey.has(p.key) ? { ...p, item: byKey.get(p.key)! } : p));
}
