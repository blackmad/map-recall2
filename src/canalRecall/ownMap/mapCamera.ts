// The own map's camera: MapLibre's camera model (centre, zoom, bearing,
// pitch, fov) over our local metre frame, with the projection helpers that
// replace `map.project` / `map.unproject` / `getBounds` / `cameraForBounds`.
//
// Zoom follows MapLibre's convention exactly (512 px world at zoom 0, metres
// per pixel shrinking with cos(lat)), so a `jumpTo` camera read from the game
// reproduces the same view here (see rendererSpike/ride.ts `mapLibreEye`, which
// this agrees with; tested). Pure maths: no three.js, no DOM.

import { fromLocal, type Vec2 } from './frame';

export const EARTH_RADIUS = 6371008.8; // MapLibre's earthRadius
/** MapLibre's default vertical field of view (0.6435 rad). */
export const DEFAULT_FOV_DEG = 36.86989764584402;
export const MAX_PITCH_DEG = 85;

export interface CameraState {
  /** Local metres (x east, y north). */
  center: Vec2;
  zoom: number;
  /** Degrees clockwise from north. */
  bearing: number;
  /** Degrees from straight down. */
  pitch: number;
  fovDeg?: number;
}

export interface Viewport { width: number; height: number }

export type Vec3 = [number, number, number];

export function metresPerPixel(zoom: number, lat: number): number {
  return (2 * Math.PI * EARTH_RADIUS * Math.cos(lat * Math.PI / 180)) / (512 * 2 ** zoom);
}

export function zoomForMetresPerPixel(mpp: number, lat: number): number {
  return Math.log2((2 * Math.PI * EARTH_RADIUS * Math.cos(lat * Math.PI / 180)) / (512 * mpp));
}

export interface CameraFrame {
  eye: Vec3;
  target: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  /** Focal length in CSS px. */
  focal: number;
  /** Eye-to-centre distance, metres. */
  distance: number;
  mpp: number;
  viewport: Viewport;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function cameraFrame(cam: CameraState, viewport: Viewport): CameraFrame {
  const fov = (cam.fovDeg ?? DEFAULT_FOV_DEG) * Math.PI / 180;
  const lat = fromLocal(cam.center[0], cam.center[1])[1];
  const mpp = metresPerPixel(cam.zoom, lat);
  const focal = 0.5 * viewport.height / Math.tan(fov / 2);
  const distance = focal * mpp;
  const pitch = Math.min(MAX_PITCH_DEG, Math.max(0, cam.pitch)) * Math.PI / 180;
  const bearing = cam.bearing * Math.PI / 180;
  const heading: Vec3 = [Math.sin(bearing), Math.cos(bearing), 0];
  const target: Vec3 = [cam.center[0], cam.center[1], 0];
  const eye: Vec3 = [
    target[0] - heading[0] * distance * Math.sin(pitch),
    target[1] - heading[1] * distance * Math.sin(pitch),
    distance * Math.cos(pitch),
  ];
  const forward = norm(sub(target, eye));
  // Right is heading × z-up, which stays defined when looking straight down.
  const right = norm(cross(heading, [0, 0, 1]));
  const up = norm(cross(right, forward));
  return { eye, target, forward, right, up, focal, distance, mpp, viewport };
}

/** Local metres (z up) → CSS px. `depth` ≤ 0 means behind the eye. */
export function project(frame: CameraFrame, p: Vec2 | Vec3): { x: number; y: number; depth: number } {
  const d = sub([p[0], p[1], p[2] ?? 0], frame.eye);
  const depth = dot(d, frame.forward);
  const s = frame.focal / (depth || 1e-9);
  return {
    x: frame.viewport.width / 2 + dot(d, frame.right) * s,
    y: frame.viewport.height / 2 - dot(d, frame.up) * s,
    depth,
  };
}

/** CSS px → the ground point (z = `planeZ`) under it, or null above the horizon. */
export function unproject(frame: CameraFrame, x: number, y: number, planeZ = 0): Vec2 | null {
  const sx = (x - frame.viewport.width / 2) / frame.focal;
  const sy = -(y - frame.viewport.height / 2) / frame.focal;
  const dir: Vec3 = [
    frame.forward[0] + frame.right[0] * sx + frame.up[0] * sy,
    frame.forward[1] + frame.right[1] * sx + frame.up[1] * sy,
    frame.forward[2] + frame.right[2] * sx + frame.up[2] * sy,
  ];
  if (dir[2] >= -1e-9) return null;
  const t = (planeZ - frame.eye[2]) / dir[2];
  if (t <= 0) return null;
  return [frame.eye[0] + dir[0] * t, frame.eye[1] + dir[1] * t];
}

/** The visible ground as a box (replaces `map.getBounds`). Rows above the
 *  horizon are clipped to `maxReach` metres from the centre. */
export function visibleBounds(frame: CameraFrame, maxReach = 20_000): [number, number, number, number] {
  const { width: w, height: h } = frame.viewport;
  const pts: Vec2[] = [];
  for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h], [w / 2, 0], [0, h / 2], [w, h / 2]] as const) {
    let hit = unproject(frame, x, y);
    // Above the horizon: walk down the column until the ray meets the ground.
    for (let yy = y; !hit && yy < h; yy += h / 16) hit = unproject(frame, x, yy);
    if (hit) pts.push(hit);
  }
  const cx = frame.target[0], cy = frame.target[1];
  let x0 = cx, y0 = cy, x1 = cx, y1 = cy;
  for (const [x, y] of pts) {
    const dx = Math.max(-maxReach, Math.min(maxReach, x - cx)), dy = Math.max(-maxReach, Math.min(maxReach, y - cy));
    x0 = Math.min(x0, cx + dx); x1 = Math.max(x1, cx + dx); y0 = Math.min(y0, cy + dy); y1 = Math.max(y1, cy + dy);
  }
  return [x0, y0, x1, y1];
}

