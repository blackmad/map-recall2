/**
 * A survey area: the region a façade reconnaissance run covers.
 *
 * Amsterdam's canal ring needs a boundary that follows curving canal
 * centrelines and reaches across the water to the far bank. That is a real
 * requirement, not an Amsterdam quirk — any waterfront or boulevard fabric has
 * it — but it is *one* way to describe an area, and hardcoding it made every
 * other city unrepresentable.
 *
 * So an area is declared as one of two shapes:
 *
 *   corridor  a ring that follows named linear features (canals, streets),
 *             each leg pushed outward by its own distance to reach the
 *             buildings on the far side
 *   polygon   an explicit ring, for areas whose edges are not linear features
 *
 * Both resolve to the same thing: a ring in the city's projected CRS, with
 * membership by footprint intersection.
 */
import type { LngLat, ProjectedCrs, ProjectedPoint } from './sources.ts';

export interface CorridorEdge {
  /** Name of the linear feature this leg follows, as OSM carries it. */
  feature: string;
  /** Junction the leg starts at (another feature's name), or null for the feature's own end. */
  from: string | null;
  to: string | null;
  /**
   * How far outward, in metres from the centreline, to push the boundary so it
   * intersects the building row on the far side.
   */
  outwardOffsetM: number;
  rationale: string;
}

export interface CorridorArea {
  kind: 'corridor';
  /** OSM tag selecting the linear features, e.g. { waterway: 'canal' }. */
  featureSelector: Record<string, string>;
  edges: readonly CorridorEdge[];
  /** Bounding box to query the linear features within. */
  featureBbox: readonly [south: number, west: number, north: number, east: number];
}

export interface PolygonArea {
  kind: 'polygon';
  ringLngLat: readonly LngLat[];
}

export interface SurveyArea {
  areaId: string;
  cityId: string;
  name: string;
  description: string;
  /** Fixed local origin for this area's geometry, in the city's projected CRS. */
  localOrigin: ProjectedPoint;
  localOriginNote: string;
  shape: CorridorArea | PolygonArea;
}

const distance = (a: ProjectedPoint, b: ProjectedPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const EPSILON_M = 0.5;

/** Join way fragments into maximal polylines by matching shared endpoints. */
export function chainWays(ways: LngLat[][], crs: ProjectedCrs): LngLat[][] {
  const remaining = ways.map(way => way.map(p => crs.fromLngLat(p)));
  const chains: ProjectedPoint[][] = [];

  while (remaining.length) {
    let chain = remaining.pop()!;
    let extended = true;
    while (extended) {
      extended = false;
      for (let index = 0; index < remaining.length; index++) {
        const candidate = remaining[index];
        const head = chain[0], tail = chain[chain.length - 1];
        const first = candidate[0], last = candidate[candidate.length - 1];
        if (distance(tail, first) < EPSILON_M) chain = [...chain, ...candidate.slice(1)];
        else if (distance(tail, last) < EPSILON_M) chain = [...chain, ...candidate.slice(0, -1).reverse()];
        else if (distance(head, last) < EPSILON_M) chain = [...candidate.slice(0, -1), ...chain];
        else if (distance(head, first) < EPSILON_M) chain = [...candidate.slice(1).reverse(), ...chain];
        else continue;
        remaining.splice(index, 1);
        extended = true;
        break;
      }
    }
    chains.push(chain);
  }
  return chains.map(chain => chain.map(p => crs.toLngLat(p)));
}

/** Where two centrelines meet, in projected metres. */
export function junction(a: ProjectedPoint[], b: ProjectedPoint[]): { point: ProjectedPoint; gapM: number } {
  let best = { point: a[0], gapM: Infinity };
  for (const p of a) for (const q of b) {
    const gap = distance(p, q);
    if (gap < best.gapM) best = { point: p, gapM: gap };
  }
  return best;
}

const nearestIndex = (polyline: ProjectedPoint[], target: ProjectedPoint) =>
  polyline.reduce((best, point, index) => (distance(point, target) < distance(polyline[best], target) ? index : best), 0);

/**
 * The run of `polyline` between two points on it, in the direction from → to.
 *
 * A `null` end means "carry on to this feature's own end". Which end is not
 * decided by index position: a canal ring curves back on itself, so a junction
 * can sit anywhere along the array. Take whichever side is longer.
 */
export function clipBetween(polyline: ProjectedPoint[], from: ProjectedPoint | null, to: ProjectedPoint | null): ProjectedPoint[] {
  const start = from ? nearestIndex(polyline, from) : null;
  const end = to ? nearestIndex(polyline, to) : null;
  if (start === null && end === null) return polyline;

  const runLength = (run: ProjectedPoint[]) => run.reduce((total, point, index) => (index ? total + distance(run[index - 1], point) : 0), 0);
  const longerSide = (index: number) => {
    const before = polyline.slice(0, index + 1).reverse();
    const after = polyline.slice(index);
    return runLength(before) >= runLength(after) ? before : after;
  };

  if (start === null) return longerSide(end!).reverse();
  if (end === null) return longerSide(start);
  return start <= end ? polyline.slice(start, end + 1) : polyline.slice(end, start + 1).reverse();
}

/** Signed area in square metres; positive when the ring is counter-clockwise. */
export const signedAreaM2 = (ring: ProjectedPoint[]) => {
  let total = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) total += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  return total / 2;
};

