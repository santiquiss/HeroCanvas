import { useEffect, useState, type PointerEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Icon } from '../components/Icon';
import { EmptyHint } from '../components/EmptyHint';
import { useDesignRoot } from '../design/DesignContext';
import { NO_APP } from '../nav/pages';
import { useSimQuery, type Mode } from '../sim/modes';
import { TOOLS } from './registry';
import styles from './Panel.module.css';

const KEY = 'hc.panels';

/** The last route each tool with routes had (the token group, the component), to go back to on its tab. */
const lastRoute = new Map<string, string>();

export interface PanelPrefs {
  left: boolean;
  right: boolean;
  /** Active tool per side. */
  tool: Partial<Record<'left' | 'right', string>>;
  /** Width per side (drag the panel's inner edge; double-click resets it). */
  width?: Partial<Record<'left' | 'right', number>>;
}

// The right one fits its three tabs with the proposal's change counts in the last.
export const DEFAULT_W = { left: 248, right: 296 };
const MIN_W = 200;
const MAX_W = 520;

function read(): PanelPrefs {
  try {
    return { left: true, right: true, tool: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { left: true, right: true, tool: {} };
  }
}

/** Panel visibility and active tools, remembered per viewer. */
export function usePanelPrefs(): [PanelPrefs, (patch: Partial<PanelPrefs>) => void] {
  const [prefs, setPrefs] = useState(read);
  const update = (patch: Partial<PanelPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch, tool: { ...p.tool, ...patch.tool }, width: { ...p.width, ...patch.width } };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  return [prefs, update];
}

/** One side panel: a tab per tool and the active tool. In Inspect mode, the side of the inspector shows it alone. */
export function PanelHost({
  side,
  mode,
  prefs,
  update,
  only,
}: {
  side: 'left' | 'right';
  mode: Mode;
  prefs: PanelPrefs;
  update: (p: Partial<PanelPrefs>) => void;
  /** Just these tools (by id), whatever the mode offers (Capture: Pages alone). */
  only?: string[];
}) {
  const { inspect } = useDesignRoot();
  const onSide = TOOLS.filter((t) => t.side === side && (t.modes ?? ['prototype', 'components']).includes(mode) && (!only || only.includes(t.id)));
  const inspector = inspect ? onSide.filter((t) => t.whileInspecting) : [];
  // The tab that was active comes back when Inspect ends: the inspector never becomes the remembered tool.
  const tools = inspector.length ? inspector : onSide.filter((t) => !t.whileInspecting);
  // A route that's a tool's content brings its tab up (once per route: the viewer can switch tabs after).
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const sim = useSimQuery();
  const claimed = tools.find((t) => t.claims?.(pathname))?.id;
  useEffect(() => {
    if (claimed) lastRoute.set(claimed, pathname);
    if (claimed && prefs.tool[side] !== claimed) update({ tool: { [side]: claimed } });
    // On a route change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, claimed]);
  if (!tools.length) return null;
  const active = tools.find((t) => t.id === prefs.tool[side]) ?? tools[0];
  const C = active.component;
  // A tool with its own routes (Components, Tokens) opens them: its tab and the view go together.
  const pick = (t: (typeof tools)[number]) => {
    update({ tool: { [side]: t.id } });
    if (t.home && !t.claims?.(pathname)) navigate((lastRoute.get(t.id) ?? t.home) + sim());
  };
  return (
    <aside className={`${styles.panel} ${styles[side]}`} style={{ width: prefs.width?.[side] ?? DEFAULT_W[side] }}>
      <ResizeEdge side={side} width={prefs.width?.[side] ?? DEFAULT_W[side]} onWidth={(w) => update({ width: { [side]: w } })} />
      <div className={styles.tabs}>
        {tools.map((t) => (
          <button key={t.id} className={`${styles.tab} ${t === active ? styles.tabOn : ''}`} title={t.title} onClick={() => pick(t)}>
            <Icon name={t.icon} size={16} />
            {t.title}
            {t.badge && <t.badge />}
          </button>
        ))}
      </div>
      <div className={styles.body}>
        {/* No app connected: in each tool's place, what it shows once there is one. */}
        {NO_APP && active.empty ? (
          <EmptyHint icon={active.icon} title={active.title}>
            {active.empty}
          </EmptyHint>
        ) : (
          <C />
        )}
      </div>
    </aside>
  );
}

/** The panel's inner edge: drag to resize (the canvas follows live), double-click for the default width. */
/** A panel's inner edge: drag to resize it (between MIN_W and MAX_W), double-click to reset. */
export function ResizeEdge({ side, width, onWidth }: { side: 'left' | 'right'; width: number; onWidth: (w: number | undefined) => void }) {
  const [drag, setDrag] = useState<{ x: number; w: number } | null>(null);
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX, w: width });
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) * (side === 'left' ? 1 : -1);
    onWidth(Math.round(Math.min(MAX_W, Math.max(MIN_W, drag.w + dx))));
  };
  return (
    <div
      className={`${styles.resize} ${styles[side === 'left' ? 'resizeL' : 'resizeR']} ${drag ? styles.resizing : ''}`}
      title="Drag to resize · double-click to reset"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
      onDoubleClick={() => onWidth(undefined)}
    />
  );
}
