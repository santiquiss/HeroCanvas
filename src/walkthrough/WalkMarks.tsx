// The walkthrough beside the screen: the open step's numbered marks, each outside the device, level with what it
// points at, with a line that ends in a small dot just inside its near edge (the control's or the component's, not
// the text in it). Nothing else is drawn on the app. In the color of Highlight changes, over everything in the canvas
// and under everything outside it (the toolbar's menus, the panels): in the canvas's own layer, clipped to it. On the
// selected device only (in a set, the last one touched): the others stay clean, and show the same state. And the two other
// ways of going on. ← and → open the step before or after. A tap on what the step marks as its next goes to the next
// step, once the app has done what that tap does (on any device). Nothing while no step is open.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { findTarget, markBox, onTop, screens, tapArea } from './engine';
import { SIDE_PANEL_PARAM } from '../nav/sidePanel';
import { useWalk, walkStatus } from './useWalk';
import styles from './Walkthrough.module.css';

interface Placed {
  n: number;
  next: boolean;
  /** What it points at. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Its number: where, and on which side of the device. */
  bx: number;
  by: number;
  side: 'left' | 'right';
}

/** How often the marks are placed again: the screens scroll, sheets open, the canvas zooms. */
const PLACE_MS = 150;
/** A number's size, its distance from the device's edge, and the least between two on a side. */
const BADGE = 22;
const OUT = 36;
const APART = 28;
/** The least room left between a number and the next device. */
const GAP = 8;
/** After a tap that goes on: once the app has taken it and the address has settled. */
const ADVANCE_MS = 180;
/** How far the line goes into what it points at, and its end's radius. */
const INTO = 6;
const DOT = 3;