/** Push each ring vertex outward by its own offset. */
export function offsetOutward(ring: ProjectedPoint[], offsetsM: number[]): ProjectedPoint[] {
  const counterClockwise = signedAreaM2(ring) > 0;
  const count = ring.length;
  const result: ProjectedPoint[] = [];

  for (let i = 0; i < count; i++) {
    const previous = ring[(i - 1 + count) % count];
    const next = ring[(i + 1) % count];
    const incoming = { x: ring[i].x - previous.x, y: ring[i].y - previous.y };
    const outgoing = { x: next.x - ring[i].x, y: next.y - ring[i].y };
    const normalOf = (v: { x: number; y: number }) => {
      const length = Math.hypot(v.x, v.y) || 1;
      const sign = counterClockwise ? 1 : -1;
      return { x: (sign * v.y) / length, y: (-sign * v.x) / length };
    };
    const a = normalOf(incoming), b = normalOf(outgoing);
    const bisector = { x: a.x + b.x, y: a.y + b.y };
    const length = Math.hypot(bisector.x, bisector.y);
    const unit = length < 1e-6 ? b : { x: bisector.x / length, y: bisector.y / length };
    const miter = Math.min(1 / Math.max(0.35, unit.x * b.x + unit.y * b.y), 2.5);
    result.push({ x: ring[i].x + unit.x * offsetsM[i] * miter, y: ring[i].y + unit.y * offsetsM[i] * miter });
  }
  return result;
}

/** Blend per-vertex offsets across edge changes so a wider leg ramps in. */
export function smoothOffsets(ring: ProjectedPoint[], offsetsM: number[], rampM = 60): number[] {
  const cumulative = [0];
  for (let i = 1; i < ring.length; i++) cumulative.push(cumulative[i - 1] + distance(ring[i - 1], ring[i]));
  const perimeter = cumulative[cumulative.length - 1] + distance(ring[ring.length - 1], ring[0]);

  return offsetsM.map((_, i) => {
    let weighted = 0, weight = 0;
    for (let j = 0; j < offsetsM.length; j++) {
      const raw = Math.abs(cumulative[i] - cumulative[j]);
      const along = Math.min(raw, perimeter - raw);
      if (along > rampM) continue;
      const w = 1 - along / rampM;
      weighted += offsetsM[j] * w;
      weight += w;
    }
    return weight ? weighted / weight : offsetsM[i];
  });
}

/**
 * Excise the loops an outward offset creates at a concave kink.
 *
 * Offsetting by more than the local radius of curvature makes the ring cross
 * itself. Left in place, such a loop flips the inside/outside test for every
 * building near it.
 */
export function removeSelfIntersections(ring: ProjectedPoint[], maxPasses = 12): ProjectedPoint[] {
  const intersect = (a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint, d: ProjectedPoint): ProjectedPoint | null => {
    const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
    const denominator = rx * sy - ry * sx;
    if (Math.abs(denominator) < 1e-12) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denominator;
    const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denominator;
    if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
    return { x: a.x + t * rx, y: a.y + t * ry };
  };

  let current = ring;
  for (let pass = 0; pass < maxPasses; pass++) {
    let cut = false;
    outer: for (let i = 0; i < current.length; i++) {
      for (let j = i + 2; j < current.length; j++) {
        if (i === 0 && j === current.length - 1) continue;
        const point = intersect(current[i], current[(i + 1) % current.length], current[j], current[(j + 1) % current.length]);
        if (!point) continue;
        const loop = [...current.slice(i + 1, j + 1)];
        const rest = [...current.slice(0, i + 1), point, ...current.slice(j + 1)];
        current = Math.abs(signedAreaM2(loop)) > Math.abs(signedAreaM2(rest)) ? [...loop, point] : rest;
        cut = true;
        break outer;
      }
    }
    if (!cut) return current;
  }
  return current;
}

export interface ResolvedArea {
  area: SurveyArea;
  /** Centreline ring, before the outward offset. Empty for a polygon area. */
  centreline: ProjectedPoint[];
  ring: ProjectedPoint[];
  ringLngLat: LngLat[];
  areaKm2: number;
  bboxLngLat: readonly [number, number, number, number];
  legs: Array<{ edge: CorridorEdge; vertexCount: number; lengthM: number }>;
  junctions: Array<{ name: string; lngLat: LngLat; gapM: number }>;
}

