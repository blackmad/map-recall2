/**
 * house:frames pose maths (lane H10, #358): where the game's first-person camera goes so its frame matches a street
 * panorama cut, and how a world point lands in both images.
 *
 * One pose drives both halves of a pair. The game half is drawn by the engine's own first-person camera
 * (`engine/fpsCamera.ts fpsPose`, applied through `ownMap/mapCamera.ts cameraFrame`); the photo half is a pinhole cut
 * from the equirectangular panorama with the same camera frame, so projecting the BAG wall through `frameFor(pose)`
 * gives the same outline in both. The game camera cannot look up (`MAX_PITCH_DEG` 85: at least 5 degrees below the
 * horizon), so a tall wall is fitted by widening the vertical field of view, never by pitching up.
 *
 * Frames: "local" is east/north metres about the camera's lng/lat, true north, z up from the camera's ground (the game's
 * local frame, `engine/gameCamera.ts` equirectangular approximation). The panorama's frame is the RD grid
 * (`facade/rectify.ts` AMSTERDAM_WORLD_ALIGNED, as every pand-reference crop reads it); `toPanoDirection` turns the
 * local ray by the grid convergence (about -0.4 degrees in the centre) before sampling.
 */
import { fpsPose, type FpsPose } from '../../src/canalRecall/engine/fpsCamera.ts';
import { cameraFrame, project, MAX_PITCH_DEG, type CameraFrame } from '../../src/canalRecall/ownMap/mapCamera.ts';
import { lngLatToWorld, type LoaderFrame } from '../../src/canalRecall/engine/gameCamera.ts';
import { lngLatToRd, rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';

export type Rd = { x: number; y: number };
export const FRAME_W = 1440;
export const FRAME_H = 900;
/** Panorama camera over its ground: `lensFor`'s datum (published height - 2.44 m is the ground), so the eye is 2.44 m. */
export const PANO_EYE_HEIGHT_M = 2.44;
/** The game lens' range: it looks at least 90 - MAX_PITCH_DEG below the horizon; the vertical FOV is clamped here. */
export const LENS = { minLookDownDeg: 90 - MAX_PITCH_DEG, maxLookDownDeg: 30, minVfovDeg: 45, maxVfovDeg: 120 } as const;
/** Fit margin, px at 1440 x 900, around the wall (and its crown allowance) in the frame. */
export const FIT_MARGIN_PX = 24;
/** Metres above the tile height kept in frame (gables, parapets, the roof edge): rectify.ts WALL_EXTRA_M. */
export const CROWN_EXTRA_M = 1.5;

const M_LAT = 111_320;
const mLng = (lat: number) => 111_320 * Math.cos(lat * Math.PI / 180);

export interface FramePose {
  /** Camera position: RD metres and WGS84 [lng, lat]. */
  rd: Rd;
  lngLat: [number, number];
  /** Eye over the ground, metres, and the camera's NAP height (record height - 43.5, or assumed ground + eye). */
  eyeHeightM: number;
  cameraNap: number | null;
  /** Degrees clockwise from true north. */
  headingDeg: number;
  /** Degrees below the horizon (the game's pitch is 90 - this). */
  lookDownDeg: number;
  vfovDeg: number;
  width: number;
  height: number;
  /** The wall (and its crown allowance) did not fit at the widest lens: 'top', 'sides' or both. */
  clipped: string[];
}

export interface WallQuad { a: Rd; b: Rd; heightM: number }

/** RD point → local metres about `origin` (true north), z unchanged. */
export function rdToLocal(p: Rd, origin: [number, number]): [number, number] {
  const [lng, lat] = rdToLngLat(p);
  return [(lng - origin[0]) * mLng(origin[1]), (lat - origin[1]) * M_LAT];
}

/** Bearing (deg clockwise from true north) from the camera to an RD point. */
export function bearingTo(cam: [number, number], p: Rd): number {
  const [x, y] = rdToLocal(p, cam);
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}

/** RD grid north's bearing from true north at `p`, degrees (meridian convergence; negative west of 5.387 E). */
export function gridConvergenceDeg(p: [number, number]): number {
  const a = lngLatToRd(p), b = lngLatToRd([p[0], p[1] + 0.001]);
  return -Math.atan2(b.x - a.x, b.y - a.y) * 180 / Math.PI;
}

/** The engine's first-person camera fields for a pose (what the game is told to draw). */
export function fpsFor(pose: FramePose): FpsPose {
  return fpsPose({ rider: pose.lngLat, bearingDeg: pose.headingDeg, viewportHeightPx: pose.height, eyeHeightM: pose.eyeHeightM, fovDeg: pose.vfovDeg, lookDownDeg: pose.lookDownDeg, maxPitchDeg: MAX_PITCH_DEG });
}

/** The camera frame (mapCamera.ts cameraFrame) in local metres about the camera; elevation 0 = the camera's ground. */
export function frameFor(pose: FramePose): CameraFrame {
  const f = fpsFor(pose);
  const center: [number, number] = [(f.center[0] - pose.lngLat[0]) * mLng(pose.lngLat[1]), (f.center[1] - pose.lngLat[1]) * M_LAT];
  return cameraFrame({ center, zoom: f.zoom, bearing: f.bearing, pitch: f.pitch, fovDeg: f.fovDeg, elevation: 0 }, { width: pose.width, height: pose.height }, pose.lngLat[1]);
}

/** RD point at `zM` over the camera's ground → image px (both halves), depth <= 0 behind the camera. */
export function projectRd(frame: CameraFrame, pose: FramePose, p: Rd, zM: number): { x: number; y: number; depth: number } {
  const [x, y] = rdToLocal(p, pose.lngLat);
  return project(frame, [x, y, zM]);
}

/** Image px → the local ray (east, north, up), unnormalised. */
export function rayFor(frame: CameraFrame, px: number, py: number): [number, number, number] {
  const sx = (px - frame.viewport.width / 2) / frame.focal, sy = -(py - frame.viewport.height / 2) / frame.focal;
  return [0, 1, 2].map(i => frame.forward[i] + frame.right[i] * sx + frame.up[i] * sy) as [number, number, number];
}

/** A local (true-north) direction → the RD-grid direction the world-aligned panorama is indexed by. */
export function toPanoDirection(d: [number, number, number], convergenceDeg: number): [number, number, number] {
  const g = convergenceDeg * Math.PI / 180, c = Math.cos(g), s = Math.sin(g);
  // Grid north sits `g` clockwise of true north, so a bearing B (true) is B - g on the grid.
  return [d[0] * c - d[1] * s, d[0] * s + d[1] * c, d[2]];
}

/** Sample points of a wall quad (ends and middle, base and crown allowance) for fitting. */
function fitPoints(wall: WallQuad): Array<{ p: Rd; z: number }> {
  const out: Array<{ p: Rd; z: number }> = [];
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const p = { x: wall.a.x + (wall.b.x - wall.a.x) * t, y: wall.a.y + (wall.b.y - wall.a.y) * t };
    out.push({ p, z: 0 }, { p, z: wall.heightM + CROWN_EXTRA_M });
  }
  return out;
}

