// The iPhone Duo's right column holds the top page's toolbar under the corner status, as Apple's vertical controls
// ("Designing for iPhone Duo"): Back or Close at the top, then the actions that are only a symbol (a text button stays
// in a horizontal bar). A page's bar hands them over with useColumnBar and keeps its title, its text actions and its own
// content in its row; the column draws them with the app's ColumnBar (AppNavigation), or the kit's. Only as many as fit
// above the column's navigation go; the rest stay in the page's bar. Only a page at the screen's right edge, beside the
// column, can have it ("Locate controls near the content they affect"): a pane on the left (a list beside its detail)
// keeps its controls in its own bar. Of those, the page mounted last that is still open has it.
import { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentType } from 'react';
import { Icon } from '../components/Icon';
import type { ColumnBarProps, ToolbarAction } from '../contract';
import { RightEdgeCtx } from '../nav/context';
import { CORNER_STATUS, type Layout } from './layout';
import { useSim } from './SimContext';
import styles from './columnBar.module.css';

interface Entry {
  seq: number;
  title: string;
  back?: { icon: 'back' | 'close'; onPress: () => void };
  actions: ToolbarAction[];
}

interface State {
  top: Entry | null;
  /** How many controls fit between the status and the column's navigation. */
  room: number;
}

export interface ColumnBarStore {
  subscribe: (listener: () => void) => () => void;
  state: () => State;
  set: (entry: Entry) => () => void;
  setRoom: (room: number) => void;
}

export function createColumnBar(): ColumnBarStore {
  const entries = new Map<number, Entry>();
  const listeners = new Set<() => void>();
  let state: State = { top: null, room: Infinity };
  const changed = (next: Partial<State>) => {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const topEntry = () => {
    let top: Entry | null = null;
    for (const e of entries.values()) if (!top || e.seq > top.seq) top = e;
    return top;
  };
  return {
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    state: () => state,
    set: (entry) => {
      entries.set(entry.seq, entry);
      changed({ top: topEntry() });
      return () => {
        entries.delete(entry.seq);
        changed({ top: topEntry() });
      };
    },
    setRoom: (room) => {
      if (room !== state.room) changed({ room });
    },
  };
}

/** The screen's store; null where a page renders alone (a story, a thumbnail without the screen). */
export const ColumnBarCtx = createContext<ColumnBarStore | null>(null);
/** Whether the page it's in is open: one leaving (sliding out) gives the column to the page under it at once. */
export const PageOpenCtx = createContext(true);

const NONE: State = { top: null, room: 0 };
const noState = () => NONE;
const noSubscribe = () => () => {};
let mounted = 0;

/** What of a page's toolbar is in the column: its back (or close), and how many of its actions (the first). */
export interface InColumn {
  back: boolean;
  actions: number;
}

/** What the column shows of an entry, given the room: the back first, then the actions in order. */
function placed(e: Entry, room: number): InColumn {
  const back = !!e.back && room >= 1;
  return { back, actions: Math.max(0, Math.min(e.actions.length, room - (e.back ? 1 : 0))) };
}

/**
 * A page's toolbar for the iPhone Duo's column: its title, its back or close (`back`) and its actions that are only a
 * symbol. Returns what of it is in the column (the screen has one, this page is on top at the right edge, and it fits),
 * so the page's bar leaves that out of its row; elsewhere nothing is. The latest callbacks run; the column redraws only
 * when the title, the icons or the labels change.
 */
export function useColumnBar(title: string, { back, actions = [] }: { back?: { icon?: 'back' | 'close'; onPress: () => void }; actions?: ToolbarAction[] } = {}): InColumn {
  const store = useContext(ColumnBarCtx);
  const open = useContext(PageOpenCtx);
  const atRight = useContext(RightEdgeCtx);
  const { layout } = useSim();
  const [seq] = useState(() => ++mounted);
  const latest = useRef({ back, actions });
  const on = !!store && layout.sideNav && open && atRight && (!!back || actions.length > 0);
  useLayoutEffect(() => {
    latest.current = { back, actions };
  });
  const backIcon = back ? (back.icon ?? 'back') : null;
  const key = actions.map((a) => `${a.icon}:${a.label}`).join('|');
  // Before paint, so the controls never show in the row for a frame first.
  useLayoutEffect(() => {
    if (!on) return;
    const column = latest.current.actions.map((a, i) => ({ ...a, onPress: () => latest.current.actions[i]?.onPress?.() }));
    return store.set({ seq, title, back: backIcon ? { icon: backIcon, onPress: () => latest.current.back?.onPress() } : undefined, actions: column });
  }, [on, store, seq, title, backIcon, key]);
  const { top, room } = useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.state ?? noState);
  return on && top?.seq === seq ? placed(top, room) : { back: false, actions: 0 };
}

