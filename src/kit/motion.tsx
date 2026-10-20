// Motion helpers for the kit and the apps built on it (CSS does the easing; these handle timing and number tweening).
import { createContext, useContext, useEffect, useState } from 'react';

export const EASE_OUT = (t: number) => 1 - (1 - t) ** 3;
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A still copy of the screens (Flow's thumbnails): nothing moves, everything shows its end state. */
export const StillCtx = createContext(false);

/** No motion: the user asked for less (the OS setting), or the screen is a still copy (StillCtx). */
export function useStill(): boolean {
  return useContext(StillCtx) || reducedMotion();
}

/**
 * A SwiftUI spring as a CSS easing. `duration` is SwiftUI's perceptual duration and `bounce` its bounce: 0 is
 * `.smooth` (no overshoot), 0.15 `.snappy`, 0.3 `.bouncy`. Returns a linear() curve and the time it takes to settle
 * (within 0.1%), which is the CSS duration to use.
 */
export function spring(duration: number, bounce = 0): { easing: string; ms: number } {
  // SwiftUI: stiffness (2π / duration)², damping 4π (1 − bounce) / duration, mass 1, so damping ratio = 1 − bounce.
  const w = (2 * Math.PI) / duration;
  const z = 1 - bounce;
  const x = (t: number) => {
    if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  };
  let end = duration;
  for (let t = 0; t < duration * 4; t += 0.004) if (Math.abs(1 - x(t)) > 0.001) end = t;
  const n = 48;
  const points = Array.from({ length: n + 1 }, (_, i) => (i === n ? 1 : +x((end * i) / n).toFixed(4)));
  return { easing: `linear(${points.join(', ')})`, ms: Math.round(end * 1000) };
}

/** True one frame after `on` turns true, so CSS transitions start from the "off" values (e.g. rings at 0). */
export function useEntered(on: boolean): boolean {
  const still = useStill();
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!on) {
      setEntered(false);
      return;
    }
    let r2 = 0;
    const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(() => setEntered(true))));
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [on]);
  // Still: at the end state right away.
  return still ? on : entered;
}

/** Counts the number in `text` ("1450", "24%") up from 0 each time `run` turns true. */
export function CountUp({ text, run, delay = 0, ms = 700 }: { text: string; run: boolean; delay?: number; ms?: number }) {
  const m = text.match(/^(\d+)(.*)$/);
  const target = m ? Number(m[1]) : 0;
  const [n, setN] = useState(target);
  const still = useStill();
  useEffect(() => {
    if (!m || !run || still) {
      setN(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - t0) / ms));
      setN(Math.round(target * EASE_OUT(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, text, target, delay, ms, still]);
  return <>{m ? `${n}${m[2]}` : text}</>;
}
