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
import { listDetailActive, LIST_DETAIL_BOTTOM_NAV_MIN } from '../sim/layout';
import { parseDevices } from '../sim/deviceSet';
import { useSim, useUrlPatch } from '../sim/SimContext';
import { STATUS_COLOR } from './PagesPanel';
import styles from './Panel.module.css';

export function PageInspector() {
  const nav = useNavRoot();
  const { layout: L } = useSim();
  const [search] = useSearchParams();
  const { effective: cfg } = useScreenConfigLayers();
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
          Open pages
          <span className={styles.muted} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
            {nav.stack.length === 1 ? 'this one' : `${nav.stack.length}, bottom to top`}
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
                title={isTop ? 'This page' : 'Go back to this page'}
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
          <Pair k="Class" v={`${L.isTablet ? 'Tablet' : 'Phone'} · ${L.os} · ${L.horizontalSizeClass}${L.land ? ' · landscape' : ''}${L.rotLocked ? ' · rotation locked' : ''}`} />
          <Pair k="Navigation" v={navigationOf(L)} />
          <ListDetailRows />
          {L.sideNav && <Pair k="Right column" v={sideColumnFor(top.id, def, cfg) === 'nav' ? 'The navigation, under the status' : 'Empty: kept for the status'} />}
          {L.split && !nav.def(nav.stack[0].id).split && <Pair k="Side panel" v={L.dashOpen ? `Open beside the page · ${L.detailW} wide` : `Opens beside the page when one is pushed · ${L.detailW} wide`} />}
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
 * only: orientation is set in code (`landscape` in the manifest, app/pages.tsx).
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
      <span className={styles.k} title="Whether the page turns with the device. Set in code: landscape, in app/pages.tsx">
        Landscape
      </span>
      <span className={styles.v}>{value}</span>
    </>
  );
}

/** Where the app's navigation is on this display, in words. */
function navigationOf(L: ReturnType<typeof useSim>['layout']): string {
  if (L.nav === 'rail' && L.railW <= L.safeL) return 'None of the tool’s: the app’s own (a sidebar, a header)';
  return { column: 'A column at the right', rail: 'A rail at the left', bottom: 'A bar at the bottom' }[L.nav];
}

/**
 * The pages that show a list and its detail (a sidebar app, a settings screen): whether they do side by side on this
 * display or one at a time, and from what width. Read only: set in code (`split`, app/pages.tsx).
 */
function ListDetailRows() {
  const nav = useNavRoot();
  const { layout: L } = useSim();
  const { effective: cfg } = useScreenConfigLayers();
  return (
    <>
      {nav.stack
        .filter((r) => nav.def(r.id).split)
        .map((r) => {
          const def = nav.def(r.id);
          const eff = splitFor(r.id, def, cfg);
          if (!eff) return null;
          const width = isFullScreen(def.level) ? L.vw : def.level === 'tab' ? L.baseW : L.split ? L.detailW : L.mainW;
          const need = L.bottomNav ? Math.max(eff.minWidth, LIST_DETAIL_BOTTOM_NAV_MIN) : eff.minWidth;
          const side = listDetailActive(L, width, eff.minWidth);
          const list = eff.ratio === 'equal' ? 'half each' : `the list ${eff.masterWidth} wide`;
          return (
            <Pair
              key={r.id}
              k={`List & detail${nav.stack.filter((x) => nav.def(x.id).split).length > 1 ? ` · ${nav.title(r)}` : ''}`}
              v={side ? `Side by side here (${list}): ${width} ≥ ${need}` : `One at a time here: side by side from ${need} wide (${width} here)`}
            />
          );
        })}
    </>
  );
}
