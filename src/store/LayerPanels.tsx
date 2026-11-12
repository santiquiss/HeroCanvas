// A screenshot's editor, in App Store Assets' two panels. At the left, its layers front to back (the background last),
// with Add (a text, an image, a device with a screen, a shape) and each one's eye; at the right, what the one picked
// is: its position (alignment, X and Y, its box, constraints, turn), then what its kind has (the text and its type, the screen and its frame, the image,
// the shape's fill), and its order, copy and removal; the background when no layer is picked. Edited with the dev
// server (it saves app/store-assets.json); on a deployed site the same, disabled.
import { useContext, useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useNavRoot } from '../nav/context';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { canWrite, uploadImage, useCanWrite } from '../persist/devApi';
import { BASE_LANGUAGE, LANG_PARAM, LANGUAGES, languageIn } from '../sim/language';
import { plural, t } from '../i18n/ui';
import { ColorRow, Dropdown, OwnValues, pct, RangeSlider, ResetValue, Segments, Slider, Toggle } from './controls';
import type { Display } from '../devices/devices';
import { finishesOf, modelsFor } from './Device3D';
import { useLastScreen } from './lastScreen';
import { BACKGROUND, useMultiPick } from './route';
import { storeOf, type StoreAsset } from './sizes';
import { shotName } from './StoreAssets';
import { PositionFields } from './PositionFields';
import {
  addLayer,
  restack,
  stackOf,
  type StackEntry,
  newId,
  setBackground,
  runOf,
  unifyBackground,
  separateBackground,
  setSpread,
  type StoreShot,
  updateLayer,
  updateLayerAt,
  findLayer,
  groupOf,
  canGroup,
  resolveAt,
  sourceAt,
  ownsDevice,
  setOwnDevice,
  dropOwn,
  REFERENCE_SIZE,
  REF_W,
  inShares,
  type Background,
  type DeviceFade,
  type DeviceLayer,
  type GroupLayer,
  type Layer,
  type TextLayer,
  type ComponentLayer,
  DEFAULT_GLASS,
  anchorSide,
  shotsNow,
  type Glass,
} from './shots';
import { SHADOW_PRESETS } from '../capture/prefs';
import { generatePalette, newSeed, PRESETS, presetControls, presetCss, resolvePreset, shiftLightness, type PresetBackground } from './backgrounds';
import { backgroundCss, edgesCrossed, lightOf, plainLayout, reachOf, textIn } from './ShotImage';
import { kindIcon, openLayerMenu, requestInteract, useLayerActions, useOpenShot } from './layerMenu';
import { AngleSection, ColorSection, LightingSection, ShadowSection } from '../capture/CaptureSections';
import { DEFAULT_SHADOW } from '../capture/exportImage';
import { FLAT } from '../capture/tilt';
import { STORIES } from '../design/stories';
import panel from '../tools/Panel.module.css';
import styles from './StoreAssets.module.css';



type AlignHow = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'spaceX' | 'spaceY';
const ALIGNS: { how: AlignHow; icon: string; label: string }[] = [
  { how: 'left', icon: 'align_horizontal_left', label: t('Align left edges') },
  { how: 'centerX', icon: 'align_horizontal_center', label: t('Align centers across') },
  { how: 'right', icon: 'align_horizontal_right', label: t('Align right edges') },
  { how: 'top', icon: 'align_vertical_top', label: t('Align top edges') },
  { how: 'centerY', icon: 'align_vertical_center', label: t('Align centers down') },
  { how: 'bottom', icon: 'align_vertical_bottom', label: t('Align bottom edges') },
];
const DISTRIBUTES: { how: AlignHow; icon: string; label: string }[] = [
  { how: 'spaceX', icon: 'horizontal_distribute', label: t('Distribute across, the same space between') },
  { how: 'spaceY', icon: 'vertical_distribute', label: t('Distribute down, the same space between') },
];

/**
 * The layers picked, lined up on the box around them all (as Figma), or spread with the same space between: each as
 * the open size draws it (its box on the canvas), moved by the point it's placed by, on the open size's breakpoint.
 * Each one's change lands in one undo step.
 */
function alignPicked(asset: StoreAsset, shotId: string, ids: string[], how: AlignHow) {
  const display = asset.display;
  const shot = shotsNow().find((s) => s.id === shotId);
  if (!display || !shot) return;
  const boxes = ids.flatMap((id) => {
    const raw = shot.layers.find((l) => l.id === id);
    const el = document.querySelector<HTMLElement>(`[data-store-edited="${CSS.escape(id)}"]`);
    if (!raw || !el) return [];
    const l = resolveAt(raw, asset.id);
    const w = el.offsetWidth / display.w;
    const h = el.offsetHeight / display.h;
    // Its left and top edges, from the point it's placed by (its center, or the edge it's anchored to).
    const left = l.x - (w * (1 + anchorSide(l.ax))) / 2;
    const top = l.y - (h * (1 + anchorSide(l.ay))) / 2;
    return [{ l, w, h, left, top }];
  });
  if (boxes.length < 2) return;
  const minL = Math.min(...boxes.map((b) => b.left));
  const maxR = Math.max(...boxes.map((b) => b.left + b.w));
  const minT = Math.min(...boxes.map((b) => b.top));
  const maxB = Math.max(...boxes.map((b) => b.top + b.h));
  const at = (b: (typeof boxes)[number], left: number, top: number) => ({ x: left + (b.w * (1 + anchorSide(b.l.ax))) / 2, y: top + (b.h * (1 + anchorSide(b.l.ay))) / 2 });
  const place = new Map<string, { x: number; y: number }>();
  for (const b of boxes) {
    const left = how === 'left' ? minL : how === 'right' ? maxR - b.w : how === 'centerX' ? (minL + maxR) / 2 - b.w / 2 : b.left;
    const top = how === 'top' ? minT : how === 'bottom' ? maxB - b.h : how === 'centerY' ? (minT + maxB) / 2 - b.h / 2 : b.top;
    place.set(b.l.id, at(b, left, top));
  }
  // Spread: the first and the last stay, the space between them shared equally.
  if (how === 'spaceX' || how === 'spaceY') {
    const across = how === 'spaceX';
    const sorted = [...boxes].sort((a, b) => (across ? a.left - b.left : a.top - b.top));
    const span = across ? maxR - minL : maxB - minT;
    const sizes = sorted.reduce((n, b) => n + (across ? b.w : b.h), 0);
    const gap = (span - sizes) / (sorted.length - 1);
    let pos = across ? minL : minT;
    for (const b of sorted) {
      place.set(b.l.id, across ? at(b, pos, b.top) : at(b, b.left, pos));
      pos += (across ? b.w : b.h) + gap;
    }
  }
  const r = (v: number) => Math.round(v * 10000) / 10000;
  for (const [id, p] of place) updateLayerAt(asset.id, shotId, id, { x: r(p.x), y: r(p.y) }, asset.id);
}

/** A layer's name in the list: its own, or what it shows. */
function useLayerName() {
  const [search] = useSearchParams();
  const language = languageIn(search.get(LANG_PARAM));
  return (l: Layer): string => {
    if (l.name) return l.name;
    switch (l.kind) {
      case 'device':
        return t('Device');
      case 'text':
        return textIn(l, language).split('\n')[0] || t('Text');
      case 'image':
        return l.src.split('/').pop() ?? t('Image');
      case 'shape':
        return l.shape === 'ellipse' ? t('Ellipse') : t('Rectangle');
      case 'group':
        return l.layout === 'row' ? t('Row') : t('Stack');
      case 'component':
        return `${l.component} · ${l.story}`;
    }
  };
}

/** The left panel with a screenshot open: back to the assets, Add, its layers front to back, the background. */
/** The groups folded in the layers list, by id: for the session, whichever screenshot is open. */
const FOLDED = new Set<string>();

