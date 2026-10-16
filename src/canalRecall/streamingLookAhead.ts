// Look-ahead for the streamers: where the rider will be in a few seconds.
//
// Every streamer used to plan from where the rider (or the camera) is now: building tiles from the view bounds,
// ground cells and facade chunks nearest first in every direction. At riding speed (up to 87 m/s on a straight)
// the view's far edge is a few seconds ahead, and a z14 building tile, a ground cell or a detailed facade block
// takes longer than that to fetch, build and install, so whole blocks arrived in view or under the rider
// (docs/perf-pop-in-20261016.md). These helpers estimate the rider's motion from the positions the streamers are
// already given each frame, and rank work so what lies ahead comes first.
//
// Pure maths on lng/lat; no DOM, no three.js, so every bundle can carry it.

export type LngLat = readonly [number, number];
export type Bounds = { west: number; south: number; east: number; north: number };

const M_PER_DEG_LAT = 111_320;
const mPerDegLng = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

/** Below this the rider is treated as standing (no direction to favour). */
export const LOOK_AHEAD_MIN_SPEED_MPS = 2;

/**
 * The rider's velocity, smoothed over about `tauMs`: heading and speed in metres per second. A jump (a new
 * ride, a teleport, a frame after a long stall) longer than `jumpM` resets it instead of reading as speed.
 */
export class MotionEstimate {
  private last: { lng: number; lat: number; t: number } | null = null;
  private vx = 0; // metres per second, east
  private vy = 0; // metres per second, north
  constructor(private readonly tauMs = 600, private readonly jumpM = 400) {}

  update(lng: number, lat: number, tMs: number): void {
    const last = this.last;
    this.last = { lng, lat, t: tMs };
    if (!last) return;
    const dt = tMs - last.t;
    if (!(dt > 0)) return;
    const dx = (lng - last.lng) * mPerDegLng(lat), dy = (lat - last.lat) * M_PER_DEG_LAT;
    if (Math.hypot(dx, dy) > this.jumpM || dt > 2000) { this.vx = this.vy = 0; return; }
    const k = 1 - Math.exp(-dt / this.tauMs);
    this.vx += ((dx / dt) * 1000 - this.vx) * k;
    this.vy += ((dy / dt) * 1000 - this.vy) * k;
  }

  /** Metres per second. */
  get speed(): number { return Math.hypot(this.vx, this.vy); }
  /** Unit vector east/north of travel, or null while standing. */
  get direction(): [number, number] | null {
    const s = this.speed;
    return s < LOOK_AHEAD_MIN_SPEED_MPS ? null : [this.vx / s, this.vy / s];
  }
  reset(): void { this.last = null; this.vx = this.vy = 0; }
}

/** A point `metres` along an east/north unit `direction` from `from`. */
export function offsetLngLat(from: LngLat, direction: readonly [number, number], metres: number): [number, number] {
  return [from[0] + (direction[0] * metres) / mPerDegLng(from[1]), from[1] + (direction[1] * metres) / M_PER_DEG_LAT];
}

/** Square box of half-size `halfM` metres round a point. */
export function boxAround(at: LngLat, halfM: number): Bounds {
  const dLng = halfM / mPerDegLng(at[1]), dLat = halfM / M_PER_DEG_LAT;
  return { west: at[0] - dLng, south: at[1] - dLat, east: at[0] + dLng, north: at[1] + dLat };
}

export type LookAheadOptions = {
  /** Seconds of travel to look ahead, one point each. */
  seconds?: readonly number[];
  /** Never further than this, metres. */
  maxM?: number;
  /** Never nearer than this while moving, metres. */
  minM?: number;
};

/** Points ahead of a moving rider (none while standing), nearest first. */
export function lookAheadPoints(at: LngLat, motion: Pick<MotionEstimate, 'speed' | 'direction'>, options: LookAheadOptions = {}): [number, number][] {
  const direction = motion.direction;
  if (!direction) return [];
  const { seconds = [4, 9], maxM = 900, minM = 150 } = options;
  const out: [number, number][] = [];
  for (const s of seconds) out.push(offsetLngLat(at, direction, Math.min(maxM, Math.max(minM, motion.speed * s))));
  return out;
}

/**
 * Rank for "build this first": distance from the rider, shortened ahead and lengthened behind. A point straight
 * ahead at d ranks like d·(1 − `bias`); straight behind like d·(1 + `bias`). With no direction it is plain distance.
 */
export function aheadRank(from: LngLat, to: LngLat, direction: readonly [number, number] | null, bias = 0.6): number {
  const dx = (to[0] - from[0]) * mPerDegLng(from[1]), dy = (to[1] - from[1]) * M_PER_DEG_LAT;
  const d = Math.hypot(dx, dy);
  if (!direction || d < 1e-6) return d;
  const cos = (dx * direction[0] + dy * direction[1]) / d;
  return d * (1 - bias * cos);
}

/** Same rank in a local metric frame (x east, y north, metres). */
export function aheadRankXY(from: readonly [number, number], to: readonly [number, number], direction: readonly [number, number] | null, bias = 0.6): number {
  const dx = to[0] - from[0], dy = to[1] - from[1], d = Math.hypot(dx, dy);
  if (!direction || d < 1e-6) return d;
  return d * (1 - bias * ((dx * direction[0] + dy * direction[1]) / d));
}

/** Centre of slippy tile `x/y` at `zoom`, as lng/lat. */
export function tileCentre(zoom: number, x: number, y: number): [number, number] {
  const n = 2 ** zoom;
  const lng = ((x + 0.5) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180) / Math.PI;
  return [lng, lat];
}

/**
 * Look-ahead streaming is on by default; `?lookAhead=0` or `window.__canalRecallLookAhead = false` plans from
 * the rider and view alone, as before (for A/B measurements, scripts/pop-in.mjs).
 */
export function lookAheadEnabled(): boolean {
  try {
    const g = globalThis as { __canalRecallLookAhead?: boolean; location?: { search?: string } };
    if (g.__canalRecallLookAhead === false) return false;
    return new URLSearchParams(g.location?.search ?? '').get('lookAhead') !== '0';
  } catch { return true; }
}
