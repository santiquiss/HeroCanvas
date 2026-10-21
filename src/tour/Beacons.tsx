// The tour's beacons: while one of its steps is open on the device, a dot pulses on each part of the interface the step
// names (its `spots`, matched by `data-tour` on the designer's own controls), with a soft ring around the part. A part
// stops pulsing once it's clicked; opening the step again brings it back. Over everything, never in the way
// (pointer-events: none), placed from the parts' own boxes as they move (a panel resized, the canvas zoomed).
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavRoot } from '../nav/context';
import { STEPS } from './steps';
import styles from './Beacons.module.css';

interface Spot {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The part's own corner radius: the ring follows its shape. */
  r: number;
}

/** The parts of the interface `keys` name, where they show now (hidden ones, like a header's measuring copy, left out). */
function locate(keys: string[], done: Set<string>): Spot[] {
  const spots: Spot[] = [];
  for (const key of keys) {
    if (done.has(key)) continue;
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`)) {
      if (el.closest('[inert], [aria-hidden="true"]') || !el.checkVisibility?.({ visibilityProperty: true, opacityProperty: false })) continue;
      const r = el.getBoundingClientRect();
      const radius = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, Math.min(r.width, r.height) / 2);
      if (r.width && r.height) spots.push({ key, x: r.left, y: r.top, w: r.width, h: r.height, r: radius });
    }
  }
  return spots;
}

const same = (a: Spot[], b: Spot[]) => a.length === b.length && a.every((s, i) => s.key === b[i].key && Math.abs(s.x - b[i].x) < 0.5 && Math.abs(s.y - b[i].y) < 0.5 && Math.abs(s.w - b[i].w) < 0.5 && Math.abs(s.h - b[i].h) < 0.5);

export function TourBeacons() {
  const nav = useNavRoot();
  const step = STEPS.find((s) => s.id === nav.stack[nav.stack.length - 1]?.id);
  const [spots, setSpots] = useState<Spot[]>([]);
  // What was clicked on this visit to the step: it has been found.
  const [done, setDone] = useState<{ step?: string; keys: Set<string> }>({ keys: new Set() });
  const found = done.step === step?.id ? done.keys : new Set<string>();

  useEffect(() => {
    if (!step) {
      setSpots([]);
      return;
    }
    // Where they are, a few times a second: they move with panels, zoom and pan, and the menus that hold them come and go.
    const place = () => setSpots((prev) => {
      const next = locate(step.spots, found);
      return same(prev, next) ? prev : next;
    });
    place();
    const timer = window.setInterval(place, 250);
    window.addEventListener('resize', place);
    const click = (e: PointerEvent) => {
      const hit = (e.target as Element | null)?.closest?.('[data-tour]')?.getAttribute('data-tour');
      if (hit && step.spots.includes(hit)) setDone({ step: step.id, keys: new Set([...found, hit]) });
    };
    document.addEventListener('pointerdown', click, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', click, true);
    };
    // `found` is described by `done`.
  }, [step, done]);

  if (!step || !spots.length) return null;
  return createPortal(
    <div className={styles.layer} aria-hidden>
      {spots.map((s, i) => (
        <span key={`${s.key}-${i}`} className={styles.spot} style={{ left: s.x, top: s.y, width: s.w, height: s.h }}>
          <span className={styles.ring} style={{ borderRadius: s.r + 3 }} />
          <span className={styles.dot} />
        </span>
      ))}
    </div>,
    document.body,
  );
}
