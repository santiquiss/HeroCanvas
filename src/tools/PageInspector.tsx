// Inspector for the current page: manifest entry, params, owned state, the navigation stack,
// a shareable link and the layout metrics the screens see. A flow page gets its steps, to go through one at a time.
import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { useNavRoot } from '../nav/context';
import { flowTransitions, isVariant, stepOf, stepState } from '../nav/flow';
import { HOLD_PARAM, stateKeys } from '../nav/stack';
import { isFullScreen } from '../nav/types';
import { DEVICES, displayId, findDevice, findDisplay, type Device, type Display } from '../devices/devices';
import { landscapeFor, sideColumnFor, splitFor, supportsLandscape, useScreenConfigLayers } from '../nav/screenConfig';
import { useCanWrite } from '../persist/devApi';
import { listDetailActive, LIST_DETAIL_BOTTOM_NAV_MIN } from '../sim/layout';
import { parseDevices } from '../sim/deviceSet';
import { useSim, useUrlPatch } from '../sim/SimContext';
import { STATUS_COLOR } from './PagesPanel';
import styles from './Panel.module.css';

export function PageInspector() {
  const nav = useNavRoot();
  const { layout: L } = useSim();
  const [search] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const top = nav.stack[nav.stack.length - 1];
  const def = nav.def(top.id);
  const params = Object.entries(top.params);
  const state = stateKeys(def).map((k) => [k, search.get(k)] as const);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <>
      <div className={styles.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, lineHeight: '20px' }}>{nav.title(top)}</span>
          <span className={styles.badge}>{def.level}</span>
        </div>
        <div className={styles.kv}>
          <span className={styles.k}>Id</span>
          <span className={`${styles.v} ${styles.mono}`}>{top.id}</span>
          <span className={styles.k}>Path</span>
          <span className={`${styles.v} ${styles.mono}`}>{def.path}</span>
          <span className={styles.k}>Status</span>
          <span className={styles.v} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={styles.dot} style={{ background: STATUS_COLOR[def.status ?? 'placeholder'] }} />
            {def.status ?? 'placeholder'}
          </span>
          <LandscapeSupport id={top.id} />
          {def.note && (
            <>
              <span className={styles.k}>Note</span>
              <span className={styles.v}>{def.note}</span>
            </>
          )}
        </div>
      </div>

      {def.flow && <FlowSection id={top.id} />}

      {nav.stack
        .filter((r) => nav.def(r.id).split)
        .map((r) => (
          <ScreenConfigSection key={r.id} id={r.id} />
        ))}
      {L.sideNav && <SideColumnSection id={top.id} />}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Params</div>
        {params.length || state.length ? (
          <div className={styles.kv}>
            {params.map(([k, v]) => (
              <Pair key={k} k={`:${k}`} v={v} />
            ))}
            {state.map(([k, v]) => (
              <Pair key={k} k={`?${k}`} v={v} />
            ))}
          </div>
        ) : (
          <span className={styles.muted}>None</span>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Stack
          <span className={styles.muted} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
            {nav.stack.length} {nav.stack.length === 1 ? 'level' : 'levels'}
          </span>
        </div>
        <div className={styles.crumbs}>
          {nav.stack.map((r, i) => {
            const isTop = i === nav.stack.length - 1;
            return (
              <button
                key={i}
                className={styles.crumb}
                style={{ paddingLeft: 6 + i * 12, fontWeight: isTop ? 600 : 400 }}
                title={isTop ? 'Current page' : 'Go back to this level'}
                onClick={() => !isTop && nav.setStack(nav.stack.slice(0, i + 1))}
              >
                <Icon name={i === 0 ? 'home' : 'subdirectory_arrow_right'} size={14} />
                <span className={styles.name}>{nav.title(r)}</span>
                <span className={styles.badge}>{nav.def(r.id).level}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Link
          <button className={styles.btn} onClick={copy}>
            <Icon name={copied ? 'check' : 'link'} size={14} />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <span className={`${styles.mono} ${styles.v}`} style={{ color: 'var(--ui-text-2)' }}>
          {decodeURIComponent(window.location.hash)}
        </span>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Layout</div>
        <div className={styles.kv}>
          <Pair k="Viewport" v={`${L.vw} × ${L.vh}`} />
          <Pair k="Class" v={`${L.isTablet ? 'Tablet' : 'Phone'} · ${L.os}${L.land ? ' · landscape' : ''}${L.rotLocked ? ' · rotation locked' : ''}`} />
          <Pair k="Navigation" v={{ column: 'Right column', rail: 'Rail (left)', bottom: 'Bottom bar' }[L.nav]} />
          <Pair k="Split" v={L.split ? `Yes · panel ${L.detailW}px` : 'No'} />
          <Pair k="Content" v={`${L.contentW}px · ${L.cols} cols`} />
          <Pair k="Safe area" v={`top ${L.sbH} · bottom ${L.botIn}${L.safeL ? ` · left ${L.safeL}` : ''}`} />
          {L.reserved && <Pair k="Reserved" v={`top-right ${L.reserved.width}×${L.reserved.height} · header inset ${L.headerInsetR}`} />}
        </div>
      </div>
    </>
  );
}

/** The flow's current step, back / next through the steps, where its actions go, and the loaders' hold. */
function FlowSection({ id }: { id: string }) {
  const nav = useNavRoot();
  const [search] = useSearchParams();
  const patch = useUrlPatch();
  const def = nav.def(id);
  const flow = def.flow!;
  const step = stepOf(flow, search);
  const i = flow.steps.indexOf(step);
  const top = nav.stack[nav.stack.length - 1];
  const show = (to: string) => {
    const st = flow.steps.find((s) => s.id === to);
    if (st) nav.open(id, top.params, stepState(def, st));
  };
  const held = step.auto && search.get(HOLD_PARAM) === '1';
  const out = flowTransitions(flow).filter((t) => t.from === step.id);
  // The step's states (something picked, a valid code…): here and in Flow, not in the Pages list — they aren't pages.
  const states = step.variants ?? [];
  const picked = states.findIndex((v) => Object.keys(v.state).length > 0 && isVariant(search, v));
  const at = picked >= 0 ? picked : states.findIndex((v) => !Object.keys(v.state).length);
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        Flow
        <span className={styles.muted} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
          step {i + 1} of {flow.steps.length}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <button className={styles.btn} style={{ padding: 2 }} title="Previous step" disabled={i === 0} onClick={() => show(flow.steps[i - 1].id)}>
          <Icon name="chevron_left" size={16} />
        </button>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <Icon name={step.kind === 'loading' ? 'hourglass_empty' : 'crop_portrait'} size={16} />
          <span className={styles.name}>{step.label}</span>
        </span>
        <button className={styles.btn} style={{ padding: 2 }} title="Next step" disabled={i === flow.steps.length - 1} onClick={() => show(flow.steps[i + 1].id)}>
          <Icon name="chevron_right" size={16} />
        </button>
      </div>
      {step.note && (
        <div className={styles.muted} style={{ marginBottom: 8, lineHeight: '16px' }}>
          {step.note}
        </div>
      )}
      {states.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }} role="radiogroup" aria-label="States">
          {states.map((v, k) => (
            <button key={v.label} role="radio" aria-checked={k === at} className={`${styles.btn} ${k === at ? styles.btnActive : ''}`} onClick={() => nav.open(id, top.params, stepState(def, step, v))}>
              {v.label}
            </button>
          ))}
        </div>
      )}
      {held && (
        <button className={styles.btn} style={{ marginBottom: 8 }} title="Let this loader move on, as in the app" onClick={() => patch({ [HOLD_PARAM]: null })}>
          <Icon name="play_arrow" size={14} />
          Paused · play
        </button>
      )}
      <div className={styles.kv}>
        {out.map((t, k) => (
          <Fragment key={k}>
            <span className={styles.k}>{t.auto ? 'After' : t.label}</span>
            <span className={styles.v}>
              {t.to ? (
                <button className={styles.link} onClick={() => show(t.to!)}>
                  {t.auto && `${t.label} → `}
                  {flow.steps.find((s) => s.id === t.to)?.label ?? t.to}
                </button>
              ) : (
                <span className={styles.muted}>leaves the flow</span>
              )}
              {t.when && <span className={styles.muted}> · {t.when}</span>}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string | null }) {
  return (
    <>
      <span className={styles.k}>{k}</span>
      <span className={`${styles.v} ${styles.mono}`}>{v ?? <span className={styles.muted}>—</span>}</span>
    </>
  );
}

const MIN_WIDTHS = [600, 720, 834, 1024];
const MASTER_WIDTHS = [320, 360, 400, 440];
const select: React.CSSProperties = { height: 24, border: '1px solid #dfe2e6', borderRadius: 6, font: 'inherit', fontSize: 11, padding: '0 4px', maxWidth: '100%' };

/** Live override of a page's master–detail config (kept in the URL as `cfg`). */
function ScreenConfigSection({ id }: { id: string }) {
  const nav = useNavRoot();
  const { layout: L } = useSim();
  const { effective: cfg, setUrl: setCfg } = useScreenConfigLayers();
  const def = nav.def(id);
  const base = def.split!;
  const eff = splitFor(id, def, cfg);
  const o = cfg[id] ?? {};
  const on = o.split !== false;
  // Covers and boot pages span the screen; pushed pages get the main area (or the tablet panel).
  const width = isFullScreen(def.level) ? L.vw : L.split ? L.detailW : L.mainW;
  const active = !!eff && listDetailActive(L, width, eff.minWidth);
  const need = eff ? (L.bottomNav ? Math.max(eff.minWidth, LIST_DETAIL_BOTTOM_NAV_MIN) : eff.minWidth) : 0;
  const child = nav.def(base.defaultChild.id);
  const variants = child.variants?.() ?? [];
  const current = JSON.stringify(eff?.defaultChild.params ?? base.defaultChild.params);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        Screen config · {nav.title({ id, params: {} })}
      </div>
      <div className={styles.kv} style={{ alignItems: 'center' }}>
        <span className={styles.k}>List–detail</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={on} onChange={(e) => setCfg(id, { split: e.target.checked })} />
          <span className={styles.muted}>{!on ? 'off: always stacks' : active ? `active (${width}px ≥ ${need})` : `stacks here (${width}px < ${need}${L.bottomNav && need > eff!.minWidth ? ', bottom nav' : ''})`}</span>
        </label>
        <span className={styles.k}>From width</span>
        <select style={select} disabled={!on} value={eff?.minWidth ?? base.minWidth} onChange={(e) => setCfg(id, { minWidth: Number(e.target.value) })}>
          {MIN_WIDTHS.map((w) => (
            <option key={w} value={w}>
              {w}px{w === base.minWidth ? ' (code)' : ''}
            </option>
          ))}
        </select>
        <span className={styles.k}>Proportion</span>
        <select style={select} disabled={!on} value={eff?.ratio ?? base.ratio} onChange={(e) => setCfg(id, { ratio: e.target.value as 'equal' | 'detail' })}>
          <option value="equal">50 / 50{base.ratio === 'equal' ? ' (code)' : ''}</option>
          <option value="detail">Detail-dominant{base.ratio === 'detail' ? ' (code)' : ''}</option>
        </select>
        <span className={styles.k}>List width</span>
        <select style={select} disabled={!on || (eff?.ratio ?? base.ratio) === 'equal'} value={eff?.masterWidth ?? base.masterWidth} onChange={(e) => setCfg(id, { masterWidth: Number(e.target.value) })}>
          {MASTER_WIDTHS.map((w) => (
            <option key={w} value={w}>
              {w}px{w === base.masterWidth ? ' (code)' : ''}
            </option>
          ))}
        </select>
        <span className={styles.k}>Default</span>
        <select style={select} disabled={!on} value={current} onChange={(e) => setCfg(id, { defaultParams: JSON.parse(e.target.value) })}>
          {variants.map((v) => (
            <option key={v.label} value={JSON.stringify(v.params)}>
              {v.label}
              {JSON.stringify(v.params) === JSON.stringify(base.defaultChild.params) ? ' (code)' : ''}
            </option>
          ))}
        </select>
      </div>
      <SaveBar id={id} />
    </div>
  );
}

/** The displays on the canvas: the single device, or each display of a set (none in All devices). */
function canvasDisplays(search: URLSearchParams): { device: Device; display: Display }[] {
  const set = parseDevices(search.get('devices'));
  if (set.length >= 2) {
    const seen = new Set<string>();
    return set
      .map((it) => {
        const device = findDevice(it.device);
        return { device, display: findDisplay(device, it.display) };
      })
      .filter(({ device, display }) => !seen.has(displayId(device, display)) && !!seen.add(displayId(device, display)));
  }
  if (search.get('device') === 'all') return [];
  const device = findDevice(search.get('device'));
  return [{ device, display: findDisplay(device, search.get('display')) }];
}

/**
 * Whether the current page turns with the device, on the displays of the canvas (every display in All devices). Read
 * only: orientation is set in code (`landscape` in the manifest, src/app/pages.tsx).
 */
function LandscapeSupport({ id }: { id: string }) {
  const nav = useNavRoot();
  const [search] = useSearchParams();
  const { effective: cfg } = useScreenConfigLayers();
  const setting = landscapeFor(id, nav.def(id), cfg);
  const onCanvas = canvasDisplays(search);
  const displays = onCanvas.length ? onCanvas : DEVICES.flatMap((device) => device.displays.map((display) => ({ device, display })));
  const turning = displays.filter(({ device, display }) => supportsLandscape(setting, device, display));
  const name = ({ device, display }: { device: Device; display: Display }) => `${device.name}${device.displays.length > 1 ? ` · ${display.label.split(' ')[0]}` : ''}`;
  const value = !turning.length ? 'Not supported · portrait only' : turning.length === displays.length ? 'Supported' : `Supported on ${turning.map(name).join(', ')}`;
  return (
    <>
      <span className={styles.k} title="Whether the page turns with the device. Set in code: landscape, in src/app/pages.tsx">
        Landscape
      </span>
      <span className={styles.v}>{value}</span>
    </>
  );
}


/** iPhone Duo: what the right column shows on the current page. */
function SideColumnSection({ id }: { id: string }) {
  const nav = useNavRoot();
  const { effective: cfg, setUrl: setCfg } = useScreenConfigLayers();
  const def = nav.def(id);
  const value = sideColumnFor(id, def, cfg);
  const base = def.sideColumn ?? (isFullScreen(def.level) ? 'empty' : 'nav');
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>iPhone Duo column · {nav.title(nav.stack[nav.stack.length - 1])}</div>
      <div className={styles.kv} style={{ alignItems: 'center' }}>
        <span className={styles.k}>Right column</span>
        <select style={select} value={value} onChange={(e) => setCfg(id, { sideColumn: e.target.value as 'nav' | 'empty' })}>
          <option value="nav">Navigation{base === 'nav' ? ' (code)' : ''}</option>
          <option value="empty">Empty (reserved){base === 'empty' ? ' (code)' : ''}</option>
        </select>
      </div>
      <p className={styles.muted} style={{ margin: '8px 0 0' }}>
        The status and Dynamic Island always live in this column; content never goes under it.
      </p>
      <SaveBar id={id} />
    </div>
  );
}

/**
 * Where the page's config comes from, and the actions to move it between layers:
 *   unsaved (URL) → Save as default (screen-config.json) → Make code default (src/app/pages.tsx)
 *   Revert to code default drops what was saved. The two destructive actions ask for confirmation inline.
 */
function SaveBar({ id }: { id: string }) {
  const nav = useNavRoot();
  const { url, saved, effective, proposal, save, discard, resetSaved, makeCodeDefault } = useScreenConfigLayers();
  const writable = useCanWrite();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'revert' | 'code' | null>(null);
  const def = nav.def(id);
  const unsaved = !!url[id] && Object.keys(url[id]).length > 0;
  const isSaved = !!saved[id] && Object.keys(saved[id]).length > 0;
  const splitOff = !!def.split && effective[id]?.split === false;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setConfirm(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const noWrite = 'Saving needs the dev server (npm run dev)';
  const tip = (t: string) => (writable ? t : noWrite);
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span className={styles.badge} style={unsaved ? { background: 'var(--ui-amber-soft)', color: 'var(--ui-amber-text)' } : isSaved ? { background: 'var(--ui-green-soft)', color: 'var(--ui-green-text)' } : undefined}>
          {unsaved ? 'Unsaved (URL only)' : isSaved ? (proposal ? 'Saved in proposal' : 'Saved project default') : proposal ? 'Same as base' : 'Code default'}
        </span>
        {!confirm && unsaved && (
          <>
            <button className={styles.btn} disabled={!writable || busy} title={tip(proposal ? `Save in the proposal (src/proposals/${proposal.folder}/config.json)` : 'Save for everyone in src/nav/screen-config.json; the code stays as is')} onClick={() => run(() => save(id))}>
              <Icon name="save" size={14} />
              {proposal ? 'Save to proposal' : 'Save as default'}
            </button>
            <button className={styles.btn} disabled={busy} title="Drop the unsaved changes" onClick={() => discard(id)}>
              Discard
            </button>
          </>
        )}
        {!confirm && !proposal && (unsaved || isSaved) && (
          <button className={styles.btn} disabled={!writable || busy} title={tip('Write these values into the page in src/app/pages.tsx')} onClick={() => setConfirm('code')}>
            <Icon name="code" size={14} />
            Make code default
          </button>
        )}
        {!confirm && !unsaved && isSaved && (
          <button className={styles.btn} disabled={!writable || busy} title={tip(proposal ? 'Remove this page from the proposal config; it goes back to the base' : 'Delete the saved values; the page goes back to what the code says')} onClick={() => setConfirm('revert')}>
            <Icon name="restart_alt" size={14} />
            {proposal ? 'Revert to base' : 'Revert to code default'}
          </button>
        )}
      </div>
      {confirm && (
        <div style={{ padding: 8, borderRadius: 6, background: 'var(--ui-bg-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>
            {confirm === 'revert'
              ? proposal
                ? 'Remove this page from the proposal config? It goes back to the base.'
                : 'Delete the saved values of this page? It goes back to what the code says.'
              : `Write these values into src/app/pages.tsx as the code default?${splitOff ? ' List–detail is off: it will be removed from the code.' : ''}`}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={styles.btn}
              disabled={busy}
              style={{ background: 'var(--ui-strong)', color: 'var(--ui-on-strong)', borderColor: 'var(--ui-strong)' }}
              onClick={() => run(() => (confirm === 'revert' ? resetSaved(id) : makeCodeDefault(id, def)))}
            >
              {confirm === 'revert' ? 'Revert' : 'Write to code'}
            </button>
            <button className={styles.btn} disabled={busy} onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {!writable && unsaved && <span className={styles.muted}>{noWrite}. The link keeps the change.</span>}
      {error && <span style={{ color: 'var(--ui-red-text)' }}>{error}</span>}
    </div>
  );
}
