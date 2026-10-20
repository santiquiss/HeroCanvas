// The device in 3D, in WebGL: its body (capture/body: sides and buttons in the device's color) and, for the export,
// the frame's picture as its face. The body is shaded per pixel as anodized metal: it mirrors a photo studio (a
// softbox above, a bright band at eye level, a dark floor) tinted by its color, so light runs along the sides as they
// turn, with a brighter rim where they turn away (Fresnel), and the fine grain of bead-blasted aluminum (noise fixed
// to the surface, so it stays put as the device turns). The same projection as the frame's CSS transform (tilt.ts), so the
// canvas (the body here, the live frame over it) and the file match.
import type { Vertex } from './body';
import { PERSPECTIVE, project, turn, type Tilt } from './tilt';

export interface SceneInput {
  /** The body's triangles, in the frame's own coordinates (points, centered, y down). */
  mesh: Vertex[];
  /** The body's color (`#rrggbb`). */
  color: string;
  tilt: Tilt;
  /** The frame turned a quarter (a portrait-only page on a landscape device: layout `rotLocked`). */
  rot90: boolean;
  /** The face: the frame's picture, `w` × `h` points. */
  face?: { src: TexImageSource; w: number; h: number };
  light?: Lighting;
}

/** The scene's one light: where it comes from, how bright the body is, how much the metal shines. */
export interface Lighting {
  from: LightFrom;
  /**
   * Where the light is across, set by hand (Light's angle): -1 the left preset, 0 the top, 1 the right, up to ±1.5;
   * unset, `from`'s.
   */
  side?: number;
  /** 0.5–1.5: the body's lit color, darker or brighter. */
  brightness: number;
  /** 0–1: the highlight along the edges. */
  shine: number;
  /** 0–1: from a painted body (lit, matte) to metal (the studio's reflections in its color). */
  metal: number;
  /** 0–1: the surface's grain (bead-blasted metal), none to coarse. */
  grain: number;
}
export type LightFrom = 'left' | 'top' | 'right';
export const DEFAULT_LIGHT: Lighting = { from: 'top', brightness: 1, shine: 0.5, metal: 0.5, grain: 0.5 };

/** The presets across: left, top, right. */
export const PRESET_SIDE: Record<LightFrom, number> = { left: -1, top: 0, right: 1 };
/** How far across the light is (-1 left … 1 right): set by hand, else its preset's. */
export const lightSide = (l: Pick<Lighting, 'from' | 'side'>) => l.side ?? PRESET_SIDE[l.from];
/** The preset a side is, if it's one. */
export const presetAt = (side: number): LightFrom | null => (Object.keys(PRESET_SIDE) as LightFrom[]).find((f) => PRESET_SIDE[f] === side) ?? null;
/**
 * Where the light comes from: above and in front, as far to one side as `lightSide` says (y down, z toward the
 * viewer). The presets: left, top, right as they were, a hand-set angle anywhere between and a little past.
 */