export function LayersList() {
  const { asset, sel, shot, index, shots, crossing, language } = useOpenShot();
  const editable = useCanWrite();
  const name = useLayerName();
  const last = useLastScreen();
  const pages = useNavRoot().pages;
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (!shot) return null;
  const add = (layer: Layer) => sel.pickLayer(addLayer(asset.id, shot.id, layer));
  const addText = () => add({ id: newId(), kind: 'text', text: { [language]: t('A short, clear title') }, size: Math.round(REF_W * 0.085), weight: 700, color: '#111111', align: 'center', x: 0.5, y: 0.07, ay: 'top', w: 0.86, rotate: 0 });
  const addShape = () => add({ id: newId(), kind: 'shape', shape: 'rect', h: 0.3, fill: '#FFFFFF', radius: 24, x: 0.5, y: 0.5, w: 0.7, rotate: 0 });
  // The screen open in Prototype, or the first page: Interact with the screen takes it anywhere.
  const start = last ?? { page: { id: Object.keys(pages)[0], params: {} }, query: '' };
  const addDevice = () => add({ id: newId(), kind: 'device', page: start.page, query: start.query, frame: true, x: 0.5, y: 0.5, w: 0.78, rotate: 0 });
  // The first component with stories, as its first story draws it: the panel picks another.
  const firstStory = [...STORIES.values()][0];
  const addComponent = () => firstStory && add({ id: newId(), kind: 'component', component: firstStory.component, story: firstStory.stories[0]?.name ?? '', frameW: COMPONENT_FRAME_W, x: 0.5, y: 0.5, w: 0.6, rotate: 0 });
  const addImage = async (f: File | undefined) => {
    if (!f || !(await canWrite())) return;
    setBusy(true);
    try {
      add({ id: newId(), kind: 'image', src: await uploadImage(f), x: 0.5, y: 0.5, w: 0.5, rotate: 0 });
    } catch (e) {
      console.warn('App Store Assets: the image wasn’t saved.', e);
    } finally {
      setBusy(false);
    }
  };
  // Its stack, front first: its own layers, and the neighbors' reaching into it (linked: saved in theirs, ordered here).
  const linkedBy = new Map(crossing.map((c) => [c.layer.id, c]));
  const stack = stackOf(shot, crossing.map((c) => c.layer.id));
  const front = [...stack].reverse();
  const layerOf = (e: StackEntry): Layer => (e.linked ? linkedBy.get(e.id)!.layer : shot.layers.find((l) => l.id === e.id)!);
  const ownerOf = (e: StackEntry): string => (e.linked ? linkedBy.get(e.id)!.owner : shot.id);
  // A layer's menu (its right click, or its ⋯): picked first (Shift keeps the others), then the shared menu.
  const multi = useMultiPick();
  const openMenu = (id: string, x: number, y: number) => {
    if (!multi.ids.includes(id)) sel.pickLayer(id);
    openLayerMenu(x, y);
  };
  // A click picks it; Shift + click picks it with the others (to group them), its own at the top only.
  const pick = (id: string, shift: boolean, own: boolean) => (shift && own ? multi.toggle(id) : sel.pickLayer(id));
  const isOn = (id: string) => (multi.ids.length ? multi.ids.includes(id) : sel.layer === id);
  // Dragging a layer in the list: which, and where it would land (a place among the rows, front first). The
  // background isn't one of them: it stays at the bottom.
  const [drag, setDrag] = useState<{ id: string; over: number | null } | null>(null);
  const dropAt = (row: number, e: DragEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2 ? row : row + 1;
  };
  const drop = () => {
    if (!drag || drag.over === null) return setDrag(null);
    const from = front.findIndex((l) => l.id === drag.id);
    // Among the others (front first), then as the stack's index (back first).
    const to = drag.over > from ? drag.over - 1 : drag.over;
    if (to !== from) {
      const next = [...front];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      restack(asset.id, shot.id, next.reverse());
    }
    setDrag(null);
  };
  // Groups folded in the list (kept while the panel comes and goes); one holding the layer picked stays open.
  const [, redraw] = useState(0);
  const groupsIn = (list: Layer[]): GroupLayer[] => list.flatMap((l) => (l.kind === 'group' ? [l, ...groupsIn(l.children)] : []));
  const groups = groupsIn(shot.layers);
  const folded = (g: GroupLayer) => FOLDED.has(g.id) && !findLayer(g.children, sel.layer);
  const fold = (ids: string[], on: boolean) => {
    for (const id of ids) {
      if (on) FOLDED.add(id);
      else FOLDED.delete(id);
    }
    redraw((n) => n + 1);
  };
  const allFolded = groups.length > 0 && groups.every((g) => FOLDED.has(g.id));
  /** One row: a layer of the stack, or (indented) a group's. */
  const row = (l: Layer, owner: string, opts: { linked?: boolean; depth?: number; drag?: { row: number } } = {}) => {
    // Shown or hidden on the open size: its own there in this size's color (the panel's Visible resets it).
    const off = !!resolveAt(l, asset.id).hidden;
    const ownHidden = !!sourceAt(l, 'hidden', asset.id);
    return (
    <div
      draggable={editable && !!opts.drag}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', l.id);
        setDrag({ id: l.id, over: null });
      }}
      onDragEnd={() => setDrag(null)}
      className={`${styles.layerRow} ${isOn(l.id) ? styles.layerRowOn : ''} ${off ? styles.layerHidden : ''} ${drag?.id === l.id ? styles.layerDragged : ''}`}
      style={opts.depth ? { paddingLeft: 16 * opts.depth } : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenu(l.id, e.clientX, e.clientY);
      }}
    >
      {/* A group folds and unfolds; the others keep its room, so names line up. */}
      {l.kind === 'group' && !opts.linked ? (
        <button className={styles.layerFold} onClick={() => fold([l.id], !FOLDED.has(l.id))} aria-expanded={!folded(l)} aria-label={folded(l) ? t('Expand') : t('Collapse')} title={folded(l) ? t('Expand') : t('Collapse')}>
          <Icon name={folded(l) ? 'chevron_right' : 'expand_more'} size={16} />
        </button>
      ) : (
        <span className={styles.layerFoldSpace} />
      )}
      <button
        className={styles.layerPick}
        onClick={(e) => pick(l.id, e.shiftKey, !opts.linked)}
        aria-current={isOn(l.id) ? 'true' : undefined}
        title={opts.linked ? t('Linked: from screenshot {n}, it reaches into this one. Move, size and order it here too.', { n: shots.findIndex((x) => x.id === owner) + 1 }) : undefined}
      >
        <Icon name={kindIcon(l)} size={16} />
        <span className={styles.layerName}>{name(l)}</span>
        {opts.linked && <Icon name="link" size={14} color="var(--ui-blue-text)" />}
      </button>
      <button
        className={`${styles.icon} ${styles.layerMore}`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          openMenu(l.id, r.left, r.bottom + 4);
        }}
        aria-label={t('More')}
        title={t('More')}
        aria-haspopup="menu"
      >
        <Icon name="more_horiz" size={16} />
      </button>
      <button className={styles.icon} disabled={!editable} data-bp={ownHidden ? 'device' : undefined} onClick={() => updateLayerAt(asset.id, owner, l.id, { hidden: !off }, asset.id)} aria-label={off ? t('Show') : t('Hide')} title={ownHidden ? (off ? t('Hidden on this size only') : t('Shown on this size only')) : off ? t('Show') : t('Hide')}>
        <Icon name={off ? 'visibility_off' : 'visibility'} size={16} />
      </button>
    </div>
    );
  };
  /** A group's layers, indented a step a level (a group in it, its own under it). */
  const nested = (g: GroupLayer, depth: number): ReactNode =>
    g.children.map((c) => (
      <div key={c.id}>
        {row(c, shot.id, { depth })}
        {c.kind === 'group' && !folded(c) && nested(c, depth + 1)}
      </div>
    ));
  return (
    <div className={styles.panel}>
      {/* The screenshot as the canvas names it: its place and its screen. */}
      <h3 className={`${styles.guideTitle} ${styles.shotTitle}`}>
        <span className={styles.number}>{index + 1}</span>
        {shotName(shot, pages)}
      </h3>
      {editable && <h4 className={styles.fieldTitle}>{t('Add')}</h4>}
      {editable && (
        <div className={styles.addRow} role="group" aria-label={t('Add a layer')}>
          <button className={styles.addBtn} onClick={addText} title={t('Add a text')}>
            <Icon name="title" size={18} />
            {t('Text')}
          </button>
          <button className={styles.addBtn} onClick={() => file.current?.click()} disabled={busy} title={t('Add an image from your computer')}>
            <Icon name="image" size={18} />
            {t('Image')}
          </button>
          <button className={styles.addBtn} onClick={addDevice} title={t('Add a device with a screen')}>
            <Icon name="smartphone" size={18} />
            {t('Device')}
          </button>
          <button className={styles.addBtn} onClick={addShape} title={t('Add a shape')}>
            <Icon name="category" size={18} />
            {t('Shape')}
          </button>
          <button className={styles.addBtn} onClick={addComponent} disabled={!firstStory} title={t('Add one of the app’s components, from its stories')}>
            <Icon name="widgets" size={18} />
            {t('Component')}
          </button>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => void addImage(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
        </div>
      )}
      {/* The list's title, and with groups in it, folding them all (or unfolding them). */}
      <div className={styles.layersHead}>
        <h4 className={styles.fieldTitle}>{t('Layers')}</h4>
        {groups.length > 0 && (
          <button className={styles.icon} onClick={() => fold(groups.map((g) => g.id), !allFolded)} title={allFolded ? t('Expand all') : t('Collapse all')} aria-label={allFolded ? t('Expand all') : t('Collapse all')}>
            <Icon name={allFolded ? 'unfold_more' : 'unfold_less'} size={16} />
          </button>
        )}
      </div>
      <ul className={styles.layers} aria-label={t('Layers')}>
        {front.map((e, i) => {
          const l = layerOf(e);
          return (
            <li
              key={e.id}
              className={`${drag?.over === i ? styles.dropBefore : ''} ${drag?.over === i + 1 && i === front.length - 1 ? styles.dropAfter : ''}`}
              onDragOver={(ev) => {
                if (!drag) return;
                ev.preventDefault();
                const over = dropAt(i, ev);
                if (over !== drag.over) setDrag({ ...drag, over });
              }}
              onDrop={(ev) => {
                ev.preventDefault();
                drop();
              }}
            >
              {row(l, ownerOf(e), { linked: e.linked, drag: { row: i } })}
              {/* A group's layers under it, in its order (a row's left to right, a stack's top to bottom). */}
              {!e.linked && l.kind === 'group' && !folded(l) && nested(l, 1)}
            </li>
          );
        })}
        <li>
          <div className={`${styles.layerRow} ${sel.layer === BACKGROUND ? styles.layerRowOn : ''}`}>
            <span className={styles.layerFoldSpace} />
            <button className={styles.layerPick} onClick={() => sel.pickLayer(BACKGROUND)} aria-current={sel.layer === BACKGROUND ? 'true' : undefined}>
              <span className={styles.layerSwatch} style={{ background: backgroundCss(shots[runOf(shots, index).start].background) }} />
              <span className={styles.layerName}>{t('Background')}</span>
            </button>
          </div>
        </li>
      </ul>
      {multi.ids.length > 1 && <p className={styles.guideText}>{t('{n} layers picked: right click to group them as a row or a stack.', { n: multi.ids.length })}</p>}
    </div>
  );
}


