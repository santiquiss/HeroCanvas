// A lab, not part of the tool: the iPhone Duo in 3D, opening and closing, to see whether the device frame can be one.
// The model (public/devices/iphone-duo.glb, from Sketchfab, CC BY 4.0) has its two halves apart, each turning on the
// hinge (z axis); its folding inner screen is ours: one plane per half, meeting at the hinge.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 20);
camera.position.set(-2.6, 0.4, 0);
// The live app over the model: the designer's real mode (`?real=1`, the app alone at a display's size) in an iframe per
// display, over the canvas. Each frame its glass's four corners are projected to the window and the iframe gets the
// one perspective transform (a homography) that puts its rectangle on them: a single matrix3d the browser can hit
// test, so a click on a screen is the app's; a drag anywhere else reaches the canvas and turns the Duo.
const layer = document.createElement('div');
layer.className = 'live';
document.body.append(layer);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/** A stand-in for a page: drawn on a canvas, split between the halves. */
function screenTexture(w: number, h: number, label: string, corner = 0) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  // The display's rounded corners (a share of its height): outside them, the black under the glass shows.
  if (corner) {
    g.beginPath();
    g.roundRect(0, 0, w, h, corner * h);
    g.clip();
  }
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#2f86ff');
  grad.addColorStop(1, '#0035b8');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.font = `600 ${Math.round(h / 10)}px system-ui`;
  g.textAlign = 'center';
  g.fillText(label, w / 2, h / 2);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 6; i++) g.fillRect(w * 0.08, h * (0.62 + i * 0.05), w * 0.84, h * 0.03);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// The pages: a screen of a real app, shot on each display (`npm run shot -- "/dashboard" --device ipduo --display
// inner --land`, its frame cropped); until they load, the placeholder.
const inner = screenTexture(1490, 1048, 'Inner display', 0.075);
const outerPage = screenTexture(600, 1300, 'Outer');
/** A picture drawn into a page's canvas (its top left `w` × `h`, the screen), inside its rounded corners. */
function drawPage(texture: THREE.CanvasTexture, src: CanvasImageSource, w: number, h: number, corner: number) {
  const c = texture.image as HTMLCanvasElement;
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, w, h);
  g.save();
  g.beginPath();
  g.roundRect(0, 0, w, h, corner * h);
  g.clip();
  g.drawImage(src, 0, 0, w, h, 0, 0, w, h);
  g.restore();
  texture.needsUpdate = true;
}
/** A shot drawn into a page's canvas, inside its rounded corners. */
function drawShot(texture: THREE.CanvasTexture, src: string, corner: number) {
  const img = new Image();
  img.onload = () => drawPage(texture, img, img.width, img.height, corner);
  img.src = src;
}
drawShot(inner, new URL('./screens/inner.png', import.meta.url).href, 0.075);
drawShot(outerPage, new URL('./screens/outer.png', import.meta.url).href, 0);
/**
 * A mesh's triangles on one side of the hinge (the plane z = 0, the Duo open), in world space: triangles crossing it
 * are cut along it, so each half ends exactly at the hinge. Positions and normals only; `uvFrom` gives the glass its
 * page's coordinates from where each point lies (`[z, y]` → u, v).
 */
