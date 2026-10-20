// The device's body in 3D: the frame's own outline (its size and corner radii) extruded backwards by the device's
// thickness, its sides shaped as the device's (round as an iPhone SE's, or flat with soft or crisp edges), with its
// buttons on them (capture/models). Built
// from the layout and the model, no downloaded 3D files; scene.ts draws it, on the canvas and in the export.
import type { BodySpec, EdgeStyle, Port } from './models';

/**
 * A side's cross-section, as fractions of the depth: an elliptical arc at the front edge and one at the back, `rx`
 * out of the face's outline and `rz` deep each, joined by a flat band. `round` is all arc (the band vanishes).
 */
export const EDGES: Record<EdgeStyle, { rx: number; rz: number }> = {
  round: { rx: 0.24, rz: 0.5 },
  soft: { rx: 0.08, rz: 0.3 },
  flat: { rx: 0.035, rz: 0.14 },
};
/** Steps in each arc. */
const ARC_STEPS = 5;

/** Corner radii in CSS order (tl, tr, br, bl) from a border-radius ("67px" or "30px 30px 12px 12px"). */
export function radiiOf(radius: string): [number, number, number, number] {
  const n = radius.split(/\s+/).map((v) => parseFloat(v) || 0);
  const [a, b = a, c = a, d = b] = n;
  return [a, b, c, d];
}

/** The cross-section from the front edge to the back: how far back, how far out of the outline, and the normal (out, z). */
export function sideProfile(depth: number, edge: EdgeStyle = 'flat'): { z: number; out: number; n: [number, number] }[] {
  const rx = EDGES[edge].rx * depth;
  const rz = Math.min(EDGES[edge].rz, 0.5) * depth;
  const ring = (phi: number, zc: number) => {
    const n: [number, number] = [Math.cos(phi) / rx, Math.sin(phi) / rz];
    const l = Math.hypot(n[0], n[1]);
    return { z: zc + rz * Math.sin(phi), out: rx * Math.cos(phi), n: [n[0] / l, n[1] / l] as [number, number] };
  };
  const rings = [];
  // The front arc turns from facing you to facing out; the back arc from out to away.
  for (let i = 0; i <= ARC_STEPS; i++) rings.push(ring((Math.PI / 2) * (1 - i / ARC_STEPS), -rz));
  for (let i = rz * 2 < depth - 1e-6 ? 0 : 1; i <= ARC_STEPS; i++) rings.push(ring((-Math.PI / 2) * (i / ARC_STEPS), -(depth - rz)));
  return rings;
}

/** The outline: points around the rounded rectangle (centered, y down) with their outward normals. */
export function outline(w: number, h: number, radii: [number, number, number, number], seg = 12): { x: number; y: number; nx: number; ny: number }[] {
  const max = Math.min(w, h) / 2;
  const [tl, tr, br, bl] = radii.map((r) => Math.max(0.5, Math.min(r, max)));
  const corners: [number, number, number, number][] = [
    // center x, center y, radius, start angle
    [-w / 2 + tl, -h / 2 + tl, tl, Math.PI],
    [w / 2 - tr, -h / 2 + tr, tr, 1.5 * Math.PI],
    [w / 2 - br, h / 2 - br, br, 0],
    [-w / 2 + bl, h / 2 - bl, bl, 0.5 * Math.PI],
  ];
  const pts: { x: number; y: number; nx: number; ny: number }[] = [];
  for (const [cx, cy, r, a0] of corners)
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) });
    }
  return pts;
}

/** USB-C's opening: 8.4 × 2.6 mm, in the middle of the bottom. */
const USB_C: Port = { w: 8.4, h: 2.6 };

export interface Vertex {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  /** Brighter (a button's polished metal) above 1. */
  tone?: number;
  /** A color of its own instead of the body's (the port). */
  paint?: [number, number, number];
}

/** The sides as triangles (three vertices each): the outline swept back along the edge's cross-section. */
export function sideTriangles(w: number, h: number, radii: [number, number, number, number], depth: number, edge: EdgeStyle = 'flat'): Vertex[] {
  const pts = outline(w, h, radii);
  const profile = sideProfile(depth, edge);
  const ring = (k: number) => {
    const { z, out, n } = profile[k];
    return pts.map((p) => ({ x: p.x + p.nx * out, y: p.y + p.ny * out, z, nx: p.nx * n[0], ny: p.ny * n[0], nz: n[1] }));
  };
  const tris: Vertex[] = [];
  let a = ring(0);
  for (let k = 1; k < profile.length; k++) {
    const b = ring(k);
    // The first strips, against the face, are the gasket between the glass and the frame: the bezel's black, not
    // metal (lit as metal, its edge faces you and the light, and draws a light line along the bezel).
    // Its first two steps: the curve's turn from facing you to facing out, where the light would catch it.
    const [ra, rb] = k <= 2 ? [a.map(gasket), b.map(gasket)] : [a, b];
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      tris.push(ra[i], rb[i], ra[j], ra[j], rb[i], rb[j]);
    }
    a = b;
  }
  return tris;
}

