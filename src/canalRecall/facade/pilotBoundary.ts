/**
 * The pilot boundary: De Negen Straatjes and Grachtengordel-West.
 *
 * Fixed once, here, and referenced by every downstream stage. The build prompt
 * specifies it as Brouwersgracht in the north, Leidsegracht in the south,
 * Singel in the east and Prinsengracht plus the first Jordaan row in the west,
 * with *both banks* of each boundary canal included.
 *
 * Two things follow from "both banks" that a bounding box cannot express:
 *
 * 1. The boundary follows canal *centrelines*, which curve. A straight chord
 *    between corner junctions cuts off the outside of every bend, and the
 *    canal ring bends continuously.
 * 2. The centreline ring is then offset *outward*, far enough to reach into
 *    the building row on the far bank. Membership is by footprint
 *    intersection, so the boundary only has to cross the far row's front wall,
 *    not contain the whole plot.
 *
 * Singel does not reach Leidsegracht — it ends at Koningsplein — so the
 * south-east corner is closed along Herengracht, which does. The Gouden Bocht
 * beyond Leidsegracht is the stretch sector and is deliberately outside this
 * ring.
 */
import { lngLatToRd, rdToLngLat, type LngLat, type RdPoint } from './rdNew.ts';

export interface CanalCentreline {
  name: string;
  points: LngLat[];
}

/** A leg of the boundary ring: a run of one canal between two named junctions. */
export interface BoundaryEdge {
  canal: string;
  /** Junction the leg starts at, or `null` for the canal's own end. */
  from: string | null;
  to: string | null;
  /**
   * How far outward, in metres from the canal centreline, the boundary is
   * pushed so that it intersects the far-bank building row.
   */
  outwardOffsetM: number;
  rationale: string;
}

/**
 * Offsets are measured against real canal cross-sections rather than picked.
 *
 * A Grachtengordel canal is roughly 25 m of water between quay faces, with a
 * quay of 12–15 m on each side before the building line. So the far-bank front
 * wall sits about 27 m from the centreline, and 45 m puts the boundary a
 * comfortable 18 m into a plot that is 30–55 m deep — past the front wall
 * everywhere, and nowhere near the row behind.
 *
 * The west edge is larger because the brief asks for Prinsengracht's west bank
 * *and* the first Jordaan row behind it: about 27 m to the Prinsengracht-facing
 * front wall, a block of 50–60 m, then into the next row.
 */
export const BOUNDARY_EDGES: readonly BoundaryEdge[] = [
  {
    canal: 'Brouwersgracht', from: 'Prinsengracht', to: 'Singel', outwardOffsetM: 42,
    rationale: 'North edge. Brouwersgracht is narrower than the main grachten, so 42 m still lands inside the north-bank warehouses without reaching Haarlemmerstraat.',
  },
  {
    canal: 'Singel', from: 'Brouwersgracht', to: null, outwardOffsetM: 45,
    rationale: 'East edge, from Brouwersgracht to the canal’s south end at Koningsplein. Both banks of Singel are in scope.',
  },
  {
    canal: 'Herengracht', from: 'Singel-south-end', to: 'Leidsegracht', outwardOffsetM: 45,
    rationale: 'South-east closure. Singel stops at Koningsplein while Leidsegracht starts at Herengracht, so Herengracht carries the corner between them.',
  },
  {
    canal: 'Leidsegracht', from: 'Herengracht', to: 'Prinsengracht', outwardOffsetM: 45,
    rationale: 'South edge. The Gouden Bocht continues south-east of here and is the stretch sector, not the core.',
  },
  {
    canal: 'Prinsengracht', from: 'Leidsegracht', to: 'Brouwersgracht', outwardOffsetM: 95,
    rationale: 'West edge. Wider than the rest because the brief includes the first Jordaan house row behind the Prinsengracht west bank: ~27 m to the front wall, a 50–60 m block, then into the next row.',
  },
] as const;

const EPSILON_M = 0.5;

const distance = (a: RdPoint, b: RdPoint) => Math.hypot(a.x - b.x, a.y - b.y);

/** Join OSM way fragments into maximal polylines by matching shared endpoints. */
export function chainWays(ways: LngLat[][]): LngLat[][] {
  const remaining = ways.map(way => way.map(lngLatToRd));
  const chains: RdPoint[][] = [];

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
  return chains.map(chain => chain.map(rdToLngLat));
}

