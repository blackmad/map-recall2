/**
 * Power from the air (lane R5-F, #266). The user, 2026-11-08, panning the city from the air on a Mac at DPR 2: "the
 * engine does feel genuinely smoother. I wish it wasn't running my fan so hard." The aerial pan is GPU-bound: every
 * frame of a pan draws the whole horizon-deep view at the native pixel ratio with MSAA, and the sun's shadow box follows
 * the view, so the shadow map is redrawn every few frames. Nothing lowered the cost while the camera flew.
 *
 * This is the pure policy: one call per game frame with the view's pose, the answer is what the frame host and the
 * shared frame should do this frame. Four levers, each behind its own `?flag=0` (all off = today's frame, byte for byte):
 *
 *  - `fps` (`?aerialFps=0`): while the camera is panned off the rider (detached) and moving from the air, the frame host
 *    renders at most AERIAL_FPS times a second; back to every frame as soon as the camera settles (MOVE_HOLD_MS).
 *  - `scale` (`?aerialScale=0`): the pixel ratio × AERIAL_SCALE while aerial, detached and moving; native on settle.
 *  - `shadows` (`?aerialShadows=0`): the shadow map is redrawn at most every AERIAL_SHADOW_EVERY-th frame while aerial,
 *    detached and moving (between redraws the box stays where it was drawn).
 *  - `mapSize` (`?aerialShadowMap=0`): the sun's shadow map is AERIAL_SHADOW_MAP² while aerial (moving or not): from the
 *    air one shadow texel of the 2048² map covers a fraction of a pixel.
 *
 * Not a lever: "only the near tiers cast from the air" (the plan's c3). Measured on 2026-11-08 the coarse, far and
 * baked tiers already never cast (threeBuildingsBrowser.ts coarse `castShadow = false`, farShells.ts, bakedCoarse.ts);
 * the shadow pass from the air is the trees' shadow twin, the near walls, landmarks, furniture and stand-ins.
 *
 * "Moving" is the view's own pose changing (centre, zoom, bearing, pitch), not the input that moved it, so a trackpad
 * pan, a keyboard pan and a scripted fly-to read the same.
 */

export interface AerialLevers { fps: boolean; scale: boolean; shadows: boolean; mapSize: boolean }

export const AERIAL_FPS = 30;
export const AERIAL_SCALE = 0.8;
export const AERIAL_SHADOW_EVERY = 4;
export const AERIAL_SHADOW_MAP = 1024;
/**
 * The camera reads as settled this long after the last frame its pose changed. The brief's bound is "native within
 * 300 ms of settling"; a held key or a trackpad's momentum can leave one or two frames without a change, so not 0.
 */
export const MOVE_HOLD_MS = 150;
/** Pose changes smaller than these per second are drift (easing tails, float noise), not motion. */
export const MOVE_MIN = { mps: 2, zoomPerS: 0.05, degPerS: 1 };

export interface AerialPose {
  now: number;
  /** isAerialView for the frame's pose, and not the intro. */
  aerial: boolean;
  /** The camera is panned off the rider (game camera `detached`). */
  detached: boolean;
  lng: number; lat: number; zoom: number; pitch: number; bearing: number;
}

export interface AerialDecision {
  aerial: boolean;
  moving: boolean;
  /** Least ms between rendered frames, or null (every frame). */
  frameMs: number | null;
  /** Multiplier on the pixel ratio (1 = native). */
  scale: number;
  /** Redraw the shadow map at most every n-th frame (1 = whenever the box or casters change). */
  shadowEvery: number;
  /** The sun's shadow-map size to use, or null for the tier's own. */
  shadowMapSize: number | null;
}

export const NEUTRAL: Readonly<AerialDecision> = Object.freeze({ aerial: false, moving: false, frameMs: null, scale: 1, shadowEvery: 1, shadowMapSize: null });

/** The levers from the query (`?aerialFps=0` …) or the matching window globals (`__canalRecallAerialFps = false`). */
export function aerialLeversFromQuery(search: string, globals: Record<string, unknown> = {}): AerialLevers {
  let params: URLSearchParams | null = null;
  try { params = new URLSearchParams(search); } catch { params = null; }
  const on = (param: string, global: string) => {
    if (globals[global] === false) return false;
    if (globals[global] === true) return true;
    return params?.get(param) !== '0';
  };
  return {
    fps: on('aerialFps', '__canalRecallAerialFps'),
    scale: on('aerialScale', '__canalRecallAerialScale'),
    shadows: on('aerialShadows', '__canalRecallAerialShadows'),
    mapSize: on('aerialShadowMap', '__canalRecallAerialShadowMap'),
  };
}

const M_PER_DEG = 111_320;

export class AerialPower {
  private last: AerialPose | null = null;
  private lastMoveAt = -Infinity;
  decision: AerialDecision = { ...NEUTRAL };

  constructor(readonly levers: AerialLevers) {}

  /** True when any lever can change a frame (all off: the caller skips every apply). */
  get any(): boolean { const l = this.levers; return l.fps || l.scale || l.shadows || l.mapSize; }

  update(p: AerialPose): AerialDecision {
    const prev = this.last;
    this.last = p;
    if (prev && p.aerial) {
      const dt = Math.max(1e-3, (p.now - prev.now) / 1000);
      const dx = (p.lng - prev.lng) * M_PER_DEG * Math.cos(p.lat * Math.PI / 180), dy = (p.lat - prev.lat) * M_PER_DEG;
      let db = Math.abs(p.bearing - prev.bearing) % 360; if (db > 180) db = 360 - db;
      const moved = Math.hypot(dx, dy) / dt > MOVE_MIN.mps || Math.abs(p.zoom - prev.zoom) / dt > MOVE_MIN.zoomPerS
        || db / dt > MOVE_MIN.degPerS || Math.abs(p.pitch - prev.pitch) / dt > MOVE_MIN.degPerS;
      if (moved) this.lastMoveAt = p.now;
    }
    const l = this.levers;
    const moving = p.aerial && p.now - this.lastMoveAt <= MOVE_HOLD_MS;
    const flying = moving && p.detached;
    this.decision = {
      aerial: p.aerial,
      moving,
      frameMs: l.fps && flying ? 1000 / AERIAL_FPS : null,
      scale: l.scale && flying ? AERIAL_SCALE : 1,
      shadowEvery: l.shadows && flying ? AERIAL_SHADOW_EVERY : 1,
      shadowMapSize: l.mapSize && p.aerial ? AERIAL_SHADOW_MAP : null,
    };
    return this.decision;
  }
}
