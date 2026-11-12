// App Store Assets: a store listing's images, the screenshots made from the prototype's own screens. The canvas shows
// the store picked in the left panel's tabs: its screenshot sizes one under the other (a numbered place for each the
// store takes, the ones it needs marked), every size drawing the same shared layout with its own device, in the
// language picked; or its listing graphics. A screenshot clicked opens in its size (its layers at the left, the
// picked layer at the right). Always the app as it ships: a proposal on screen is set aside when the mode opens.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type RefObject } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import type { Display } from '../devices/devices';
import { useNavRoot } from '../nav/context';
import { pageName } from '../nav/stack';
import type { Layout } from '../sim/layout';
import { BASE_LANGUAGE, LANG_PARAM, LANGUAGES, languageIn, type Language } from '../sim/language';
import { usePan } from '../sim/usePan';
import { ZoomBar, type Zoom } from '../sim/ViewBar';
import { plural, t } from '../i18n/ui';
import { Dropdown, Segments } from './controls';
import { BACKGROUND, SIZE_PARAM, useMultiPick, useSelection, useShotMultiPick, useStoreAsset, useStoreTab } from './route';
import { StoreLogo } from './StoreLogo';
import { ExportStage } from './ExportStage';
import { ExportProgress, startExport, useExporting } from './ExportProgress';
import { PREVIEW_VIEW, StorePreview } from './preview/StorePreview';
import { RequiredBadge } from './RequiredBadge';
import { extentOf, ShotImage, type BackgroundRun, type Neighbor, type SpillEdit } from './ShotImage';
import { InteractHost, LayerContextMenu, openLayerMenu, requestInteract } from './layerMenu';
import { useCanWrite } from '../persist/devApi';
import { CommentPins, useCommenting, useCommentReveal } from '../comments';
import { refreshScreens } from '../sim/screenStill';
import { PAGE_ATTR, screenAttrs } from '../comments/anchor';
import { shotOfPage, STORE_SCREEN, storePage } from '../comments/types';
import { useGraphics, REFERENCE_SIZE, undo, redo, useHistory, addShot, adoptBrowserShots, mainDevice, moveShot, findLayer, groupOf, removeLayer, removeLayers, topOf, removeShot, resolveAt, runOf, shotsNow, unifyBackground, shotsOf, transferLayer, updateLayerAt, useShotSets, type Layer, type StoreShot } from './shots';
import { ALL_ASSETS, assetById, sizeOf, storeOf, STORES, type StoreAsset, type StoreId } from './sizes';
import styles from './StoreAssets.module.css';

/** What sets a proposal on screen: the store's images are the app as it ships. */
const DESIGN_PARAMS = ['proposal', 'variant', 'changes'];

export interface StoreAssetsProps {
  /** A page's layout on a store size's screen (portrait, as the shell computes any other). */
  layoutFor: (display: Display, detailOpen: boolean, pageId?: string) => Layout;
}