/** The right panel's Layer tab: what the picked layer is (or the background), edited where it's saved. */
export function LayerPanel() {
  const { asset, sel, shot, index, count, shots, crossing, language } = useOpenShot();
  const editable = useCanWrite();
  const actions = useLayerActions();
  if (!shot)
    return (
      <div className={styles.panel}>
        <div className={styles.emptyPanel}>
          <Icon name="touch_app" size={22} />
          <strong>{t('Pick a screenshot')}</strong>
          <span>{t('Click one on the canvas: its layers show at the left, and here what the one you pick is.')}</span>
        </div>
      </div>
    );
  // A neighbor's layer reaching into this one, picked here: edited where it's saved, its own screenshot.
  const link = crossing.find((c) => c.layer.id === sel.layer);
  const ownerId = link?.owner ?? shot.id;
  const ownerIndex = link ? shots.findIndex((x) => x.id === link.owner) : index;
  const raw = findLayer((link ? shots[ownerIndex] : shot)?.layers ?? [], sel.layer);
  const off = !editable;
  // Several picked (Shift): what they can do together.
  if (actions.multi.ids.length > 1) {
    const ok = canGroup(shot.layers, actions.multi.ids);
    return (
      <div className={styles.panel}>
        <section className={styles.guide}>
          <h3 className={styles.guideTitle}>{t('{n} layers picked', { n: actions.multi.ids.length })}</h3>
          <p className={styles.guideText}>{t('Grouped, they’re laid out together: side by side (a row) or one under the other (a stack), as far apart as you set, and placed as one.')}</p>
          <h4 className={styles.fieldTitle}>{t('Align')}</h4>
          <div className={styles.alignRow} role="group" aria-label={t('Align')}>
            {ALIGNS.map((a) => (
              <button key={a.how} className={styles.icon} disabled={off} onClick={() => alignPicked(asset, shot.id, actions.multi.ids, a.how)} title={a.label} aria-label={a.label}>
                <Icon name={a.icon} size={18} />
              </button>
            ))}
          </div>
          {actions.multi.ids.length > 2 && (
            <div className={styles.alignRow} role="group" aria-label={t('Distribute')}>
              {DISTRIBUTES.map((a) => (
                <button key={a.how} className={styles.icon} disabled={off} onClick={() => alignPicked(asset, shot.id, actions.multi.ids, a.how)} title={a.label} aria-label={a.label}>
                  <Icon name={a.icon} size={18} />
                </button>
              ))}
            </div>
          )}
          <div className={styles.gap} />
          <div className={styles.listingActions}>
            <button className={styles.button} disabled={off || !ok} onClick={() => actions.group('row')}>
              <Icon name="view_column" size={16} />
              {t('Group as a row')}
            </button>
            <button className={styles.button} disabled={off || !ok} onClick={() => actions.group('stack')}>
              <Icon name="view_agenda" size={16} />
              {t('Group as a stack')}
            </button>
          </div>
        </section>
      </div>
    );
  }
  if (sel.layer === BACKGROUND)
    return (
      <div className={styles.panel}>
        <section className={styles.guide}>
          <h3 className={styles.guideTitle}>{t('Background')}</h3>
          <RunFields asset={asset} shots={shots} index={index} disabled={off} />
          {/* In a run, the run's (its first one's): changed here, it changes across them all. */}
          <BackgroundField value={shots[runOf(shots, index).start].background} disabled={off} onChange={(b) => setBackground(asset.id, shots[runOf(shots, index).start].id, b)} />
        </section>
      </div>
    );
  if (!raw)
    return (
      <div className={styles.panel}>
        <div className={styles.emptyPanel}>
          <Icon name="touch_app" size={22} />
          <strong>{t('Pick a layer')}</strong>
          <span>{t('Click one on the screenshot, or in the list at the left: here, what it is.')}</span>
        </div>
      </div>
    );
  // The layer as laid out on the open size's breakpoint; what's changed here is kept as that breakpoint's.
  // The open size (its id): a layer with values of its own there is laid out there by them, and changed there alone.
  const device = asset.id;
  const layer = resolveAt(raw, device);
  const set = (patch: Partial<Layer>) => updateLayerAt(asset.id, ownerId, raw.id, patch, device);
  // The controls' own values on this size (in color, each with a reset): OwnValues.
  // A value with those that go with it (TOGETHER): its own if any of them is, and reset all at once.
  const ownAt = (k: string) => ((TOGETHER[k] ?? [k]).some((key) => sourceAt(raw, key, device)) ? 'device' : undefined);
  const own = { from: ownAt, reset: (k: string) => resetKey(k) };
  // One value back to the reference's on this size.
  const resetKey = (key: string) => updateLayer(asset.id, ownerId, raw.id, dropOwn(raw, device, [...(TOGETHER[key] ?? [key]), ...(RESET_ALSO[key] ?? [])]));
  // In a group, its place is the group's: only its size and turn are its own.
  const inGroup = !!groupOf(shot.layers, raw.id);
  // Sections as Capture's: its place, then what its kind has (a device: its screen, then its look).
  const section = (title: string, body: ReactNode) => (
    <section className={panel.section}>
      <div className={panel.sectionTitle}>
        <span>{title}</span>
      </div>
      <div className={styles.sectionBody}>{body}</div>
    </section>
  );
  return (
    <OwnValues.Provider value={own}>
    <div className={`${styles.panel} ${styles.layerPanel}`}>
      {section(
        t('Position'),
        <>
          <SizeScope asset={asset} layer={raw} disabled={off} onReset={() => updateLayer(asset.id, ownerId, raw.id, setOwnDevice(raw, device, false))} />
          <PositionFields layer={layer} display={asset.display!} disabled={off} set={set} from={ownAt} reset={resetKey} mode={inGroup ? 'child' : layer.kind === 'group' ? 'group' : 'free'} />
          <Toggle field="hidden" label={t('Visible')} value={!layer.hidden} disabled={off} onChange={(on) => set({ hidden: !on })} />
          {!inGroup && <Toggle label={t('Extend into the screenshots beside it')} value={!!layer.extend} disabled={off} onChange={(on) => set({ extend: on || undefined })} />}
          {link && (
            <p className={`${styles.guideText} ${styles.crossing}`}>
              <Icon name="link" size={14} />
              {t('Linked from screenshot {n}: saved there, moved and ordered here too', { n: ownerIndex + 1 })}
            </p>
          )}
          <CrossingNote layer={layer} display={asset.display!} index={ownerIndex} count={count} gap={storeOf(asset).gap} />
        </>,
      )}
      {layer.kind === 'group' && section(t('Layout'), <GroupFields layer={layer} disabled={off} set={set} onUngroup={() => actions.ungroup(layer.id)} />)}
      {layer.kind === 'group' && section(t('Fade'), <FadeFields layer={layer} disabled={off} set={set} from={sourceAt(raw, 'fade', device)} reset={() => resetKey('fade')} />)}
      {layer.kind === 'device' &&
        section(
          t('Screen'),
          <>
            <button className={`${styles.button} ${styles.primary} ${styles.wide} ${styles.first}`} disabled={off} onClick={() => requestInteract(raw.id)}>
              <Icon name="open_in_full" size={16} />
              {t('Interact with the screen')}
            </button>
            <Segments field="theme" label={t('Appearance')} caption={t('Appearance')} value={layer.theme ?? 'light'} disabled={off} onChange={(theme) => set({ theme: theme === 'light' ? undefined : theme })} options={[{ value: 'light', label: t('Light') }, { value: 'dark', label: t('Dark') }]} />
            {layer.scroll?.length || layer.taps?.length ? <p className={styles.guideText}>{t('Kept as it was left: scrolled, and with what was opened on it.')}</p> : null}
            <ReplaceField layer={layer} language={language} disabled={off} set={set} />
            <RecolorField layer={layer} disabled={off} set={set} />
          </>,
        )}
      {layer.kind === 'text' && section(t('Text'), <TextFields layer={layer} language={language} disabled={off} set={set} from={ownAt} reset={resetKey} />)}
      {layer.kind === 'shape' &&
        section(
          t('Shape'),
          <>
            <Segments
              field="shape"
              label={t('Shape')}
              value={layer.shape}
              disabled={off}
              onChange={(shape) => set({ shape })}
              options={[
                { value: 'rect', label: t('Rectangle') },
                { value: 'ellipse', label: t('Ellipse') },
                { value: 'viewfinder', label: t('Viewfinder'), title: t('Only its four corners, as a camera frames a photo') },
              ]}
            />
            {layer.shape !== 'ellipse' && <Slider field="radius" label={t('Corners')} value={layer.radius} min={0} max={layer.shape === 'viewfinder' ? 60 : 200} step={1} format={(v) => `${v}`} disabled={off} onChange={(radius) => set({ radius })} />}
            {layer.shape === 'viewfinder' && (
              <>
                <Slider field="stroke" label={t('Thickness')} value={layer.stroke ?? 5} min={1} max={20} step={0.5} format={(v) => `${v} pt`} disabled={off} onChange={(stroke) => set({ stroke })} />
                <Slider field="arm" label={t('Corner length')} value={layer.arm ?? 0.18} min={0.05} max={0.5} step={0.01} format={pct} disabled={off} onChange={(arm) => set({ arm })} />
              </>
            )}
            <ColorRow field="fill" label={layer.shape === 'viewfinder' ? t('Color') : t('Fill')} value={layer.fill} disabled={off} onChange={(fill) => set({ fill })} />
            <Segments field="shadow" label={t('Shadow')} caption={t('Shadow')} value={layer.shadow ?? 'none'} disabled={off} onChange={(shadow) => set({ shadow: shadow === 'none' ? undefined : shadow })} options={SHADOW_PRESETS.filter((p) => p.id !== 'custom').map((p) => ({ value: p.id, label: p.label }))} />
          </>,
        )}
      {layer.kind === 'image' &&
        section(
          t('Image'),
          <>
            <p className={styles.guideText}>{layer.src}</p>
            <Toggle field="flip" label={t('Mirror')} value={!!layer.flip} disabled={off} onChange={(flip) => set({ flip: flip || undefined })} />
          </>,
        )}
      {layer.kind === 'component' && section(t('Component'), <ComponentFields layer={layer} language={language} disabled={off} set={set} />)}
      {layer.kind === 'device' && <DeviceLook layer={layer} display={asset.display!} disabled={off} set={set} />}
      {layer.kind === 'device' && section(t('Fade'), <FadeFields layer={layer} disabled={off} set={set} from={sourceAt(raw, 'fade', device)} reset={() => resetKey('fade')} />)}
    </div>
    </OwnValues.Provider>
  );
}