function clipAcross(mesh: THREE.Mesh, sign: -1 | 1, uvFrom?: (p: THREE.Vector3) => [number, number]) {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const pos = src.attributes.position as THREE.BufferAttribute;
  const nor = src.attributes.normal as THREE.BufferAttribute | undefined;
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  type V = { p: THREE.Vector3; n: THREE.Vector3 };
  const out: V[] = [];
  const side = (v: V) => sign * v.p.z;
  const lerp = (a: V, b: V) => {
    const t = side(a) / (side(a) - side(b));
    return { p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize() };
  };
  for (let i = 0; i < pos.count; i += 3) {
    const tri: V[] = [0, 1, 2].map((k) => ({
      p: new THREE.Vector3().fromBufferAttribute(pos, i + k).applyMatrix4(mesh.matrixWorld),
      n: nor ? new THREE.Vector3().fromBufferAttribute(nor, i + k).applyMatrix3(normalMatrix).normalize() : new THREE.Vector3(-1, 0, 0),
    }));
    // Sutherland–Hodgman against the half-space, then a fan.
    const poly: V[] = [];
    for (let k = 0; k < 3; k++) {
      const a = tri[k];
      const b = tri[(k + 1) % 3];
      if (side(a) >= 0) poly.push(a);
      if (side(a) >= 0 !== side(b) >= 0) poly.push(lerp(a, b));
    }
    for (let k = 1; k + 1 < poly.length; k++) out.push(poly[0], poly[k], poly[k + 1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out.flatMap((v) => v.p.toArray()), 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(out.flatMap((v) => v.n.toArray()), 3));
  if (uvFrom) geo.setAttribute('uv', new THREE.Float32BufferAttribute(out.flatMap((v) => uvFrom(v.p)), 2));
  return geo;
}

/**
 * The inner display: one sheet, as the real one is (it folds; there's no seam). Across it (s, from -across/2 to
 * +across/2) it lies flat on each side's inner face, and within BEND of the hinge it curves from one to the other (a
 * quadratic curve through the corner where the two faces meet): flat when open, a crease's curve as it closes. Built
 * in the Duo's frame, its points recomputed from the sides each frame (fold()).
 */
const BEND = 0.03;
const COLUMNS = 120;
const sheet: { mesh?: THREE.Mesh; across: number; along: number } = { across: 0, along: 0 };
function foldingSheet(across: number, along: number) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((COLUMNS + 1) * 2 * 3), 3));
  const uv: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= COLUMNS; i++) {
    // The page across (u, from the right side's edge to the camera side's) and along (v, top to bottom).
    uv.push(i / COLUMNS, 1, i / COLUMNS, 0);
    if (i < COLUMNS) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: inner, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  void along;
  return m;
}

/**
 * A point on a side's inner face, `d` from its hinge, at `z` along the hinge (the Duo's z: a side's origin is at one
 * end of it), in the Duo's frame, a hair off the face.
 */
function onFace(side: THREE.Object3D, d: number, z: number) {
  // The camera side's body is on its -x, the right side's on its +x: the face's outside is the other way.
  const out = side === halves.camera ? 1 : -1;
  return new THREE.Vector3(out * 0.0003, -d, z - side.position.z).applyMatrix4(side.matrix);
}

function fold() {
  const { mesh, across, along } = sheet;
  if (!mesh || !halves.camera || !halves.right) return;
  halves.camera.updateMatrix();
  halves.right.updateMatrix();
  const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
  // Each side's hinge is off the middle by `gap`: a point s across the sheet is |s| - gap from it.
  const gap = Math.abs(halves.camera.position.y);
  for (let i = 0; i <= COLUMNS; i++) {
    const s = -across / 2 + (across * i) / COLUMNS;
    for (const [row, z] of [[0, -along / 2], [1, along / 2]] as const) {
      let p: THREE.Vector3;
      if (Math.abs(s) >= BEND) p = onFace(s > 0 ? halves.camera : halves.right, Math.abs(s) - gap, z);
      else {
        // The bend: from the right side's face at BEND to the camera side's, pulled towards where the faces meet.
        const a = onFace(halves.right, BEND - gap, z);
        const c = onFace(halves.camera, BEND - gap, z);
        const corner = onFace(halves.right, -gap, z).add(onFace(halves.camera, -gap, z)).multiplyScalar(0.5);
        const t = (s + BEND) / (2 * BEND);
        p = a.multiplyScalar((1 - t) * (1 - t)).add(corner.multiplyScalar(2 * (1 - t) * t)).add(c.multiplyScalar(t * t));
      }
      pos.setXYZ(2 * i + row, p.x, p.y, p.z);
    }
  }
  pos.needsUpdate = true;
}

/** The outer display's glass: its page placed by position once the Duo is laid open. */
const outerGlass: THREE.Mesh[] = [];

