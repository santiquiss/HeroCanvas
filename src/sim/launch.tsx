// The app's launch (AppConfig.launch), played on a device's screen: the four phases every platform has — the
// screen the system draws while the app loads (background, icon, brand mark), the icon's enter, the hold while it
// loads, the exit into the first screen. Played on a cold start: once since HeroCanvas loaded (Scenarios › Launch),
// every time a screen mounts, or never; replayLaunch() (Pages' Launch row, Scenarios' Replay) plays it again on every
// screen. Screens read useLaunchPhase() to start their own entrance when it's over. Transforms and opacity only; still
// copies and reduced motion skip it.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import type { LaunchConfig } from '../contract';
import { componentInstance } from '../design/component';
import { spring, useStill } from '../kit/motion';
import type { LaunchPhase } from './launchPhase';
import { useUrlParams } from './SimContext';
import styles from './launch.module.css';

export const LAUNCH_PARAM = 'launch';

/** Replays, counted: each one plays the launch again on every screen (kept in memory, not the URL: not a scenario). */
let runs = 0;
const listeners = new Set<() => void>();
export function replayLaunch() {
  runs++;
  listeners.forEach((l) => l());
}
const useRuns = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => runs,
    () => 0,
  );
export type LaunchPlayback = 'once' | 'always' | 'off';
export const LAUNCH_PLAYBACK: { value: LaunchPlayback; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'always', label: 'Every time' },
  { value: 'off', label: 'Off' },
];

const ENTER = { spring: spring(0.55, 0.32), fade: { easing: 'ease-out', ms: 320 } };
const EXIT = spring(0.6, 0.12);
/** Flying to a component: no overshoot. */
const FLY = spring(0.6, 0);
/**
 * Then it settles: it lands a little bigger than the component (SETTLE_SCALE) and both shrink into place together as
 * one crossfades into the other. Moving as one, two images that don't match to the pixel (an emblem alone, the same
 * emblem in an app icon) read as one thing changing, not a jump.
 */
const SETTLE = spring(0.5, 0);
const SETTLE_SCALE = 1.08;
const CROSSFADE_MS = 380;
/** The icon fades out faster than the component fades in: less of the two at once, a ghost of one on the other. */
const FADE_OUT_MS = 220;
/** Whether a launch played since HeroCanvas loaded (Once plays it only then). */
let played = false;

/**
 * The launch on one device's screen (`root`, its element): whether to play it now, its phase, and the overlay to draw
 * over the screen. The screen's content goes in LaunchPhaseCtx (launchPhase.ts) with `phase`, for useLaunchPhase().
 */
export function useLaunch(LAUNCH: LaunchConfig | undefined, root: HTMLElement | null, theme: 'light' | 'dark') {
  const still = useStill();
  const get = useUrlParams();
  const playback = (get(LAUNCH_PARAM) as LaunchPlayback | null) ?? 'once';
  const run = useRuns();
  const should = () => !!LAUNCH && !still && playback !== 'off' && (playback === 'always' || !played);
  const [phase, setPhase] = useState<LaunchPhase>(() => (should() ? 'screen' : 'done'));
  // A replay plays it again, whatever the playback: it's asked for. Against the last replay seen, not a first-run
  // flag: effects run twice on mount in development (StrictMode), which would read as a replay.
  const seen = useRef(run);
  useEffect(() => {
    if (run === seen.current) return;
    seen.current = run;
    if (LAUNCH && !still) setPhase('screen');
  }, [run, LAUNCH, still]);
  const done = useCallback(() => {
    played = true;
    setPhase('done');
  }, []);
  const overlay = LAUNCH && phase !== 'done' && root ? <LaunchOverlay key={run} config={LAUNCH} theme={theme} root={root} onExit={() => setPhase('exit')} onDone={done} /> : null;
  return { phase, overlay };
}

/** The element of the screen's first visible instance of a component (by its name), the icon's landing place. */
function findComponent(root: HTMLElement, name: string): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>('[data-hc]'))
    if (componentInstance(el.dataset.hc)?.name === name && el.getClientRects().length) return el;
  return null;
}