/**
 * Values that go together, kept and reset as one: a place with its constraint, a size with its unit, the glare with
 * where it is and how strong, and a shadow's preset with its look.
 */
const TOGETHER: Record<string, string[]> = {
  x: ['x', 'ax'],
  y: ['y', 'ay'],
  w: ['w', 'wUnit'],
  h: ['h', 'hUnit'],
  glare: ['glare', 'glareSide', 'glareStrength'],
  shadow: ['shadow', 'shadowLook'],
};
/** Reset with a value without making it its own: a model back to the reference's takes its color back too. */
const RESET_ALSO: Record<string, string[]> = { model: ['finish'] };

/**
 * A device's look, with Capture's own sections (capture/CaptureSections), as Capture sets them: framed, its model, color
 * and metal, and its angle; always, the light with the glass's glare, and its shadow. Disabled where it can't be saved.
 */
function DeviceLook({ layer, display, disabled, set }: { layer: DeviceLayer; display: Display; disabled: boolean; set: (patch: Partial<Layer>) => void }) {
  const models = modelsFor(display);
  const model = models.find((m) => m.device.id === layer.model) ?? models[0];
  const finishes = finishesOf(model?.device.id);
  const light = lightOf(layer);
  const fills = !layer.frame && inShares(layer, display).w >= 0.999 && layer.rotate === 0;
  const preset = layer.shadow ?? (fills ? 'none' : 'medium');
  // This size's own values (the reference's elsewhere): their sections' names in its color, with a reset.
  const owned = useContext(OwnValues);
  const ownOf = (key: string) => (owned?.from(key) ? () => owned.reset(key) : undefined);
  const modelOwn = ownOf('model');
  return (
    <fieldset className={styles.captureLook} disabled={disabled}>
      <section className={panel.section}>
        <div className={panel.sectionTitle}>
          <span>{t('Device')}</span>
        </div>
        <div className={styles.sectionBody}>
        {/* Off: the screen alone, with its corners. */}
        <Toggle field="frame" label={t('Frame')} value={layer.frame} disabled={disabled} onChange={(frame) => set({ frame })} />
        {/* Unframed, the screen can sit in a glass slab instead. */}
        {!layer.frame && !fills && <GlassFields glass={layer.glass} disabled={disabled} onChange={(glass) => set({ glass })} />}
        {/* The model, then how it's drawn: as it is (its finish and metal) or minimal, clay in one color. */}
        {layer.frame &&
          (models.length > 1 ? (
            <div className={styles.captioned} data-bp={modelOwn ? 'device' : undefined}>
              <span className={styles.caption}>
                {t('Model')}
                {modelOwn && <ResetValue onReset={modelOwn} disabled={disabled} />}
              </span>
              <Dropdown label={t('Model')} value={model.device.id} options={models.map((m) => ({ value: m.device.id, label: m.device.name }))} onChange={(id) => set({ model: id, finish: undefined })} />
            </div>
          ) : (
            model && <p className={styles.guideText}>{model.device.name}</p>
          ))}
        {layer.frame && (
          <Segments
            field="look"
            label={t('Style')}
            caption={t('Style')}
            value={layer.look ?? 'device'}
            disabled={disabled}
            onChange={(look) => set({ look: look === 'device' ? undefined : look })}
            options={[
              { value: 'device', label: t('Realistic'), title: t('The device as it is: its finish and bezel') },
              { value: 'minimal', label: t('Minimal'), title: t('The same device in one color, matte, like clay') },
            ]}
          />
        )}
        {layer.frame && layer.look === 'minimal' && (
          <ColorRow field="minimalColor" label={t('Color')} value={layer.minimalColor ?? '#F2F3F6'} disabled={disabled} onChange={(minimalColor) => set({ minimalColor })} />
        )}
        {layer.frame && layer.look !== 'minimal' && (
          <ColorSection finishes={finishes} color={layer.finish ?? finishes[0].color} onColor={(finish) => set({ finish })} light={light} onLight={(l) => set({ light: l })} own={ownOf('finish')} />
        )}
        </div>
      </section>
      {layer.frame && (
        <>
          <AngleSection tilt={layer.tilt ?? FLAT} onTilt={(tilt) => set({ tilt })} hint={t('On the canvas, Alt + drag turns it.')} own={ownOf('tilt')} />
        </>
      )}
      <LightingSection
        light={light}
        onLight={(l) => set({ light: l })}
        glare={{ on: !!layer.glare, side: layer.glareSide ?? 'top', strength: layer.glareStrength ?? 0.8 }}
        onGlare={(g) => set({ ...(g.on !== undefined && { glare: g.on }), ...(g.side && { glareSide: g.side }), ...(g.strength !== undefined && { glareStrength: g.strength }) })}
        own={{ light: ownOf('light'), glare: ownOf('glare') }}
      />
      <ShadowSection
        preset={preset}
        look={layer.shadowLook ?? SHADOW_PRESETS.find((x) => x.id === preset)?.look ?? DEFAULT_SHADOW}
        onChange={(c) => set({ ...(c.shadowPreset && { shadow: c.shadowPreset }), ...(c.shadowLook && { shadowLook: c.shadowLook }), ...(c.shadowPreset === 'none' && { shadow: 'none' }) })}
        own={ownOf('shadow')}
      />
    </fieldset>
  );
}

