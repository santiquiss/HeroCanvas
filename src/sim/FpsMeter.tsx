// Frame-rate meter for checking that interactions stay fluid (target: the display's refresh rate). Toggle with F.
// Writes its text straight to the DOM twice a second, so it never re-renders React or costs a frame itself.
import { useEffect, useRef, useState } from 'react';
import styles from './SimulatorShell.module.css';

const KEY = 'hc.fps';

export function FpsMeter() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') {
        setOn((v) => {
          try {
            localStorage.setItem(KEY, v ? '0' : '1');
          } catch {
            /* storage unavailable */
          }
          return !v;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let prev = performance.now();
    let windowStart = prev;
    let frames = 0;
    let worst = 0;
    // The display's refresh rate: the shortest steady frame interval seen.
    let best = Infinity;
    const tick = (now: number) => {
      const dt = now - prev;
      prev = now;
      frames++;
      worst = Math.max(worst, dt);
      if (dt > 4) best = Math.min(best, dt);
      if (now - windowStart >= 500) {
        const fps = (frames * 1000) / (now - windowStart);
        const hz = Math.round(1000 / best);
        const el = label.current;
        if (el) {
          el.textContent = `${Math.round(fps)} fps · ${hz} Hz · worst ${worst.toFixed(1)} ms`;
          el.dataset.level = fps >= hz * 0.92 ? 'ok' : fps >= hz * 0.7 ? 'warn' : 'bad';
        }
        windowStart = now;
        frames = 0;
        worst = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);

  if (!on) return null;
  return (
    <div ref={label} className={styles.fps} title="Frame rate (F to hide)">
      …
    </div>
  );
}
