// Real mode: the app alone, filling the window of the device it's opened on, at its real size — no frame, no
// designer around it, and no drawn system (the device shows its own status, home indicator and keyboard). The layout
// is the same one every device of the canvas gets, from a display made of what this one reports (sim/realDevice).
// On by itself on a phone or when installed on the home screen; `?real=1` / `?real=0` say so either way.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { DesignProvider } from '../design/DesignContext';
import { useNavRoot } from '../nav/context';
import { landscapeFor, supportsLandscape, useScreenConfig } from '../nav/screenConfig';
import { detailOpenFor } from '../nav/stack';
import { useDeveloperHidden } from './developerHidden';
import { DeviceScreen } from './DeviceScreen';
import { computeLayout } from './layout';
import { RealControls } from './RealControls';
import { platformOf, REAL_PARAM, realByDefault, realDisplay, turnedSafe } from './realDevice';
import { SharedSimProvider, SimProvider } from './SimContext';
import { TouchPointer } from './TouchPointer';
import { useRealViewport } from './useRealViewport';
import styles from './RealShell.module.css';

/** Opened from the home screen (installed), with no browser around it. */
const standalone = () => !!window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function useRealMode(): boolean {
  const [search] = useSearchParams();
  // Decided once: turning the device or the browser's bars don't switch between the app and the designer.
  const [auto] = useState(() => realByDefault(standalone(), !!window.matchMedia?.('(pointer: coarse)').matches, Math.min(window.innerWidth, window.innerHeight)));
  const param = search.get(REAL_PARAM);
  return param === '1' || (param !== '0' && auto);
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
  const theme = search.get('theme') === 'dark' ? 'dark' : 'light';
  const video = search.get('video') === '1';
  const detailOpen = detailOpenFor(pages, stack);
  const top = stack[stack.length - 1];

  const { w, h, angle } = view;
  const { top: st, right: sr, bottom: sb, left: sl } = view.safe;
  const { device, display, land, known } = useMemo(
    () => realDisplay({ w, h, safe: { top: st, right: sr, bottom: sb, left: sl } }, platform),
    [w, h, st, sr, sb, sl, platform],
  );
  const supported = supportsLandscape(landscapeFor(top.id, def(top.id), cfg), device, display);
  const layout = useMemo(() => {
    // A page with no landscape stays in portrait on a turned device: its safe area turns with the device.
    const shown = land && !supported && display.safe ? { ...display, safe: turnedSafe(display.safe, angle) } : display;
    return computeLayout({ display: shown, land, supported, detailOpen, video });
  }, [display, land, supported, detailOpen, video, angle]);

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

  const info = `${known ? device.name + (device.displays.length > 1 ? ` · ${display.label}` : '') : 'This device'} · ${w} × ${h} pt · safe area ${st} / ${sr} / ${sb} / ${sl}`;
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
          {/* A mouse (the mode tried on a computer) drags to scroll, as on the canvas; a finger scrolls by itself. */}
          <TouchPointer frame={frame} enabled scale={1} rotated={false} />
          <RealControls info={info} open={controls} onClose={() => setControls(false)} />
        </SimProvider>
      </SharedSimProvider>
    </DesignProvider>
  );
}