/** A group's name inside a section (Typography, Background): a line above it sets it apart. */
function Subhead({ title }: { title: string }) {
  return <h4 className={styles.subhead}>{title}</h4>;
}

function TextFields({ layer, language, disabled, set, from, reset }: { layer: TextLayer; language: string; disabled: boolean; set: (patch: Partial<Layer>) => void; from?: (key: string) => 'device' | undefined; reset?: (key: string) => void }) {
  const languageName = LANGUAGES.find((l) => l.id === language)?.name ?? language;
  const own = layer.text[language] != null;
  return (
    <>
      <label className={styles.textField}>
        <span className={styles.sliderHead}>
          <span>{languageName}</span>
          {!own && language !== BASE_LANGUAGE && <span className={styles.mono}>{t('from the base language')}</span>}
        </span>
        <textarea rows={3} value={textIn(layer, language)} disabled={disabled} onChange={(e) => set({ text: { ...layer.text, [language]: e.target.value } })} />
      </label>
      <Subhead title={t('Typography')} />
      <Segments
        field="font"
        label={t('Typeface')}
        caption={t('Typeface')}
        value={layer.font ?? 'app'}
        disabled={disabled}
        onChange={(font) => set({ font, ...(font === 'google' && !layer.family && { family: DEFAULT_GOOGLE_FAMILY }) })}
        options={[
          { value: 'app', label: t('The app’s'), title: t('The typeface the app’s screens use') },
          { value: 'system', label: t('System'), title: t('The device’s own (San Francisco, Roboto)') },
          { value: 'serif', label: t('Serif') },
          { value: 'google', label: t('Google'), title: t('A family from Google Fonts, by its name') },
        ]}
      />
      {layer.font === 'google' && (
        <label className={styles.textField}>
          <span className={styles.sliderHead}>
            <span>{t('Family')}</span>
            <span className={styles.mono}>fonts.google.com</span>
          </span>
          <input className={styles.field} value={layer.family ?? ''} disabled={disabled} placeholder="Nunito" onChange={(e) => set({ family: e.target.value })} />
        </label>
      )}
      <Slider field="size" label={t('Size')} value={layer.size} min={8} max={160} step={1} format={(v) => `${v} pt`} disabled={disabled} onChange={(size) => set({ size })} from={from?.('size')} onReset={reset && (() => reset('size'))} />
      <Segments field="weight" label={t('Weight')} caption={t('Weight')} value={layer.weight} disabled={disabled} onChange={(weight) => set({ weight })} options={[400, 500, 600, 700, 800].map((w) => ({ value: w as TextLayer['weight'], label: <span style={{ fontWeight: w }}>Aa</span>, title: String(w) }))} />
      <Toggle field="italic" label={t('Italic')} value={!!layer.italic} disabled={disabled} onChange={(italic) => set({ italic: italic || undefined })} />
      <Slider field="tracking" label={t('Letter spacing')} value={layer.tracking ?? -0.01} min={-0.1} max={0.3} step={0.005} format={(v) => `${Math.round(v * 1000) / 10}%`} disabled={disabled} onChange={(tracking) => set({ tracking })} />
      <Slider field="leading" label={t('Line height')} value={layer.leading ?? 1.12} min={0.7} max={2} step={0.01} format={(v) => v.toFixed(2)} disabled={disabled} onChange={(leading) => set({ leading })} />
      <Segments
        field="align"
        label={t('Alignment')}
        caption={t('Alignment')}
        value={layer.align}
        disabled={disabled}
        onChange={(align) => set({ align })}
        options={(['left', 'center', 'right'] as const).map((a) => ({ value: a, label: <Icon name={`format_align_${a}`} size={16} />, title: a }))}
      />
      <ColorRow field="color" label={t('Color')} value={layer.color} disabled={disabled} onChange={(color) => set({ color })} />
      {layer.box && <Toggle field="box" label={t('Box as wide as the layer')} value={!!layer.box.wide} disabled={disabled} onChange={(wide) => set({ box: { ...layer.box!, wide: wide || undefined } })} />}
      {layer.icon && <ColorRow field="iconColor" label={t('Icon color')} value={layer.iconColor ?? layer.color} disabled={disabled} onChange={(iconColor) => set({ iconColor })} />}
      <Subhead title={t('Background')} />
      <GlassFields glass={layer.glass} disabled={disabled} onChange={(glass) => set({ glass })} />
      {(layer.glass || layer.box) && (
        <Segments field="shadow" label={t('Shadow')} value={layer.shadow ?? 'none'} disabled={disabled} onChange={(shadow) => set({ shadow: shadow === 'none' ? undefined : shadow })} options={SHADOW_PRESETS.filter((p) => p.id !== 'custom').map((p) => ({ value: p.id, label: p.label }))} />
      )}
      <Subhead title={t('Accent')} />
      {/* The words between asterisks, in a look of their own: kept on the same words in every language. */}
      <Toggle field="accent" label={t('Accent the *words* between asterisks')} value={!!layer.accent} disabled={disabled} onChange={(on) => set({ accent: on ? { color: '#0070C5', weight: layer.weight } : undefined })} />
      {layer.accent && (
        <>
          <ColorRow field="accent" label={t('Accent color')} value={layer.accent.color} disabled={disabled} onChange={(color) => set({ accent: { ...layer.accent!, color } })} />
          <Segments
            label={t('Accent background')}
            caption={t('Background')}
            value={layer.accent.fill ? (layer.accent.fillStyle ?? 'block') : 'none'}
            disabled={disabled}
            onChange={(v) => set({ accent: { ...layer.accent!, fill: v === 'none' ? undefined : (layer.accent!.fill ?? '#0070C5'), fillStyle: v === 'none' ? undefined : v } })}
            options={[
              { value: 'none', label: t('None') },
              { value: 'block', label: t('Block') },
              { value: 'marker', label: t('Marker') },
            ]}
          />
          {layer.accent.fill && <ColorRow field="accent" label={t('Accent background color')} value={layer.accent.fill} disabled={disabled} onChange={(fill) => set({ accent: { ...layer.accent!, fill } })} />}
          <Segments field="accent" label={t('Accent weight')} caption={t('Weight')} value={layer.accent.weight ?? layer.weight} disabled={disabled} onChange={(weight) => set({ accent: { ...layer.accent!, weight } })} options={[400, 500, 600, 700, 800].map((w) => ({ value: w as TextLayer['weight'], label: <span style={{ fontWeight: w }}>Aa</span>, title: String(w) }))} />
        </>
      )}
    </>
  );
}

