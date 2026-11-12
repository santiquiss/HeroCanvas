// What a layer of App Store Assets' open screenshot can do, wherever it's asked: its menu (the layers list's ⋯ and
// right click, the canvas's right click), and grouping several picked into a row or a stack (and back). One menu for
// both: the same items, for the layer picked or the several picked with Shift.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { useCanWrite } from '../persist/devApi';
import { LANG_PARAM, languageIn } from '../sim/language';
import { t } from '../i18n/ui';
import { BACKGROUND, useMultiPick, useSelection, useStoreAsset } from './route';
import { storeOf } from './sizes';
import { crossingInto, plainLayout, type Crossing } from './ShotImage';
import {
  duplicateLayer,
  findLayer,
  groupLayers,
  groupOf,
  canGroup,
  parentOf,
  moveInGroup,
  removeLayer,
  removeLayers,
  restack,
  shotsOf,
  stackOf,
  ungroup,
  updateLayer,
  updateLayerAt,
  resolveAt,
  copyPlacement,
  useCopiedPlacement,
  useShotSets,
  type Layer,
  type StoreShot,
} from './shots';
import { ScreenStateDialog } from './ScreenState';
import styles from './StoreAssets.module.css';

/** The open screenshot, its set and position in it, and the language the canvas shows. */
export function useOpenShot() {
  const [asset] = useStoreAsset();
  const sets = useShotSets();
  const sel = useSelection();
  const [search] = useSearchParams();
  const shots = shotsOf(sets, asset.id);
  const index = shots.findIndex((s) => s.id === sel.shot);
  const shot = shots[index] as StoreShot | undefined;
  // The neighbors' layers reaching into it (listed in it, linked), as the canvas draws them.
  const neighbors = shots.flatMap((n, j) => (j === index ? [] : [{ shot: n, at: j - index }]));
  const crossing: Crossing[] = shot && asset.display ? crossingInto(neighbors, asset.display, storeOf(asset).gap, plainLayout) : [];
  return { asset, sel, shot, index, count: shots.length, shots, crossing, language: languageIn(search.get(LANG_PARAM)) };
}

/** A layer's icon in the list: its kind (a group, by its layout). */
export function kindIcon(l: Layer): string {
  if (l.kind === 'group') return l.layout === 'row' ? 'view_column' : 'view_agenda';
  return { device: 'smartphone', text: 'title', image: 'image', shape: 'category', component: 'widgets' }[l.kind];
}

// The menu open, and where: one for the whole mode (the list and the canvas open the same).
let opened: { x: number; y: number } | null = null;
const subs = new Set<() => void>();
const setOpened = (v: typeof opened) => {
  opened = v;
  for (const f of subs) f();
};
/** Opens the menu of what's picked (the layer, or the several picked with Shift) at (x, y). */
export const openLayerMenu = (x: number, y: number) => setOpened({ x, y });

/** Gap a new group starts with, points of an image 440 wide. */
const NEW_GAP = 16;

/**
 * Where layers of the open screenshot are drawn on the canvas, as shares of its image (their centers): what a group is
 * placed by, and its children when it's let go of. Read from the open size's screenshot.
 */
function centersOf(ids: string[], attr: 'data-store-edited' | 'data-store-child', within?: Element | null): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const id of ids) {
    const el = (within ?? document).querySelector<HTMLElement>(`[${attr}="${CSS.escape(id)}"]`);
    const image = el?.closest<HTMLElement>('[data-store-image]');
    if (!el || !image) continue;
    const r = el.getBoundingClientRect();
    const box = image.getBoundingClientRect();
    out[id] = { x: (r.left + r.width / 2 - box.left) / box.width, y: (r.top + r.height / 2 - box.top) / box.height };
  }
  return out;
}

const round = (v: number) => Math.round(v * 10000) / 10000;

