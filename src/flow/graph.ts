// Flow's map from the page manifest. Each section is a lane (a frame with its title): its root on top, the pages under
// it below in rows that wrap, and theirs below them, top → bottom. Lanes sit side by side, wrapping into rows so the
// whole map is about as wide as the screen is (stacked left → right, it was a tall strip that Fit shrank to ~13%).
// Arrows come from each page's `links` (and from its parent for pages nobody links to).
import type { Manifest } from '../nav/stack';

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

/** A section's frame: its root page and everything under it. */
export interface FlowLane {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlowMetrics {
  /** A page's box (a flow page is as wide as its steps). */
  size: (id: string) => { w: number; h: number };
  gapX: number;
  gapY: number;
  /** How wide a row of pages under one parent gets before it wraps. */
  rowW: number;
  /** Inside a lane: padding, and room for its title above the padding. */
  lanePad: number;
  laneTitle: number;
  laneGap: number;
  /** The viewport's width / height: the map aims for it. */
  aspect: number;
}

/** The lanes, in the Pages panel's order: boot pages, tabs, then other roots (Profile). */
export function flowRoots(pages: Manifest): string[] {
  const ids = Object.keys(pages);
  return [
    ...ids.filter((k) => pages[k].level === 'boot'),
    ...ids.filter((k) => pages[k].level === 'tab'),
    ...ids.filter((k) => !pages[k].parent && pages[k].level !== 'tab' && pages[k].level !== 'boot'),
  ];
}

export function flowEdges(pages: Manifest): FlowEdge[] {
  const ids = Object.keys(pages);
  const edges: FlowEdge[] = ids.flatMap((id) => (pages[id].links ?? []).filter((l) => pages[l.to]).map((l) => ({ from: id, to: l.to, label: l.label })));
  const targeted = new Set(edges.map((e) => e.to));
  for (const id of ids) {
    const parent = pages[id].parent;
    if (parent && pages[parent] && pages[id].level !== 'tab' && !targeted.has(id)) edges.push({ from: parent, to: id });
  }
  return edges;
}

interface Block {
  w: number;
  h: number;
  place: (x: number, y: number) => void;
}

export function flowLayout(pages: Manifest, m: FlowMetrics): { pos: Record<string, { x: number; y: number }>; lanes: FlowLane[]; bounds: { w: number; h: number } } {
  const ids = Object.keys(pages);
  const children = (id: string) => ids.filter((k) => pages[k].parent === id && pages[k].level !== 'tab');
  const pos: Record<string, { x: number; y: number }> = {};

  // A page and what's under it: the page on top, its children's blocks below in rows that wrap.
  const block = (id: string): Block => {
    const own = m.size(id);
    const kids = children(id).map(block);
    if (!kids.length) return { ...own, place: (x, y) => void (pos[id] = { x, y }) };
    const limit = Math.max(m.rowW, own.w);
    const rows: Block[][] = [[]];
    let used = 0;
    for (const k of kids) {
      const row = rows[rows.length - 1];
      if (row.length && used + m.gapX + k.w > limit) {
        rows.push([k]);
        used = k.w;
      } else {
        row.push(k);
        used += (row.length > 1 ? m.gapX : 0) + k.w;
      }
    }
    const rowW = rows.map((r) => r.reduce((a, b) => a + b.w, 0) + m.gapX * (r.length - 1));
    const rowH = rows.map((r) => Math.max(...r.map((b) => b.h)));
    return {
      w: Math.max(own.w, ...rowW),
      h: own.h + rowH.reduce((a, b) => a + m.gapY + b, 0),
      place: (x, y) => {
        pos[id] = { x, y };
        let ry = y + own.h + m.gapY;
        rows.forEach((r, i) => {
          let rx = x;
          for (const b of r) {
            b.place(rx, ry);
            rx += b.w + m.gapX;
          }
          ry += rowH[i] + m.gapY;
        });
      },
    };
  };

  // Lanes side by side, wrapping at about the width that makes the map the screen's shape.
  const lanes = flowRoots(pages).map((id) => {
    const b = block(id);
    return { id, b, w: b.w + 2 * m.lanePad, h: b.h + 2 * m.lanePad + m.laneTitle };
  });
  const area = lanes.reduce((a, l) => a + (l.w + m.laneGap) * (l.h + m.laneGap), 0);
  const target = Math.max(...lanes.map((l) => l.w), Math.sqrt(area * m.aspect));
  const out: FlowLane[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const l of lanes) {
    if (x > 0 && x + l.w > target) {
      x = 0;
      y += rowH + m.laneGap;
      rowH = 0;
    }
    out.push({ id: l.id, x, y, w: l.w, h: l.h });
    l.b.place(x + m.lanePad, y + m.laneTitle + m.lanePad);
    x += l.w + m.laneGap;
    rowH = Math.max(rowH, l.h);
  }
  const bounds = { w: Math.max(...out.map((l) => l.x + l.w)), h: Math.max(...out.map((l) => l.y + l.h)) };
  return { pos, lanes: out, bounds };
}