export type Side = 'left' | 'right' | 'top' | 'bottom';

/** A portrait side once a landscape frame turns the device left (its top on the left). */
const TURNED_LEFT: Record<Side, Side> = { top: 'left', left: 'bottom', bottom: 'right', right: 'top' };
const SIDE_NORMAL: Record<Side, [number, number]> = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

/**
 * A closed foldable's seam: the line where its two halves meet, a dark groove around the side at half the depth,
 * except along the hinge (frame-local, as the outline).
 */
function seam(w: number, h: number, radii: [number, number, number, number], depth: number, out: number, gap: number, hinge: Side): Vertex[] {
  const pts = outline(w, h, radii);
  const [hx, hy] = SIDE_NORMAL[hinge];
  // Only the hinge's straight side: around the corners the seam runs on, under the spine's tapered ends.
  const onHinge = (p: (typeof pts)[number]) => p.nx * hx + p.ny * hy > 0.98;
  const v = (p: (typeof pts)[number], z: number): Vertex => ({ x: p.x + p.nx * out, y: p.y + p.ny * out, z, nx: p.nx, ny: p.ny, nz: 0, paint: SEAM });
  const tris: Vertex[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
    if (onHinge(a) || onHinge(b)) continue;
    tris.push(v(a, -depth / 2 - gap / 2), v(a, -depth / 2 + gap / 2), v(b, -depth / 2 - gap / 2), v(b, -depth / 2 - gap / 2), v(a, -depth / 2 + gap / 2), v(b, -depth / 2 + gap / 2));
  }
  return tris;
}
const SEAM: [number, number, number] = [16, 16, 18];

/** A stadium (a pill) `len` long and `thick` across, centered: points around it with their in-plane normals. */
function stadium(len: number, thick: number, seg = 8): { u: number; v: number; nu: number; nv: number }[] {
  return roundRect(len, thick, Math.min(thick, len) / 2, seg);
}

/** A rounded rectangle `len` × `thick` with corners of radius `r` (a stadium at half the thickness), centered. */
function roundRect(len: number, thick: number, r: number, seg = 8): { u: number; v: number; nu: number; nv: number }[] {
  r = Math.min(r, thick / 2, len / 2);
  const cu = len / 2 - r;
  const cv = thick / 2 - r;
  const pts: { u: number; v: number; nu: number; nv: number }[] = [];
  for (const [su, sv, a0] of [
    [1, -1, -Math.PI / 2],
    [1, 1, 0],
    [-1, 1, Math.PI / 2],
    [-1, -1, Math.PI],
  ] as const)
    for (let i = 0; i <= seg / 2; i++) {
      const a = a0 + (i / (seg / 2)) * (Math.PI / 2);
      pts.push({ u: su * cu + r * Math.cos(a), v: sv * cv + r * Math.sin(a), nu: Math.cos(a), nv: Math.sin(a) });
    }
  return pts;
}

/**
 * Something on a side, built in that side's own terms (u along it, v across the depth, w out of it) and placed on
 * the portrait frame: on `side`, `along` from its middle, at depth `zc`, `w` from the frame's outline.
 */
function onSide(side: Side, wp: number, hp: number, along: number, zc: number) {
  return (u: number, v: number, w: number, nu: number, nv: number, nw: number, tone: number, paint?: [number, number, number]): Vertex => {
    const z = zc + v;
    if (side === 'right') return { x: wp / 2 + w, y: along + u, z, nx: nw, ny: nu, nz: nv, tone, paint };
    if (side === 'left') return { x: -wp / 2 - w, y: along + u, z, nx: -nw, ny: nu, nz: nv, tone, paint };
    if (side === 'top') return { x: along + u, y: -hp / 2 - w, z, nx: nu, ny: -nw, nz: nv, tone, paint };
    return { x: along + u, y: hp / 2 + w, z, nx: nu, ny: nw, nz: nv, tone, paint };
  };
}

/**
 * A key: a pill standing out of the side from `w0` to `w1`, its top edge rounded off (a bevel ring), as the buttons
 * of most phones and tablets are.
 */