/** Where the column's controls start: under the corner status, 8 below it. */
const columnBarTop = (L: Pick<Layout, 'statusTop' | 'cornerStatus'>) => (L.cornerStatus === 'vertical' ? L.statusTop + CORNER_STATUS.vertical.h + 8 : 24);

/** A control (40) and the space between two. */
const CONTROL = 40;
const GAP = 8;
/** Between the toolbar and the column's navigation: Apple's space between the top and the bottom bars' items. */
const NAV_GAP = 16;
/** On the wrapper of the column's navigation (DeviceScreen), to measure the room above it. */
export const SIDE_NAV_ATTR = 'data-side-nav';

/** The column's vertical bar (DeviceScreen, on displays with a column): it fades out with the last page that had it. */
export function ColumnBar({ store, zIndex, Bar = KitColumnBar }: { store: ColumnBarStore; zIndex: number; Bar?: ComponentType<ColumnBarProps> }) {
  const { layout: L } = useSim();
  const { top, room } = useSyncExternalStore(store.subscribe, store.state);
  const ref = useRef<HTMLDivElement>(null);
  const barTop = columnBarTop(L);
  // The room above the navigation, after each commit (it comes and goes with the page on top). Offsets, not client
  // rects: the canvas scales the screen.
  useLayoutEffect(() => {
    const nav = ref.current?.parentElement?.querySelector(`[${SIDE_NAV_ATTR}]`)?.firstElementChild as HTMLElement | null | undefined;
    if (!nav) return store.setRoom(Infinity);
    store.setRoom(Math.max(0, Math.floor((nav.offsetTop - NAV_GAP - barTop + GAP) / (CONTROL + GAP))));
  });
  // The one it last showed, kept while it fades out.
  const [shown, setShown] = useState(top);
  if (top && top !== shown) setShown(top);
  const fit = shown ? placed(shown, room) : null;
  const visible = !!top && !!fit && (fit.back || fit.actions > 0);
  return (
    <div ref={ref} className={`${styles.column} ${visible ? '' : styles.off}`} style={{ top: barTop, width: L.sideW, zIndex }}>
      {shown && fit && <Bar title={shown.title} back={fit.back ? shown.back : undefined} actions={shown.actions.slice(0, fit.actions)} />}
    </div>
  );
}

/** The kit's vertical bar, for an app that declares none: round buttons on the app's surface, 8 apart. */
function KitColumnBar({ back, actions }: ColumnBarProps) {
  return (
    <div className={styles.bar}>
      {back && (
        <button className={styles.button} aria-label={back.icon === 'close' ? 'Close' : 'Back'} onClick={back.onPress}>
          <Icon name={back.icon === 'close' ? 'close' : 'arrow_back'} size={22} color="var(--app-icon)" />
        </button>
      )}
      {actions.map((a) => (
        <button key={`${a.icon}:${a.label}`} className={styles.button} aria-label={a.label} title={a.label} onClick={a.onPress}>
          <Icon name={a.icon} size={22} color="var(--app-icon)" />
        </button>
      ))}
    </div>
  );
}
