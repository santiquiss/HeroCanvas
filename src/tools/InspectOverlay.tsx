// Draws hover / selection boxes and Figma-style distance lines over the device, in stage coordinates.
// Measures every frame while something is highlighted (re-rendering only on change), so scrolling and animations
// stay in sync.
import { useEffect, useRef, useState } from 'react';
import { elementById, useDesign } from '../design/DesignContext';
import { elementSize, kindLabel } from '../design/element';
import { componentInstance } from '../design/component';

const BLUE = '#0d99ff';
const RED = '#f24822';
/** The padding's tint, as Figma shows a frame's padding: the outline's blue, light. */
const PADDING = 'rgba(13, 153, 255, 0.16)';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An element's padding on each side, in screen px (its CSS padding at the frame's scale); null without any. */
function paddingOf(el: Element | null): [number, number, number, number] | null {
  if (!(el instanceof HTMLElement) || !el.offsetWidth) return null;
  const cs = getComputedStyle(el);
  const k = el.getBoundingClientRect().width / el.offsetWidth;
  const sides = (['Top', 'Right', 'Bottom', 'Left'] as const).map((sd) => (parseFloat(cs[`padding${sd}`]) || 0) * k) as [number, number, number, number];
  return sides.some((v) => v > 0.5) ? sides : null;
}

function boxOf(el: Element | null, origin: DOMRect): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
}

export function InspectOverlay({ stage }: { stage: React.RefObject<HTMLDivElement | null> }) {
  const { hovered, selected, hoveredEl, selectedEl, rootRef, scale } = useDesign();
  const [, tick] = useState(0);
  const raf = useRef(0);
  const active = !!(hovered || selected || hoveredEl || selectedEl);

  // Measure every frame, but re-render only when a box actually moved or resized.
  useEffect(() => {
    if (!active) return;
    let last = '';
    const loop = () => {
      const root = rootRef.current;
      const key = [selectedEl ?? elementById(root, selected), hoveredEl ?? elementById(root, hovered)]
        .map((el) => {
          const r = el?.getBoundingClientRect();
          return r ? `${r.left},${r.top},${r.width},${r.height}` : '';
        })
        .join('|');
      if (key !== last) {
        last = key;
        tick((t) => t + 1);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [active, selected, hovered, selectedEl, hoveredEl, rootRef]);

  const st = stage.current;
  if (!active || !st) return null;
  const origin = st.getBoundingClientRect();
  const root = rootRef.current;
  // The selection and the hover: a component (by id) or an element picked on its own.
  const selEl = selectedEl ?? elementById(root, selected);
  const hovAt = hoveredEl ?? elementById(root, hovered);
  const hovEl = hovAt !== selEl ? hovAt : null;
  const sel = boxOf(selEl, origin);
  const hov = boxOf(hovEl, origin);
  const px = (v: number) => Math.round(v / scale);
  /** A component's name, or the kind of layer an element is. */
  const label = (el: Element | null, id: string | null) => (el && !id ? kindLabel(el) : componentInstance(id ?? undefined)?.name);
  const size = selEl ? elementSize(selEl, scale) : null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, overflow: 'hidden' }}>
      {hov && <Outline box={hov} width={1} label={label(hovEl, hoveredEl ? null : hovered)} padding={paddingOf(hovEl)} />}
      {sel && <Outline box={sel} width={2} label={label(selEl, selectedEl ? null : selected)} size={size ? `${size.w} × ${size.h}` : undefined} padding={paddingOf(selEl)} />}
      {sel && hov && <Distances a={sel} b={hov} px={px} />}
    </div>
  );
}

function Outline({ box, width, label, size, padding }: { box: Box; width: number; label?: string; size?: string; padding?: [number, number, number, number] | null }) {
  return (
    <>
      {/* Its padding, tinted inside the outline: a strip per side (the left and right ones between the top and bottom). */}
      {padding && <PaddingTint box={box} sides={padding} />}
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, boxShadow: `inset 0 0 0 ${width}px ${BLUE}` }} />
      {label && (
        <Tag x={box.x} y={box.y - 18}>
          {label}
        </Tag>
      )}
      {size && (
        <Tag x={box.x + box.w / 2} y={box.y + box.h + 4} center>
          {size}
        </Tag>
      )}
    </>
  );
}