export function StoreAssets({ layoutFor }: StoreAssetsProps) {
  const [asset] = useStoreAsset();
  const [search, setSearch] = useSearchParams();
  // Live only: a proposal picked before coming here is set aside (Prototype gets it back from its own link).
  const hasDesign = DESIGN_PARAMS.some((k) => search.has(k));
  useEffect(() => {
    if (!hasDesign) return;
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const k of DESIGN_PARAMS) next.delete(k);
        return next;
      },
      { replace: true },
    );
  }, [hasDesign, setSearch]);
  // The first sketch kept sets in the browser: into the team's file, once.
  useEffect(() => void adoptBrowserShots(), []);
  const graphics = search.get(VIEW_PARAM) === 'graphics';
  const preview = search.get(VIEW_PARAM) === PREVIEW_VIEW;
  const setView = (v: 'shots' | 'graphics') =>
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === 'graphics') next.set(VIEW_PARAM, 'graphics');
        else next.delete(VIEW_PARAM);
        return next;
      },
      { replace: true },
    );
  const language = languageIn(search.get(LANG_PARAM));
  const setLanguage = (l: Language) =>
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (l === BASE_LANGUAGE) next.delete(LANG_PARAM);
        else next.set(LANG_PARAM, l);
        return next;
      },
      { replace: true },
    );
  const editable = useCanWrite();
  // A click anywhere outside the screenshots (the canvas, its header) lets go of the picked layer.
  const sel = useSelection();
  // Only the person's clicks: a screen's recorded taps, replayed as it mounts, are clicks too and bubble up here.
  const away = (e: { target: EventTarget; nativeEvent: Event }) => e.nativeEvent.isTrusted && !(e.target as HTMLElement).closest('figure, button, label, select, input, [role=button], [role=menu]') && sel.pickLayer(null);
  return (
    <div className={styles.root} onClick={away}>
      {/* In Preview, the prototype's canvas has its own controls over it (StorePreview): no header. */}
      {!preview && <header className={styles.head}>
        <div className={styles.headLeft}>
          <StorePicker />
          <Segments
            label={t('What to show')}
            value={graphics ? 'graphics' : 'shots'}
            disabled={false}
            onChange={setView}
            options={[
              { value: 'shots', label: t('Screenshots') },
              { value: 'graphics', label: t('Listing graphics') },
            ]}
          />
          {!editable && (
            <span className={styles.readOnly} title={t('The screenshots are arranged on a local copy (npm run dev) and committed; here they’re to look at and comment.')}>
              <Icon name="visibility" size={14} />
              {t('View only')}
            </span>
          )}
        </div>
        <div className={styles.actions}>
          {/* Undo and the screens drawn again are the screenshots': the listing graphics are files. */}
          {editable && !graphics && <UndoButtons />}
          {editable && !graphics && <RefreshScreens />}
          <UnifyBar asset={asset} editable={editable} />
          {LANGUAGES.length > 1 && (
            <Dropdown label={t('Language')} title={t('The screenshots’ language')} value={language} options={LANGUAGES.map((l) => ({ value: l.id, label: l.name }))} onChange={setLanguage} />
          )}
        </div>
      </header>}
      {/* An export on its way: its progress, over everything (nothing's edited meanwhile). */}
      <ExportProgress />
      {/* Where the export draws each screenshot, under its modal. */}
      <ExportStage layoutFor={layoutFor} />
      {/* A layer's menu, for the canvas's right click and the layers list's alike. */}
      <LayerContextMenu />
      {/* Interact with the screen: from the Layer panel, or a device double clicked on the canvas. */}
      <InteractHost />
      {/* The screenshots stay drawn behind Listing graphics: back to them is at once, nothing drawn again. */}
      <ShotsView layoutFor={layoutFor} language={language} editable={editable} hidden={graphics || preview} />
      {graphics && <GraphicsView />}
      {/* The listing as the App Store shows it, on devices side by side (the toolbar's Preview). */}
      {preview && <StorePreview layoutFor={layoutFor} language={language} onLanguage={setLanguage} />}
    </div>
  );
}

