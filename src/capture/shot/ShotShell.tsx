// Shot mode (`?shot=1`): the page an agent's capture is made of (`npm run shot`, scripts/shot.mjs). The current
// screen on its device, in light and in dark side by side (or one of them), in black frames, with room around them, on
// a transparent page: nothing of the designer around it. Same screens and URL as the prototype (the route, the persona,
// the proposal, the scenario's controls), so any page is a shot. Nothing moves (still mode): the picture is each
// screen's end state.
//
// Before and after (`?shot_compare=1`, with a proposal): the screen under Live, labeled "Before", beside the
// proposal's, "After". Only when there is a before to show: a page the proposal adds, or a screen it leaves as it
// was, comes out alone and unlabeled (`finish()` says why).
//
// `window.__shot` is what the script drives: `ready()` once the screens have settled, `act(steps)` (shotActions.ts),
// `finish()` before the picture, `rect()` the area to cut.
import { APP_THEME_PARAM, appearanceIn, findAppTheme } from '../../sim/appThemes';
import { designLayout, railFoldedIn, VARIANT_PARAM } from '../../design/overridableRegistry';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { StillCtx } from '../../kit/motion';
import { DesignProvider } from '../../design/DesignContext';
import { DEVICES, findDevice, findDisplay } from '../../devices/devices';
import { NavCtx, useNavRoot, type Nav } from '../../nav/context';
import { DesignOverride } from '../../design/overridable';
import { landscapeFor, supportsLandscape, useScreenConfig } from '../../nav/screenConfig';
import { detailOpenFor } from '../../nav/stack';
import { FrameHardware, frameBox, frameStyle } from '../../sim/DeviceFrame';
import { DeviceScreen } from '../../sim/DeviceScreen';
import { computeLayout } from '../../sim/layout';
import { SharedSimProvider, SimProvider } from '../../sim/SimContext';
import frameStyles from '../../sim/SimulatorShell.module.css';
import { fingerprint, runStep, type ShotStep } from './shotActions';
import { liveNavFor, visualSignature } from './liveNav';
import { SHOT_COMPARE_PARAM, SHOT_GAP_PARAM, SHOT_PADDING_PARAM, SHOT_THEMES_PARAM } from './params';
import styles from './ShotShell.module.css';

type Theme = 'light' | 'dark';

/** `?shot_themes=`: `light`, `dark` or both (`light,dark`); unset, the default. */
export function shotThemes(param: string | null, fallback: Theme[] = ['light', 'dark']): Theme[] {
  const asked = (param ?? '').split(',').filter((t): t is Theme => t === 'light' || t === 'dark');
  return asked.length ? [...new Set(asked)] : fallback;
}

/** A number param in points, within reason; else the default. */
export function shotPoints(param: string | null, fallback: number): number {
  const n = Number(param);
  return param != null && param !== '' && Number.isFinite(n) ? Math.min(400, Math.max(0, n)) : fallback;
}

/** Room around the devices and between them, in points (the file's pixels are these times the script's scale). */
export const SHOT_PADDING = 40;
export const SHOT_GAP = 40;

/** Live, for a Before frame: the base design for the components a proposal replaces. */
const LIVE_DESIGN = { proposal: null, variant: null };

/** Why a before-and-after shot shows only the proposal's screen. */
export type CompareNote = 'new' | 'same' | null;