/** The actions on the open screenshot's layers. */
export function useLayerActions() {
  const { asset, sel, shot } = useOpenShot();
  const multi = useMultiPick();
  return {
    /** The several picked (of the screenshot's own, at the top) made a row or a stack, in the order they're drawn. */
    group(layout: 'row' | 'stack') {
      if (!shot || !canGroup(shot.layers, multi.ids)) return;
      const ids = multi.ids;
      // In a group, they're its layers (drawn by it); at the top, layers of their own.
      const nested = parentOf(shot.layers, ids[0]) !== null;
      const at = centersOf(ids, nested ? 'data-store-child' : 'data-store-edited');
      const placed = ids.filter((id) => at[id]);
      if (placed.length < 2) return;
      const order = [...placed].sort((a, b) => (layout === 'row' ? at[a].x - at[b].x : at[a].y - at[b].y));
      // Where they are together: the middle of their centers (in a group, its layout places it).
      const xs = placed.map((id) => at[id].x);
      const ys = placed.map((id) => at[id].y);
      const x = nested ? 0.5 : round((Math.min(...xs) + Math.max(...xs)) / 2);
      const y = nested ? 0.5 : round((Math.min(...ys) + Math.max(...ys)) / 2);
      sel.pickLayer(groupLayers(asset.id, shot.id, order, layout, { x, y, gap: NEW_GAP }));
    },
    /** A group's layers back on their own: at the top, each where it's drawn now; in a group, laid out by it. */
    ungroup(groupId: string) {
      if (!shot) return;
      const g = findLayer(shot.layers, groupId);
      if (!g || g.kind !== 'group') return;
      const nested = parentOf(shot.layers, groupId) !== null;
      const box = nested ? null : document.querySelector(`[data-store-edited="${CSS.escape(groupId)}"]`);
      const places = nested ? {} : centersOf(g.children.map((c) => c.id), 'data-store-child', box);
      for (const k of Object.keys(places)) places[k] = { x: round(places[k].x), y: round(places[k].y) };
      ungroup(asset.id, shot.id, groupId, places);
      sel.pickLayer(null);
    },
    deleteMany() {
      if (!shot) return;
      removeLayers(asset.id, shot.id, multi.ids);
      sel.pickLayer(null);
    },
    multi,
  };
}

type Item = { icon: string; label: string; act: () => void; disabled?: boolean; danger?: boolean };

/** The menu, where it was opened, for what's picked. Mounted once in App Store Assets. */
export function LayerContextMenu() {
  const at = useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => opened,
  );
  const { asset, sel, shot, crossing } = useOpenShot();
  const editable = useCanWrite();
  const actions = useLayerActions();
  const clip = useCopiedPlacement();
  if (!at || !shot) return null;
  const close = () => setOpened(null);
  const items = menuItems();
  return items.length ? <LayerMenu x={at.x} y={at.y} items={items} onClose={close} /> : null;

  function menuItems(): Item[] {
    if (!shot) return [];
    const ids = actions.multi.ids;
    if (ids.length > 1) {
      // Layers of the same list only: the top of the stack, or one group.
      const ok = canGroup(shot.layers, ids);
      return [
        { icon: 'view_column', label: t('Group as a row'), disabled: !editable || !ok, act: () => actions.group('row') },
        { icon: 'view_agenda', label: t('Group as a stack'), disabled: !editable || !ok, act: () => actions.group('stack') },
        { icon: 'delete', label: t('Delete {n} layers', { n: ids.length }), danger: true, disabled: !editable, act: actions.deleteMany },
      ];
    }
    const id = sel.layer;
    if (!id || id === BACKGROUND) return [];
    const link = crossing.find((c) => c.layer.id === id);
    const linkedIds = crossing.map((c) => c.layer.id);
    const stack = stackOf(shot, linkedIds);
    const nudge = (by: -1 | 1) => {
      const next = [...stack];
      const i = next.findIndex((e) => e.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= next.length) return;
      [next[i], next[j]] = [next[j], next[i]];
      restack(asset.id, shot.id, next);
    };
    const i = stack.findIndex((e) => e.id === id);
    if (link) {
      return [
        { icon: 'flip_to_front', label: t('Bring forward'), disabled: !editable || i === stack.length - 1, act: () => nudge(1) },
        { icon: 'flip_to_back', label: t('Send backward'), disabled: !editable || i === 0, act: () => nudge(-1) },
        { icon: 'open_in_new', label: t('Open its screenshot'), act: () => sel.pickShot(link.owner, asset.id, id) },
        { icon: 'link_off', label: t('Stop extending'), disabled: !editable, act: () => (updateLayer(asset.id, link.owner, id, { extend: undefined }), sel.pickLayer(null)) },
      ];
    }
    const layer = findLayer(shot.layers, id);
    if (!layer) return [];
    // Shown or hidden on the open size (on the reference: everywhere it isn't its own).
    const off = !!resolveAt(layer, asset.id).hidden;
    const hide = { icon: off ? 'visibility' : 'visibility_off', label: off ? t('Show') : t('Hide'), disabled: !editable, act: () => updateLayerAt(asset.id, shot.id, id, { hidden: !off }, asset.id) };
    const del = { icon: 'delete', label: t('Delete'), danger: true, disabled: !editable, act: () => (removeLayer(asset.id, shot.id, id), sel.pickLayer(null)) };
    // In a group: its place in the group's order.
    const g = groupOf(shot.layers, id);
    if (g) {
      const k = g.children.findIndex((c) => c.id === id);
      return [
        { icon: g.layout === 'row' ? 'arrow_back' : 'arrow_upward', label: t('Move earlier'), disabled: !editable || k === 0, act: () => moveInGroup(asset.id, shot.id, id, -1) },
        { icon: g.layout === 'row' ? 'arrow_forward' : 'arrow_downward', label: t('Move later'), disabled: !editable || k === g.children.length - 1, act: () => moveInGroup(asset.id, shot.id, id, 1) },
        ...(layer.kind === 'group' ? [{ icon: 'ungroup', label: t('Ungroup'), disabled: !editable, act: () => actions.ungroup(id) }] : []),
        hide,
        del,
      ];
    }
    // Its place and size on this size, to paste on another (an iPad's on the other iPad), as that size's own.
    const copy = { icon: 'content_copy', label: t('Copy position and size'), act: () => copyPlacement(layer, asset.id, asset.label) };
    const paste = {
      icon: 'content_paste',
      label: clip ? t('Paste position and size (from {size})', { size: clip.from }) : t('Paste position and size'),
      disabled: !editable || !clip,
      act: () => clip && updateLayerAt(asset.id, shot.id, id, clip.values as Partial<Layer>, asset.id),
    };
    return [
      { icon: 'flip_to_front', label: t('Bring forward'), disabled: !editable || i === stack.length - 1, act: () => nudge(1) },
      { icon: 'flip_to_back', label: t('Send backward'), disabled: !editable || i === 0, act: () => nudge(-1) },
      ...(layer.kind === 'group' ? [{ icon: 'ungroup', label: t('Ungroup'), disabled: !editable, act: () => actions.ungroup(id) }] : []),
      { icon: 'library_add', label: t('Duplicate'), disabled: !editable, act: () => sel.pickLayer(duplicateLayer(asset.id, shot.id, id)) },
      copy,
      paste,
      hide,
      del,
    ];
  }
}