/** A glass behind a text or a component: on, and how much it frosts, covers and darkens. */
function GlassFields({ glass, disabled, onChange }: { glass?: Glass; disabled: boolean; onChange: (g: Glass | undefined) => void }) {
  return (
    <>
      <Toggle field="glass" label={t('Glass effect')} value={!!glass} disabled={disabled} onChange={(on) => onChange(on ? (glass ?? DEFAULT_GLASS) : undefined)} />
      {glass && (
        <>
          <Slider field="glass" label={t('Frost')} value={glass.frost} min={0} max={40} step={1} format={(v) => `${v}`} disabled={disabled} onChange={(frost) => onChange({ ...glass, frost })} />
          <Slider field="glass" label={t('Opacity')} value={glass.opacity} min={0} max={1} step={0.01} format={pct} disabled={disabled} onChange={(opacity) => onChange({ ...glass, opacity })} />
          <Slider field="glass" label={t('Darkness')} value={glass.dark} min={0} max={1} step={0.01} format={pct} disabled={disabled} onChange={(dark) => onChange({ ...glass, dark })} />
          <Slider field="glass" label={t('Glass rim')} value={glass.rim ?? 0} min={0} max={10} step={0.5} format={(v) => (v ? `${v} pt` : t('None'))} disabled={disabled} onChange={(rim) => onChange({ ...glass, rim: rim || undefined })} />
        </>
      )}
    </>
  );
}

/**
 * Words the device's screen shows put another way, in this screenshot alone (the app's screen stays as it is): one
 * per line, `what it says => what it says here`, in the language on the canvas.
 */
function ReplaceField({ layer, language, disabled, set }: { layer: DeviceLayer | ComponentLayer; language: string; disabled: boolean; set: (patch: Partial<Layer>) => void }) {
  const own = layer.replace?.[language] ?? [];
  const text = own.map((p) => `${p.from} => ${p.to}`).join('\n');
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  const save = () => {
    const pairs = draft
      .split('\n')
      .map((l) => l.split('=>').map((x) => x.trim()))
      .filter(([from, to]) => from && to !== undefined)
      .map(([from, to]) => ({ from, to }));
    const next: Record<string, { from: string; to: string }[]> = { ...layer.replace, [language]: pairs };
    if (!pairs.length) delete next[language];
    set({ replace: Object.keys(next).length ? next : undefined });
  };
  return (
    <label className={styles.textField}>
      <span className={styles.sliderHead}>
        <span>{t('Texts on the screen')}</span>
      </span>
      <textarea rows={2} value={draft} disabled={disabled} placeholder={t('Updated plan => Your plan is ready')} onChange={(e) => setDraft(e.target.value)} onBlur={save} />
      <span className={styles.guideText}>{t('One per line: what it says => what it says in this screenshot. The app’s screen stays as it is.')}</span>
    </label>
  );
}

/**
 * Colors the device's screen paints put another way, in this screenshot alone (store/recolor): one per line,
 * `its color => the color here`, in any CSS color or the app's tokens. The same in every language.
 */
function RecolorField({ layer, disabled, set }: { layer: DeviceLayer; disabled: boolean; set: (patch: Partial<Layer>) => void }) {
  const text = (layer.recolor ?? []).map((p) => `${p.from} => ${p.to}`).join('\n');
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  const save = () => {
    const pairs = draft
      .split('\n')
      .map((l) => l.split('=>').map((x) => x.trim()))
      .filter(([from, to]) => from && to)
      .map(([from, to]) => ({ from, to }));
    set({ recolor: pairs.length ? pairs : undefined });
  };
  return (
    <label className={styles.textField}>
      <span className={styles.sliderHead}>
        <span>{t('Colors on the screen')}</span>
      </span>
      <textarea rows={2} value={draft} disabled={disabled} placeholder={t('#0A6CFF66 => var(--app-primary)')} onChange={(e) => setDraft(e.target.value)} onBlur={save} />
      <span className={styles.guideText}>{t('One per line: a color it paints => its color in this screenshot, in every language. Any CSS color or the app’s tokens; the alpha counts.')}</span>
    </label>
  );
}

/** The width a new component layer is laid out at: a phone's content width. */
const COMPONENT_FRAME_W = 360;
const DEFAULT_GOOGLE_FAMILY = 'Nunito';

/** A component layer: which component and story, the width it's laid out at, its appearance and shadow. */
function ComponentFields({ layer, language, disabled, set }: { layer: ComponentLayer; language: string; disabled: boolean; set: (patch: Partial<Layer>) => void }) {
  const mod = STORIES.get(layer.component);
  const names = [...STORIES.keys()];
  return (
    <>
      <div className={styles.captioned}>
        <span className={styles.caption}>{t('Component')}</span>
        <Dropdown label={t('Component')} value={layer.component} options={names.map((n) => ({ value: n, label: n }))} onChange={(component) => set({ component, story: STORIES.get(component)?.stories[0]?.name ?? '', args: undefined })} />
      </div>
      {mod && mod.stories.length > 1 && (
        <div className={styles.captioned}>
          <span className={styles.caption}>{t('Story')}</span>
          <Dropdown label={t('Story')} value={layer.story} options={mod.stories.map((s) => ({ value: s.name, label: s.name }))} onChange={(story) => set({ story })} />
        </div>
      )}
      {layer.args && Object.keys(layer.args).length > 0 && <p className={styles.guideText}>{t('With its own args: {keys}', { keys: Object.keys(layer.args).join(', ') })}</p>}
      <ReplaceField layer={layer} language={language} disabled={disabled} set={set} />
      <Slider field="frameW" label={t('Laid out at')} value={layer.frameW} min={80} max={1000} step={4} format={(v) => `${v} pt`} disabled={disabled} onChange={(frameW) => set({ frameW })} />
      <p className={styles.guideText}>{t('Its own width, as on a phone: the layer zooms it to its size.')}</p>
      <Segments field="theme" label={t('Appearance')} caption={t('Appearance')} value={layer.theme ?? 'light'} disabled={disabled} onChange={(theme) => set({ theme: theme === 'light' ? undefined : theme })} options={[{ value: 'light', label: t('Light') }, { value: 'dark', label: t('Dark') }]} />
      <Segments
        label={t('Shadow')}
        caption={t('Shadow')}
        value={layer.shadow ?? 'none'}
        disabled={disabled}
        onChange={(shadow) => set({ shadow: shadow === 'none' ? undefined : shadow })}
        options={SHADOW_PRESETS.filter((p) => p.id !== 'custom').map((p) => ({ value: p.id, label: p.label }))}
      />
      <Subhead title={t('Background')} />
      <GlassFields glass={layer.glass} disabled={disabled} onChange={(glass) => set({ glass })} />
    </>
  );
}

/** Light, neutral and dark backgrounds to start from; the app's brand color is added from its theme. */
const SOLIDS = ['#FFFFFF', '#F2F2F7', '#E8F0FE', '#1C1C1E', '#000000'];
const GRADIENTS: [string, string][] = [
  ['#E8F0FE', '#FFFFFF'],
  ['#F2F2F7', '#D1D1D6'],
  ['#1C1C1E', '#3A3A3C'],
  ['#0A84FF', '#5E5CE6'],
];

/** The app's primary color as its screens paint it (its theme's `--app-primary`), to offer as a background. */
function appPrimary(): string | null {
  const screen = typeof document === 'undefined' ? null : document.querySelector('[data-device-screen]');
  const v = screen ? getComputedStyle(screen).getPropertyValue('--app-primary').trim() : '';
  return v || null;
}

/**
 * Whose a change is: on the reference (REFERENCE_SIZE), every size's, each scaled to its own; on another size, that
 * size's alone. Its own values there show in color; Use the reference's drops them.
 */