export function ShotShell() {
  const [search] = useSearchParams();
  const { pathname } = useLocation();
  const nav = useNavRoot();
  const [cfg] = useScreenConfig();
  const device = findDevice(search.get('device'));
  const display = findDisplay(device, search.get('display'));
  const land = search.get('land') === '1';
  // The video layout (16:9 video on top, the app below), as in the prototype.
  const video = search.get('video') === '1';
  const layoutFor = (n: Nav) => {
    const top = n.stack[n.stack.length - 1];
    const supported = supportsLandscape(landscapeFor(top.id, n.def(top.id), cfg), device, display);
    // The rail and the room beside it as its design has them (Before is Live's).
    const design = designLayout(n.proposal?.id, n.proposal ? search.get(VARIANT_PARAM) : null, railFoldedIn(search));
    return computeLayout({ display, land, supported, detailOpen: detailOpenFor(n.pages, n.stack), video, ...design });
  };
  const compare = search.get(SHOT_COMPARE_PARAM) === '1';
  const live = useMemo(() => (compare ? liveNavFor(nav, pathname, search) : null), [compare, nav, pathname, search]);
  // The two looked the same once drawn (finish()): only After stays.
  const [same, setSame] = useState(false);
  const note: CompareNote = !compare ? null : !live ? 'new' : same ? 'same' : null;
  const versions: { key: 'before' | 'after'; label: string | null; nav: Nav }[] =
    compare && live && !same
      ? [
          { key: 'before', label: 'Before', nav: live },
          { key: 'after', label: 'After', nav },
        ]
      : [{ key: 'after', label: null, nav }];
  // Before and after compare one theme (light unless asked); a plain shot shows both.
  // An app theme that forces light or dark (appConfig.themes) shows in it alone.
  // So does the app's own appearance setting, when light or dark.
  const appearance = appearanceIn((k) => search.get(k));
  const forced = findAppTheme(search.get(APP_THEME_PARAM))?.scheme ?? (appearance !== 'system' ? appearance : undefined);
  const themes = forced ? [forced] : shotThemes(search.get(SHOT_THEMES_PARAM), compare ? ['light'] : ['light', 'dark']);
  const padding = shotPoints(search.get(SHOT_PADDING_PARAM), SHOT_PADDING);
  const gap = shotPoints(search.get(SHOT_GAP_PARAM), SHOT_GAP);
  const stage = useRef<HTMLDivElement>(null);
  // An id the designer doesn't know falls back to its default device: a shot says so instead of showing another one.
  const askedDevice = search.get('device');
  const askedDisplay = search.get('display');
  const problem =
    askedDevice && device.id !== askedDevice
      ? `Unknown device "${askedDevice}" (${DEVICES.map((d) => d.id).join(', ')})`
      : askedDisplay && display.key !== askedDisplay
        ? `${device.name} has no display "${askedDisplay}" (${device.displays.map((d) => d.key).join(', ')})`
        : compare && !nav.proposal
          ? 'Before and after needs a proposal in the route (?proposal=…)'
          : null;
  useShotApi(stage, problem, note, setSame);

  return (
    <StillCtx.Provider value={true}>
      <DesignProvider scale={1}>
        <SharedSimProvider>
          <div ref={stage} className={styles.stage} style={{ padding, gap }} data-shot-stage>
            {versions.map((v) => {
              const layout = layoutFor(v.nav);
              const box = frameBox(layout);
              return (
                <div key={v.key} className={styles.version}>
                  {v.label && <div className={styles.label}>{v.label}</div>}
                  <div className={styles.frames} style={{ gap }}>
                    {themes.map((theme) => (
                      <div key={theme} className={styles.slot} style={{ width: box.w, height: box.h }}>
                        <div
                          className={`${frameStyles.frame} ${styles.frame}`}
                          style={frameStyle(layout, 1)}
                          data-shot-frame={theme}
                          data-shot-version={v.key}
                          // Steps start on the proposal's screen, the one that navigates with the proposal's pages.
                          data-shot-primary={v.key === 'after' && theme === themes[0] ? '' : undefined}
                        >
                          <NavCtx.Provider value={v.nav}>
                            <DesignOverride.Provider value={v.key === 'before' ? LIVE_DESIGN : null}>
                              <SimProvider layout={layout} theme={theme}>
                                <DeviceScreen overlays />
                              </SimProvider>
                            </DesignOverride.Provider>
                          </NavCtx.Provider>
                          <FrameHardware layout={layout} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SharedSimProvider>
      </DesignProvider>
    </StillCtx.Provider>
  );
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolves once `el` hasn't changed for `quiet` ms (data that loads, a page that mounts), or after `max` ms. */
function settled(el: Element, quiet = 300, max = 5000): Promise<void> {
  return new Promise((resolve) => {
    let t = window.setTimeout(done, quiet);
    const cap = window.setTimeout(done, max);
    const mo = new MutationObserver(() => {
      clearTimeout(t);
      t = window.setTimeout(done, quiet);
    });
    mo.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
    function done() {
      mo.disconnect();
      clearTimeout(t);
      clearTimeout(cap);
      resolve();
    }
  });
}

/** An image that's loading, done (or failed), within `max` ms. A lazy one out of sight never loads: it isn't waited. */
function loaded(img: HTMLImageElement, max = 4000): Promise<void> {
  if (img.complete) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, max);
    const done = () => {
      clearTimeout(t);
      resolve();
    };
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
}

/** The screens are drawn: fonts and images loaded, nothing changing. */
async function ready(el: HTMLElement) {
  await document.fonts.ready;
  await settled(el);
  await Promise.all([...el.querySelectorAll('img')].map((img) => loaded(img)));
  await frame();
  await frame();
}

export interface ShotApi {
  ready(): Promise<void>;
  act(steps: ShotStep[]): Promise<void>;
  /** Before and after: drops Before if it looks like After. Why only one screen shows, if it does. */
  finish(): Promise<CompareNote>;
  rect(): { x: number; y: number; width: number; height: number };
}

declare global {
  interface Window {
    __shot?: ShotApi;
  }
}

function useShotApi(stage: RefObject<HTMLDivElement | null>, problem: string | null, note: CompareNote, setSame: (same: boolean) => void) {
  useEffect(() => {
    // The page itself is see-through: the PNG keeps only the devices.
    document.documentElement.dataset.shot = '';
    // The stage is gone if a step left shot mode (an address without `?shot=1`): the page is what is left.
    const el = () => stage.current ?? document.body;
    const frames = () => [...el().querySelectorAll<HTMLElement>('[data-shot-frame]')];
    window.__shot = {
      ready: () => (problem ? Promise.reject(new Error(problem)) : ready(el())),
      async act(steps) {
        for (const step of steps) {
          if ('wait' in step) {
            await sleep(step.wait);
            continue;
          }
          const all = frames();
          const first = all.find((f) => f.hasAttribute('data-shot-primary')) ?? all[0];
          const rest = all.filter((f) => f !== first);
          const before = rest.map(fingerprint);
          runStep(first, step);
          await settled(el());
          // What the others share with the first (navigation, sheets) already shows there; the rest is each one's.
          for (const [i, other] of rest.entries()) if (fingerprint(other) === before[i]) runStep(other, step);
          await settled(el());
        }
        // No keyboard in the picture unless a step asked for the focus.
        if (!steps.some((s) => 'focus' in s)) (document.activeElement as HTMLElement | null)?.blur?.();
        await ready(el());
      },
      async finish() {
        const before = el().querySelector('[data-shot-version=before]');
        const after = el().querySelector(`[data-shot-version=after][data-shot-frame=${before?.getAttribute('data-shot-frame')}]`);
        if (before && after && visualSignature(before) === visualSignature(after)) {
          setSame(true);
          await ready(el());
          return 'same';
        }
        return note;
      },
      rect() {
        const r = el().getBoundingClientRect();
        return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
      },
    };
    return () => {
      delete window.__shot;
      delete document.documentElement.dataset.shot;
    };
  }, [stage, problem, note, setSame]);
}