export function WalkMarks() {
  const w = useWalk();
  const { step, marksOn } = w;
  const [placed, setPlaced] = useState<Placed[]>([]);
  // The walkthrough as of the last render: going on after a tap waits for what the tap did (the app may have opened
  // a page), and must write the step into the address as it is then, not as it was when the tap landed.
  const latest = useRef(w);
  latest.current = w;

  // A step named by the address that wasn't put in its state here (a link opened, the browser's Back or Forward):
  // put it there, as the list would.
  const stepId = step?.id;
  useEffect(() => {
    const now = latest.current;
    if (!now.step) now.forget();
    else if (!now.applied(now.step.id)) now.open(now.step);
  }, [stepId]);

  // The proposal's steps, for a script that walks them all (`npm run walk`).
  const steps = w.steps;
  useEffect(() => {
    window.__hcWalkSteps = steps.map((s) => ({ id: s.id, story: s.story, n: s.n, of: s.of, title: s.title, sidePanel: !!SIDE_PANEL_PARAM && s.place.state?.[SIDE_PANEL_PARAM] === '1' }));
    return () => {
      delete window.__hcWalkSteps;
    };
  }, [steps]);

  // What a script reads to check a walkthrough (`npm run walk`): the step on screen, whether its way in is done (or
  // where it stopped), and each mark found or not, with where to tap the one that goes on. Read, never acted on.
  useEffect(() => {
    if (!step) {
      delete window.__hcWalk;
      return;
    }
    const probe = () => {
      const now = latest.current;
      const screen = screens()[0];
      window.__hcWalk = {
        step: step.id,
        // Not done until it was put in its state: the address may name it a moment before.
        busy: walkStatus().busy || !now.applied(step.id),
        missing: walkStatus().missing,
        marks: (step.marks ?? []).map((m) => {
          const el = screen ? findTarget(screen, m.target) : null;
          // Where a finger goes: the middle of what takes the tap, unless something covers it there (a bar's fade over a
          // row); then the target's own middle, which is on top.
          const area = el && screen && m.next ? tapArea(screen, el) : null;
          const r = el ? (area && onTop(area) ? area : el).getBoundingClientRect() : null;
          return { target: m.target, next: !!m.next, at: r ? [r.left + r.width / 2, r.top + r.height / 2] : null };
        }),
      };
    };
    probe();
    const timer = window.setInterval(probe, PLACE_MS);
    return () => window.clearInterval(timer);
  }, [step]);

  // The marks, where what they point at is now.
  useEffect(() => {
    if (!step?.marks?.length || !marksOn) {
      setPlaced([]);
      return;
    }
    const place = () => {
      const screen = screens()[0];
      const canvas = document.querySelector('[data-canvas]');
      const next: Placed[] = [];
      if (screen && canvas) {
        // In the canvas's coordinates: the layer is its child.
        const c = canvas.getBoundingClientRect();
        const sr = screen.getBoundingClientRect();
        const s = new DOMRect(sr.x - c.x, sr.y - c.y, sr.width, sr.height);
        // How far a number can go from the screen on each side before it'd reach the next device (a set): the room to
        // the nearest screen beside it, or to the canvas's edge. Where it's narrower than a number's usual place, the
        // number goes in its middle, between the two devices.
        const others = screens()
          .slice(1)
          .map((o) => o.getBoundingClientRect())
          .filter((o) => o.bottom > sr.top && o.top < sr.bottom);
        const roomLeft = Math.min(sr.left - c.left, ...others.filter((o) => o.right <= sr.left).map((o) => sr.left - o.right));
        const roomRight = Math.min(c.right - sr.right, ...others.filter((o) => o.left >= sr.right).map((o) => o.left - sr.right));
        const out = (room: number) => (room >= OUT + BADGE + GAP ? OUT : Math.max(0, room / 2 - BADGE / 2));
        step.marks!.forEach((m, i) => {
          const el = findTarget(screen, m.target);
          if (!el) return;
          // What's tapped to go on is pointed at whole (the button, the card); anything else, as it is (a text in a card).
          const abs = m.next ? markBox(screen, el) : el.getBoundingClientRect();
          const r = new DOMRect(abs.x - c.x, abs.y - c.y, abs.width, abs.height);
          // On the left, unless it sits in the screen's right part (something as wide as the screen: the left).
          const side = r.left + r.width / 2 > s.left + s.width * 0.6 ? 'right' : 'left';
          next.push({ n: i + 1, next: !!m.next, x: r.left, y: r.top, w: r.width, h: r.height, side, bx: side === 'left' ? s.left - out(roomLeft) - BADGE : s.right + out(roomRight), by: r.top + r.height / 2 - BADGE / 2 });
        });
        // No two numbers on a side on top of each other: down the side, each at least APART under the one before.
        for (const side of ['left', 'right'] as const) {
          let floor = -Infinity;
          for (const p of next.filter((q) => q.side === side).sort((a, b) => a.by - b.by)) {
            p.by = Math.max(p.by, floor);
            floor = p.by + APART;
          }
        }
      }
      setPlaced((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    place();
    const timer = window.setInterval(place, PLACE_MS);
    return () => window.clearInterval(timer);
  }, [step, marksOn]);

  // ← → on the keyboard, when nothing's being typed.
  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const at = e.target as HTMLElement | null;
      if (at && (at.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(at.tagName))) return;
      if (e.key === 'ArrowRight') w.move(1);
      else if (e.key === 'ArrowLeft') w.move(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // A tap on the step's next mark, on any screen: the app takes it, then the walkthrough goes on.
  useEffect(() => {
    const mark = step?.marks?.find((m) => m.next);
    if (!mark) return;
    const onClick = (e: MouseEvent) => {
      // Only the person's own taps: a step's replayed ones aren't theirs.
      if (!e.isTrusted || !(e.target instanceof Element)) return;
      const screen = e.target.closest('[data-hc-screen]');
      // Anywhere on what the mark points at (the whole card, not only its title).
      const el = screen && findTarget(screen, mark.target);
      const area = el && tapArea(screen, el);
      if (!area || !(area.contains(e.target) || e.target.contains(area))) return;
      // Which step comes next is known now; it's written once the app is done.
      const next = latest.current.nextId;
      if (next) window.setTimeout(() => latest.current.show(next), ADVANCE_MS);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  });

  const canvas = document.querySelector('[data-canvas]');
  if (!placed.length || !canvas) return null;
  return createPortal(
    <div className={styles.layer} aria-hidden>
      <svg className={styles.lines}>
        {placed.map((p) => {
          // From the number's inner edge to the near edge of what it points at, at its middle.
          const fromX = p.side === 'left' ? p.bx + BADGE : p.bx;
          const fromY = p.by + BADGE / 2;
          const toX = p.side === 'left' ? p.x + INTO : p.x + p.w - INTO;
          const toY = p.y + p.h / 2;
          return (
            <g key={p.n} className={styles.line}>
              <polyline points={`${fromX},${fromY} ${(fromX + toX) / 2},${fromY} ${(fromX + toX) / 2},${toY} ${toX},${toY}`} />
              <circle cx={toX} cy={toY} r={DOT} />
            </g>
          );
        })}
      </svg>
      {placed.map((p) => (
        <span key={p.n}>
          <span className={`${styles.badge} ${styles.beside}`} style={{ left: p.bx, top: p.by }}>
            {p.n}
          </span>
        </span>
      ))}
    </div>,
    canvas,
  );
}

declare global {
  interface Window {
    /** The walkthrough's step as a script checks it (`npm run walk`, scripts/walk.mjs). */
    /** `sidePanel`: the step opens the app's side panel (the Coach) itself. */
    __hcWalkSteps?: { id: string; story: number; n: number; of: number; title: string; sidePanel: boolean }[];
    __hcWalk?: { step: string; busy: boolean; missing: string | null; marks: { target: string; next: boolean; at: [number, number] | null }[] };
  }
}
