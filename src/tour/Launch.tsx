// Welcome's launch, to show the motion a screen can have here: a splash with the app icon (it springs in, a sheen
// sweeps it), the icon flying to its place in the hero as the splash fades (a shared element), the sections rising
// in one after another; then the icon stays alive, tilting in 3D after the pointer and spinning when tapped.
// Compositor-only (transform, opacity). Still copies (Flow, Capture's stills) and reduced motion get the end state.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useComponent } from '../design/component';
import { spring, useEntered, useStill } from '../kit/motion';
import styles from './Launch.module.css';

const ICON = '/pwa/icon-192.png';
const IN = spring(0.55, 0.32);
const FLY = spring(0.6, 0.12);
const TILT = spring(0.45, 0.2);
const SPIN = spring(0.9, 0.18);
/** How long the splash holds before the icon flies, from when it shows. */
const HOLD_MS = 950;

/** The app icon, alive: it floats, tilts after the pointer over its area (`data-tilt-area`), and spins when tapped. */
export function AppIcon({ size = 88, hidden = false, iconRef }: { size?: number; hidden?: boolean; iconRef?: RefObject<HTMLSpanElement | null> }) {
  const hc = useComponent('AppIcon', { size });
  const still = useStill();
  const tilt = useRef<HTMLSpanElement>(null);
  const [spin, setSpin] = useState(0);
  useEffect(() => {
    const el = tilt.current;
    const area = el?.closest<HTMLElement>('[data-tilt-area]') ?? el;
    if (!el || !area) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 2)));
      const y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 2)));
      el.style.setProperty('--rx', `${-y * 16}deg`);
      el.style.setProperty('--ry', `${x * 20}deg`);
      el.style.setProperty('--gx', `${50 + x * 40}%`);
      el.style.setProperty('--gy', `${50 + y * 40}%`);
      el.style.setProperty('--glare', '1');
    };
    const leave = () => {
      for (const p of ['--rx', '--ry']) el.style.setProperty(p, '0deg');
      el.style.setProperty('--glare', '0');
    };
    area.addEventListener('pointermove', move);
    area.addEventListener('pointerleave', leave);
    return () => {
      area.removeEventListener('pointermove', move);
      area.removeEventListener('pointerleave', leave);
    };
  }, []);
  return (
    <button
      {...hc}
      className={`${styles.icon} ${still ? '' : styles.float}`}
      style={{ width: size, height: size, opacity: hidden ? 0 : 1 } as CSSProperties}
      aria-label="Spin the icon"
      onClick={() => setSpin((s) => s + 360)}
    >
      <span ref={tilt} className={styles.tilt} style={{ '--spin': `${spin}deg`, '--tilt-ease': TILT.easing, '--tilt-ms': `${TILT.ms}ms`, '--spin-ease': SPIN.easing, '--spin-ms': `${SPIN.ms}ms` } as CSSProperties}>
        <span ref={iconRef} className={styles.face} style={{ borderRadius: size * 0.225 }}>
          <img src={ICON} alt="" width={size} height={size} />
          <span className={styles.glare} />
        </span>
      </span>
    </button>
  );
}

/**
 * The splash over the whole device screen (its root, `data-device-screen`, so the tab bar is under it too). The icon
 * springs in; after the hold it flies to `target` (the hero's icon) while the splash fades; then `onDone`.
 */
export function LaunchScreen({ target, onDone }: { target: RefObject<HTMLElement | null>; onDone: () => void }) {
  const hc = useComponent('LaunchScreen', {});
  const anchor = useRef<HTMLDivElement>(null);
  const icon = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [fly, setFly] = useState<CSSProperties | null>(null);
  // The icon's image decoded before anything moves: a first load would spring in an empty square.
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => setHost(anchor.current?.closest<HTMLElement>('[data-device-screen]') ?? null), []);
  useEffect(() => {
    const img = new Image();
    img.src = ICON;
    img
      .decode()
      .catch(() => undefined)
      .then(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!host || !ready) return;
    const t1 = window.setTimeout(() => {
      const from = icon.current?.getBoundingClientRect();
      const to = target.current?.getBoundingClientRect();
      if (!from || !to) return onDone();
      // FLIP: from the splash's icon to the hero's, by its center and its scale.
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      // The device is drawn scaled on the canvas: rects are in screen pixels, transforms in the device's.
      const k = host.getBoundingClientRect().width / host.offsetWidth || 1;
      setFly({ transform: `translate(${dx / k}px, ${dy / k}px) scale(${to.width / from.width})`, transition: `transform ${FLY.ms}ms ${FLY.easing}` });
    }, HOLD_MS);
    const t2 = window.setTimeout(onDone, HOLD_MS + FLY.ms);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [host, ready, target, onDone]);
  const splash = (
    <div {...hc} className={styles.splash} style={{ '--fly-ms': `${FLY.ms}ms` } as CSSProperties}>
      {/* The blue fades as the icon flies; the icon, apart, stays whole until it lands. */}
      <div className={`${styles.splashBg} ${fly ? styles.fading : ''}`} />
      <span className={styles.splashIcon} style={fly ?? undefined}>
        <span ref={icon} className={`${styles.splashFace} ${ready ? styles.springIn : styles.waiting}`} style={{ '--in-ms': `${IN.ms}ms`, '--in-ease': IN.easing } as CSSProperties}>
          <img src={ICON} alt="" width={128} height={128} />
          <span className={styles.sheen} />
        </span>
      </span>
    </div>
  );
  return (
    <>
      <div ref={anchor} hidden />
      {host ? createPortal(splash, host) : null}
    </>
  );
}

/** A block that rises in, `index` steps after the launch (`on`). */
export function Reveal({ on, index, children }: { on: boolean; index: number; children: ReactNode }) {
  const entered = useEntered(on);
  return (
    <div className={`${styles.reveal} ${entered ? styles.revealed : ''}`} style={{ transitionDelay: `${index * 70}ms` }}>
      {children}
    </div>
  );
}