const halves: { camera?: THREE.Object3D; right?: THREE.Object3D } = {};
/** The hinge's cover, and how far it sinks (along x) closed. */
const hinge: { block?: THREE.Object3D; home: number; sink: number } = { home: 0, sink: 0 };
/** Each side's own hinge, a few tenths of a millimetre off the middle: where it sits when open. */
const pivots = new Map<THREE.Object3D, number>();
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
loader.load(`${import.meta.env.BASE_URL}devices/iphone-duo.glb`, (gltf) => {
  const duo = gltf.scene;
  // Upright, cameras on top: the hinge (z) vertical.
  duo.rotation.x = Math.PI / 2;
  scene.add(duo);
  duo.traverse((o) => {
    if (o.name.startsWith('camera-side')) halves.camera = o;
    if (o.name.startsWith('right-side')) halves.right = o;
    if (o === halves.camera || o === halves.right) pivots.set(o, o.position.y);
    // The outer display (its node may hold several primitives): a page of its own, on the part drawn in 'screen'.
    if (o.name.startsWith('screen') && !o.name.startsWith('screen-foldable')) {
      const outer = new THREE.MeshBasicMaterial({ map: outerPage, toneMapped: false });
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (mesh.isMesh && (mesh.material as THREE.Material).name === 'screen') {
          mesh.material = outer;
          outerGlass.push(mesh);
        }
      });
    }
  });
  // Each half of the inner screen rides its side: laid out open, then attached (keeping where it is) to the side
  // it's on, so it turns with it.
  setAngle(180);
  scene.updateMatrixWorld(true);
  const sideAt = (z: number) => {
    const c = (o?: THREE.Object3D) => (o ? new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).z : 0);
    return Math.sign(c(halves.camera)) === Math.sign(z) ? halves.camera : halves.right;
  };
  // The inner panel (glass, black border, rounded corners), flat as the open pose has it: split at the hinge, each
  // half on its side. Its glass shows the page, on the model's own UVs.
  // (three drops the dot from glTF names: `screen-foldable001`.)
  let panel: THREE.Object3D | undefined;
  duo.traverse((o) => { if (!panel && o.name.startsWith('screen-foldable')) panel = o; });
  const parts: THREE.Mesh[] = [];
  panel?.traverse((o) => (o as THREE.Mesh).isMesh && parts.push(o as THREE.Mesh));
  // The outer display's page by where each point is too (its own UVs are a corner of the model's texture): across
  // the hinge (z) its width, along it (y) its height, seen from +x (the outside, open): u runs towards -z.
  for (const mesh of outerGlass) {
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const world = Array.from({ length: pos.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
    const b = new THREE.Box3().setFromPoints(world);
    const uv = world.flatMap((p) => [(b.max.z - p.z) / (b.max.z - b.min.z), (p.y - b.min.y) / (b.max.y - b.min.y)]);
    mesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  }
  const glass = parts.find((p) => (p.material as THREE.Material).name === 'screen');
  // The glass: one sheet across both halves, bending at the hinge (fold below), its page whole. The other layers
  // (its border, the black under it) are cut at the hinge, each half on its side.
  if (glass) {
    const b = new THREE.Box3().setFromObject(glass);
    // Open, across the hinge is world z (the halves' y) and along it world y (their -z).
    sheet.across = b.max.z - b.min.z;
    sheet.along = b.max.y - b.min.y;
    sheet.mesh = foldingSheet(sheet.across, sheet.along);
    duo.add(sheet.mesh);
    glass.removeFromParent();
  }
  for (const part of parts) {
    if (part === glass) continue;
    for (const sign of [-1, 1] as const) {
      const half = new THREE.Mesh(clipAcross(part, sign), part.material);
      scene.add(half);
      sideAt(sign)?.attach(half);
    }
    part.removeFromParent();
  }
  setAngle(angle);
  // The hinge's cover: it stays put while the sides turn, so closed it stood out of their spine. Measured closed,
  // it sinks into the spine as the Duo closes (open, it's hidden between the sides).
  hinge.block = duo.children.find((c) => c.name.startsWith('middle-block'));
  if (hinge.block) {
    hinge.home = hinge.block.position.x;
    setAngle(0);
    scene.updateMatrixWorld(true);
    const spine = Math.max(...[halves.camera, halves.right].map((o) => (o ? new THREE.Box3().setFromObject(o).max.x : 0)));
    hinge.sink = spine - new THREE.Box3().setFromObject(hinge.block).max.x;
    setAngle(angle);
  }
  placeLive();
});

