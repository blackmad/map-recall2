// Which walls of a building face a street, so front doors (and the stoops, door
// pediments and gable stones that hang on them) go only on the street side.
//
// User report 2026-10-02 (Da Costakade): doors and stoops stood on back walls,
// courtyard walls and the garden side of terraces, because every exposed wall
// got a door. A wall faces the street when a ray from it, cast straight out,
// meets a street centreline before it meets another building: a front wall sees
// the road a few metres away; a back wall sees the neighbour's back wall across
// the gardens first. Pure and deterministic, so the chunk worker can run it.

/** Highways a house can have its front door on. Motor roads, service alleys and paths are not. */
export const FRONT_HIGHWAYS: ReadonlySet<string> = new Set([
  'residential', 'living_street', 'pedestrian', 'unclassified', 'tertiary', 'secondary', 'primary',
  'tertiary_link', 'secondary_link', 'primary_link', 'cycleway', 'busway',
]);

/** A street this far in front of a wall, unobstructed, makes it a street wall. */
export const STREET_REACH_M = 32;
/** A building with no street wall within reach falls back to its wall nearest a street within this. */
export const FALLBACK_REACH_M = 70;

const M_PER_DEG_LAT = 110_540;
const mPerDegLng = (lat: number) => 111_320 * Math.cos(lat * Math.PI / 180);

/**
 * Flat street segments [x0, y0, x1, y1, ...] in metres from `origin`, for the
 * paths ([lng, lat][]) whose highway can carry a front door.
 */
export function streetSegments(paths: ReadonlyArray<{ highway?: string; points: ReadonlyArray<readonly [number, number]> }>, origin: { lng: number; lat: number }): Float32Array {
  const kx = mPerDegLng(origin.lat), out: number[] = [];
  for (const path of paths) {
    if (path.highway && !FRONT_HIGHWAYS.has(path.highway)) continue;
    for (let i = 1; i < path.points.length; i++) {
      const [a, b] = [path.points[i - 1], path.points[i]];
      out.push((a[0] - origin.lng) * kx, (a[1] - origin.lat) * M_PER_DEG_LAT, (b[0] - origin.lng) * kx, (b[1] - origin.lat) * M_PER_DEG_LAT);
    }
  }
  return Float32Array.from(out);
}

/** A uniform grid over flat segments, so a ray only tests the segments near it. */
export class SegmentGrid {
  private readonly cells = new Map<string, number[]>();
  constructor(readonly segs: ArrayLike<number>, readonly cellM = 25, readonly owners?: ArrayLike<number>) {
    for (let s = 0; s < segs.length / 4; s++) {
      const [x0, y0, x1, y1] = [segs[s * 4], segs[s * 4 + 1], segs[s * 4 + 2], segs[s * 4 + 3]];
      for (const key of this.keysFor(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1))) {
        let list = this.cells.get(key);
        if (!list) this.cells.set(key, list = []);
        list.push(s);
      }
    }
  }

  private *keysFor(minX: number, minY: number, maxX: number, maxY: number): Generator<string> {
    const c = this.cellM;
    for (let gx = Math.floor(minX / c); gx <= Math.floor(maxX / c); gx++) for (let gy = Math.floor(minY / c); gy <= Math.floor(maxY / c); gy++) yield `${gx},${gy}`;
  }

  /** Segment indices whose cells overlap the box. */
  near(minX: number, minY: number, maxX: number, maxY: number): Set<number> {
    const out = new Set<number>();
    for (const key of this.keysFor(minX, minY, maxX, maxY)) for (const s of this.cells.get(key) ?? []) out.add(s);
    return out;
  }

  /**
   * Distance along the ray (ox, oy) + t (dx, dy), |d| = 1, to the first segment it crosses
   * within `maxT`, skipping segments owned by `skipOwner`; Infinity when none.
   */
  firstHit(ox: number, oy: number, dx: number, dy: number, maxT: number, skipOwner = -1): number {
    const ex = ox + dx * maxT, ey = oy + dy * maxT;
    let best = Infinity;
    for (const s of this.near(Math.min(ox, ex), Math.min(oy, ey), Math.max(ox, ex), Math.max(oy, ey))) {
      if (this.owners && this.owners[s] === skipOwner) continue;
      const ax = this.segs[s * 4], ay = this.segs[s * 4 + 1], bx = this.segs[s * 4 + 2], by = this.segs[s * 4 + 3];
      const sx = bx - ax, sy = by - ay, den = dx * sy - dy * sx;
      if (Math.abs(den) < 1e-9) continue;
      const qx = ax - ox, qy = ay - oy;
      const t = (qx * sy - qy * sx) / den, u = (qx * dy - qy * dx) / den;
      if (t >= 0 && t <= maxT && u >= 0 && u <= 1 && t < best) best = t;
    }
    return best;
  }
}

export type WallRay = { x0: number; y0: number; x1: number; y1: number; nx: number; ny: number; len: number };

/**
 * Distance from the wall to the street straight in front of it (the nearest of three
 * rays, at a quarter, half and three quarters along), or Infinity when another
 * building (`walls`, owners = building index) stands in front first or no street is
 * within `reach`. `owner` is this wall's building, so its own walls never block it.
 */
export function streetDistance(wall: WallRay, streets: SegmentGrid, walls: SegmentGrid | null, owner: number, reach = STREET_REACH_M): number {
  let best = Infinity;
  for (const f of [0.25, 0.5, 0.75]) {
    // Start just outside the wall so the wall itself is not hit.
    const ox = wall.x0 + (wall.x1 - wall.x0) * f + wall.nx * 0.05, oy = wall.y0 + (wall.y1 - wall.y0) * f + wall.ny * 0.05;
    const street = streets.firstHit(ox, oy, wall.nx, wall.ny, reach);
    if (!(street < best)) continue;
    const blocked = walls ? walls.firstHit(ox, oy, wall.nx, wall.ny, street, owner) : Infinity;
    if (blocked >= street) best = street;
  }
  return best;
}
