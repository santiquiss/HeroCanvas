// PreviewScreen as the public API gives it (`herocanvas`): loaded when it first shows, not with the API. The real one
// reads the app's pages, which import the API: importing it here would load the app before the API has finished.
import { useEffect, useState, type ComponentType } from 'react';
import type { PreviewScreenProps } from './PreviewScreen';

let loaded: ComponentType<PreviewScreenProps> | null = null;

/** A page drawn on a device of its own (a layout from computeLayout), as Flow and the where-used rail draw it. */
export function PreviewScreen(props: PreviewScreenProps) {
  const [Real, setReal] = useState(() => loaded);
  useEffect(() => {
    if (Real) return;
    let live = true;
    void import('./PreviewScreen').then((m) => {
      loaded = m.PreviewScreen;
      if (live) setReal(() => m.PreviewScreen);
    });
    return () => {
      live = false;
    };
  }, [Real]);
  return Real ? <Real {...props} /> : null;
}