function SizeScope({ asset, layer, disabled, onReset }: { asset: StoreAsset; layer: Layer; disabled: boolean; onReset: () => void }) {
  if (asset.id === REFERENCE_SIZE) return <p className={styles.guideText}>{t('The reference: what’s set here is every size’s, each scaled to its own.')}</p>;
  const own = ownsDevice(layer, asset.id);
  return (
    <p className={styles.guideText}>
      {t('A change here is {device}’s alone. To use it on another size: right click, Copy position and size.', { device: asset.label })}
      {own && ` ${t('Its own values here are in color.')} `}
      {own && (
        <button className={styles.linkButton} disabled={disabled} onClick={onReset}>
          {t('Use the reference’s')}
        </button>
      )}
    </p>
  );
}

/** A preset's every setting: its palette's base, each of its colors, its parameters; Shuffle for another variant. */
function PresetFields({ value, disabled, onChange }: { value: PresetBackground; disabled: boolean; onChange: (b: Background) => void }) {
  const { colors: names, params, shuffles } = presetControls(value.id);
  const now = resolvePreset(value);
  const setColor = (i: number, c: string) => onChange({ ...value, colors: now.colors.map((x, j) => (j === i ? c : x)) });
  const setParam = (key: string, v: number) => onChange({ ...value, params: { ...now.params, [key]: v } });
  const format = (p: (typeof params)[number]) => (v: number) => (p.max <= 1 && p.unit === '%' ? pct(v) : p.unit === '×' ? `${v.toFixed(2)}×` : `${Math.round(v * 10) / 10}${p.unit ?? ''}`);
  const edited = !!(value.colors || value.params || value.seed);
  return (
    <>
      <div className={styles.presetActions}>
        {shuffles && (
          <button className={styles.button} disabled={disabled} onClick={() => onChange({ ...value, seed: newSeed() })} title={t('The same colors, its shapes elsewhere')}>
            <Icon name="shuffle" size={16} />
            {t('Shuffle')}
          </button>
        )}
        <button className={styles.button} disabled={disabled || !edited} onClick={() => onChange({ kind: 'preset', id: value.id, color: value.color })} title={t('Its colors from the base color again, and its settings as they come')}>
          <Icon name="restart_alt" size={16} />
          {t('Reset')}
        </button>
      </div>
      <ColorRow label={t('Base color')} value={value.color} disabled={disabled} onChange={(c) => onChange({ ...value, color: c, colors: undefined })} />
      <p className={styles.guideText}>{t('Makes all its colors; change them one by one below.')}</p>
      <h4 className={styles.subTitle}>{t('Colors')}</h4>
      {names.length > 1 && (
        // Palettes from the base color: another one each click; lighter and darker move the ones there.
        <div className={styles.paletteRow} role="group" aria-label={t('Palette from the base color')}>
          <button className={styles.button} disabled={disabled} onClick={() => onChange({ ...value, colors: generatePalette(value, 'shades') })} title={t('The base color’s own hue, lighter and darker: another each click')}>
            <Icon name="gradient" size={16} />
            {t('Shades')}
          </button>
          <button className={styles.button} disabled={disabled} onClick={() => onChange({ ...value, colors: generatePalette(value, 'analogous') })} title={t('Hues beside the base color’s: another each click')}>
            <Icon name="palette" size={16} />
            {t('Analogous')}
          </button>
          <button className={styles.icon} disabled={disabled} onClick={() => onChange({ ...value, colors: shiftLightness(now.colors, 6) })} aria-label={t('Lighter')} title={t('Lighter')}>
            <Icon name="light_mode" size={16} />
          </button>
          <button className={styles.icon} disabled={disabled} onClick={() => onChange({ ...value, colors: shiftLightness(now.colors, -6) })} aria-label={t('Darker')} title={t('Darker')}>
            <Icon name="dark_mode" size={16} />
          </button>
        </div>
      )}
      {names.map((n, i) => (
        <ColorRow key={n} label={n} value={now.colors[i]} disabled={disabled} onChange={(c) => setColor(i, c)} />
      ))}
      {params.length > 0 && <h4 className={styles.subTitle}>{t('Settings')}</h4>}
      {params.map((p) => (
        <Slider key={p.key} label={p.label} value={now.params[p.key]} min={p.min} max={p.max} step={p.step} format={format(p)} disabled={disabled} onChange={(v) => setParam(p.key, v)} />
      ))}
    </>
  );
}

function BackgroundField({ value, disabled, onChange }: { value: Background; disabled: boolean; onChange: (b: Background) => void }) {
  const brand = appPrimary();
  const solids = brand ? [...SOLIDS, brand] : SOLIDS;
  const gradients: [string, string][] = brand ? [...GRADIENTS, [brand, '#FFFFFF']] : GRADIENTS;
  const same = (b: Background) => JSON.stringify(b) === JSON.stringify(value);
  const swatch = (b: Background, key: string, title: string) => <button key={key} className={`${styles.swatch} ${same(b) ? styles.swatchOn : ''}`} style={{ background: backgroundCss(b) }} disabled={disabled} onClick={() => onChange(b)} aria-label={title} title={title} />;
  // The color a kind starts from when switched to: the one it has (a gradient's first).
  const color = value.kind === 'gradient' ? value.from : value.color;
  const switchTo = (k: Background['kind']) =>
    onChange(
      k === 'solid'
        ? { kind: 'solid', color }
        : k === 'gradient'
          ? { kind: 'gradient', from: color, to: value.kind === 'gradient' ? value.to : '#FFFFFF', angle: value.kind === 'gradient' ? value.angle : 180 }
          : // A preset starts from the app's color: a solid's white or a gradient's light end make a pale one.
            { kind: 'preset', id: 'mesh', color: brand ?? color },
    );
  return (
    <>
      <Segments
        label={t('Background')}
        value={value.kind}
        disabled={disabled}
        onChange={switchTo}
        options={[
          { value: 'solid', label: t('Solid') },
          { value: 'gradient', label: t('Gradient') },
          { value: 'preset', label: t('Presets') },
        ]}
      />
      {value.kind === 'preset' ? (
        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <button key={p.id} className={`${styles.preset} ${value.id === p.id ? styles.presetOn : ''}`} disabled={disabled} onClick={() => value.id !== p.id && onChange({ kind: 'preset', id: p.id, color: value.color })} title={p.name} aria-pressed={value.id === p.id}>
              <span className={styles.presetImage}>
                <span className={styles.presetDraw} style={{ background: presetCss(value.id === p.id ? value : { kind: 'preset', id: p.id, color: value.color }) }} />
              </span>
              <span className={styles.presetName}>{p.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.swatches}>
          {value.kind === 'solid' ? solids.map((c) => swatch({ kind: 'solid', color: c }, c, c)) : gradients.map(([from, to]) => swatch({ kind: 'gradient', from, to, angle: value.angle }, from + to, `${from} → ${to}`))}
        </div>
      )}
      {value.kind === 'solid' ? (
        <ColorRow label={t('Color')} value={value.color} disabled={disabled} onChange={(c) => onChange({ ...value, color: c })} />
      ) : value.kind === 'preset' ? (
        <PresetFields value={value} disabled={disabled} onChange={onChange} />
      ) : (
        <>
          <ColorRow label={t('From')} value={value.from} disabled={disabled} onChange={(from) => onChange({ ...value, from })} />
          <ColorRow label={t('To')} value={value.to} disabled={disabled} onChange={(to) => onChange({ ...value, to })} />
          <Slider label={t('Angle')} value={value.angle} min={0} max={360} step={5} format={(v) => `${v}°`} disabled={disabled} onChange={(angle) => onChange({ ...value, angle })} />
        </>
      )}
    </>
  );
}

/**
 * Where a layer past its image's edge goes on: the screenshot beside it shows the rest (one element across two
 * screenshots), or, past the first or the last, it's cut there.
 */
