// Which rows of a panel's tree are open (Pages, Layers), kept outside the panel: switching to another tab and back
// finds the tree as it was. Collapse all / Expand all is remembered per viewer (localStorage), and so are the rows
// when their keys outlive the page (Pages' ids; Layers' elements only while they're on screen).
import { useSyncExternalStore } from 'react';

/** `default`: each row as the panel opens it; `collapsed` / `expanded`: every row closed / open (Collapse / Expand all). */
export type TreeMode = 'default' | 'collapsed' | 'expanded';

interface Saved {
  mode?: TreeMode;
  rows?: [string, boolean][];
}

export interface TreeOpen<K> {
  /** The row's own state, when it was toggled since the last Collapse / Expand all. */
  row(key: K): boolean | undefined;
  /** A row's state by the mode, for one not toggled: `byDefault` in the default mode. */
  byMode(byDefault: boolean): boolean;
  setRow(key: K, open: boolean): void;
  mode(): TreeMode;
  /** Collapse or expand all: every row follows it again. */
  setMode(mode: Exclude<TreeMode, 'default'>): void;
  /** Re-renders the reader on any change. */
  useVersion(): number;
}

const read = (key: string): Saved => {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}') as Saved;
  } catch {
    return {};
  }
};

/** `weak`: keys are elements, held only while they live (not saved). Otherwise string keys, saved with the mode. */
export function treeOpen<K extends string>(id: string): TreeOpen<K>;
export function treeOpen<K extends object>(id: string, opts: { weak: true }): TreeOpen<K>;
export function treeOpen(id: string, { weak = false } = {}): TreeOpen<string | object> {
  const KEY = `hc.tree.${id}`;
  const saved = read(KEY);
  let mode: TreeMode = saved.mode ?? 'default';
  const fresh = () => (weak ? new WeakMap<object, boolean>() : new Map<string, boolean>(saved.rows ?? []));
  let rows: Map<string, boolean> | WeakMap<object, boolean> = fresh();
  let version = 0;
  const listeners = new Set<() => void>();
  const changed = () => {
    version++;
    try {
      localStorage.setItem(KEY, JSON.stringify({ mode, ...(rows instanceof Map ? { rows: [...rows] } : {}) } satisfies Saved));
    } catch {
      /* storage unavailable */
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return {
    row: (key) => (rows as Map<unknown, boolean>).get(key),
    byMode: (byDefault) => (mode === 'default' ? byDefault : mode === 'expanded'),
    setRow: (key, open) => {
      if ((rows as Map<unknown, boolean>).get(key) === open) return;
      (rows as Map<unknown, boolean>).set(key, open);
      changed();
    },
    mode: () => mode,
    setMode: (next) => {
      mode = next;
      saved.rows = [];
      rows = fresh();
      changed();
    },
    useVersion: () => useSyncExternalStore(subscribe, () => version),
  };
}
