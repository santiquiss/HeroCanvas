// Words a layer's screen or component shows, put another way in one screenshot alone (a device's or a component's
// `replace`): each text that reads `from` reads `to`, again whenever it's redrawn. The app's own texts stay as they are.
import { useEffect, type RefObject } from 'react';

export interface TextSwap {
  from: string;
  to: string;
}

/** Every text node under `root` that reads `from` (spaces around it aside) reads `to`. */
export function swapTexts(root: Node, pairs: TextSwap[]): void {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) for (const p of pairs) if (n.nodeValue?.trim() === p.from) n.nodeValue = n.nodeValue.replace(p.from, p.to);
}

/** Keeps the texts under `ref` swapped while `pairs` hold (`key`: what redraws it from scratch). */
export function useTextSwap(ref: RefObject<Element | null>, pairs: TextSwap[] | undefined, key = '') {
  const pairsKey = JSON.stringify(pairs ?? null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !pairs?.length) return;
    const swap = () => swapTexts(root, pairs);
    swap();
    const mo = new MutationObserver(swap);
    mo.observe(root, { subtree: true, childList: true, characterData: true });
    return () => mo.disconnect();
  }, [pairsKey, key]); // eslint-disable-line react-hooks/exhaustive-deps
}