export interface Padding { top: number; right: number; bottom: number; left: number }

/**
 * The camera that fits `points` inside the viewport minus `padding` (replaces
 * `map.cameraForBounds` / `fitBounds`). Works for any bearing/pitch: the
 * centre is the points' box centre shifted for asymmetric padding, and the
 * zoom is found by bisection on the projected extent.
 */
export function cameraForPoints(points: readonly Vec2[], viewport: Viewport, opts: { bearing?: number; pitch?: number; padding?: Partial<Padding>; maxZoom?: number; fovDeg?: number } = {}): CameraState {
  const pad: Padding = { top: 0, right: 0, bottom: 0, left: 0, ...opts.padding };
  const bearing = opts.bearing ?? 0, pitch = opts.pitch ?? 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  let center: Vec2 = [(x0 + x1) / 2, (y0 + y1) / 2];
  const fits = (zoom: number): boolean => {
    const f = cameraFrame({ center, zoom, bearing, pitch, fovDeg: opts.fovDeg }, viewport);
    return points.every(p => {
      const s = project(f, p);
      return s.depth > 0 && s.x >= pad.left && s.x <= viewport.width - pad.right && s.y >= pad.top && s.y <= viewport.height - pad.bottom;
    });
  };
  const shift = (zoom: number) => {
    // Asymmetric padding moves the box centre off the screen centre.
    const f = cameraFrame({ center, zoom, bearing, pitch, fovDeg: opts.fovDeg }, viewport);
    const want = { x: (pad.left + viewport.width - pad.right) / 2, y: (pad.top + viewport.height - pad.bottom) / 2 };
    const g0 = unproject(f, viewport.width / 2, viewport.height / 2), g1 = unproject(f, want.x, want.y);
    if (g0 && g1) center = [center[0] - (g1[0] - g0[0]), center[1] - (g1[1] - g0[1])];
  };
  let lo = 0, hi = opts.maxZoom ?? 22;
  for (let pass = 0; pass < 2; pass++) {
    lo = 0; hi = opts.maxZoom ?? 22;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    if (pass === 0) shift(lo);
  }
  return { center, zoom: lo, bearing, pitch, fovDeg: opts.fovDeg };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const angleLerp = (a: number, b: number, t: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;

/**
 * A smooth city ↔ street move (replaces `flyTo` / `easeTo` for the start
 * flight). Zoom eases in zoom space; the centre moves in proportion to the
 * change of scale, so on-screen motion stays even instead of racing across
 * the city at street scale.
 */
export function easeCamera(from: CameraState, to: CameraState, t: number): CameraState {
  const k = smooth(Math.max(0, Math.min(1, t)));
  const zoom = lerp(from.zoom, to.zoom, k);
  const dz = to.zoom - from.zoom;
  const u = Math.abs(dz) < 1e-6 ? k : (1 - 2 ** -(zoom - from.zoom)) / (1 - 2 ** -dz);
  return {
    center: [lerp(from.center[0], to.center[0], u), lerp(from.center[1], to.center[1], u)],
    zoom,
    bearing: angleLerp(from.bearing, to.bearing, k),
    pitch: lerp(from.pitch, to.pitch, k),
    fovDeg: to.fovDeg ?? from.fovDeg,
  };
}
