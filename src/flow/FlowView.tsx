// Flow: every page on a pannable, zoomable canvas as a live thumbnail at the current device and theme,
// with arrows for how they connect. A flow page (manifest `flow`) is a strip of its steps (FlowStrip). Click a
// thumbnail to open it in the prototype.
// Performance: ~90 live screens. Panning and zooming move the canvas's transform directly (no React render per frame;
// the view is saved when the gesture settles), the graph is memoized (a view change doesn't re-render it), and the
// thumbnails mount a few at a time, the visible ones first (LazyPreview).
import { CHANGE, type ChangeKind } from '../design/changes';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { Icon } from '../components/Icon';
import { useNavRoot } from '../nav/context';
import { pageIcon, pageName, parsePath, ROLE_NAMES } from '../nav/stack';
import { lastPrototypeUrl } from '../sim/modes';
import type { PageStatus } from '../nav/types';
import type { Layout } from '../sim/layout';
import { useSim } from '../sim/SimContext';
import { STATUS_COLOR } from '../tools/PagesPanel';
import { ARC_ABOVE, ARC_BELOW, FlowStrip, STEP_GAP } from './FlowStrip';
import { flowEdges, flowLayout, type FlowEdge, type FlowLane } from './graph';
import { FlowRootCtx, LazyPreview } from './LazyPreview';
import { PageCard } from './PageCard';
import { PageCommentCount } from '../comments';
import { PreviewScreen } from './PreviewScreen';
import styles from './Flow.module.css';
import { plural, t } from '../i18n/ui';

/** Thumbnail scale relative to the device. */
const S = 0.32;
const HEAD = 30;
const VARIANTS_H = 54;
const GAP_X = 72;
const GAP_Y = 96;
/** Pages in a row under one parent before it wraps. */
const ROW_N = 4;
const LANE_PAD = 56;
const LANE_TITLE = 64;
const LANE_GAP = 160;
/**
 * Semantic zoom: below this scale a screen can't be read anyway, so each page is a card (its icon, its name at a
 * constant size on screen) instead of a live screen — lighter too, nothing to render.
 */
const FAR_K = 0.35;
/** How much a constant-size label may grow on the canvas (far out it stops: it would cover its neighbours). */
const MAX_INV = 3.5;
const VIEW_KEY = 'hc.flowView';
/** A pan or zoom is done once nothing has moved for this long: then the view is saved (state, storage, the % shown). */
const SETTLE_MS = 160;

interface View {
  x: number;
  y: number;
  k: number;
}

