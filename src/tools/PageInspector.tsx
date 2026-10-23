// Inspector for the current page: manifest entry, params, owned state, the navigation stack,
// a shareable link and the layout metrics the screens see. A flow page gets its steps, to go through one at a time.
import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { useNavRoot } from '../nav/context';
import { flowTransitions, isVariant, stepOf, stepState } from '../nav/flow';
import { HOLD_PARAM, ROLE_NAMES, stateKeys } from '../nav/stack';
import { pageInFront, SIDE_PANEL_PAGE, sidePanelOnIn } from '../nav/sidePanel';
import { isFullScreen } from '../nav/types';
import { DEVICES, displayId, findDevice, findDisplay, type Device, type Display } from '../devices/devices';
import { landscapeFor, sideColumnFor, splitFor, supportsLandscape, useScreenConfigLayers } from '../nav/screenConfig';
import { listDetailActive, LIST_DETAIL_BOTTOM_NAV_MIN } from '../sim/layout';
import { parseDevices } from '../sim/deviceSet';
import { useSim, useUrlPatch } from '../sim/SimContext';
import { STATUS_COLOR, STATUS_WORD } from './PagesPanel';
import styles from './Panel.module.css';
import { t } from '../i18n/ui';

export function PageInspector() {
  const nav = useNavRoot();
  const { layout: L } = useSim();
  const [search] = useSearchParams();
  const { effective: cfg } = useScreenConfigLayers();
  const [copied, setCopied] = useState(false);
  // The side panel, when it's on, is the page in front: the one inspected.
  const panel = SIDE_PANEL_PAGE && sidePanelOnIn(search) ? SIDE_PANEL_PAGE : null;
  const top = pageInFront(nav.stack, search);
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
          <span className={styles.badge}>{ROLE_NAMES[def.level]}</span>
        </div>
        <div className={styles.kv}>
          <span className={styles.k}>{t('Id')}</span>
          <span className={`${styles.v} ${styles.mono}`}>{top.id}</span>
          <span className={styles.k}>{t('Path')}</span>
          <span className={`${styles.v} ${styles.mono}`}>{def.path}</span>
          <span className={styles.k}>{t('Status')}</span>
          <span className={styles.v} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={styles.dot} style={{ background: STATUS_COLOR[def.status ?? 'placeholder'] }} />
            {STATUS_WORD[def.status ?? 'placeholder']}
          </span>
          <LandscapeSupport id={top.id} />
          {def.note && (
            <>
              <span className={styles.k}>{t('Note')}</span>
              <span className={styles.v}>{def.note}</span>
            </>
          )}
        </div>
      </div>

      {def.flow && <FlowSection id={top.id} />}


      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Params')}</div>
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
          <span className={styles.muted}>{t('None')}</span>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {t('Open pages')}
          <span className={styles.muted} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
            {nav.stack.length + (panel ? 1 : 0) === 1 ? t('this one') : t('{count}, bottom to top', { count: nav.stack.length + (panel ? 1 : 0) })}
          </span>
        </div>
        <div className={styles.crumbs}>
          {nav.stack.map((r, i) => {
            const isTop = !panel && i === nav.stack.length - 1;
            return (
              <button
                key={i}
                className={styles.crumb}
                style={{ paddingLeft: 6 + i * 12, fontWeight: isTop ? 600 : 400 }}
                title={isTop ? t('This page') : t('Go back to this page')}
                onClick={() => !isTop && nav.setStack(nav.stack.slice(0, i + 1))}
              >
                <Icon name={i === 0 ? 'home' : 'subdirectory_arrow_right'} size={14} />
                <span className={styles.name}>{nav.title(r)}</span>
                <span className={styles.badge}>{ROLE_NAMES[nav.def(r.id).level]}</span>
              </button>
            );
          })}
          {/* The side panel, over the stack (or beside it). */}
          {panel && (
            <button className={styles.crumb} style={{ paddingLeft: 6 + nav.stack.length * 12, fontWeight: 600 }} title={t('This page')}>
              <Icon name="right_panel_open" size={14} />
              <span className={styles.name}>{nav.title({ id: panel, params: {} })}</span>
              <span className={styles.badge}>{ROLE_NAMES[nav.def(panel).level]}</span>
            </button>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {t('Link')}
          <button className={styles.btn} onClick={copy}>
            <Icon name={copied ? 'check' : 'link'} size={14} />
            {copied ? t('Copied') : t('Copy')}
          </button>
        </div>
        <span className={`${styles.mono} ${styles.v}`} style={{ color: 'var(--ui-text-2)' }}>
          {decodeURIComponent(window.location.hash)}
        </span>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('Layout')}</div>
        <div className={styles.kv}>
          <Pair k={t('Viewport')} v={`${L.vw} × ${L.vh}`} />
          <Pair k={t('Class')} v={`${L.isTablet ? t('Tablet') : t('Phone')} · ${L.os} · ${L.horizontalSizeClass}${L.land ? ` · ${t('landscape')}` : ''}${L.rotLocked ? ` · ${t('rotation locked')}` : ''}`} />
          <Pair k={t('Navigation')} v={navigationOf(L)} />
          <ListDetailRows />
          {L.sideNav && <Pair k={t('Right column')} v={sideColumnFor(top.id, def, cfg) === 'nav' ? t('The navigation, under the status') : t('Empty: kept for the status')} />}
          {L.split && !nav.def(nav.stack[0].id).split && <Pair k={t('Side panel')} v={L.dashOpen ? t('Open beside the page · {width} wide', { width: L.detailW }) : t('Opens beside the page when one is pushed · {width} wide', { width: L.detailW })} />}
          <Pair k={t('Content')} v={t('{width}px · {cols} cols', { width: L.contentW, cols: L.cols })} />
          <Pair k={t('Safe area')} v={L.safeL ? t('top {top} · bottom {bottom} · left {left}', { top: L.sbH, bottom: L.botIn, left: L.safeL }) : t('top {top} · bottom {bottom}', { top: L.sbH, bottom: L.botIn })} />
          {L.reserved && <Pair k={t('Reserved')} v={t('top-right {size} · header inset {inset}', { size: `${L.reserved.width}×${L.reserved.height}`, inset: L.headerInsetR })} />}
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
        {t('Flow')}
        <span className={styles.muted} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
          {t('step {step} of {count}', { step: i + 1, count: flow.steps.length })}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <button className={styles.btn} style={{ padding: 2 }} title={t('Previous step')} disabled={i === 0} onClick={() => show(flow.steps[i - 1].id)}>
          <Icon name="chevron_left" size={16} />
        </button>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <Icon name={step.kind === 'loading' ? 'hourglass_empty' : 'crop_portrait'} size={16} />
          <span className={styles.name}>{step.label}</span>
        </span>
        <button className={styles.btn} style={{ padding: 2 }} title={t('Next step')} disabled={i === flow.steps.length - 1} onClick={() => show(flow.steps[i + 1].id)}>
          <Icon name="chevron_right" size={16} />
        </button>
      </div>
      {step.note && (
        <div className={styles.muted} style={{ marginBottom: 8, lineHeight: '16px' }}>
          {step.note}
        </div>
      )}
      {states.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }} role="radiogroup" aria-label={t('States')}>
          {states.map((v, k) => (
            <button key={v.label} role="radio" aria-checked={k === at} className={`${styles.btn} ${k === at ? styles.btnActive : ''}`} onClick={() => nav.open(id, top.params, stepState(def, step, v))}>
              {v.label}
            </button>
          ))}
        </div>
      )}
      {held && (
        <button className={styles.btn} style={{ marginBottom: 8 }} title={t('Let this loader move on, as in the app')} onClick={() => patch({ [HOLD_PARAM]: null })}>
          <Icon name="play_arrow" size={14} />
          {t('Paused · play')}
        </button>
      )}
      <div className={styles.kv}>
        {out.map((tr, k) => (
          <Fragment key={k}>
            <span className={styles.k}>{tr.auto ? t('After') : tr.label}</span>
            <span className={styles.v}>
              {tr.to ? (
                <button className={styles.link} onClick={() => show(tr.to!)}>
                  {tr.auto && `${tr.label} → `}
                  {flow.steps.find((s) => s.id === tr.to)?.label ?? tr.to}
                </button>
              ) : (
                <span className={styles.muted}>{t('leaves the flow')}</span>
              )}
              {tr.when && <span className={styles.muted}> · {tr.when}</span>}
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
  const value = !turning.length ? t('Not supported · portrait only') : turning.length === displays.length ? t('Supported') : t('Supported on {devices}', { devices: turning.map(name).join(', ') });
  return (
    <>
      <span className={styles.k} title={t('Whether the page turns with the device. Set in code: landscape, in app/pages.tsx')}>
        {t('Landscape')}
      </span>
      <span className={styles.v}>{value}</span>
    </>
  );
}

/** Where the app's navigation is on this display, in words. */
function navigationOf(L: ReturnType<typeof useSim>['layout']): string {
  if (L.nav === 'rail' && L.railW <= L.safeL) return t('None of the tool’s: the app’s own (a sidebar, a header)');
  return { column: t('A column at the right'), rail: t('A rail at the left'), bottom: t('A bar at the bottom') }[L.nav];
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
          const list = eff.ratio === 'equal' ? t('half each') : t('the list {width} wide', { width: eff.masterWidth });
          return (
            <Pair
              key={r.id}
              k={`${t('List & detail')}${nav.stack.filter((x) => nav.def(x.id).split).length > 1 ? ` · ${nav.title(r)}` : ''}`}
              v={side ? t('Side by side here ({list}): {width} ≥ {need}', { list, width, need }) : t('One at a time here: side by side from {need} wide ({width} here)', { need, width })}
            />
          );
        })}
    </>
  );
}