function pillKey(at: ReturnType<typeof onSide>, len: number, thick: number, w0: number, w1: number, tone = 1.15, corner?: number, edge = 0.6): Vertex[] {
  const bevel = Math.min((w1 - w0) * edge, thick * 0.3);
  const seg = thick > len * 0.3 ? 16 : 8;
  const r = corner ?? Math.min(thick, len) / 2;
  const base = roundRect(len, thick, r, seg);
  const top = roundRect(len - bevel * 2, thick - bevel * 2, Math.max(0, r - bevel), seg);
  const tris: Vertex[] = [];
  const n = base.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [a, b] = [base[i], base[j]];
    // The wall, straight out.
    const wall = (p: typeof a, w: number) => at(p.u, p.v, w, p.nu, p.nv, 0, tone);
    tris.push(wall(a, w0), wall(a, w1 - bevel), wall(b, w0), wall(b, w0), wall(a, w1 - bevel), wall(b, w1 - bevel));
    // The bevel, turning from the wall to the top.
    const lo = (p: typeof a) => at(p.u, p.v, w1 - bevel, p.nu * 0.7, p.nv * 0.7, 0.7, tone);
    const hi = (p: typeof a) => at(p.u, p.v, w1, p.nu * 0.35, p.nv * 0.35, 0.94, tone);
    const [ta, tb] = [top[i], top[j]];
    tris.push(lo(a), hi(ta), lo(b), lo(b), hi(ta), hi(tb));
    // The top, facing out.
    tris.push(at(0, 0, w1, 0, 0, 1, tone), at(ta.u, ta.v, w1, 0, 0, 1, tone), at(tb.u, tb.v, w1, 0, 0, 1, tone));
  }
  return tris;
}

/**
 * A closed foldable's hinge: a barrel along the side, round across the depth (`thick`), standing `bulge` out of
 * `w0` at its middle; its ends taper into the side, inside the body's rounded corners.
 */
function barrel(at: ReturnType<typeof onSide>, len: number, thick: number, w0: number, bulge: number, tone: number): Vertex[] {
  const around = 12;
  const along = 24;
  // Its ends sink into the side over the last stretch, so it rises out of the corners instead of ending in a step.
  const taper = 0.14;
  const rise = (s: number) => {
    const d = Math.min(s, 1 - s) / taper;
    return d >= 1 ? 1 : d * d * (3 - 2 * d);
  };
  const point = (i: number, j: number) => {
    const a = -Math.PI / 2 + (i / around) * Math.PI;
    const s = j / along;
    const f = rise(s);
    return at(-len / 2 + s * len, (thick / 2) * Math.sin(a), w0 + bulge * f * Math.cos(a), 0, Math.sin(a), Math.cos(a), tone);
  };
  const tris: Vertex[] = [];
  for (let i = 0; i < around; i++)
    for (let j = 0; j < along; j++) tris.push(point(i, j), point(i + 1, j), point(i, j + 1), point(i, j + 1), point(i + 1, j), point(i + 1, j + 1));
  return tris;
}

/** A pill-shaped flat patch on the side, in a color of its own (the port's opening and its tongue). */
function patch(at: ReturnType<typeof onSide>, len: number, thick: number, w: number, paint: [number, number, number]): Vertex[] {
  const pts = stadium(len, thick);
  const tris: Vertex[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
    tris.push(at(0, 0, w, 0, 0, 1, 1, paint), at(a.u, a.v, w, 0, 0, 1, 1, paint), at(b.u, b.v, w, 0, 0, 1, 1, paint));
  }
  return tris;
}

/** The charging port's opening and the tongue inside it: near black, a lighter gray. */
const PORT_DARK: [number, number, number] = [10, 10, 12];
const PORT_TONGUE: [number, number, number] = [44, 45, 48];

/**
 * A plate just behind the face, the bezel's black, its outline a hair outside the face's: where the face's soft edge
 * and the side's meet, neither covers the pixel whole, and the background would show through as a light line.
 */
function faceBacking(w: number, h: number, radii: [number, number, number, number]): Vertex[] {
  const pts = outline(w + 1, h + 1, radii.map((r) => r + 0.5) as [number, number, number, number]);
  const v = (x: number, y: number): Vertex => ({ x, y, z: -0.4, nx: 0, ny: 0, nz: 1, paint: BEZEL });
  const tris: Vertex[] = [];
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
    tris.push(v(0, 0), v(a.x, a.y), v(b.x, b.y));
  }
  return tris;
}
/** The frame's bezel (SimulatorShell .frame's gradient, its darker end). */
const BEZEL: [number, number, number] = [20, 22, 26];
const gasket = (v: Vertex): Vertex => ({ ...v, paint: BEZEL });

/** How far a button stands out of the side, and how thick it is across the side, in mm. */
const BUTTON_OUT = 0.55;
const BUTTON_THICK = 2.4;
/** A closed foldable's hinge spine stands this far out of its side; the seam between the halves is this wide (mm). */
const HINGE_OUT = 0.5;
const SEAM_GAP = 0.35;
/** How far off the side a mark drawn on it sits (the seam, the port), in points: enough to stay in front of it. */
const SURFACE_GAP = 0.6;