/**
 * Aim at the wall centre and fit the lens: the heading points at the wall's midpoint; the look-down centres the wall's
 * vertical span (clamped to the game's 5-30 degrees); the vertical FOV is the narrowest in [45, 120] that keeps the
 * wall, its ends and CROWN_EXTRA_M above the tile height inside the frame with FIT_MARGIN_PX. When even 120 does not fit,
 * the pose keeps 120 and lists what is cut off (`clipped`). Same spirit as `aimedThumbnail` (heading at the wall centre,
 * FOV from the wall's half-size over the distance), within what the game camera can do.
 */
export function aimPose(cam: { lngLat: [number, number]; cameraNap?: number | null; eyeHeightM?: number }, wall: WallQuad, size = { width: FRAME_W, height: FRAME_H }): FramePose {
  const lngLat = cam.lngLat, eye = cam.eyeHeightM ?? PANO_EYE_HEIGHT_M;
  const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
  const headingDeg = bearingTo(lngLat, mid);
  // Vertical span of the wall as seen from the eye (angles at the nearest point, the steepest).
  const [mx, my] = rdToLocal(mid, lngLat), d = Math.max(1, Math.hypot(mx, my));
  const top = Math.atan2(wall.heightM + CROWN_EXTRA_M - eye, d) * 180 / Math.PI, bot = Math.atan2(-eye, d) * 180 / Math.PI;
  const lookDownDeg = Math.min(LENS.maxLookDownDeg, Math.max(LENS.minLookDownDeg, -(top + bot) / 2));
  const base: FramePose = { rd: lngLatToRd(lngLat), lngLat, eyeHeightM: eye, cameraNap: cam.cameraNap ?? null, headingDeg, lookDownDeg, vfovDeg: LENS.maxVfovDeg, width: size.width, height: size.height, clipped: [] };
  const pts = fitPoints(wall);
  const misses = (v: number) => {
    const f = frameFor({ ...base, vfovDeg: v }), m = FIT_MARGIN_PX, bad = new Set<string>();
    for (const q of pts) {
      const s = projectRd(f, base, q.p, q.z);
      if (s.depth <= 0) { bad.add('sides'); continue; }
      if (s.x < m || s.x > size.width - m) bad.add('sides');
      if (s.y < m) bad.add('top');
      if (s.y > size.height - m) bad.add('bottom');
    }
    return [...bad];
  };
  // The narrowest lens that fits the wall's height, and the one that fits its length; a wall too long for the widest
  // lens is shown by its middle at the height fit (opening further would only shrink the wall), and listed as clipped.
  const narrowest = (ok: (v: number) => boolean): number | null => {
    if (!ok(LENS.maxVfovDeg)) return null;
    if (ok(LENS.minVfovDeg)) return LENS.minVfovDeg;
    let lo: number = LENS.minVfovDeg, hi: number = LENS.maxVfovDeg;
    for (let i = 0; i < 24; i++) { const v = (lo + hi) / 2; if (ok(v)) hi = v; else lo = v; }
    return Math.round(hi * 100) / 100;
  };
  const vTall = narrowest(v => !misses(v).some(m => m === 'top' || m === 'bottom'));
  const vLong = narrowest(v => !misses(v).includes('sides'));
  const clipped = [...(vTall === null ? ['top'] : []), ...(vLong === null ? ['sides'] : [])];
  const vfovDeg = Math.max(vTall ?? LENS.maxVfovDeg, vLong ?? 0);
  return { ...base, vfovDeg, clipped };
}