function PaddingTint({ box, sides: [t, r, b, l] }: { box: Box; sides: [number, number, number, number] }) {
  const strip = (x: number, y: number, w: number, h: number, key: string) =>
    w > 0 && h > 0 ? <div key={key} style={{ position: 'absolute', left: x, top: y, width: w, height: h, background: PADDING }} /> : null;
  return (
    <>
      {strip(box.x, box.y, box.w, t, 't')}
      {strip(box.x, box.y + box.h - b, box.w, b, 'b')}
      {strip(box.x, box.y + t, l, box.h - t - b, 'l')}
      {strip(box.x + box.w - r, box.y + t, r, box.h - t - b, 'r')}
    </>
  );
}

function Tag({ x, y, center, color = BLUE, children }: { x: number; y: number; center?: boolean; color?: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        position: 'absolute',
        left: x,
        top: Math.max(0, y),
        transform: center ? 'translateX(-50%)' : undefined,
        padding: '1px 4px',
        borderRadius: 3,
        background: color,
        color: '#fff',
        font: '600 10px/14px Inter, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/**
 * Distance lines between the selection (a) and the hovered element (b), like Figma's Alt-hover:
 * gaps when they are apart on an axis, inner offsets when one contains the other.
 */
function Distances({ a, b, px }: { a: Box; b: Box; px: (v: number) => number }) {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const [ar, ab, br, bb] = [a.x + a.w, a.y + a.h, b.x + b.w, b.y + b.h];
  const midY = (Math.max(a.y, b.y) + Math.min(ab, bb)) / 2;
  const midX = (Math.max(a.x, b.x) + Math.min(ar, br)) / 2;
  const cyA = a.y + a.h / 2;
  const cxA = a.x + a.w / 2;
  const inside = (o: Box, i: Box) => i.x >= o.x && i.y >= o.y && i.x + i.w <= o.x + o.w && i.y + i.h <= o.y + o.h;

  if (inside(b, a) || inside(a, b)) {
    const [o, i] = inside(b, a) ? [b, a] : [a, b];
    const cx = i.x + i.w / 2;
    const cy = i.y + i.h / 2;
    lines.push({ x1: o.x, y1: cy, x2: i.x, y2: cy }, { x1: i.x + i.w, y1: cy, x2: o.x + o.w, y2: cy });
    lines.push({ x1: cx, y1: o.y, x2: cx, y2: i.y }, { x1: cx, y1: i.y + i.h, x2: cx, y2: o.y + o.h });
  } else {
    const y = Math.min(ab, bb) > Math.max(a.y, b.y) ? midY : cyA;
    const x = Math.min(ar, br) > Math.max(a.x, b.x) ? midX : cxA;
    if (br <= a.x) lines.push({ x1: br, y1: y, x2: a.x, y2: y });
    if (b.x >= ar) lines.push({ x1: ar, y1: y, x2: b.x, y2: y });
    if (bb <= a.y) lines.push({ x1: x, y1: bb, x2: x, y2: a.y });
    if (b.y >= ab) lines.push({ x1: x, y1: ab, x2: x, y2: b.y });
  }

  return (
    <>
      {lines.map((l, i) => {
        const len = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
        if (len < 1) return null;
        const horiz = l.y1 === l.y2;
        return (
          <div key={i}>
            <div
              style={{
                position: 'absolute',
                left: Math.min(l.x1, l.x2),
                top: Math.min(l.y1, l.y2),
                width: horiz ? len : 1,
                height: horiz ? 1 : len,
                background: RED,
              }}
            />
            <Tag x={(l.x1 + l.x2) / 2} y={(l.y1 + l.y2) / 2 - (horiz ? 18 : 7)} center color={RED}>
              {px(len)}
            </Tag>
          </div>
        );
      })}
    </>
  );
}
