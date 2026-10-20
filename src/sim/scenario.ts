// The system's accessibility settings in the screens (sim/systemText), from the URL: Scenarios' Accessibility section
// sets them. Who's using the app is sim/persona; a page's own conditions are its manifest `controls`, read as the
// state params they set.
import { useMemo } from 'react';
import { accessibilityIn, type Accessibility } from './systemText';
import { useUrlParams } from './SimContext';

export function useAccessibility(): Accessibility {
  const get = useUrlParams();
  const a = accessibilityIn(get);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => a, [a.textSize, a.boldText]);
}