/** The store (App Store, Google Play), as the canvas's title: its mark and name, a menu to switch. */
function StorePicker() {
  const [store, open] = useStoreTab();
  const on = STORES.find((s) => s.id === store)!;
  return (
    <label className={styles.storePicker} title={t('Store')}>
      <StoreLogo store={on.id} size={20} />
      <h2 className={styles.title}>{on.name}</h2>
      <select value={on.id} onChange={(e) => open(e.target.value as StoreId)} aria-label={t('Store')}>
        {STORES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Icon name="expand_more" size={20} color="var(--ui-text-subtle)" />
    </label>
  );
}

/** Which of the store's views the canvas shows: its screenshot sizes (default) or its listing graphics. */
export const VIEW_PARAM = 'view';
/** A size's row height at Fit, as a share of the canvas's (each row as tall, whatever its screen). */
const ROW_FIT = 0.62;

/** The store's screenshot sizes, one under the other (iPhones, iPads, then the Duo), all from the shared layout. */
function ShotsView({ layoutFor, language, editable, hidden }: { layoutFor: StoreAssetsProps['layoutFor']; language: Language; editable: boolean; hidden: boolean }) {
  const [asset] = useStoreAsset();
  const store = storeOf(asset);
  // The reference first, then phones (and a foldable closed), then tablets, the store's order in each.
  const sizes = store.groups
    .flatMap((g) => g.assets)
    .filter((a): a is StoreAsset & { display: Display } => a.kind === 'screenshot' && !!a.display)
    .map((a, i) => ({ a, i, rank: a.id === REFERENCE_SIZE ? 0 : a.display.w < 600 ? 1 : 2 }))
    .sort((x, y) => x.rank - y.rank || x.i - y.i)
    .map(({ a }) => a);
  // Zoom as the rest of the designer's: Fit (each row as tall as part of the canvas, never past 1:1) or a fixed scale.
  const [zoom, setZoom] = useState<Zoom>('fit');
  const canvas = useRef<HTMLElement>(null);
  const [canvasH, setCanvasH] = useState(800);
  useLayoutEffect(() => {
    const el = canvas.current;
    if (!el) return;
    // Hidden (Listing graphics), it has no height: the last one stays, so nothing is sized again for it.
    const ro = new ResizeObserver(() => el.clientHeight > 0 && setCanvasH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fitOf = (d: Display) => Math.max(0.1, Math.min(1, (canvasH * ROW_FIT) / d.h));
  const current = sizes.find((a) => a.id === asset.id) ?? sizes[0];
  // Middle-button drag pans the canvas, as the prototype's.
  const pan = usePan();
  const commenting = useCommenting();
  // No keys while an export is on (the modal covers the rest).
  const exporting = useExporting();
  useLayerKeys(current, editable && !hidden && !exporting);
  useUndoKeys(editable && !hidden && !exporting);
  useRevealShot(canvas);
  return (
    <main ref={canvas} className={styles.main} hidden={hidden} onPointerDownCapture={commenting ? (e) => e.button === 0 && e.stopPropagation() : undefined}>
      {/* The canvas comments are left on (comments/anchor): each screenshot a page, its size row the example. While
          commenting, a press doesn't reach the layers (no picking, no dragging): its click leaves a pin. */}
      <div className={styles.rows} data-store-rows {...pan} {...screenAttrs(STORE_SCREEN)}>
        {sizes.map((a) => (
          <SizeRow key={a.id} asset={a} scale={zoom === 'fit' ? fitOf(a.display) : zoom} language={language} editable={editable} layoutFor={layoutFor} on={a.id === current.id} />
        ))}
      </div>
      <ZoomBar zoom={zoom} fitScale={fitOf(current.display)} onZoom={setZoom} />
      <CommentPins stage={canvas} />
    </main>
  );
}

/** A screenshot's card on the canvas, drawn or not yet: its size and its id. */
const SHOT_ATTR = 'data-store-shot';
const shotMark = (size: string, shot: string) => ({ [SHOT_ATTR]: `${size}:${shot}` });

/** How long a comment opened from the panel is looked for on the canvas (its store, its row drawn) before giving up. */
const REVEAL_SHOT_MS = 6000;

/**
 * A comment opened from the panel: its screenshot, in the size row it was left on, is scrolled into view (the rows
 * scroll sideways, past where the comments look for its pin), and its pin opens there. Looked for each frame until it's
 * there: on the listing graphics, the screenshots are shown; in another store, its size's; a row not drawn yet is
 * scrolled to as it loads, and again once it's drawn (its card is a new element then).
 */
function useRevealShot(canvas: RefObject<HTMLElement | null>) {
  const reveal = useCommentReveal();
  const [search, setSearch] = useSearchParams();
  // Read by the loop, not a dependency of it: the URL it changes mustn't start it over.
  const now = useRef(search);
  now.current = search;
  useEffect(() => {
    const shot = reveal && shotOfPage(reveal.root.page);
    if (!shot) return;
    const size = reveal.root.anchor?.story;
    const end = performance.now() + REVEAL_SHOT_MS;
    let raf = 0;
    let asked = 0;
    let scrolledTo: Element | null = null;
    const find = (root: Element) =>
      (size && root.querySelector(`[${SHOT_ATTR}="${CSS.escape(`${size}:${shot}`)}"]`)) || root.querySelector(`[${SHOT_ATTR}$="${CSS.escape(`:${shot}`)}"]`);
    const step = () => {
      const root = canvas.current;
      const card = root && !root.hidden ? find(root) : null;
      if (card && card !== scrolledTo) {
        scrolledTo = card;
        card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      // Drawn and in place: done.
      if (card && !card.hasAttribute('aria-busy')) return;
      if (!card && performance.now() > asked + 400) {
        // Not on the canvas: the screenshots' view, in the store of the size it was left on.
        asked = performance.now();
        const q = now.current;
        const wantSize = size && ALL_ASSETS.some((x) => x.id === size) && storeOf(assetById(size)).id !== storeOf(assetById(q.get(SIZE_PARAM))).id ? size : null;
        if (q.get(VIEW_PARAM) || wantSize)
          setSearch(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete(VIEW_PARAM);
              if (wantSize) next.set(SIZE_PARAM, wantSize);
              return next;
            },
            { replace: true },
          );
      }
      if (performance.now() < end) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reveal, canvas, setSearch]);
}

/**
 * Rows draw their screenshots once they near the view, one row a frame (each is heavy: devices, screens, components),
 * after the canvas has shown: opening App Store Assets is instant, and only the rows looked at are drawn. Once drawn, a
 * row stays drawn.
 */
const waiting: (() => void)[] = [];
let pumping = false;
function pump() {
  if (pumping) return;
  pumping = true;
  const next = () => {
    const show = waiting.shift();
    if (!show) return void (pumping = false);
    show();
    // Two frames: the row's paint lands before the next one starts.
    requestAnimationFrame(() => requestAnimationFrame(next));
  };
  requestAnimationFrame(next);
}

function useNearView(ref: RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    let queued: (() => void) | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || queued) return;
        io.disconnect();
        waiting.push((queued = () => setNear(true)));
        pump();
      },
      // Near is up and down only: the canvas scrolls sideways as a whole, and a row's box is the view's width, so a
      // canvas scrolled far right would leave every row below it undrawn.
      { root: el.closest('[data-store-rows]'), rootMargin: '600px 1000000px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      // Gone before its turn (another store, another view): out of the line.
      if (queued) waiting.splice(waiting.indexOf(queued) >>> 0, 1);
    };
  }, [near, ref]);
  return near;
}

/** A size's kind of device, as an icon: a foldable, a tablet (an iPad), or a phone. */
function deviceIcon(d: Display, id: string): string {
  if (id.includes('duo')) return 'devices_fold';
  if (d.w >= 600) return d.os === 'android' ? 'tablet_android' : 'tablet_mac';
  return d.os === 'android' ? 'smartphone' : 'phone_iphone';
}

/** One size: what it is and what the store asks of it, then its places, the shared layout's screenshots in them. */
function SizeRow({ asset, scale, language, editable, layoutFor, on }: { asset: StoreAsset & { display: Display }; scale: number; language: Language; editable: boolean; layoutFor: StoreAssetsProps['layoutFor']; on: boolean }) {
  const sets = useShotSets();
  // The shared layout, as many as this store takes.
  const shots = shotsOf(sets, asset.id).slice(0, asset.max);
  const pages = useNavRoot().pages;
  const [w, h] = asset.sizes[0];
  const box = { w: asset.display.w * scale, h: asset.display.h * scale };
  const sel = useSelection();
  const places = Array.from({ length: asset.max }, (_, i) => i);
  const row = useRef<HTMLElement>(null);
  const near = useNearView(row);
  return (
    <section ref={row} className={`${styles.row} ${on ? styles.rowOn : ''}`} aria-label={asset.label}>
      {/* What the size is and what the store asks of it: a title, not a control (a screenshot clicked opens the size). */}
      <div className={styles.rowHead}>
        <span className={styles.rowTitle}>
          <Icon name={deviceIcon(asset.display, asset.id)} size={20} color="var(--ui-text-subtle)" />
          {asset.label}
          {asset.id === REFERENCE_SIZE && (
            <span className={styles.bpChip} data-bp="compact" title={t('Every other size is laid out from this one: its proportions, with its own adjustments')}>
              {t('Reference')}
            </span>
          )}
          <RequiredBadge asset={asset} />
        </span>
        <span className={styles.sub}>
          {w} × {h} px · {rule(asset, shots.length)}
        </span>
        <span className={styles.sub}>{asset.note}</span>
      </div>
      {/* As far apart as the store shows them (an element across two goes on after the space). */}
      <div className={styles.strip} style={{ gap: storeOf(asset).gap * box.w }}>
        {places.map((i) => {
          const shot = shots[i];
          // Not drawn yet (out of view, or waiting its turn): its place at its size, loading.
          if (shot && !near)
            return (
              <figure key={shot.id} className={styles.card} aria-busy {...shotMark(asset.id, shot.id)}>
                <div className={styles.loading} style={{ width: box.w, height: box.h, borderRadius: cornersOf(asset.display, scale) }} />
                <figcaption className={styles.caption}>
                  <span className={styles.number}>{i + 1}</span>
                </figcaption>
              </figure>
            );
          if (shot) return <ShotCard key={shot.id} editable={editable} shot={shot} shots={shots} index={i} count={shots.length} asset={asset} box={box} scale={scale} language={language} name={shotName(shot, pages)} layoutFor={layoutFor} />;
          const next = editable && i === shots.length;
          return (
            <figure key={`place-${i}`} className={styles.card}>
              {next ? (
                // The next place: a click starts an empty screenshot there, open to add its layers at the left.
                <button
                  className={`${styles.place} ${styles.placeNext}`}
                  style={{ width: box.w, height: box.h, borderRadius: cornersOf(asset.display, scale) }}
                  onClick={() => sel.pickShot(addShot(asset.id), asset.id)}
                  title={t('New screenshot')}
                  aria-label={t('New screenshot')}
                >
                  <Icon name="add" size={22} />
                </button>
              ) : (
                <div className={styles.place} style={{ width: box.w, height: box.h, borderRadius: cornersOf(asset.display, scale) }} />
              )}
              <figcaption className={styles.caption}>
                <span className={`${styles.number} ${styles.numberEmpty}`}>{i + 1}</span>
                <span className={styles.name}>{i < asset.min ? t('Required') : t('Optional')}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

/** The store's listing graphics (its icon, feature graphic, creative assets): what each is; picked, its requirements. */
function GraphicsView() {
  const [asset, pick] = useStoreAsset();
  const store = storeOf(asset);
  const graphics = store.groups.flatMap((g) => g.assets).filter((a) => a.kind === 'graphic');
  const files = useGraphics();
  const exporting = useExporting();
  // One graphic in every size the store lists, in a zip (ExportProgress: each fills its size, cropped to it).
  const exportOne = (g: StoreAsset) =>
    void startExport({
      label: g.label,
      file: `${store.name}-${g.label}`.replace(/[^a-zA-Z0-9.-]+/g, '-').replace(/^-|-$/g, ''),
      sizes: [],
      graphics: g.sizes.map((px) => ({ store: store.name, label: g.label, px, file: files[g.id] })),
    });
  return (
    <main className={styles.main}>
      <div className={styles.graphics}>
        {graphics.map((g) => {
          const [w, h] = g.sizes[0];
          const k = Math.min(1, 260 / Math.max(w, h));
          return (
            <figure key={g.id} className={`${styles.graphic} ${g.id === asset.id ? styles.graphicOn : ''}`}>
              {files[g.id] ? (
                // Its file (StoreData.graphics), as the store shows it.
                <button className={styles.graphicFile} style={{ width: w * k, height: h * k }} onClick={() => pick(g.id)} title={t('See what the store asks of it (Requirements)')}>
                  <img src={import.meta.env.BASE_URL + files[g.id]} alt={g.label} width={w * k} height={h * k} />
                </button>
              ) : (
                <button className={styles.placeholder} style={{ width: w * k, height: h * k }} onClick={() => pick(g.id)} title={t('See what the store asks of it (Requirements)')}>
                  <Icon name="image" size={24} />
                  <span>{t('Made outside HeroCanvas for now')}</span>
                </button>
              )}
              <figcaption className={styles.graphicCaption}>
                <span className={styles.graphicText}>
                  <span className={styles.rowTitle}>
                    {g.label}
                    <RequiredBadge asset={g} />
                  </span>
                  <span className={styles.sub}>
                    {g.sizes.map(([x, y]) => `${x} × ${y}`).join(' · ')} px
                  </span>
                </span>
                {files[g.id] && (
                  <button
                    className={styles.icon}
                    disabled={exporting}
                    onClick={() => exportOne(g)}
                    aria-label={t('Export')}
                    title={g.sizes.length > 1 ? t('Export it in every size the store takes ({sizes})', { sizes: g.sizes.map(([x, y]) => `${x} × ${y}`).join(', ') }) : t('Export it at the store’s size')}
                  >
                    <Icon name="download" size={18} />
                  </button>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </main>
  );
}

/**
 * Export: this size in the language on screen or in every language, or the store's whole listing (in this language or
 * every one). The dev server draws them (scripts/vite/storeExport.ts) and hands back a zip: a folder per store,
 * language and size, each screenshot a PNG at the store's pixels. Where there's no dev server (the deployed site), the
 * menu says where it's made.
 */
/**
 * A screen's corners on the canvas, as its device rounds them (the stores show screenshots so): the display's radius
 * at the canvas's scale, and a foldable's hinge side at its own. The export stays square: the stores round it.
 */
function cornersOf(d: Display, scale: number): string {
  const r = `${d.r * scale}px`;
  if (!d.hinge) return r;
  const h = `${d.hinge.r * scale}px`;
  // Corners in CSS order: top-left, top-right, bottom-right, bottom-left.
  const on: Record<string, [boolean, boolean, boolean, boolean]> = {
    left: [true, false, false, true],
    right: [false, true, true, false],
    top: [true, true, false, false],
    bottom: [false, false, true, true],
  };
  return (on[d.hinge.edge] ?? [false, false, false, false]).map((x) => (x ? h : r)).join(' ');
}

/**
 * The open screenshot's keys: the arrows move the picked layer one point (Shift: ten), Delete removes it, Escape lets
 * go of it (then of the screenshot). Not while typing in a field.
 */
/** Undo and Redo, beside the keys (⌘Z, ⇧⌘Z). */
/**
 * The devices' screens drawn again (the dev server's pictures): after a change they don't pick up by themselves (App
 * Store Assets' own code, data from outside the app). Spins until the new ones are asked for.
 */
function RefreshScreens() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    await refreshScreens();
    setBusy(false);
  };
  return (
    <button className={styles.icon} disabled={busy} onClick={() => void run()} title={t('Draw the screens again (a change they don’t show yet)')} aria-label={t('Refresh screens')}>
      <Icon name="refresh" size={18} className={busy ? styles.spinning : undefined} />
    </button>
  );
}

function UndoButtons() {
  const { canUndo, canRedo } = useHistory();
  return (
    <span className={styles.undo}>
      <button className={styles.icon} disabled={!canUndo} onClick={() => undo()} title={t('Undo (⌘Z)')} aria-label={t('Undo')}>
        <Icon name="undo" size={18} />
      </button>
      <button className={styles.icon} disabled={!canRedo} onClick={() => redo()} title={t('Redo (⇧⌘Z)')} aria-label={t('Redo')}>
        <Icon name="redo" size={18} />
      </button>
    </span>
  );
}

/** ⌘Z undoes the last change, ⇧⌘Z (or Ctrl+Y) redoes it; a field being typed in keeps its own. */
function useUndoKeys(editable: boolean) {
  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      const again = (k === 'z' && e.shiftKey) || (k === 'y' && e.ctrlKey && !e.metaKey);
      if (k !== 'z' && !again) return;
      e.preventDefault();
      if (again) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable]);
}

function useLayerKeys(asset: (StoreAsset & { display: Display }) | undefined, editable: boolean) {
  const sel = useSelection();
  const sets = useShotSets();
  const multiIds = useMultiPick().ids;
  useEffect(() => {
    if (!sel.shot || !asset) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Escape') {
        // A group's layer picked: back to its group first, as Figma.
        const inShot = shotsOf(sets, asset.id).find((s) => s.id === sel.shot);
        const g = inShot && sel.layer ? groupOf(inShot.layers, sel.layer) : undefined;
        if (g) return sel.pickLayer(g.id);
        return sel.layer ? sel.pickLayer(null) : sel.pickShot(null);
      }
      const list = shotsOf(sets, asset.id);
      const i = list.findIndex((s) => s.id === sel.shot);
      // Its own, or a neighbor's reaching into it (picked here, saved there).
      const shot = [list[i], ...list].find((s) => s && (s === list[i] ? !!findLayer(s.layers, sel.layer) : s.layers.some((l) => l.id === sel.layer && l.extend)));
      if (!editable) return;
      // Several picked (Shift): Delete takes them all.
      if (multiIds.length > 1 && list[i] && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        removeLayers(asset.id, list[i].id, multiIds);
        return sel.pickLayer(null);
      }
      // Several picked: the arrows move them all (each by the point it's placed by, on this size's breakpoint).
      const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (multiIds.length > 1 && list[i] && arrow) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        for (const id of multiIds) {
          const l = list[i].layers.find((x) => x.id === id);
          if (!l) continue;
          const at = resolveAt(l, asset.id);
          updateLayerAt(asset.id, list[i].id, id, { x: at.x + (arrow[0] * step) / asset.display.w, y: at.y + (arrow[1] * step) / asset.display.h }, asset.id);
        }
        return;
      }
      const picked = shot && findLayer(shot.layers, sel.layer);
      if (!shot || !picked) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeLayer(asset.id, shot.id, picked.id);
        return sel.pickLayer(null);
      }
      // A layer in a group is placed by it: the arrows move the group at the top that holds it.
      const layer = topOf(shot.layers, picked.id) ?? picked;
      const step = e.shiftKey ? 10 : 1;
      const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!by) return;
      e.preventDefault();
      // Moved on the size open's breakpoint, from where it is there.
      const at = resolveAt(layer, asset.id);
      updateLayerAt(asset.id, shot.id, layer.id, { x: at.x + by[0] / asset.display.w, y: at.y + by[1] / asset.display.h }, asset.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, sets, asset, editable, multiIds]);
}

/**
 * Where a layer of screenshot `owner` went whole (all of it past the space between, on this size): the screenshot
 * it's in now and how many image widths over that is, or null while any of it is still in its own.
 */
function movedInto(owner: string, id: string, display: Display, gap: number, layoutFor: StoreAssetsProps['layoutFor']): { shot: string; by: number } | null {
  const list = shotsNow();
  const i = list.findIndex((s) => s.id === owner);
  const layer = list[i]?.layers.find((l) => l.id === id);
  if (!layer) return null;
  const { left, right } = extentOf(resolveAt(layer, sizeOf(display)), display, layoutFor);
  const step = 1 + gap;
  const k = Math.round((left + right) / 2 / step);
  const eps = 1e-3;
  if (!k || !list[i + k] || left < k * step - eps || right > k * step + 1 + eps) return null;
  return { shot: list[i + k].id, by: k * step };
}

/** A screenshot's name: its first screen's page (or "Screenshot" with no screen in it). */
export function shotName(shot: StoreShot, pages: Parameters<typeof pageName>[0]): string {
  const d = mainDevice(shot);
  return d ? pageName(pages, d.page.id) : t('Screenshot');
}

/** What the store asks of a size, against how many it has. */
function rule(asset: StoreAsset, n: number): string {
  const has = plural(n, '{n} screenshot', '{n} screenshots');
  if (n < asset.min) return t('{has}: the store needs at least {min}', { has, min: asset.min });
  return t('{has} of {max}', { has, max: asset.max });
}

function ShotCard({
  editable,
  shot,
  shots,
  index,
  count,
  asset,
  box,
  scale,
  language,
  name,
  layoutFor,
}: {
  editable: boolean;
  shot: StoreShot;
  /** The listing's screenshots (it among them): what of theirs reaches into it shows in it too. */
  shots: StoreShot[];
  index: number;
  count: number;
  asset: StoreAsset & { display: Display };
  box: { w: number; h: number };
  scale: number;
  language: Language;
  name: string;
  layoutFor: StoreAssetsProps['layoutFor'];
}) {
  const { display } = asset;
  const sel = useSelection();
  const [current] = useStoreAsset();
  const gap = storeOf(asset).gap;
  // The same screenshot shows in every size's row: open in the one clicked.
  const on = sel.shot === shot.id && current.id === asset.id;
  // Above the image and not cut by it: the picked layer's outline and handles (ShotEdit.overlay).
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const multi = useMultiPick();
  const shotPick = useShotMultiPick();
  // A device double clicked (its own, in a group, or a neighbor's reaching in): Interact with the screen.
  const interact = (e: MouseEvent<HTMLElement>) => {
    const el = e.target as HTMLElement;
    const id = el.closest<HTMLElement>('[data-store-child]')?.dataset.storeChild ?? el.closest<HTMLElement>('[data-store-layer]')?.dataset.storeLayer;
    const layer = id && shots.map((s) => findLayer(s.layers, id)).find(Boolean);
    if (!layer || layer.kind !== 'device') return;
    e.preventDefault();
    sel.pickShot(shot.id, asset.id, id);
    requestInteract(id);
  };
  // Right click on a layer: picked here (its own, or a neighbor's reaching in), then the same menu as the list's.
  const menu = (e: MouseEvent<HTMLElement>) => {
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-store-layer]')?.dataset.storeLayer;
    if (!hit) return;
    e.preventDefault();
    if (!(on && multi.ids.includes(hit))) sel.pickShot(shot.id, asset.id, hit);
    openLayerMenu(e.clientX, e.clientY);
  };
  /** A layer changed in screenshot `owner`; one moved whole into another screenshot becomes that one's, picked there. */
  const change = (owner: string, id: string, patch: Partial<Layer>) => {
    updateLayerAt(asset.id, owner, id, patch, asset.id);
    const to = movedInto(owner, id, display, gap, layoutFor);
    if (!to) return;
    transferLayer(asset.id, owner, to.shot, id, to.by);
    sel.pickShot(to.shot, asset.id, id);
  };
  // A neighbor's layer reaching into this one: picked here (listed with a link), moved and sized where it's saved.
  const spillEdit = useMemo<SpillEdit>(
    () => ({
      zoom: scale,
      picked: on ? sel.layer : null,
      overlay: on ? overlay : undefined,
      onPick: (id) => (on ? sel.pickLayer(id) : sel.pickShot(shot.id, asset.id, id)),
      onChange: editable ? change : undefined,
    }),
    [scale, sel, asset.id, editable, on, overlay, shot.id, gap, layoutFor], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // In a run sharing one background (consecutive screenshots, each continuing the one before): the first's, across them.
  const span = runOf(shots, index);
  const leader = shots[span.start];
  const run = useMemo<BackgroundRun | undefined>(
    () => (span.end > span.start ? { background: leader.background, count: span.end - span.start + 1, at: index - span.start, spread: leader.spread } : undefined),
    [span.start, span.end, leader.background, leader.spread, index],
  );
  // Every other screenshot, by its place from this one: a layer wide enough reaches past the one beside it.
  const neighbors = useMemo<Neighbor[]>(() => shots.flatMap((n, j) => (j === index ? [] : [{ shot: n, at: j - index }])), [shots, index]);
  // A click on the screenshot opens it (its layers at the left) with what was clicked picked: a layer, or the
  // background. Open, a layer picks itself; the rest picks the background.
  const open = (e?: { target: EventTarget; nativeEvent: Event }) => {
    // A screen's recorded taps, replayed as it mounts, click inside it: only the person's open it.
    if (e && !e.nativeEvent.isTrusted) return;
    // Shift: picked with others (to share one background across them).
    if (e && (e.nativeEvent as MouseEvent['nativeEvent']).shiftKey) return shotPick.toggle(shot.id);
    const hit = (e?.target as HTMLElement | undefined)?.closest<HTMLElement>('[data-store-layer]');
    // View only: the screenshot, not its layers (nothing to edit in them).
    if (!editable) return on ? undefined : sel.pickShot(shot.id, asset.id);
    if (on) return sel.pickLayer(BACKGROUND);
    sel.pickShot(shot.id, asset.id, hit?.dataset.storeLayer ?? (e ? BACKGROUND : undefined));
  };
  return (
    <figure className={`${styles.card} ${on ? styles.cardOn : ''} ${shotPick.ids.includes(shot.id) ? styles.cardPicked : ''}`} {...shotMark(asset.id, shot.id)}>
      <div
        role="button"
        tabIndex={0}
        className={styles.thumb}
        {...{ [PAGE_ATTR]: storePage(shot.id), 'data-hc-page': asset.id }}
        style={{ width: box.w, height: box.h, borderRadius: cornersOf(display, scale) }}
        onClick={open}
        onContextMenu={editable ? menu : undefined}
        onDoubleClick={interact}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
        aria-pressed={on}
        aria-label={t('Screenshot {n}: {name}', { n: index + 1, name })}
      >
        <div style={{ width: display.w, height: display.h, transform: `scale(${scale})`, transformOrigin: 'top left', '--store-zoom': scale } as CSSProperties}>
          <ShotImage
            shot={shot}
            display={display}
            language={language}
            layoutFor={layoutFor}
            neighbors={neighbors}
            spillEdit={editable ? spillEdit : undefined}
            gap={gap}
            run={run}
            edit={on && editable ? { picked: sel.layer, onPick: sel.pickLayer, onChange: editable ? (id, patch) => change(shot.id, id, patch) : undefined, zoom: scale, overlay, multi: multi.ids, onShiftPick: multi.toggle } : undefined}
          />
        </div>
      </div>
      {on && (
        <div className={styles.shotOverlay} style={{ width: box.w, height: box.h }} aria-hidden>
          <div ref={setOverlay} style={{ position: 'relative', width: display.w, height: display.h, transform: `scale(${scale})`, transformOrigin: 'top left', '--store-zoom': scale } as CSSProperties} />
        </div>
      )}
      <figcaption className={styles.caption}>
        <span className={styles.number}>{index + 1}</span>
        <span className={styles.name}>{name}</span>
        {editable && (
          <>
            <button className={styles.icon} disabled={index === 0} onClick={() => moveShot(asset.id, shot.id, -1)} aria-label={t('Move earlier')}>
              <Icon name="chevron_left" size={16} />
            </button>
            <button className={styles.icon} disabled={index === count - 1} onClick={() => moveShot(asset.id, shot.id, 1)} aria-label={t('Move later')}>
              <Icon name="chevron_right" size={16} />
            </button>
            <button className={styles.icon} onClick={() => removeShot(asset.id, shot.id)} aria-label={t('Remove')}>
              <Icon name="close" size={16} />
            </button>
          </>
        )}
      </figcaption>
    </figure>
  );
}

/**
 * Several screenshots picked with Shift: one background across them (consecutive ones only: a run with a hole in it
 * wouldn't read as one).
 */
function UnifyBar({ asset, editable }: { asset: StoreAsset; editable: boolean }) {
  const pick = useShotMultiPick();
  const sets = useShotSets();
  if (pick.ids.length < 2) return null;
  const shots = shotsOf(sets, asset.id);
  const at = pick.ids.map((id) => shots.findIndex((s) => s.id === id)).filter((i) => i >= 0).sort((a, b) => a - b);
  const consecutive = at.every((x, k) => !k || x === at[k - 1] + 1);
  return (
    <div className={styles.unifyBar}>
      <span>{t('Screenshots {list}', { list: at.map((i) => i + 1).join(', ') })}</span>
      <button
        className={`${styles.button} ${styles.primary}`}
        disabled={!editable || !consecutive}
        title={consecutive ? t('One background across them, as the first one’s, the space between counted') : t('Only screenshots side by side share a background: pick the ones between too')}
        onClick={() => {
          unifyBackground(asset.id, at.map((i) => shots[i].id));
          pick.clear();
        }}
      >
        <Icon name="gradient" size={16} />
        {t('Unify background')}
      </button>
      <button className={styles.icon} onClick={pick.clear} aria-label={t('Cancel')} title={t('Cancel')}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