/** The point where two canal centrelines meet, in RD metres. */
export function junction(a: RdPoint[], b: RdPoint[]): { point: RdPoint; gapM: number } {
  let best = { point: a[0], gapM: Infinity };
  for (const p of a) for (const q of b) {
    const gap = distance(p, q);
    if (gap < best.gapM) best = { point: p, gapM: gap };
  }
  return best;
}

const nearestIndex = (polyline: RdPoint[], target: RdPoint) =>
  polyline.reduce((best, point, index) => (distance(point, target) < distance(polyline[best], target) ? index : best), 0);

/**
 * The run of `polyline` between two points on it, in the direction from → to.
 *
 * A `null` end means "carry on to this canal's own end". Which end is not
 * decided by index position: these canals curve back on themselves, so a
 * junction can sit anywhere along the array. Take whichever side is longer,
 * which is the side that actually runs the length of the canal.
 */
export function clipBetween(polyline: RdPoint[], from: RdPoint | null, to: RdPoint | null): RdPoint[] {
  const start = from ? nearestIndex(polyline, from) : null;
  const end = to ? nearestIndex(polyline, to) : null;
  if (start === null && end === null) return polyline;

  const runLength = (run: RdPoint[]) => run.reduce((total, point, index) => (index ? total + distance(run[index - 1], point) : 0), 0);
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
export const signedAreaM2 = (ring: RdPoint[]) => {
  let total = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) total += ring[j].x * ring[i].y - ring[i].x * ring[j].y;
  return total / 2;
};

/**
 * Push each ring vertex outward by its own offset.
 *
 * Offsets differ per edge, so the per-vertex distance is carried alongside the
 * vertex and the miter is computed from the local segment normals. Corners
 * between edges of different offset therefore step rather than kink, which is
 * why `smoothOffsets` runs first.
 */
export function offsetOutward(ring: RdPoint[], offsetsM: number[]): RdPoint[] {
  const counterClockwise = signedAreaM2(ring) > 0;
  const count = ring.length;
  const result: RdPoint[] = [];

  for (let i = 0; i < count; i++) {
    const previous = ring[(i - 1 + count) % count];
    const next = ring[(i + 1) % count];
    const incoming = { x: ring[i].x - previous.x, y: ring[i].y - previous.y };
    const outgoing = { x: next.x - ring[i].x, y: next.y - ring[i].y };

    // Outward normal of a segment: right of travel for a counter-clockwise ring.
    const normalOf = (v: { x: number; y: number }) => {
      const length = Math.hypot(v.x, v.y) || 1;
      const sign = counterClockwise ? 1 : -1;
      return { x: (sign * v.y) / length, y: (-sign * v.x) / length };
    };
    const a = normalOf(incoming), b = normalOf(outgoing);
    const bisector = { x: a.x + b.x, y: a.y + b.y };
    const length = Math.hypot(bisector.x, bisector.y);
    // A near-reversal collapses the bisector; fall back to the outgoing normal.
    const unit = length < 1e-6 ? b : { x: bisector.x / length, y: bisector.y / length };
    // Miter length, clamped so a sharp corner cannot shoot off across the city.
    const miter = Math.min(1 / Math.max(0.35, (unit.x * b.x + unit.y * b.y)), 2.5);
    result.push({ x: ring[i].x + unit.x * offsetsM[i] * miter, y: ring[i].y + unit.y * offsetsM[i] * miter });
  }
  return result;
}

/**
 * Excise the loops an outward offset creates at a concave kink.
 *
 * Offsetting a polyline by more than the local radius of curvature makes the
 * offset cross itself, leaving a small inverted loop. Left in place those loops
 * flip the inside/outside test for every building near them, so they are cut
 * out: where two non-adjacent segments cross, the vertices between them are
 * replaced by the crossing point itself.
 */