function CrossingNote({ layer, display, index, count, gap }: { layer: Layer; display: Display; index: number; count: number; gap: number }) {
  if (!edgesCrossed(layer, display).length) return null;
  if (!layer.extend)
    return (
      <p className={`${styles.guideText} ${styles.crossing}`}>
        <Icon name="content_cut" size={14} />
        {t('Cut at this screenshot’s edge')}
      </p>
    );
  // The screenshots it reaches into (a wide one, several), and whether it's past the first or the last.
  const reach = reachOf(layer, display, gap, plainLayout).map((k) => index + k);
  const there = reach.filter((n) => n >= 0 && n < count);
  return (
    <>
      {there.length > 0 && (
        <p className={`${styles.guideText} ${styles.crossing}`}>
          <Icon name="link" size={14} />
          {there.length === 1 ? t('Continues in screenshot {n}', { n: there[0] + 1 }) : t('Continues in screenshots {list}', { list: there.map((n) => n + 1).join(', ') })}
        </p>
      )}
      {reach.some((n) => n < 0) && (
        <p className={`${styles.guideText} ${styles.crossing} ${styles.crossingCut}`}>
          <Icon name="content_cut" size={14} />
          {t('Past the first screenshot: cut at its left edge')}
        </p>
      )}
      {reach.some((n) => n >= count) && (
        <p className={`${styles.guideText} ${styles.crossing} ${styles.crossingCut}`}>
          <Icon name="content_cut" size={14} />
          {t('Past the last screenshot: cut at its right edge')}
        </p>
      )}
    </>
  );
}

/** A group's layout: a row or a stack, the gap between, how they line up across; and letting go of it. */
function GroupFields({ layer, disabled, set, onUngroup }: { layer: GroupLayer; disabled: boolean; set: (patch: Partial<Layer>) => void; onUngroup: () => void }) {
  const row = layer.layout === 'row';
  return (
    <>
      <Segments
        field="layout"
        label={t('Direction')}
        value={layer.layout}
        disabled={disabled}
        onChange={(layout) => set({ layout } as Partial<GroupLayer>)}
        options={[
          { value: 'row', label: <Icon name="view_column" size={16} />, title: t('Row: side by side') },
          { value: 'stack', label: <Icon name="view_agenda" size={16} />, title: t('Stack: one under the other') },
        ]}
      />
      <Slider field="gap" label={t('Gap')} value={layer.gap} min={0} max={120} step={1} format={(v) => `${v} pt`} disabled={disabled} onChange={(gap) => set({ gap } as Partial<GroupLayer>)} />
      <Segments
        field="align"
        label={t('Align')}
        value={layer.align}
        disabled={disabled}
        onChange={(align) => set({ align } as Partial<GroupLayer>)}
        options={[
          { value: 'start', label: <Icon name={row ? 'align_vertical_top' : 'align_horizontal_left'} size={16} />, title: row ? t('Top') : t('Left') },
          { value: 'center', label: <Icon name={row ? 'align_vertical_center' : 'align_horizontal_center'} size={16} />, title: t('Center') },
          { value: 'end', label: <Icon name={row ? 'align_vertical_bottom' : 'align_horizontal_right'} size={16} />, title: row ? t('Bottom') : t('Right') },
        ]}
      />
      <div className={styles.listingActions}>
        <button className={styles.button} disabled={disabled} onClick={onUngroup} title={t('Its layers back on their own, where they are now')}>
          <Icon name="ungroup" size={16} />
          {t('Ungroup')}
        </button>
      </div>
    </>
  );
}

/**
 * A screenshot's background across the ones beside it: continuing the one before (a run sharing one background, drawn
 * as one across them and the space between), the run apart again, and how wide a preset's drawing is in it.
 */
function RunFields({ asset, shots, index, disabled }: { asset: StoreAsset; shots: StoreShot[]; index: number; disabled: boolean }) {
  const shot = shots[index];
  const { start, end } = runOf(shots, index);
  const leader = shots[start];
  const count = end - start + 1;
  return (
    <>
      {index > 0 && (
        <Toggle
          label={t('Continue the background of screenshot {n}', { n: index })}
          value={index > start}
          disabled={disabled}
          onChange={(on) => (on ? unifyBackground(asset.id, [shots[index - 1].id, shot.id]) : separateBackground(asset.id, shot.id))}
        />
      )}
      {count > 1 && (
        <>
          <p className={`${styles.guideText} ${styles.crossing}`}>
            <Icon name="link" size={14} />
            {t('Shared by screenshots {from}–{to}: one background across them, the space between counted', { from: start + 1, to: end + 1 })}
          </p>
          {leader.background.kind === 'preset' && (
            <Slider
              label={t('Drawn across')}
              value={leader.spread ?? count}
              min={1}
              max={count}
              step={0.5}
              format={(v) => plural(v, '{n} screenshot', '{n} screenshots')}
              disabled={disabled}
              onChange={(v) => setSpread(asset.id, leader.id, v >= count ? null : v)}
            />
          )}
          <div className={styles.listingActions}>
            <button className={styles.button} disabled={disabled} onClick={() => separateBackground(asset.id, shot.id)} title={t('Each keeps this background, drawn on its own: then each can be changed alone')}>
              <Icon name="link_off" size={16} />
              {t('Separate backgrounds')}
            </button>
          </div>
        </>
      )}
    </>
  );
}

/** A new fade: its bottom third, gone at the edge, no blur. */
const NEW_FADE: DeviceFade = { edge: 'bottom', size: 0.35, fade: 1, blur: 0 };

/** A device fading toward an edge: which (or none), how much of it, how far to gone, and how blurred. */
function FadeFields({ layer, disabled, set, from, reset }: { layer: DeviceLayer | GroupLayer; disabled: boolean; set: (patch: Partial<Layer>) => void; from?: 'device'; reset?: () => void }) {
  const f = layer.fade;
  const put = (patch: Partial<DeviceFade>) => set({ fade: { ...(f ?? NEW_FADE), ...patch } } as Partial<DeviceLayer>);
  return (
    <>
      <Segments
        label={t('Fade')}
        caption={t('Edge')}
        from={from}
        onReset={reset}
        value={f?.edge ?? 'none'}
        disabled={disabled}
        onChange={(edge) => (edge === 'none' ? set({ fade: undefined } as Partial<DeviceLayer>) : put({ edge }))}
        options={[
          { value: 'none', label: t('None') },
          { value: 'bottom', label: t('Bottom') },
          { value: 'top', label: t('Top') },
          { value: 'both', label: t('Both') },
        ]}
      />
      {f && (
        <div className={styles.sliderTable}>
          <FadeRange f={f} disabled={disabled} put={put} />
          <Slider inline label={t('Fade out')} title={t('How far it fades at the end: 100%, gone')} value={f.fade} min={0} max={1} step={0.01} format={pct} disabled={disabled} onChange={(fade) => put({ fade })} />
          <Slider inline label={t('Blur')} title={t('How blurred it is at the end, more toward the edge')} value={f.blur} min={0} max={40} step={0.5} format={(v) => `${v} pt`} disabled={disabled} onChange={(blur) => put({ blur })} />
        </div>
      )}
    </>
  );
}

/**
 * Where a fade starts and where it's all the way faded, one stretch on one slider: on the device from its top (a
 * bottom or a top fade), or from each edge (both). Kept as distances from the edge (DeviceFade).
 */
function FadeRange({ f, disabled, put: putRaw }: { f: DeviceFade; disabled: boolean; put: (patch: Partial<DeviceFade>) => void }) {
  const gone = Math.min(f.gone ?? 0, f.size);
  // Saved as round shares (1 − 0.9 is 0.0999… in floating point).
  const r = (v: number) => Math.round(v * 10000) / 10000;
  const put = (p: { size: number; gone: number }) => putRaw({ size: r(p.size), gone: r(p.gone) });
  if (f.edge === 'bottom')
    return <RangeSlider inline label={t('Range')} title={t('Where it starts fading, and where it’s all the way faded: from the top of the device')} low={1 - f.size} high={1 - gone} min={0} max={1} step={0.01} format={pct} disabled={disabled} onChange={(lo, hi) => put({ size: Math.max(0.01, 1 - lo), gone: 1 - hi })} />;
  if (f.edge === 'top')
    return <RangeSlider inline label={t('Range')} title={t('Where it’s all the way faded, and where it starts fading: from the top of the device')} low={gone} high={f.size} min={0} max={1} step={0.01} format={pct} disabled={disabled} onChange={(lo, hi) => put({ gone: lo, size: Math.max(0.01, hi) })} />;
  return <RangeSlider inline label={t('Range')} title={t('From each edge: where it’s all the way faded, and where it starts fading')} low={gone} high={f.size} min={0} max={0.5} step={0.01} format={pct} disabled={disabled} onChange={(lo, hi) => put({ gone: lo, size: Math.max(0.01, hi) })} />;
}
