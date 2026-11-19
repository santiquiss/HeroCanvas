// Real mode: the app alone, filling the window of the device it's opened on, at its real size — no frame, no
// designer around it, and no drawn system (the device shows its own status, home indicator and keyboard). The layout
// is the same one every device of the canvas gets, from a display made of what this one reports (sim/realDevice).
// On by itself on a phone or when installed on the home screen; `?real=1` / `?real=0` say so either way.
import { sidePanelOnIn } from '../nav/sidePanel';
import { schemeIn } from './appThemes';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { DesignProvider } from '../design/DesignContext';
import { designLayout, railFoldedIn, VARIANT_PARAM } from '../design/overridableRegistry';
import { useNavRoot } from '../nav/context';
import { landscapeFor, supportsLandscape, useScreenConfig } from '../nav/screenConfig';
import { detailOpenFor } from '../nav/stack';
import { useDeveloperHidden } from './developerHidden';
import { Icon } from '../components/Icon';
import { VIEW } from '../share/view';
import { DeviceScreen } from './DeviceScreen';
import { computeLayout, screenOnly } from './layout';
import { RealControls } from './RealControls';
import { BARE_PARAM, platformOf, REAL_PARAM, realByDefault, realDisplay, SYSTEM_PARAM, turnedSafe } from './realDevice';
import { SharedSimProvider, SimProvider } from './SimContext';
import { TouchPointer } from './TouchPointer';
import { useRealViewport } from './useRealViewport';
import styles from './RealShell.module.css';
import { t } from '../i18n/ui';

/** Opened from the home screen (installed), with no browser around it. */
const standalone = () => !!window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** Real mode is this device's own (a phone, installed): decided once, so turning it or its bars don't switch. */
function useRealByDefault(): boolean {
  const [auto] = useState(() => realByDefault(standalone(), !!window.matchMedia?.('(pointer: coarse)').matches, Math.min(window.innerWidth, window.innerHeight)));
  return auto;
}

export function useRealMode(): boolean {
  const [search] = useSearchParams();
  const auto = useRealByDefault();
  const param = search.get(REAL_PARAM);
  // A link for only the app (src/share): real mode, whatever the URL says.
  return !!VIEW?.appOnly || param === '1' || (param !== '0' && auto);
}

/** How long the way back shows on entering, and after the pointer leaves the top edge. */
const EXIT_SHOWS_MS = 2500;
/** The pointer this close to the window's top brings the way back. */
const EXIT_EDGE_PX = 64;

/**
 * The way back to the designer (minimize), when real mode was asked for where the designer is the default (a computer:
 * the device header's Expand view): the view it came from, as its URL kept it. As a computer's full screen does, it
 * shows on entering and when the pointer reaches the top edge, and hides by itself, so the app shows as it is. A
 * phone's real mode has none (its way back is the hidden controls').
 */
function RealExit() {
  const [, setSearch] = useSearchParams();
  const auto = useRealByDefault();
  const [shown, setShown] = useState(true);
  useEffect(() => {
    if (auto) return;
    // The pointer at the top edge (the pill sits in it) keeps it; it hides a while after the pointer leaves.
    let atTop = false;
    let timer = 0;
    const hideLater = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => !atTop && setShown(false), EXIT_SHOWS_MS);
    };
    const move = (e: PointerEvent) => {
      const top = e.clientY <= EXIT_EDGE_PX;
      if (top) setShown(true);
      if (top !== atTop) {
        atTop = top;
        if (!top) hideLater();
      }
    };
    hideLater();
    window.addEventListener('pointermove', move);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', move);
    };
  }, [auto]);
  // Only the app (a guest's link to try it): no way out.
  if (auto || VIEW?.appOnly) return null;
  return (
    <button
      className={`${styles.exit} ${shown ? styles.exitShown : ''}`}
      title={t('Back to the designer')}
      onFocus={() => setShown(true)}
      onClick={() =>
        setSearch(
          (prev) => {
            const q = new URLSearchParams(prev);
            q.delete(REAL_PARAM);
            return q;
          },
          { replace: true },
        )
      }
    >
      <Icon name="close_fullscreen" size={16} />
      <span>{t('Exit expanded view')}</span>
    </button>
  );
}

const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);