export function removeSelfIntersections(ring: RdPoint[], maxPasses = 12): RdPoint[] {
  const intersect = (a: RdPoint, b: RdPoint, c: RdPoint, d: RdPoint): RdPoint | null => {
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
        // Keep the larger of the two arcs the crossing splits the ring into;
        // the smaller one is the spurious loop.
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

/**
 * Blend the per-vertex offsets across edge changes so the west edge's larger
 * offset ramps in over a corner rather than stepping and self-intersecting.
 */
export function smoothOffsets(ring: RdPoint[], offsetsM: number[], rampM = 60): number[] {
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

export interface PilotBoundary {
  /** The canal-centreline ring, before the outward offset. */
  centrelineRd: RdPoint[];
  /** The boundary proper: the centreline ring pushed out to the far building rows. */
  ringRd: RdPoint[];
  ringLngLat: LngLat[];
  areaKm2: number;
  centrelineAreaKm2: number;
  bboxLngLat: [west: number, south: number, east: number, north: number];
  edges: Array<{ edge: BoundaryEdge; vertexCount: number; lengthM: number }>;
  junctions: Array<{ name: string; lngLat: LngLat; gapM: number }>;
}

export function buildPilotBoundary(centrelines: CanalCentreline[]): PilotBoundary {
  const byCanal = new Map<string, RdPoint[]>();
  for (const canal of new Set(centrelines.map(c => c.name))) {
    const chains = chainWays(centrelines.filter(c => c.name === canal).map(c => c.points));
    const longest = chains.reduce((best, chain) => (chain.length > best.length ? chain : best), chains[0]);
    byCanal.set(canal, longest.map(lngLatToRd));
  }

  const junctions: PilotBoundary['junctions'] = [];
  const junctionPoint = (canal: string, other: string): RdPoint => {
    if (other === 'Singel-south-end') {
      const singel = byCanal.get('Singel')!;
      const end = singel.reduce((best, point) => (point.y < best.y ? point : best), singel[0]);
      const onHerengracht = byCanal.get(canal)![nearestIndex(byCanal.get(canal)!, end)];
      junctions.push({ name: `${canal} × Singel south end`, lngLat: rdToLngLat(onHerengracht), gapM: distance(end, onHerengracht) });
      return onHerengracht;
    }
    const found = junction(byCanal.get(canal)!, byCanal.get(other)!);
    junctions.push({ name: `${canal} × ${other}`, lngLat: rdToLngLat(found.point), gapM: found.gapM });
    return found.point;
  };

  const centrelineRd: RdPoint[] = [];
  const rawOffsets: number[] = [];
  const edges: PilotBoundary['edges'] = [];

  for (const edge of BOUNDARY_EDGES) {
    const polyline = byCanal.get(edge.canal);
    if (!polyline) throw new Error(`missing centreline for ${edge.canal}`);
    const from = edge.from ? junctionPoint(edge.canal, edge.from) : null;
    const to = edge.to ? junctionPoint(edge.canal, edge.to) : null;
    const leg = clipBetween(polyline, from, to);
    // Drop the shared junction vertex so consecutive legs do not duplicate it.
    const trimmed = centrelineRd.length && distance(centrelineRd[centrelineRd.length - 1], leg[0]) < EPSILON_M ? leg.slice(1) : leg;
    let lengthM = 0;
    for (let i = 1; i < trimmed.length; i++) lengthM += distance(trimmed[i - 1], trimmed[i]);
    centrelineRd.push(...trimmed);
    rawOffsets.push(...trimmed.map(() => edge.outwardOffsetM));
    edges.push({ edge, vertexCount: trimmed.length, lengthM });
  }

  const ringRd = removeSelfIntersections(offsetOutward(centrelineRd, smoothOffsets(centrelineRd, rawOffsets)));
  const ringLngLat = ringRd.map(rdToLngLat);
  const longitudes = ringLngLat.map(p => p[0]), latitudes = ringLngLat.map(p => p[1]);

  return {
    centrelineRd,
    ringRd,
    ringLngLat,
    areaKm2: Math.abs(signedAreaM2(ringRd)) / 1e6,
    centrelineAreaKm2: Math.abs(signedAreaM2(centrelineRd)) / 1e6,
    bboxLngLat: [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)],
    edges,
    junctions,
  };
}

/** Ray-cast point-in-ring test, in RD metres. */
export function containsRd(ring: RdPoint[], point: RdPoint): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const { x: xi, y: yi } = ring[i], { x: xj, y: yj } = ring[j];
    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when any part of a footprint ring falls inside the boundary. */
export function intersectsBoundary(boundary: RdPoint[], footprint: RdPoint[]): boolean {
  if (footprint.some(point => containsRd(boundary, point))) return true;
  if (boundary.some(point => containsRd(footprint, point))) return true;
  const crosses = (a: RdPoint, b: RdPoint, c: RdPoint, d: RdPoint) => {
    const side = (p: RdPoint, q: RdPoint, r: RdPoint) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    return side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b);
  };
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++)
    for (let k = 0, l = footprint.length - 1; k < footprint.length; l = k++)
      if (crosses(boundary[j], boundary[i], footprint[l], footprint[k])) return true;
  return false;
}