/** The app to show live: `?app=<url>` (default: MF Designer's Journal, which has a landscape layout). */
// `launch=off`: the app's own launch would wait on frames an iframe drawn into a canvas doesn't get (it isn't on
// screen), and stay blank.
const APP = new URLSearchParams(location.search).get('app') ?? `${location.port === '5173' ? '' : 'http://localhost:5173'}/#/journal?real=1&launch=off`;
/** The two displays' sizes in points (the registry's iPhone Duo: inner turned, outer upright) and their corners. */
const LIVE = {
  inner: { w: 951, h: 669, radius: '55px' },
  // The outer display's hinge side (its left) has a tighter corner.
  outer: { w: 466, h: 678, radius: '8px 59px 59px 8px' },
};
/** A live screen: its iframe and its glass in the world (center, the iframe's x and y directions, its size, facing). */
interface Live {
  el: HTMLIFrameElement;
  w: number;
  h: number;
  center: THREE.Vector3;
  right: THREE.Vector3;
  down: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
  height: number;
}
const live: { inner?: Live; outer?: Live } = {};
function liveScreen(key: 'inner' | 'outer', glass: Omit<Live, 'el' | 'w' | 'h'>): Live {
  const { w, h, radius } = LIVE[key];
  const el = document.createElement('iframe');
  el.src = APP;
  Object.assign(el.style, { position: 'absolute', left: '0', top: '0', width: `${w}px`, height: `${h}px`, border: '0', borderRadius: radius, background: '#fff', transformOrigin: '0 0', pointerEvents: 'auto', visibility: 'hidden' });
  layer.append(el);
  return { el, w, h, ...glass };
}

/** Each live screen on its glass, measured in its pose: the inner one open, the outer one closed. */
function placeLive() {
  const lift = 0.0006;
  setAngle(180);
  scene.updateMatrixWorld(true);
  if (sheet.mesh) {
    const c = new THREE.Box3().setFromObject(sheet.mesh).getCenter(new THREE.Vector3());
    // Facing -x (the inner side, open), its width across the hinge (world z), its top up (world y).
    const normal = new THREE.Vector3(-1, 0, 0);
    live.inner = liveScreen('inner', { center: c.addScaledVector(normal, lift), right: new THREE.Vector3(0, 0, 1), down: new THREE.Vector3(0, -1, 0), normal, width: sheet.across, height: sheet.along });
    watchApp(live.inner.el);
  }
  setAngle(0);
  scene.updateMatrixWorld(true);
  if (outerGlass.length) {
    const box = new THREE.Box3();
    for (const m of outerGlass) box.expandByObject(m);
    const c = box.getCenter(new THREE.Vector3());
    // Which way it faces: away from the Duo's middle, along its thin side.
    const middle = new THREE.Box3().setFromObject(halves.right ?? outerGlass[0]).getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const thin = size.x < size.z ? 'x' : 'z';
    const normal = new THREE.Vector3();
    normal[thin] = Math.sign(c[thin] - middle[thin]) || 1;
    const up = new THREE.Vector3(0, 1, 0);
    // Seen from in front, x runs to the right: up × normal.
    const right = up.clone().cross(normal);
    const height = size.y;
    live.outer = liveScreen('outer', { center: c.addScaledVector(normal, lift), right, down: up.negate(), normal, width: (height * LIVE.outer.w) / LIVE.outer.h, height });
  }
  setAngle(angle);
}