function LaunchOverlay({ config, theme, root, onExit, onDone }: { config: LaunchConfig; theme: 'light' | 'dark'; root: HTMLElement; onExit: () => void; onDone: () => void }) {
  const icon = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(!config.icon);
  const [exit, setExit] = useState<CSSProperties | null>(null);
  const [landing, setLanding] = useState(false);
  const size = config.iconSize ?? 120;
  const enter = config.enter ?? 'none';
  const enterMs = enter === 'none' ? 0 : enter === 'fade' ? ENTER.fade.ms : ENTER.spring.ms;
  const out = config.exit ?? 'fade';
  const exitMs = typeof out === 'object' ? Math.round(FLY.ms * 0.8 + SETTLE.ms) : EXIT.ms;
  const shape = config.iconShape ?? 'rounded';

  // The screen's own background matches the launch's while it plays: its rounded corners are antialiased apart from
  // the launch's, and the page color under them would show as a light hairline along the edge.
  const bg = typeof config.background === 'string' ? config.background : config.background[theme];
  useEffect(() => {
    const before = root.style.background;
    root.style.background = bg;
    return () => {
      root.style.background = before;
    };
  }, [root, bg]);

  // The images decoded first: a first load would show an empty square entering.
  useEffect(() => {
    const srcs = [config.icon, config.branding].filter(Boolean) as string[];
    Promise.all(
      srcs.map((src) => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => undefined);
      }),
    ).then(() => setReady(true));
  }, [config.icon, config.branding]);

  useEffect(() => {
    if (!ready) return;
    let target: HTMLElement | null = null;
    const t1 = window.setTimeout(() => {
      onExit();
      if (typeof out === 'object') {
        // The icon flies to the component's place, by its center and its scale (the device is drawn scaled on the
        // canvas: rects are in screen pixels, transforms in the device's).
        target = findComponent(root, out.to);
        const anchor = target?.querySelector<HTMLElement>('[data-launch-anchor]') ?? target;
        const from = icon.current?.getBoundingClientRect();
        const to = anchor?.getBoundingClientRect();
        const box = target?.getBoundingClientRect();
        if (target && from && to && box) {
          const t = target;
          const k = root.getBoundingClientRect().width / root.offsetWidth || 1;
          // Where the anchor is with the component grown by SETTLE_SCALE about its center, and where it ends.
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;
          const at = (scale: number) => {
            const ax = cx + (to.left + to.width / 2 - cx) * scale;
            const ay = cy + (to.top + to.height / 2 - cy) * scale;
            const dx = (ax - (from.left + from.width / 2)) / k;
            const dy = (ay - (from.top + from.height / 2)) / k;
            return `translate(${dx}px, ${dy}px) scale(${(to.width / from.width) * scale})`;
          };
          t.style.transition = 'none';
          t.style.opacity = '0';
          t.style.transform = `scale(${SETTLE_SCALE})`;
          setExit({ transform: at(SETTLE_SCALE), transition: `transform ${FLY.ms}ms ${FLY.easing}` });
          // Landed: both settle to their size together, the component fading in as the icon fades out.
          window.setTimeout(() => {
            t.style.transition = `opacity ${CROSSFADE_MS}ms ease, transform ${SETTLE.ms}ms ${SETTLE.easing}`;
            t.style.opacity = '1';
            t.style.transform = '';
            setExit({ transform: at(1), transition: `transform ${SETTLE.ms}ms ${SETTLE.easing}, opacity ${FADE_OUT_MS}ms ease-out` });
            setLanding(true);
          }, FLY.ms * 0.8);
          return;
        }
      }
      setExit({});
    }, enterMs + (config.hold ?? 600));
    const reset = () => {
      if (!target) return;
      target.style.opacity = '';
      target.style.transition = '';
      target.style.transform = '';
    };
    const t2 = window.setTimeout(
      () => {
        reset();
        onDone();
      },
      enterMs + (config.hold ?? 600) + exitMs,
    );
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      reset();
    };
    // Once per launch (the overlay is keyed by its run).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const exiting = exit !== null;
  const exitClass = !exiting ? '' : typeof out === 'object' ? styles.exitFly : styles[`exit_${out}`];
  return (
    <div className={`${styles.launch} ${exitClass}`} data-launch style={{ '--exit-ms': `${exitMs}ms`, '--exit-ease': EXIT.easing, '--crossfade-ms': `${FADE_OUT_MS}ms` } as CSSProperties}>
      <div className={styles.background} style={{ background: bg }} />
      {config.icon && (
        <span className={`${styles.iconMove} ${landing ? styles.landing : ''}`} style={exit && typeof out === 'object' ? exit : undefined}>
          <span
            ref={icon}
            className={`${styles.icon} ${!ready ? styles.waiting : enter === 'none' ? '' : enter === 'fade' ? styles.enterFade : styles.enterSpring}`}
            style={
              {
                width: size,
                height: shape === 'none' && !config.iconBackground ? undefined : size,
                borderRadius: config.iconBackground ? '50%' : shape === 'none' ? 0 : size * 0.225,
                overflow: shape === 'none' && !config.iconBackground ? 'visible' : undefined,
                background: config.iconBackground,
                '--enter-ms': `${enterMs}ms`,
                '--enter-ease': enter === 'fade' ? ENTER.fade.easing : ENTER.spring.easing,
              } as CSSProperties
            }
          >
            <img src={config.icon} alt="" style={config.iconBackground ? { width: '66%', height: '66%' } : shape === 'none' ? { height: 'auto' } : undefined} />
            {/* The sheen: across the square of an app icon, or the image's own shape (masked by it). */}
            {enter === 'shine' && ready && (
              <span className={styles.sheenClip} style={shape === 'none' ? { maskImage: `url(${config.icon})`, WebkitMaskImage: `url(${config.icon})` } : undefined}>
                <span className={styles.sheen} />
              </span>
            )}
          </span>
        </span>
      )}
      {config.branding && <img className={styles.branding} src={config.branding} alt="" />}
    </div>
  );
}
