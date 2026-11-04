// What a proposal's screen has that Live's doesn't, for Highlight changes: the same screen drawn in Live off screen
// (LiveTwin), then each component instance of the proposal's compared with Live's by its name and its props (the
// plain ones: texts, numbers, flags). An instance Live has no match for is new on this screen (a row added, a text
// changed); only the outermost of them is marked, so a new row is one mark, not one per icon in it.
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { createPortal } from 'react-dom';
import { DesignOverride } from '../design/overridable';
import { componentInstance } from '../design/component';
import { PreviewScreen } from '../flow/PreviewScreen';
import { useNavRoot } from '../nav/context';
import { liveSearch, useSim } from './SimContext';

const LIVE = { proposal: null, variant: null };
/** After the last change to either screen, how long to wait before comparing (both settle: data, animations). */
const SETTLE_MS = 180;

/** An element's name as a component (its `data-hc`), if it's one. */
const nameOf = (el: Element) => componentInstance((el as HTMLElement).dataset?.hc)?.name;

/** What an element is, apart from its content: its tag and, if it's a component, its name. */
const shallowKey = (el: Element) => `${el.tagName}:${nameOf(el) ?? ''}`;

/** What an element is with everything in it: its kind, its text, its pictures and values. */
function deepKey(el: Element, cache: Map<Element, string>): string {
  const hit = cache.get(el);
  if (hit != null) return hit;
  const pics = [...el.querySelectorAll('img')].map((i) => i.getAttribute('src') ?? '').join('|');
  const icons = [...el.querySelectorAll('[data-icon]')].map((i) => i.getAttribute('data-icon')).join('|');
  const key = `${shallowKey(el)}#${(el.textContent ?? '').replace(/\s+/g, ' ').trim()}#${pics}#${icons}`;
  cache.set(el, key);
  return key;
}

/** The longest common run of two lists of keys: which positions of `a` match which of `b`. */
function lcs(a: string[], b: string[]): Map<number, number> {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = new Map<number, number>();
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) pairs.set(i++, j++);
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

export interface ScreenDiff {
  /** Not in Live at all (a row, a card): each marked whole. */
  added: HTMLElement[];
  /** In Live too, but different (a text, a number): the smallest part that differs. */
  changed: HTMLElement[];
}

/**
 * What the proposal's page has that Live's doesn't, as a text diff does it but on the screens' trees: at each level the
 * children are lined up (the longest run that's the same, in order); a child left over with no Live child of its kind
 * left over too is added; one that pairs with a Live child of its kind but differs is looked into, down to what changed.
 */
export function diffScreens(proposal: Element, live: Element): ScreenDiff {
  const out: ScreenDiff = { added: [], changed: [] };
  const pc = new Map<Element, string>();
  const lc = new Map<Element, string>();
  const walk = (p: Element, l: Element, depth: number): boolean => {
    const pk = [...p.children];
    const lk = [...l.children];
    if (!pk.length || depth > 40) return false;
    const pairs = lcs(
      pk.map((e) => deepKey(e, pc)),
      lk.map((e) => deepKey(e, lc)),
    );
    const usedLive = new Set(pairs.values());
    const spareLive = lk.map((e, j) => (usedLive.has(j) ? null : e));
    let found = false;
    pk.forEach((child, i) => {
      if (pairs.has(i)) return;
      found = true;
      const k = shallowKey(child);
      const j = spareLive.findIndex((e) => e && shallowKey(e) === k);
      if (j < 0) return void out.added.push(child as HTMLElement);
      const twin = spareLive[j]!;
      spareLive[j] = null;
      // The same kind of thing, different inside: what changed in it, or it as a whole if nothing below says.
      if (!walk(child, twin, depth + 1)) out.changed.push(child as HTMLElement);
    });
    return found;
  };
  walk(proposal, live, 0);
  // Something with nothing to read or see in it (a divider, a spacer) isn't marked on its own: a row added with its
  // divider is one mark.
  const shows = (el: HTMLElement) => !!(el.textContent ?? '').trim() || !!el.querySelector('img, svg, canvas, video') || /^(IMG|SVG|CANVAS|VIDEO)$/i.test(el.tagName);
  out.added = out.added.filter(shows);
  out.changed = out.changed.filter(shows);
  return out;
}

/**
 * The screen on top of the stack as Live draws it, off screen (outside the device, so neither Layers nor the marks see
 * it), at the screen's own layout and with the URL as it is. `onRoot` gets its root once drawn.
 */
export function LiveTwin({ onRoot }: { onRoot: (root: HTMLElement | null) => void }) {
  const nav = useNavRoot();
  const { layout } = useSim();
  const top = nav.stack[nav.stack.length - 1];
  const box = useRef<HTMLDivElement>(null);
  // The URL as it is now, following it (a flow's step that goes on by itself, a state picked): the same screen as the
  // proposal's, step for step.
  const [search] = useSearchParams();
  const query = useMemo(() => new URLSearchParams(liveSearch()), [search]);
  useEffect(() => {
    onRoot(box.current);
    return () => onRoot(null);
  }, [onRoot]);
  const twin: ReactNode = (
    <div ref={box} aria-hidden style={{ position: 'fixed', left: -100000, top: 0, width: layout.vw, height: layout.vh, overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none' }}>
      <DesignOverride.Provider value={LIVE}>
        <PreviewScreen page={top} query={query} makeLayout={() => layout} />
      </DesignOverride.Provider>
    </div>
  );
  return createPortal(twin, document.body);
}

/** Calls `then` once both roots have been still for a moment, again after each change to either. */
export function useWhenSettled(a: HTMLElement | null, b: HTMLElement | null, then: () => void) {
  const latest = useRef(then);
  latest.current = then;
  useEffect(() => {
    if (!a || !b) return;
    let t = window.setTimeout(() => latest.current(), SETTLE_MS);
    const again = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => latest.current(), SETTLE_MS);
    };
    const mo = new MutationObserver((records) => {
      // The marks' own attributes don't count.
      if (records.every((r) => r.type === 'attributes' && r.attributeName === 'data-hl')) return;
      again();
    });
    mo.observe(a, { childList: true, subtree: true, characterData: true });
    mo.observe(b, { childList: true, subtree: true, characterData: true });
    return () => {
      mo.disconnect();
      window.clearTimeout(t);
    };
  }, [a, b]);
}
