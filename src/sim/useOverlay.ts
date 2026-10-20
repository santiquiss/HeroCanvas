import { useEffect, useState } from 'react';
import { useEntered } from '../kit/motion';

/** A view over the app: mounted while open and while it animates out (`ms`); `on` once it has entered. */
export function useOverlay(open: boolean, ms: number): { mounted: boolean; on: boolean } {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(t);
  }, [open, ms]);
  return { mounted, on: useEntered(open && mounted) };
}