export function lightDir(l: Pick<Lighting, 'from' | 'side'>): [number, number, number] {
  const side = lightSide(l);
  return norm([0.45 * side, -(0.75 - 0.15 * Math.min(1, Math.abs(side))), 0.66]);
}
export const LIGHT_DIRS: Record<LightFrom, [number, number, number]> = {
  left: lightDir({ from: 'left' }),
  top: lightDir({ from: 'top' }),
  right: lightDir({ from: 'right' }),
};
function norm([x, y, z]: number[]): [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** A frame-local point, turned a quarter if the frame is, then by the tilt: [screen x, y, w, depth]. */
function place(x: number, y: number, z: number, s: Pick<SceneInput, 'tilt' | 'rot90'>) {
  return s.rot90 ? project(-y, x, s.tilt, z) : project(x, y, s.tilt, z);
}

/** Where everything lands on screen, in points from the frame's center. */
export function sceneBounds(s: Pick<SceneInput, 'mesh' | 'tilt' | 'rot90'> & { face?: { w: number; h: number } }): Box {
  const pts = s.mesh.map((q) => place(q.x, q.y, q.z, s));
  if (s.face) for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pts.push(place((x * s.face.w) / 2, (y * s.face.h) / 2, 0, s));
  return {
    minX: Math.min(...pts.map((p) => p[0])),
    maxX: Math.max(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}

const VERT = `attribute vec4 p; attribute vec2 uv; attribute vec4 c; attribute vec3 nrm; attribute vec3 pos; attribute float metal; attribute vec3 here;
varying vec2 v; varying vec4 col; varying vec3 n; varying vec3 q; varying float m; varying vec3 s;
void main(){ v = uv; col = c; n = nrm; q = pos; m = metal; s = here; gl_Position = p; }`;
const FRAG = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v; varying vec4 col; varying vec3 n; varying vec3 q; varying float m; varying vec3 s;
uniform sampler2D t; uniform bool tex; uniform vec3 L; uniform float bright; uniform float shine; uniform float persp; uniform float grain;
// Value noise on the surface (its own points, not the screen's): smooth cells, two sizes.
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
// The studio a metal side mirrors, by the reflected direction (y down: up is -y).
float studio(vec3 r){
  float up = -r.y;
  float ceiling = smoothstep(-0.1, 0.9, up);
  float band = exp(-pow((up + 0.05) / 0.16, 2.0));
  float floorDark = smoothstep(0.0, -0.8, up);
  float key = pow(max(dot(r, L), 0.0), 18.0);
  float fill = pow(max(dot(r, vec3(-L.x, L.y, L.z)), 0.0), 8.0);
  // Behind the camera the studio is dark: a surface facing you (the side's edge curving into the face) mirrors that,
  // not the bright band, which would draw a light line along the bezel.
  float camera = smoothstep(0.55, 0.95, r.z);
  return (0.1 + 0.5 * ceiling + 0.7 * band + 1.6 * key + 0.3 * fill - 0.06 * floorDark) * (1.0 - 0.85 * camera);
}
void main(){
  if (tex) { gl_FragColor = texture2D(t, v); return; }
  vec3 N = normalize(n);
  vec3 V = normalize(vec3(0.0, 0.0, persp) - q);
  vec3 base = col.rgb * bright;
  float diffuse = max(dot(N, L), 0.0);
  // Matte (m < 0): the bezel's backing, the gasket, the port. No highlight: lit, they'd shine as a line along the face.
  if (m < 0.0) { gl_FragColor = vec4(col.rgb * (0.8 + 0.3 * diffuse), 1.0); return; }
  float spec = pow(max(dot(N, normalize(L + V)), 0.0), 28.0);
  vec3 painted = base * (0.5 + 0.85 * diffuse) + 0.6 * shine * spec;
  // The grain: about three specks a point, a finer layer over them; it dims and lights the surface a little and
  // breaks up the reflections, as the blasted metal scatters them.
  float g = (noise(s * 3.0) * 0.65 + noise(s * 7.0) * 0.35 - 0.5) * grain;
  float e = studio(reflect(-V, N)) * (1.0 + 0.9 * g);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  // Anodized: the reflections take the metal's color; the brightest ones wash toward white.
  vec3 metallic = base * (0.32 + 0.95 * e) + shine * (0.45 * e * e * mix(base, vec3(1.0), 0.45) + 0.25 * rim);
  gl_FragColor = vec4(mix(painted, metallic, m) * (1.0 + 0.22 * g), 1.0);
}`;

/** How deep the scene can go either way, in points: a large tablet turned 45° (its half height, turned). */
const DEPTH_RANGE = 1200;

/** Floats a vertex: clip position 4, uv 2, color 4, normal 3, turned position 3, metal 1, its own position 3. */
const STRIDE = 20;

/** One WebGL canvas drawing the device; kept while the canvas shows it (a drag redraws it every frame). */
export class DeviceScene {
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private buf: WebGLBuffer;
  private tex: WebGLTexture;
  readonly canvas: HTMLCanvasElement;

  /** The scene on `canvas`, or null where the browser has no WebGL (then the frame shows without its body). */
  static create(canvas: HTMLCanvasElement): DeviceScene | null {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true });
    return gl ? new DeviceScene(canvas, gl) : null;
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    const prog = gl.createProgram()!;
    for (const [type, src] of [
      [gl.VERTEX_SHADER, VERT],
      [gl.FRAGMENT_SHADER, FRAG],
    ] as const) {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    gl.useProgram(prog);
    this.prog = prog;
    this.buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    const attr = (name: string, size: number, offset: number) => {
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
    };
    attr('p', 4, 0);
    attr('uv', 2, 4);
    attr('c', 4, 6);
    attr('nrm', 3, 10);
    attr('pos', 3, 13);
    attr('metal', 1, 16);
    attr('here', 3, 17);
    this.tex = gl.createTexture()!;
  }

  /**
   * Draws `s` with the frame's center at the canvas's (plus `offset`, in points), `k` CSS px a point; the canvas is
   * `cssW` × `cssH` CSS px.
   */
  draw(s: SceneInput, k: number, cssW: number, cssH: number, offset: [number, number] = [0, 0]) {
    const { gl } = this;
    const base = hexRgb(s.color);
    const light = s.light ?? DEFAULT_LIGHT;
    const out: number[] = [];
    const clip = ([x, y, w, z]: number[], u: number, v: number, c: number[], n: number[], pos: number[], metal: number, here: number[] = [0, 0, 0]) =>
      // Multiplying by w keeps the face's texture perspective-correct; the depth (nearer smaller) sorts the body, over
      // the range a turned device spans (DEPTH_RANGE): finer than that, the seam and the ports, a hair off the side,
      // would sink into it at a slant.
      out.push(((x + offset[0]) * k * w) / (cssW / 2), (-(y + offset[1]) * k * w) / (cssH / 2), (-z / DEPTH_RANGE) * w, w, u, v, ...c, ...n, ...pos, metal, ...here);
    // Turned, before the perspective: where the shader looks at it from.
    const turned = (x: number, y: number, z: number) => (s.rot90 ? turn(-y, x, z, s.tilt) : turn(x, y, z, s.tilt));
    for (const q of s.mesh) {
      const tone = q.tone ?? 1;
      const c = (q.paint ?? base).map((v) => (v / 255) * tone);
      // Painted parts (the port's opening, the bezel's backing, the gasket) are matte, not metal.
      clip(place(q.x, q.y, q.z, s), 0, 0, [...c, 1], turned(q.nx, q.ny, q.nz), turned(q.x, q.y, q.z), q.paint ? -1 : light.metal, [q.x, q.y, q.z]);
    }
    if (s.face) {
      const { w, h } = s.face;
      const corner = (x: number, y: number) => clip(place((x - 0.5) * w, (y - 0.5) * h, 0, s), x, y, [0, 0, 0, 0], [0, 0, 1], [0, 0, 0], 0);
      for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]]) corner(x, y);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.DYNAMIC_DRAW);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const useTex = gl.getUniformLocation(this.prog, 'tex');
    gl.uniform3fv(gl.getUniformLocation(this.prog, 'L'), lightDir(light));
    gl.uniform1f(gl.getUniformLocation(this.prog, 'bright'), light.brightness);
    gl.uniform1f(gl.getUniformLocation(this.prog, 'shine'), light.shine);
    gl.uniform1f(gl.getUniformLocation(this.prog, 'persp'), PERSPECTIVE);
    gl.uniform1f(gl.getUniformLocation(this.prog, 'grain'), light.grain ?? DEFAULT_LIGHT.grain);
    // The body first, sorted by depth; the face over it, blended (its corners are transparent). The body is all
    // behind the face's plane, so nothing of it covers the face.
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.uniform1i(useTex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, s.mesh.length);
    gl.disable(gl.DEPTH_TEST);
    if (s.face) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s.face.src);
      // Rarely a power of two: no mipmaps, clamped; drawn near its size, so linear is sharp enough.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1i(useTex, 1);
      gl.drawArrays(gl.TRIANGLES, s.mesh.length, 6);
    }
  }

  dispose() {
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

/** The device on a canvas cropped around it, `scale` px a point: the export's picture before its shadow. */
export function renderDevice(s: SceneInput, scale: number): HTMLCanvasElement {
  const b = sceneBounds(s);
  const cssW = b.maxX - b.minX;
  const cssH = b.maxY - b.minY;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(cssW * scale);
  canvas.height = Math.ceil(cssH * scale);
  const scene = DeviceScene.create(canvas);
  // No WebGL: the picture without the body (the frame and the screen are drawn apart, exportImage).
  if (!scene) return canvas;
  // `k` in canvas px: the canvas's size in "CSS px" is then its pixel size.
  scene.draw(s, scale, canvas.width, canvas.height, [-(b.minX + b.maxX) / 2, -(b.minY + b.maxY) / 2]);
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  out.getContext('2d')!.drawImage(canvas, 0, 0);
  scene.dispose();
  return out;
}