/** The inner app's picture, onto the folding sheet. One at a time. */
let snapping: Promise<void> | null = null;
function snapInner(): Promise<void> {
  if (snapping) return snapping;
  // What changes from here on needs another picture.
  dirty = false;
  const scale = 2;
  capturing = true;
  snapping = pictureOf(live.inner?.el, scale)
    .then((c) => {
      if (c) drawPage(inner, c, LIVE.inner.w * scale, LIVE.inner.h * scale, 55 / LIVE.inner.h);
    })
    .catch((e) => console.warn("The app's picture failed", e))
    .finally(() => {
      // The picture's own touches, dropped before they're delivered.
      appObserver?.takeRecords();
      capturing = false;
      snapping = null;
    });
  return snapping;
}

// The picture is kept current while the app is in use, so folding needn't wait for one (it takes most of a second:
// copying the page and its fonts). The app changing marks it stale; once it's been still for a moment, a new one is
// taken in the background. Only a fold right after a change waits for it.
let dirty = true;
let refreshTimer = 0;
let capturing = false;
let appObserver: MutationObserver | null = null;
/** How long the app is still before its picture is taken again. */
const SETTLE_MS = 300;
function markDirty() {
  dirty = true;
  clearTimeout(refreshTimer);
  // Whatever the fold: hidden, the app is still laid out, and a change it makes while hidden (as it's shown or hidden
  // again) must be in the picture the next fold starts with.
  refreshTimer = window.setTimeout(() => void snapInner(), SETTLE_MS);
}
/** Watch the inner app for changes (its DOM, a scroll, typing). */
function watchApp(frame: HTMLIFrameElement) {
  frame.addEventListener('load', () => {
    const win = frame.contentWindow as (Window & typeof globalThis) | null;
    const doc = frame.contentDocument;
    if (!win || !doc) return;
    // Taking the picture touches the page itself (styles set and put back): not the app changing.
    appObserver = new win.MutationObserver(() => !capturing && markDirty());
    appObserver.observe(doc, { subtree: true, childList: true, attributes: true, characterData: true });
    for (const type of ['scroll', 'input']) doc.addEventListener(type, markDirty, true);
    markDirty();
  });
}
/** The picture as the app is now: at once if it's current, else once it's taken. */
const currentPicture = () => (dirty || snapping ? snapInner() : Promise.resolve());

type PictureWindow = Window & { __heroPicture?: (scale: number) => Promise<HTMLCanvasElement> };
/**
 * The app's picture, taken in its own iframe (lab/picture.ts, loaded there once): its window's elements, styles and
 * fonts. Needs the app on this page's origin.
 */
async function pictureOf(frame: HTMLIFrameElement | undefined, scale: number) {
  const win = frame?.contentWindow as PictureWindow | null | undefined;
  const doc = frame?.contentDocument;
  if (!win || !doc) return null;
  if (!win.__heroPicture) {
    const script = doc.createElement('script');
    script.type = 'module';
    script.src = new URL('./picture.js', location.href).href;
    await new Promise((ok, fail) => {
      script.onload = ok;
      script.onerror = fail;
      doc.head.append(script);
    });
  }
  return win.__heroPicture!(scale);
}

/** A live screen onto its glass as the camera sees it, or hidden (folding, or seen from behind). */
function project(l: Live | undefined, on: boolean) {
  if (!l) return;
  const facing = l.normal.dot(camera.position.clone().sub(l.center)) > 0;
  // Hidden, not removed from layout: the picture taken as it folds needs the app laid out.
  l.el.style.visibility = on && facing ? '' : 'hidden';
  if (!on || !facing) return;
  const corner = (x: number, y: number) => {
    const p = l.center.clone().addScaledVector(l.right, (x - 0.5) * l.width).addScaledVector(l.down, (y - 0.5) * l.height).project(camera);
    return [((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight] as const;
  };
  l.el.style.transform = homography(l.w, l.h, [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)]);
}

/** The CSS matrix3d taking a w × h rectangle (from its top left) to four points, in order TL, TR, BR, BL. */
function homography(w: number, h: number, to: (readonly [number, number])[]) {
  return `matrix3d(${homographyValues(w, h, to).join(', ')})`;
}

/** The same, as the sixteen values of a 4×4 matrix (column-major, as DOMMatrix and matrix3d take them). */
function homographyValues(w: number, h: number, to: (readonly [number, number])[]) {
  const from = [[0, 0], [w, 0], [w, h], [0, h]];
  // X = (a x + c y + e) / (g x + h y + 1), Y = (b x + d y + f) / (g x + h y + 1): eight unknowns, two rows a point.
  const A: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i];
    const [X, Y] = to[i];
    A.push([x, 0, y, 0, 1, 0, -x * X, -y * X]);
    B.push(X);
    A.push([0, x, 0, y, 0, 1, -x * Y, -y * Y]);
    B.push(Y);
  }
  const [a, b, c, d, e, f, g, k] = solve(A, B);
  return [a, b, 0, g, c, d, 0, k, 0, 0, 1, 0, e, f, 0, 1];
}