/**
 * The body behind a frame `frameW` × `frameH` (as shown: landscape when `land`, the device turned left, its top
 * on the left): sides and buttons, in points, the face at z 0 and the back at −depth. `spec` gives the thickness
 * and the keys, scaled to the frame (its width is the body's); without one, `depth` points and no keys.
 */
export function deviceMesh(o: { frameW: number; frameH: number; radii: [number, number, number, number]; land: boolean; spec?: BodySpec; depth: number }): { tris: Vertex[]; depth: number } {
  const wp = o.land ? o.frameH : o.frameW;
  const hp = o.land ? o.frameW : o.frameH;
  const unit = o.spec ? wp / o.spec.w : 0;
  const depth = o.spec ? o.spec.depth * unit : o.depth;
  const edge = o.spec?.edge ?? 'flat';
  const tris = [...faceBacking(o.frameW, o.frameH, o.radii), ...sideTriangles(o.frameW, o.frameH, o.radii, depth, edge)];
  if (!o.spec) return { tris, depth };
  // The keys sit on the side's outermost line.
  const mid = depth * EDGES[edge].rx;
  const out = BUTTON_OUT * unit;
  // A closed foldable is two halves stacked: its keys and port sit on one of them (`half`), not across both.
  const folded = !!o.spec.fold?.hinge;
  const room = folded ? depth / 2 : depth;
  const zOf = (half: 'front' | 'back' = 'front') => (folded ? (half === 'front' ? -depth / 4 : (-3 * depth) / 4) : -depth / 2);
  const t = Math.min(room * 0.42 * (folded ? 1.4 : 1), BUTTON_THICK * unit);
  const alongH = hp / o.spec.h;
  const alongW = wp / o.spec.w;
  const place = (faces: Vertex[]) =>
    // In portrait first; a landscape frame turns it left: (x, y) → (y, −x).
    tris.push(...(o.land ? faces.map((q) => ({ ...q, x: q.y, y: -q.x, nx: q.ny, ny: -q.nx })) : faces));
  const across = (side: Side) => side === 'top' || side === 'bottom';
  for (const k of o.spec.buttons) {
    // The key's middle, from the middle of its side.
    const along = across(k.edge) ? -wp / 2 + (k.at + k.len / 2) * alongW : -hp / 2 + (k.at + k.len / 2) * alongH;
    const len = k.len * (across(k.edge) ? alongW : alongH);
    place(pillKey(onSide(k.edge, wp, hp, along, zOf(k.half)), len, t, mid - 1.5, mid + out));
  }
  const fold = o.spec.fold;
  if (fold?.hinge) {
    // Closed: the hinge's spine, a long rounded barrel the whole depth of its side, in darker metal; the seam
    // between the halves around the rest.
    const side = fold.hinge;
    const at = onSide(side, wp, hp, 0, -depth / 2);
    if (fold.spine === 'flat') {
      // A flat, polished cover the whole side long and deep (iPhone Duo): nearly square corners, a crisp edge.
      const len = (across(side) ? wp : hp) - 2 * Math.min(...o.radii);
      place(pillKey(at, len, depth * 0.98, mid - 1.5, mid + HINGE_OUT * 0.8 * unit, 1.08, depth * 0.1, 0.3));
    } else {
      // A barrel along its straight part, between the corners of that side.
      const len = (across(side) ? wp : hp) - 2 * Math.max(...o.radii);
      place(barrel(at, len, depth * 0.96, mid - 1.5, 1.5 + HINGE_OUT * unit, 0.82));
    }
    const local = o.land ? TURNED_LEFT[side] : side;
    tris.push(...seam(o.frameW, o.frameH, o.radii, depth, mid + SURFACE_GAP, SEAM_GAP * unit, local));
  }
  if (fold?.crease) {
    // Open: where the halves meet, a dark gap across the two sides the fold runs into.
    const sides: Side[] = fold.crease === 'vertical' ? ['top', 'bottom'] : ['left', 'right'];
    for (const side of sides) place(patch(onSide(side, wp, hp, 0, -depth / 2), SEAM_GAP * 2 * unit, depth * 0.9, mid + SURFACE_GAP, SEAM));
  }
  const port = o.spec.port ?? USB_C;
  if (port.w) {
    // Flush with the side's outermost line, a hair out so it draws over it.
    const side = port.edge ?? 'bottom';
    const span = across(side) ? alongW : alongH;
    const at = onSide(side, wp, hp, (port.at ?? 0) * span, zOf(port.half));
    const pw = port.w * unit;
    const ph = Math.min(port.h * unit, room * (folded ? 0.75 : 0.6));
    place([...patch(at, pw, ph, mid + SURFACE_GAP, PORT_DARK), ...patch(at, pw * 0.7, ph * 0.28, mid + SURFACE_GAP * 1.5, PORT_TONGUE)]);
  }
  return { tris, depth };
}