export function FlowView({ makeLayout }: { makeLayout: (detailOpen: boolean, pageId?: string) => Layout }) {
  const { layout } = useSim();
  const nav = useNavRoot();
  const PAGES = nav.pages;
  const wrap = useRef<HTMLDivElement>(null);
  // The screen the prototype was showing before switching to Flow: highlighted, with its variant preselected.
  const last = useMemo(() => parsePath(PAGES, (lastPrototypeUrl() ?? '').split('?')[0]), [PAGES]);
  const [variant, setVariant] = useState<Record<string, number>>(() => {
    if (!last) return {};
    const i = PAGES[last.id].variants?.().findIndex((v) => Object.entries(v.params ?? {}).every(([k, x]) => last.params[k] === x)) ?? -1;
    return i > 0 ? { [last.id]: i } : {};
  });
  const [dragging, setDragging] = useState(false);
  const moved = useRef(0);

  const w = Math.round(layout.vw * S);
  const h = Math.round(layout.vh * S);
  // A page's box: its header, the thumbnail and its variants; a flow page is as wide as its steps, with room for arcs.
  const size = useCallback(
    (id: string) => {
      const n = PAGES[id].flow?.steps.length;
      return n ? { w: n * w + (n - 1) * STEP_GAP, h: HEAD + ARC_ABOVE + h + VARIANTS_H + ARC_BELOW } : { w, h: HEAD + h + VARIANTS_H };
    },
    [PAGES, w, h],
  );
  // The map aims for the canvas's shape (measured once it's there).
  const [aspect, setAspect] = useState(1.5);
  useEffect(() => {
    const el = wrap.current;
    if (el && el.clientHeight) setAspect(el.clientWidth / el.clientHeight);
  }, []);
  const edges = useMemo(() => flowEdges(PAGES), [PAGES]);
  const { pos, lanes, bounds } = useMemo(
    () => flowLayout(PAGES, { size, gapX: GAP_X, gapY: GAP_Y, rowW: ROW_N * w + (ROW_N - 1) * GAP_X, lanePad: LANE_PAD, laneTitle: LANE_TITLE, laneGap: LANE_GAP, aspect }),
    [PAGES, size, w, aspect],
  );

  const [view, setView] = useState<View | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(VIEW_KEY) || 'null');
    } catch {
      return null;
    }
  });
  // The view while a gesture runs: written to the canvas directly, saved to state when it settles.
  const live = useRef(view);
  const canvas = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  useEffect(() => {
    live.current = view;
  }, [view]);
  // While it moves, the canvas is one GPU layer (moving it is just compositing); when it settles, it's redrawn sharp at
  // its new scale.
  const apply = useCallback((v: View) => {
    live.current = v;
    const el = canvas.current;
    if (el) {
      el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.k})`;
      el.style.willChange = 'transform';
    }
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      if (canvas.current) canvas.current.style.willChange = '';
      setView(live.current);
    }, SETTLE_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(settle.current), []);
  const fit = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    const k = Math.min(1, (el.clientWidth - 96) / bounds.w, (el.clientHeight - 96) / bounds.h);
    setView({ k, x: (el.clientWidth - bounds.w * k) / 2, y: (el.clientHeight - bounds.h * k) / 2 });
  }, [bounds]);
  useEffect(() => {
    if (!view) fit();
  }, [view, fit]);
  useEffect(() => {
    if (!view) return;
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(view));
    } catch {
      /* storage unavailable */
    }
  }, [view]);

  // Wheel: pan (trackpad scroll), zoom with ⌘/Ctrl or pinch. Non-passive so the page doesn't scroll.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = live.current;
      if (!v) return;
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect();
        const cx = e.clientX - r.left;
        const cy = e.clientY - r.top;
        const k = clamp(v.k * Math.exp(-e.deltaY * 0.01));
        apply({ k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k });
      } else apply({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [apply]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const start = { x: e.clientX, y: e.clientY, v: live.current };
    moved.current = 0;
    setDragging(true);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      moved.current = Math.max(moved.current, Math.hypot(dx, dy));
      if (start.v) apply({ ...start.v, x: start.v.x + dx, y: start.v.y + dy });
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // From the live view (a gesture may not have settled yet).
  const zoomBy = (f: number) => {
    const v = live.current;
    const el = wrap.current;
    if (!v || !el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    const k = clamp(v.k * f);
    setView({ k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k });
  };

  const current = last?.id ?? null;

  return (
    <div ref={wrap} className={`${styles.wrap} ${dragging ? styles.dragging : ''}`} onPointerDown={onPointerDown}>
      {view && (
        <div
          ref={canvas}
          className={styles.canvas}
          // --inv: labels that keep their size on screen (titles, far-out names), set when a zoom settles.
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, '--inv': Math.min(MAX_INV, Math.max(1, 1 / view.k)) } as CSSProperties}
        >
          <FlowRootCtx.Provider value={wrap}>
            <FlowGraph
              lanes={lanes}
              edges={edges}
              pos={pos}
              bounds={bounds}
              w={w}
              h={h}
              size={size}
              far={view.k < FAR_K}
              variant={variant}
              setVariant={setVariant}
              current={current}
              moved={moved}
              makeLayout={makeLayout}
            />
          </FlowRootCtx.Provider>
        </div>
      )}

      <div className={styles.hint}>{t('Drag or scroll to pan · ⌘ / Ctrl + scroll to zoom · click a screen to open it')}</div>
      <div className={styles.zoom} onPointerDown={(e) => e.stopPropagation()}>
        <button title={t('Zoom out')} onClick={() => zoomBy(1 / 1.25)}>
          <Icon name="remove" size={18} />
        </button>
        <button title={t('Zoom to 100%')} onClick={() => live.current && setView({ ...live.current, k: 1 })}>
          {Math.round((view?.k ?? 1) * 100)}%
        </button>
        <button title={t('Zoom in')} onClick={() => zoomBy(1.25)}>
          <Icon name="add" size={18} />
        </button>
        <button title={t('Fit all')} onClick={fit}>
          <Icon name="fit_screen" size={18} />
        </button>
      </div>
    </div>
  );
}

interface GraphProps {
  lanes: FlowLane[];
  edges: FlowEdge[];
  pos: Record<string, { x: number; y: number }>;
  bounds: { w: number; h: number };
  w: number;
  h: number;
  size: (id: string) => { w: number; h: number };
  /** Zoomed far out: cards instead of screens (semantic zoom). */
  far: boolean;
  variant: Record<string, number>;
  setVariant: Dispatch<SetStateAction<Record<string, number>>>;
  current: string | null;
  /** How far the pointer moved since it went down: a drag isn't a click. */
  moved: MutableRefObject<number>;
  makeLayout: (detailOpen: boolean, pageId?: string) => Layout;
}

/** The sections, the pages, their arrows and thumbnails. Memoized: panning and zooming don't re-render it. */
const FlowGraph = memo(function FlowGraph({ lanes, edges, pos, bounds, w, h, size, far, variant, setVariant, current, moved, makeLayout }: GraphProps) {
  const { layout } = useSim();
  const nav = useNavRoot();
  const PAGES = nav.pages;
  // A page's thumbnail box (the first step's, for a flow), to draw arrows from and to.
  const box = (id: string) => {
    const top = pos[id].y + HEAD + (PAGES[id].flow ? ARC_ABOVE : 0);
    return { x: pos[id].x, y: top, w: size(id).w, h, head: pos[id].y };
  };
  const wasDrag = useCallback(() => moved.current >= 4, [moved]);
  // The section a page is in (its root): an arrow to another section is drawn lighter, dashed — it crosses the map.
  const laneOf = (id: string): string => {
    let at = id;
    for (let i = 0; i < 10 && PAGES[at]?.parent && PAGES[PAGES[at].parent!]; i++) at = PAGES[at].parent!;
    return at;
  };
  const radius = layout.screenRadius.replace(/(\d+(\.\d+)?)px/g, (_, v) => `${Number(v) * S}px`);
  return (
    <>
      {lanes.map((l) => (
        <div key={l.id} className={styles.lane} style={{ left: l.x, top: l.y, width: l.w, height: l.h }}>
          <span className={styles.laneTitle} style={{ height: LANE_TITLE }}>
            {pageName(PAGES, l.id)}
          </span>
        </div>
      ))}
      <svg className={styles.edges} width={bounds.w} height={bounds.h}>
        <defs>
          <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#7d848e" />
          </marker>
        </defs>
        {edges.map((e, i) => {
          const across = laneOf(e.from) !== laneOf(e.to);
          return (
            <path
              key={i}
              d={edgeBetween(box(e.from), box(e.to)).path}
              fill="none"
              stroke="#7d848e"
              strokeWidth={1.5}
              strokeDasharray={across ? '6 6' : undefined}
              opacity={across ? 0.45 : 1}
              markerEnd="url(#flow-arrow)"
            />
          );
        })}
      </svg>
      {!far &&
        edges.map((e, i) => {
          if (!e.label) return null;
          const { mid } = edgeBetween(box(e.from), box(e.to));
          return (
            <span key={i} className={styles.edgeLabel} style={{ left: mid.x, top: mid.y }}>
              {e.label}
            </span>
          );
        })}

      {Object.keys(pos).map((id) => {
        const def = PAGES[id];
        const variants = def.variants?.() ?? [];
        const vi = Math.min(variant[id] ?? 0, Math.max(0, variants.length - 1));
        const params = variants[vi]?.params ?? {};
        const state = variants[vi]?.state;
        const name = pageName(PAGES, id);
        const head = far ? (
          // Far out: just the name (and its open comments), at a constant size on screen.
          <div className={styles.farHead} title={name}>
            <span className={styles.name}>{name}</span>
            <span className={styles.farCount}>
              <PageCommentCount page={id} />
            </span>
          </div>
        ) : (
          <div className={styles.nodeHead}>
            <Icon name={pageIcon(def)} size={16} />
            <span className={styles.name}>{name}</span>
            {def.level !== 'tab' && <span className={styles.badge}>{ROLE_NAMES[def.level]}</span>}
            {def.flow && <span className={styles.badge}>{plural(def.flow.steps.length, 'flow · {n} step', 'flow · {n} steps')}</span>}
            {nav.change(id) && <ChangeBadge change={nav.change(id)!} />}
            <PageCommentCount page={id} />
            <span className={styles.dot} style={{ background: STATUS_COLOR[def.status ?? 'placeholder'] }} title={def.status && STATUS_WORD[def.status]} />
          </div>
        );
        if (def.flow) {
          return (
            <div key={id} className={styles.node} style={{ left: pos[id].x, top: pos[id].y, width: size(id).w }}>
              {head}
              <div style={{ position: 'relative', height: ARC_ABOVE + h + VARIANTS_H + ARC_BELOW }}>
                <FlowStrip id={id} params={params} w={w} h={h} scale={S} radius={radius} head={0} labels={VARIANTS_H} current={id === current} moved={wasDrag} makeLayout={makeLayout} far={far} />
              </div>
            </div>
          );
        }
        return (
          <div key={id} className={styles.node} style={{ left: pos[id].x, top: pos[id].y, width: w }}>
            {head}
            <div
              className={`${styles.thumb} ${id === current ? styles.current : ''}`}
              style={{ width: w, height: h, borderRadius: radius }}
              title={far ? name : t('Open in the prototype')}
              onClick={() => moved.current < 4 && nav.open(id, params, state)}
            >
              {far ? (
                <PageCard icon={pageIcon(def)} status={def.status} change={nav.change(id)} />
              ) : (
                <div className={styles.thumbInner} style={{ width: layout.vw, height: layout.vh, transform: `scale(${S})` }}>
                  <LazyPreview>{() => <PreviewScreen page={{ id, params }} state={state} makeLayout={makeLayout} still />}</LazyPreview>
                </div>
              )}
            </div>
            {!far && variants.length > 1 && (
              <div className={styles.variants}>
                {variants.map((v, i) => (
                  <button key={v.label} className={`${styles.variant} ${i === vi ? styles.variantOn : ''}`} onClick={() => setVariant((s) => ({ ...s, [id]: i }))}>
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
});

/** A page's status as its dot's tooltip names it (the words of Pages). */
const STATUS_WORD: Record<PageStatus, string> = { done: t('done'), pending: t('pending'), placeholder: t('placeholder') };

const clamp = (k: number) => Math.max(0.1, Math.min(2, k));

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Top of the page's header (above the thumbnail). */
  head: number;
}

/**
 * An arrow from one page to another, by where the target is: below (from the bottom of the source to the top of the
 * target's header), beside (side to side), or above. A cubic curve, and its midpoint for the label.
 */
function edgeBetween(a: Box, b: Box) {
  const below = b.head >= a.y + a.h;
  const above = a.head >= b.y + b.h;
  let p1: { x: number; y: number };
  let p2: { x: number; y: number };
  let c1: { x: number; y: number };
  let c2: { x: number; y: number };
  if (below || above) {
    const dir = below ? 1 : -1;
    // From under the source, as close above the target as it reaches (a wide flow page's arrows go straight down).
    p1 = { x: Math.max(a.x + 12, Math.min(a.x + a.w - 12, b.x + b.w / 2)), y: below ? a.y + a.h : a.head };
    p2 = { x: b.x + b.w / 2, y: below ? b.head - 4 : b.y + b.h + 4 };
    const dy = Math.max(40, Math.abs(p2.y - p1.y) / 2) * dir;
    c1 = { x: p1.x, y: p1.y + dy };
    c2 = { x: p2.x, y: p2.y - dy };
  } else {
    const right = b.x >= a.x + a.w / 2;
    p1 = { x: right ? a.x + a.w : a.x, y: a.y + a.h / 2 };
    p2 = { x: right ? b.x - 2 : b.x + b.w + 2, y: b.y + b.h / 2 };
    const dx = Math.max(60, Math.abs(p2.x - p1.x) / 2) * (right ? 1 : -1);
    c1 = { x: p1.x + dx, y: p1.y };
    c2 = { x: p2.x - dx, y: p2.y };
  }
  const mid = { x: (p1.x + 3 * c1.x + 3 * c2.x + p2.x) / 8, y: (p1.y + 3 * c1.y + 3 * c2.y + p2.y) / 8 };
  return { path: `M${p1.x} ${p1.y} C${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`, mid };
}

/** NEW / CHANGED marker for pages under the active proposal. */
/** NEW / CHANGED / REMOVED, in the colors of change (design/changes). */
export function ChangeBadge({ change }: { change: ChangeKind }) {
  return (
    <span
      style={{
        padding: '1px 5px',
        borderRadius: 4,
        background: CHANGE[change].color,
        color: '#fff',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        flex: 'none',
      }}
    >
      {CHANGE[change].label}
    </span>
  );
}