/** Gaussian elimination with partial pivoting. */
function solve(A: number[][], B: number[]) {
  const n = B.length;
  const M = A.map((row, i) => [...row, B[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const k = M[r][col] / M[col][col];
      for (let c2 = col; c2 <= n; c2++) M[r][c2] -= k * M[col][c2];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * The fold: 180° flat open, 0° closed; both halves turn by half of it, about the hinge. Each side turns on its own
 * axis, apart from the other's by the hinge's width: closing, they come together (by the sine of half the angle), so
 * closed the two inner faces rest on each other with no gap.
 */
function setAngle(deg: number) {
  const a = THREE.MathUtils.degToRad(deg);
  const together = Math.sin(a / 2);
  for (const [side, turn] of [[halves.camera, -Math.PI / 2 - a / 2], [halves.right, -Math.PI / 2 + a / 2]] as const) {
    if (!side) continue;
    side.rotation.z = turn;
    side.position.y = (pivots.get(side) ?? 0) * together;
  }
  if (hinge.block) hinge.block.position.x = hinge.home + hinge.sink * (1 - together);
  fold();
  // The outer display is on only closed: opening, it goes dark within the first few degrees and the inner one leads.
  const on = 1 - THREE.MathUtils.smoothstep(deg, 0.5, 6);
  for (const m of outerGlass) (m.material as THREE.MeshBasicMaterial).color.setScalar(on);
}

// A spring to the target angle (from the button), or the slider's value at once.
// `?angle=90` starts there; `?view=side` from three quarters (for screenshots).
const query = new URLSearchParams(location.search);
let angle = Number(query.get('angle') ?? 180);
let target = angle;
if (query.get('view') === 'side') camera.position.set(-1.9, 0.9, 1.7);
// `?cam=x,y,z`: any point of view (to look at a detail).
const cam = query.get('cam')?.split(',').map(Number);
if (cam?.length === 3) camera.position.set(cam[0], cam[1], cam[2]);
let velocity = 0;
const slider = document.getElementById('angle') as HTMLInputElement;
const deg = document.getElementById('deg')!;
const toggle = document.getElementById('toggle') as HTMLButtonElement;
// As it starts to fold, the inner display's picture is the app as it is now (its last state): kept current in the
// background (watchApp), so the fold starts at once; after a change just made, it waits for the new one. The slider
// starts at once either way, the picture showing when it's ready.
toggle.onclick = async () => {
  const next = target > 90 ? 0 : 180;
  toggle.disabled = true;
  await currentPicture();
  toggle.disabled = false;
  target = next;
  toggle.textContent = target > 90 ? 'Close' : 'Open';
};
slider.onpointerdown = () => void currentPicture();
slider.oninput = () => {
  target = angle = Number(slider.value);
  velocity = 0;
};

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  // Stiffness 120, damping a touch under critical: it settles with a slight give, as a hinge does.
  velocity += (120 * (target - angle) - 2 * 0.85 * Math.sqrt(120) * velocity) * dt;
  angle += velocity * dt;
  setAngle(angle);
  slider.value = String(Math.round(angle));
  deg.textContent = `${Math.round(angle)}°`;
  // Live only settled: open the inner display, closed the outer one; folding, the model's own (the sheet's picture).
  const still = Math.abs(velocity) < 2;
  controls.update();
  renderer.render(scene, camera);
  project(live.inner, still && angle > 179);
  project(live.outer, still && angle < 1);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