export interface NamedWay {
  name: string;
  points: LngLat[];
}

/** Resolve a declared area into a ring in the city's projected CRS. */
export function resolveArea(area: SurveyArea, crs: ProjectedCrs, ways: NamedWay[] = []): ResolvedArea {
  const finish = (centreline: ProjectedPoint[], ring: ProjectedPoint[], legs: ResolvedArea['legs'], junctions: ResolvedArea['junctions']): ResolvedArea => {
    const ringLngLat = ring.map(p => crs.toLngLat(p));
    const longitudes = ringLngLat.map(p => p[0]), latitudes = ringLngLat.map(p => p[1]);
    return {
      area, centreline, ring, ringLngLat,
      areaKm2: Math.abs(signedAreaM2(ring)) / 1e6,
      bboxLngLat: [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)],
      legs, junctions,
    };
  };

  if (area.shape.kind === 'polygon') {
    return finish([], area.shape.ringLngLat.map(p => crs.fromLngLat(p)), [], []);
  }

  const byFeature = new Map<string, ProjectedPoint[]>();
  for (const name of new Set(ways.map(w => w.name))) {
    const chains = chainWays(ways.filter(w => w.name === name).map(w => w.points), crs);
    const projected = chains.map(chain => chain.map(p => crs.fromLngLat(p)));
    const length = (chain: ProjectedPoint[]) => chain.reduce((total, p, i) => (i ? total + distance(chain[i - 1], p) : 0), 0);
    byFeature.set(name, projected.reduce((best, chain) => (length(chain) > length(best) ? chain : best), projected[0]));
  }

  const junctions: ResolvedArea['junctions'] = [];
  const junctionPoint = (feature: string, other: string): ProjectedPoint => {
    // A pseudo-junction: the point on `feature` nearest another feature's own
    // southern end. Needed where two boundary features never actually meet.
    const suffix = '-south-end';
    if (other.endsWith(suffix)) {
      const target = byFeature.get(other.slice(0, -suffix.length))!;
      const end = target.reduce((best, point) => (point.y < best.y ? point : best), target[0]);
      const on = byFeature.get(feature)![nearestIndex(byFeature.get(feature)!, end)];
      junctions.push({ name: `${feature} × ${other}`, lngLat: crs.toLngLat(on), gapM: distance(end, on) });
      return on;
    }
    const found = junction(byFeature.get(feature)!, byFeature.get(other)!);
    junctions.push({ name: `${feature} × ${other}`, lngLat: crs.toLngLat(found.point), gapM: found.gapM });
    return found.point;
  };

  const centreline: ProjectedPoint[] = [];
  const rawOffsets: number[] = [];
  const legs: ResolvedArea['legs'] = [];

  for (const edge of area.shape.edges) {
    const polyline = byFeature.get(edge.feature);
    if (!polyline) throw new Error(`${area.areaId}: no centreline for ${edge.feature}`);
    const from = edge.from ? junctionPoint(edge.feature, edge.from) : null;
    const to = edge.to ? junctionPoint(edge.feature, edge.to) : null;
    const leg = clipBetween(polyline, from, to);
    const trimmed = centreline.length && distance(centreline[centreline.length - 1], leg[0]) < EPSILON_M ? leg.slice(1) : leg;
    let lengthM = 0;
    for (let i = 1; i < trimmed.length; i++) lengthM += distance(trimmed[i - 1], trimmed[i]);
    centreline.push(...trimmed);
    rawOffsets.push(...trimmed.map(() => edge.outwardOffsetM));
    legs.push({ edge, vertexCount: trimmed.length, lengthM });
  }

  const ring = removeSelfIntersections(offsetOutward(centreline, smoothOffsets(centreline, rawOffsets)));
  return finish(centreline, ring, legs, junctions);
}

/** Ray-cast point-in-ring test, in projected metres. */
export function containsPoint(ring: ProjectedPoint[], point: ProjectedPoint): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const { x: xi, y: yi } = ring[i], { x: xj, y: yj } = ring[j];
    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when any part of a footprint falls inside the area. */
export function intersectsArea(ring: ProjectedPoint[], footprint: ProjectedPoint[]): boolean {
  if (footprint.some(point => containsPoint(ring, point))) return true;
  if (ring.some(point => containsPoint(footprint, point))) return true;
  const side = (p: ProjectedPoint, q: ProjectedPoint, r: ProjectedPoint) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const crosses = (a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint, d: ProjectedPoint) =>
    side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    for (let k = 0, l = footprint.length - 1; k < footprint.length; l = k++)
      if (crosses(ring[j], ring[i], footprint[l], footprint[k])) return true;
  return false;
}
