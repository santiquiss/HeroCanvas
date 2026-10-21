// Welcome's motion, after the launch (the tour's LaunchConfig, played by the simulator: its icon flies to AppIcon):
// the sections rising in one after another, and the icon alive, floating, tilting in 3D after the pointer and
// spinning when tapped. Compositor-only (transform, opacity); still copies and reduced motion get the end state.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useComponent } from '../design/component';
import { spring, useEntered, useStill } from '../kit/motion';
import { useLaunchPhase } from '../sim/launchPhase';
import styles from './Motion.module.css';

/** The app icon: the emblem on its blue tile, cropped to the tile (from brand/hc-icon.png). */
const ICON = '/tour/icon.png';
/** Where the emblem sits in it (fractions of its side): the launch's emblem lands exactly there. */
const EMBLEM = { left: 0.052, top: 0.188, width: 0.896, height: 0.702 };
const TILT = spring(0.45, 0.2);
const SPIN = spring(0.9, 0.18);

/** The app icon, alive: it floats, tilts after the pointer over its area (`data-tilt-area`), and spins when tapped. */
export function AppIcon({ size = 88 }: { size?: number }) {
  const hc = useComponent('AppIcon', { size });
  // It floats once the launch is over: a float under way would move it while the launch's emblem lands on it.
  const still = useStill();
  const phase = useLaunchPhase();
  const floats = !still && phase === 'done';
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
      className={`${styles.icon} ${floats ? styles.float : ''}`}
      style={{ width: size, height: size }}
      aria-label="Spin the icon"
      onClick={() => setSpin((s) => s + 360)}
    >
      <span ref={tilt} className={styles.tilt} style={{ '--spin': `${spin}deg`, '--tilt-ease': TILT.easing, '--tilt-ms': `${TILT.ms}ms`, '--spin-ease': SPIN.easing, '--spin-ms': `${SPIN.ms}ms` } as CSSProperties}>
        <span className={styles.face}>
          <img src={ICON} alt="" width={size} height={size} />
          {/* The glare on its glass, in its own shape (the tile's rounded square). */}
          <span className={styles.glare} style={{ maskImage: `url(${ICON})`, WebkitMaskImage: `url(${ICON})` }} />
          <span data-launch-anchor className={styles.anchor} style={{ left: `${EMBLEM.left * 100}%`, top: `${EMBLEM.top * 100}%`, width: `${EMBLEM.width * 100}%`, height: `${EMBLEM.height * 100}%` }} />
        </span>
      </span>
    </button>
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
