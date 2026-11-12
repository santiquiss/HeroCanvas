// The asset picked in App Store Assets, in the URL (`?size=appstore.iphone69`) so a link opens it, and shared by its
// three parts: the list (left panel), the canvas and the requirements (right panel).
import { useCallback, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';
import { assetById, STORES, type StoreAsset, type StoreId } from './sizes';

export const SIZE_PARAM = 'size';
/** The screenshot picked on the canvas (its layers in the left panel), and the layer picked in it (the right panel edits it). */
export const SHOT_PARAM = 'shot';
export const LAYER_PARAM = 'layer';
/** The picked layer when it's the screenshot's background (none picked: no param). */
export const BACKGROUND = 'background';

export function useStoreAsset(): [StoreAsset, (id: string) => void] {
  const [search, setSearch] = useSearchParams();
  const pick = useCallback(
    (id: string) =>
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(SIZE_PARAM, id);
          return next;
        },
        { replace: true },
      ),
    [setSearch],
  );
  return [assetById(search.get(SIZE_PARAM)), pick];
}

/** The screenshot picked and its layer picked (ids, or null). Picking a screenshot drops the layer. */
export function useSelection(): { shot: string | null; layer: string | null; pickShot: (id: string | null, size?: string, layer?: string) => void; pickLayer: (id: string | null) => void } {
  const [search, setSearch] = useSearchParams();
  const patch = useCallback(
    (values: Record<string, string | null>) =>
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(values)) {
            if (v) next.set(k, v);
            else next.delete(k);
          }
          return next;
        },
        { replace: true },
      ),
    [setSearch],
  );
  return {
    shot: search.get(SHOT_PARAM),
    layer: search.get(LAYER_PARAM),
    // A pick without Shift lets go of several picked.
    pickShot: useCallback((id: string | null, size?: string, layer?: string) => (setMulti([]), setShotMulti([]), patch({ [SHOT_PARAM]: id, [LAYER_PARAM]: layer ?? null, ...(size && { [SIZE_PARAM]: size }) })), [patch]),
    pickLayer: useCallback((id: string | null) => (setMulti([]), setShotMulti([]), patch({ [LAYER_PARAM]: id })), [patch]),
  };
}

// Several layers of the open screenshot picked with Shift (to group them, delete them): kept here, not in the URL; the
// last one picked is also the picked layer (`layer`).
let multi: string[] = [];
const multiSubs = new Set<() => void>();
function setMulti(next: string[]) {
  if (next.length === multi.length && next.every((id, i) => id === multi[i])) return;
  multi = next;
  for (const f of multiSubs) f();
}

/** The layers picked with Shift (two or more, or none), and Shift + click's toggle. */
export function useMultiPick(): { ids: string[]; toggle: (id: string) => void; clear: () => void } {
  const ids = useSyncExternalStore(
    (f) => (multiSubs.add(f), () => void multiSubs.delete(f)),
    () => multi,
  );
  const [search, setSearch] = useSearchParams();
  const layer = search.get(LAYER_PARAM);
  const toggle = useCallback(
    (id: string) => {
      // The one picked before starts the set: as the URL has it now (a quick second click comes before the render).
      const now = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(LAYER_PARAM) ?? layer;
      const from = multi.length ? multi : now && now !== BACKGROUND ? [now] : [];
      const next = from.includes(id) ? from.filter((x) => x !== id) : [...from, id];
      setMulti(next.length > 1 ? next : []);
      setSearch(
        (prev) => {
          const p = new URLSearchParams(prev);
          const last = next[next.length - 1];
          if (last) p.set(LAYER_PARAM, last);
          else p.delete(LAYER_PARAM);
          return p;
        },
        { replace: true },
      );
    },
    [layer, setSearch],
  );
  return { ids: ids.length > 1 ? ids : [], toggle, clear: useCallback(() => setMulti([]), []) };
}

/** Each store's asset last picked: switching stores comes back to it. */
const lastOf = new Map<StoreId, string>();

/** The store open: the picked asset's (a link opens on its store). Switching comes back to its last asset. */
export function useStoreTab(): [StoreId, (id: StoreId) => void] {
  const [asset, pick] = useStoreAsset();
  const store = asset.store;
  lastOf.set(store, asset.id);
  const open = (id: StoreId) => {
    if (id === store) return;
    pick(lastOf.get(id) ?? STORES.find((s) => s.id === id)!.groups[0].assets[0].id);
  };
  return [store, open];
}

// Several screenshots picked with Shift (to share one background across them): the screenshot open starts the set.
let shotMulti: string[] = [];
const shotSubs = new Set<() => void>();
function setShotMulti(next: string[]) {
  if (next.length === shotMulti.length && next.every((id, i) => id === shotMulti[i])) return;
  shotMulti = next;
  for (const f of shotSubs) f();
}

/** The screenshots picked with Shift, Shift + click's toggle, and letting go of them. */
export function useShotMultiPick(): { ids: string[]; toggle: (id: string) => void; clear: () => void } {
  const ids = useSyncExternalStore(
    (f) => (shotSubs.add(f), () => void shotSubs.delete(f)),
    () => shotMulti,
  );
  const toggle = useCallback((id: string) => {
    const open = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(SHOT_PARAM);
    const from = shotMulti.length ? shotMulti : open ? [open] : [];
    const next = from.includes(id) ? from.filter((x) => x !== id) : [...from, id];
    setShotMulti(next);
  }, []);
  // The first one picked counts too (no screenshot open yet): marked, waiting for a second.
  return { ids, toggle, clear: useCallback(() => setShotMulti([]), []) };
}
