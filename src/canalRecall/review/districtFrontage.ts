/**
 * Street-frontage selection for the zero-activation district renderer.
 *
 * The district render harness (`scripts/review/render-compiled-area.mjs`) needs
 * one camera that lets a human read storey rhythm, roofline and massing at
 * street scale. The first version scored candidate walls by raw area, which made
 * the picker prefer the widest slab/row (93 m / 190 m) and then stand off from
 * the *whole building* bbox — so for parallel-slab districts the camera landed
 * inside the slab across the street and produced a featureless wall filling the
 * frame (pass 20, defect 4).
 *
 * This module makes the decision testable and deterministic:
 *  - pick a substantial wall near the district centroid (score by wall area over
 *    distance, as before),
 *  - march outward from the wall midpoint along the wall normal until another
 *    building's footprint blocks the view, so the camera stands in the open,
 *  - frame the *wall* (its own midpoint and height), not the whole building bbox,
 *    and choose a field of view that fits the wall height at that standoff.
 *
 * It is pure math over plain owner records (no THREE), so it can be exercised by
 * a Node check. All returned coordinates are render-space, matching the adapter
 * convention: render x = local x + origin.x - sceneOrigin.x, render z =
 * local y + origin.y - sceneOrigin.y, render y = local height.
 */

export interface OriginRD {
  x: number;
  y: number;
}

export interface RenderPoint {
  x: number;
  y: number;
  z: number;
}

export interface SurfaceLike {
  type?: string;
  rings?: number[][][];
}

export interface FootprintLike {
  type?: string;
  coordinates?: number[][][][];
}

export interface BuildingLike {
  id?: string;
  center?: [number, number];
  street?: string | null;
  groundNAP?: number;
  footprint?: FootprintLike;
  surfaces?: SurfaceLike[];
}

export interface OwnerLike {
  geometry?: {
    frame?: { originRD?: OriginRD };
    building?: BuildingLike;
  };
}

export interface StreetFrontage {
  building: string | null;
  street: string | null;
  wallWidth: number;
  wallHeight: number;
  midpoint: [number, number, number];
  standoff: number;
  clearDistance: number;
  blocked: boolean;
  groundY: number;
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
}

export interface SelectOptions {
  maxStandoff?: number;
  clearance?: number;
  lookAhead?: number;
  fovMin?: number;
  fovMax?: number;
  standoffMin?: number;
  standoffMax?: number;
}

const DEFAULT_OPTIONS: Required<SelectOptions> = {
  maxStandoff: 90,
  clearance: 1.5,
  lookAhead: 1.0,
  fovMin: 45,
  fovMax: 72,
  standoffMin: 10,
  standoffMax: 50,
};

export function renderPoint(owner: OwnerLike, origin: OriginRD, p: number[]): RenderPoint {
  const o = owner.geometry?.frame?.originRD;
  const ox = o?.x ?? 0;
  const oy = o?.y ?? 0;
  return { x: p[0] + ox - origin.x, y: p[1], z: p[2] + oy - origin.y };
}

export function renderCenter(owner: OwnerLike, origin: OriginRD): RenderPoint {
  const c = owner.geometry?.building?.center ?? [0, 0];
  return renderPoint(owner, origin, [c[0], 0, c[1]]);
}

interface WidestWall {
  ring: RenderPoint[];
  bottom: RenderPoint[];
  top: RenderPoint[];
  width: number;
  height: number;
  mid: RenderPoint;
  normal: RenderPoint;
}