/** Horizontal FOV of a pose, degrees. */
export function hfovDeg(pose: FramePose): number {
  return 2 * Math.atan(Math.tan(pose.vfovDeg * Math.PI / 360) * pose.width / pose.height) * 180 / Math.PI;
}

/** The game's world px for a lng/lat (engine/gameCamera.ts lngLatToWorld) and the player angle facing `headingDeg`. */
export function gamePlayer(lngLat: [number, number], headingDeg: number, loader: LoaderFrame): { x: number; y: number; angle: number } {
  const w = lngLatToWorld(lngLat[0], lngLat[1], loader);
  // ownWorldView solveFps: bearing = (angle + PI/2) in degrees, so angle = bearing - 90 deg.
  const angle = (headingDeg - 90) * Math.PI / 180;
  return { x: w.x, y: w.y, angle: Math.atan2(Math.sin(angle), Math.cos(angle)) };
}

/** Projected wall outline (base and top corners) in image px; null corners are behind the camera. */
export function wallOutline(frame: CameraFrame, pose: FramePose, wall: WallQuad): Array<{ x: number; y: number } | null> {
  return [[wall.a, 0], [wall.b, 0], [wall.b, wall.heightM], [wall.a, wall.heightM]].map(([p, z]) => {
    const s = projectRd(frame, pose, p as Rd, z as number);
    return s.depth > 0 ? { x: s.x, y: s.y } : null;
  });
}

/** A point on the wall (u metres from `a` along the wall, v metres over the ground) → image px. */
export function wallPoint(frame: CameraFrame, pose: FramePose, wall: WallQuad, u: number, v: number): { x: number; y: number; depth: number } {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) || 1;
  const p = { x: wall.a.x + (wall.b.x - wall.a.x) * u / len, y: wall.a.y + (wall.b.y - wall.a.y) * u / len };
  return projectRd(frame, pose, p, v);
}