/** While in real mode the page is the app: it doesn't zoom or scroll as a page. */
function usePageAsApp() {
  useEffect(() => {
    const viewport = meta('viewport');
    const before = viewport?.content;
    if (viewport) viewport.content = `${before}, maximum-scale=1, user-scalable=no`;
    document.documentElement.dataset.real = '';
    return () => {
      if (viewport && before) viewport.content = before;
      delete document.documentElement.dataset.real;
    };
  }, []);
}

export function RealShell() {
  const [search] = useSearchParams();
  const { stack, def, pages } = useNavRoot();
  const [cfg] = useScreenConfig();
  const view = useRealViewport();
  usePageAsApp();
  const platform = useMemo(() => platformOf(navigator.userAgent, navigator.maxTouchPoints), []);
  const theme = schemeIn((k) => search.get(k));
  const video = search.get('video') === '1';
  const proposal = search.get('proposal');
  const variant = search.get(VARIANT_PARAM);
  // A rail that folds (`?rail=folded`), folded here as on the canvas: its width the design's folded one.
  const railFolded = railFoldedIn(search);
  const detailOpen = detailOpenFor(pages, stack, sidePanelOnIn(search));
  const top = stack[stack.length - 1];

  const system = search.get(SYSTEM_PARAM);
  const bare = search.get(BARE_PARAM) === '1';
  const { w, h, angle } = view;
  const { top: st, right: sr, bottom: sb, left: sl } = view.safe;
  const { device, display, land, known } = useMemo(
    () => realDisplay({ w, h, safe: { top: st, right: sr, bottom: sb, left: sl } }, platform, system),
    [w, h, st, sr, sb, sl, platform, system],
  );
  const supported = supportsLandscape(landscapeFor(top.id, def(top.id), cfg), device, display);
  const layout = useMemo(() => {
    // A page with no landscape stays in portrait on a turned device: its safe area turns with the device.
    const shown = land && !supported && display.safe ? { ...display, safe: turnedSafe(display.safe, angle) } : display;
    // The app's layout (its rail, its bar, phone only), and the proposal's over it, as on the canvas.
    const L = computeLayout({ display: shown, land, supported, detailOpen, video, ...designLayout(proposal, variant, railFolded) });
    return bare ? screenOnly(L) : L;
  }, [display, land, supported, detailOpen, video, angle, proposal, variant, railFolded, bare]);

  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  // The browser's own surface (the status bar's background when installed, the page behind the app) takes the
  // app's background, so the two read as one screen.
  useEffect(() => {
    const screen = frame?.querySelector<HTMLElement>('[data-theme]');
    if (!screen) return;
    const bg = getComputedStyle(screen).getPropertyValue('--pg').trim();
    if (!bg) return;
    const color = meta('theme-color');
    const before = { color: color?.content, body: document.body.style.background };
    if (color) color.content = bg;
    document.body.style.background = bg;
    return () => {
      if (color && before.color) color.content = before.color;
      document.body.style.background = before.body;
    };
  }, [frame, theme]);

  // The designer's controls: taps on the element the app marks, as an app's hidden developer screen.
  const [controls, setControls] = useState(false);
  useDeveloperHidden(frame, () => setControls(true));

  const info = t('{device} · {w} × {h} pt · safe area {top} / {right} / {bottom} / {left}', {
    device: known ? device.name + (device.displays.length > 1 ? ` · ${display.label}` : '') : t('This device'),
    w,
    h,
    top: st,
    right: sr,
    bottom: sb,
    left: sl,
  });
  return (
    <DesignProvider scale={1}>
      <SharedSimProvider>
        <SimProvider layout={layout} theme={theme}>
          <div
            ref={setFrame}
            className={`${styles.screen} ${layout.rotLocked ? styles.turned : ''}`}
            style={layout.rotLocked ? { transform: `translate(-50%, -50%) rotate(${angle === 270 ? 90 : -90}deg)` } : undefined}
          >
            <DeviceScreen />
          </div>
          {/* A mouse (the mode tried on a computer) drags to scroll, as on the canvas; a finger scrolls by itself. A
              browser window's display has a mouse of its own: its pointer, hover and wheel, no finger. */}
          <TouchPointer frame={frame} enabled={display.os !== 'web'} scale={1} rotated={false} />
          <RealControls info={info} open={controls} onClose={() => setControls(false)} />
          <RealExit />
        </SimProvider>
      </SharedSimProvider>
    </DesignProvider>
  );
}