export function widestWall(owner: OwnerLike, origin: OriginRD): WidestWall | null {
  let best: WidestWall | null = null;
  for (const s of owner.geometry?.building?.surfaces ?? []) {
    if (s.type !== 'wall' || (s.rings?.[0]?.length ?? 0) < 4) continue;
    const ring = s.rings![0].map((p) => renderPoint(owner, origin, p));
    const ys = ring.map((p) => p.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const bottom = ring.filter((p) => Math.abs(p.y - minY) < 1e-6);
    const top = ring.filter((p) => Math.abs(p.y - maxY) < 1e-6);
    if (bottom.length < 2 || !top.length) continue;
    const width = Math.hypot(bottom[1].x - bottom[0].x, bottom[1].z - bottom[0].z);
    const height = maxY - minY;
    if (width < 3 || height < 3) continue;
    if (best && width * height <= best.width * best.height) continue;
    const [a, b] = bottom;
    let normal = cross3(
      { x: b.x - a.x, y: 0, z: b.z - a.z },
      { x: top[0].x - a.x, y: top[0].y - a.y, z: top[0].z - a.z },
    );
    const len = Math.hypot(normal.x, normal.z);
    normal = len > 1e-6 ? { x: normal.x / len, y: 0, z: normal.z / len } : { x: 0, y: 0, z: 1 };
    const mid = ring.reduce(
      (acc, p) => ({ x: acc.x + p.x / ring.length, y: acc.y + p.y / ring.length, z: acc.z + p.z / ring.length }),
      { x: 0, y: 0, z: 0 },
    );
    const center = renderCenter(owner, origin);
    if (normal.x * (mid.x - center.x) + normal.z * (mid.z - center.z) < 0) normal = { x: -normal.x, y: 0, z: -normal.z };
    best = { ring, bottom, top, width, height, mid, normal };
  }
  return best;
}

function cross3(a: RenderPoint, b: RenderPoint): RenderPoint {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/** Render-space 2D footprint rings (outer rings only) for obstruction tests. */
export function footprintRings(owner: OwnerLike, origin: OriginRD): number[][][] {
  const fp = owner.geometry?.building?.footprint;
  const coords = fp?.coordinates;
  if (!coords) return [];
  // MultiPolygon coordinates are [polygon][ring][point]; a Polygon is [ring][point].
  const asArray = coords as unknown as unknown[];
  const polygons: unknown[] = fp?.type === 'Polygon' ? [asArray] : asArray;
  const rings: number[][][] = [];
  for (const polygon of polygons) {
    if (!Array.isArray(polygon)) continue;
    const outer = (polygon as unknown[])[0];
    if (!Array.isArray(outer)) continue;
    const ring: number[][] = [];
    for (const point of outer as unknown[]) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const rp = renderPoint(owner, origin, [Number(point[0]), 0, Number(point[1])]);
      ring.push([rp.x, rp.z]);
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

function pointInRing(x: number, z: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInRings(x: number, z: number, rings: number[][][]): boolean {
  return rings.some((ring) => pointInRing(x, z, ring));
}

export function selectStreetFrontage(
  owners: OwnerLike[],
  origin: OriginRD,
  options: SelectOptions = {},
): StreetFrontage | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const usable = owners.filter(
    (owner) => owner.geometry?.frame?.originRD && (owner.geometry?.building?.surfaces?.length ?? 0) > 0,
  );
  if (!usable.length) return null;

  const groundSamples = usable
    .map((owner) => owner.geometry?.building?.groundNAP)
    .filter((value): value is number => Number.isFinite(value as number))
    .sort((a, b) => a - b);
  const groundY = groundSamples.length ? groundSamples[Math.floor(groundSamples.length / 2)] : 0;

  const district = usable.map((owner) => renderCenter(owner, origin));
  const centroid = district.reduce(
    (acc, c) => ({ x: acc.x + c.x / usable.length, z: acc.z + c.z / usable.length }),
    { x: 0, z: 0 },
  );

  const candidates = usable
    .map((owner) => {
      const wall = widestWall(owner, origin);
      if (!wall) return null;
      const center = renderCenter(owner, origin);
      const dist = Math.hypot(center.x - centroid.x, center.z - centroid.z);
      return { owner, wall, score: (wall.width * wall.height) / (1 + dist / 40) };
    })
    .filter((row): row is { owner: OwnerLike; wall: WidestWall; score: number } => row !== null)
    .sort((a, b) => b.score - a.score || String(a.owner.geometry?.building?.id).localeCompare(String(b.owner.geometry?.building?.id)));
  const pick = candidates[0];
  if (!pick) return null;

  const { owner, wall } = pick;
  const targetId = owner.geometry?.building?.id ?? null;

  const blockers: number[][][] = [];
  for (const other of usable) {
    const id = other.geometry?.building?.id;
    if (id && targetId && id === targetId) continue;
    blockers.push(...footprintRings(other, origin));
  }

  const { mid, normal } = wall;
  let clearDistance = opts.maxStandoff;
  let blocked = false;
  for (let t = opts.clearance; t <= opts.maxStandoff; t += 0.5) {
    const x = mid.x + normal.x * t;
    const z = mid.z + normal.z * t;
    if (pointInRings(x, z, blockers)) {
      clearDistance = Math.max(0, t - opts.clearance);
      blocked = true;
      break;
    }
  }

  const camY = groundY + 1.7;
  const halfExtent = Math.max(Math.abs(wall.top[0].y - camY), Math.abs(wall.bottom[0].y - camY)) + opts.lookAhead;
  // Stand back far enough to take in the frontage and its roofline, capped so a
  // long slab still reads as a street stretch rather than a distant object, and
  // never past the first obstruction across the street. When the street is too
  // narrow, stay clear and widen the field of view instead.
  const desired = Math.min(
    opts.standoffMax,
    Math.max(opts.standoffMin, wall.width * 1.15 + 8),
  );
  const standoff = Math.max(3, Math.min(clearDistance, desired));
  const fitFov = (2 * Math.atan(halfExtent / standoff) * 180) / Math.PI;
  const fov = Math.min(opts.fovMax, Math.max(opts.fovMin, fitFov));
  const targetY = (wall.top[0].y + wall.bottom[0].y) / 2;

  return {
    building: targetId,
    street: owner.geometry?.building?.street ?? null,
    wallWidth: Math.round(wall.width * 10) / 10,
    wallHeight: Math.round(wall.height * 10) / 10,
    midpoint: [round(mid.x), round(targetY), round(mid.z)],
    standoff: Math.round(standoff * 10) / 10,
    clearDistance: Math.round(clearDistance * 10) / 10,
    blocked,
    groundY: round(groundY),
    fov: Math.round(fov * 10) / 10,
    position: [round(mid.x + normal.x * standoff), round(camY), round(mid.z + normal.z * standoff)],
    target: [round(mid.x), round(targetY), round(mid.z)],
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