/** A layer's menu, where it was opened (kept on the screen); a pick, a click elsewhere, Escape or a scroll closes it. */
function LayerMenu({ x, y, items, onClose }: { x: number; y: number; items: { icon: string; label: string; act: () => void; disabled?: boolean; danger?: boolean }[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useEffect(() => {
    const el = ref.current;
    if (el) setPos({ left: Math.min(x, window.innerWidth - el.offsetWidth - 8), top: Math.min(y, window.innerHeight - el.offsetHeight - 8) });
    const away = (e: Event) => !ref.current?.contains(e.target as Node) && onClose();
    // Its Escape only closes it (the canvas's would also drop the layer picked).
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', esc, true);
    window.addEventListener('wheel', onClose, { passive: true });
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', esc, true);
      window.removeEventListener('wheel', onClose);
      window.removeEventListener('blur', onClose);
    };
  }, [x, y, onClose]);
  return createPortal(
    <div ref={ref} className={styles.layerMenu} role="menu" style={pos}>
      {items.map((it) => (
        <button
          key={it.label}
          role="menuitem"
          className={`${styles.layerMenuItem} ${it.danger ? styles.layerMenuDanger : ''}`}
          disabled={it.disabled}
          onClick={() => {
            it.act();
            onClose();
          }}
        >
          <Icon name={it.icon} size={16} />
          {it.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

// Interact with the screen, asked for a device layer (the Layer panel's button, a double click on the canvas): one
// dialog for the whole mode, so it opens with the panel closed too.
let interacting: string | null = null;
const interactSubs = new Set<() => void>();
const setInteracting = (id: string | null) => {
  interacting = id;
  for (const f of interactSubs) f();
};
/** Opens Interact with the screen for device layer `id` of the open screenshot (or a neighbor's reaching into it). */
export const requestInteract = (id: string) => setInteracting(id);

/** The dialog, for the device asked for: what's left on it saved where the layer is (its own screenshot). */
export function InteractHost() {
  const id = useSyncExternalStore(
    (f) => (interactSubs.add(f), () => void interactSubs.delete(f)),
    () => interacting,
  );
  const { asset, shot, shots, crossing, language } = useOpenShot();
  if (!id || !shot || !asset.display) return null;
  const link = crossing.find((c) => c.layer.id === id);
  const owner = link ? shots.find((s) => s.id === link.owner) : shot;
  const raw = owner && findLayer(owner.layers, id);
  if (!owner || !raw || raw.kind !== 'device') return null;
  const close = () => setInteracting(null);
  return (
    <ScreenStateDialog
      layer={resolveAt(raw, asset.id)}
      display={asset.display}
      language={language}
      onClose={close}
      onDone={({ page, query, scroll, taps }) => {
        updateLayerAt(asset.id, owner.id, id, { page, query, scroll: scroll.length ? scroll : undefined, taps: taps.length ? taps : undefined }, asset.id);
        close();
      }}
    />
  );
}
