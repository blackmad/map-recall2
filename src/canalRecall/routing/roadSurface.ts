/**
 * What the car is standing on, which road it is on, and which OSM ways are one
 * street.
 *
 * These are the decisions `road-network.js` used to make inline: whether a
 * position counts as road, curb or off-road; which of several overlapping
 * centrelines the player is actually driving along at a junction; and which
 * same-name OSM ways form one continuous named feature. All three are about
 * imperfect OSM topology and all three are tuned by measured tolerances, so
 * they belong somewhere they can be tested against real geometry rather than
 * inside a method that also walks a spatial grid.
 *
 * The grid itself lives here too, because the tolerances and the cell size are
 * one decision: a query ring that is too small for the cell silently stops
 * finding roads it should.
 */

import { finishBatchedBuild, type BuildScheduling } from '../buildScheduling.ts';
// Open squares are part of the rideable surface (road-network.js getGuardRoad).
export { buildPlazaIndex, plazaAt, plazaGuardContact, plazaSurface } from './pedestrianAreas.ts';

export interface RoadPoint { x: number; y: number }

/** One OSM way as the game holds it: a centreline and a half-width. */
export interface RoadSegmentLike {
  points: RoadPoint[];
  width: number;
  name?: string;
}

/** A centreline span, indexed by the cell(s) it passes through. */
export interface RoadSpan {
  a: RoadPoint;
  b: RoadPoint;
  segIdx: number;
  ptIdx: number;
  width: number;
}

/**
 * Spans bucketed by the cells they can be queried from, packed (#130): the buckets as one Int32 list of span ids
 * per cell (`ids[offsets[c] .. offsets[c+1])`, cells by sorted numeric key) and every span as its way index and
 * point index, its end points read from the ways it was built from. The Map of per-cell `RoadSpan` arrays was
 * 22.9 MB on the ride-start heap (136,000 cells, 967,000 bucket entries, 167,000 spans); this is about 7.
 * `roadsNear` gives the same spans in the same order, one object per span made on first use and reused.
 */
export interface RoadSpatialIndex {
  cellSize: number;
  /** Sorted numeric cell keys (see `cellKey`), one per non-empty cell. */
  keys: Float64Array;
  /** Cell c's span ids are `ids[offsets[c] .. offsets[c + 1])`, in insertion order. */
  offsets: Int32Array;
  ids: Int32Array;
  /** Cells whose key fell back to a string (out of range): their span ids. */
  stringCells: Map<string, Int32Array>;
  /** Span id → way index; point index, or −1 − k for connector k. */
  spanSeg: Int32Array;
  spanPt: Int32Array;
  /** Each way's half-width when the index was built. */
  widths: Float64Array;
  segments: readonly RoadSegmentLike[];
  connectors: ReadonlyArray<Readonly<{ a: RoadPoint; b: RoadPoint; segmentIndex: number }>>;
  /** Span objects made so far (sparse). */
  spanCache: (RoadSpan | undefined)[];
}

/** px — the grid cell, matching `ROAD_GRID_CELL` in constants.js. */
export const ROAD_GRID_CELL = 100;

/**
 * px — how far outside a way's half-width still counts as its curb.
 *
 * Asphalt stops slightly inside the drawn edge and curb extends slightly
 * outside it, so the band the player feels lines up with the band they see
 * rather than with the exact polygon boundary.
 */
export const CURB_INNER_MARGIN = 6;
export const CURB_OUTER_MARGIN = 2;

/** px — endpoint clustering for "these two OSM ways are the same street". */
export const NAME_MERGE_SIZE = 18;

export type Surface = 'asphalt' | 'curb' | 'grass';

/**
 * Integer cell coordinates as one exact number key, as in `roadGraph.ts`: a
 * `"gx,gy"` string per cell cost a string per bucket insert (141,000 cells,
 * ~400,000 inserts at ride start) and nine to eighty-one strings per surface
 * query every frame (#136). Out of range (or NaN) falls back to the string.
 */
const CELL_LIMIT = 2 ** 25;
const cellKey = (gx: number, gy: number): number | string =>
  Math.abs(gx) < CELL_LIMIT && Math.abs(gy) < CELL_LIMIT ? (gx + CELL_LIMIT) * 2 ** 26 + (gy + CELL_LIMIT) : `${gx},${gy}`;

/** Squared length is enough wherever only ordering matters. */
function closestPointOnSpan(px: number, py: number, a: RoadPoint, b: RoadPoint) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) return { x: a.x, y: a.y, dist: Math.hypot(px - a.x, py - a.y) };
  const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / lengthSquared));
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  return { x: cx, y: cy, dist: Math.hypot(px - cx, py - cy) };
}

/**
 * Index every centreline span by the cells it can be queried from.
 *
 * A span is padded by its own width before being bucketed, so a query at the
 * far edge of a wide road still finds it from the cell it is standing in
 * rather than needing a wider query ring.
 */
function* roadSurfaceStages(
  segments: readonly RoadSegmentLike[],
  cellSize: number = ROAD_GRID_CELL,
  connectors: ReadonlyArray<Readonly<{ a: RoadPoint; b: RoadPoint; segmentIndex: number }>> = [],
): Generator<void, RoadSpatialIndex> {
  // Growable (key, span id) pairs in insertion order; string keys apart.
  let pairKeys = new Float64Array(1 << 16), pairIds = new Int32Array(1 << 16), pairs = 0;
  const stringBuckets = new Map<string, number[]>();
  const spanSegList: number[] = [], spanPtList: number[] = [];
  const add = (a: RoadPoint, b: RoadPoint, segIdx: number, ptCode: number, width: number) => {
    const id = spanSegList.length;
    spanSegList.push(segIdx); spanPtList.push(ptCode);
    const pad = width + 10;
    const gx0 = Math.floor((Math.min(a.x, b.x) - pad) / cellSize);
    const gx1 = Math.floor((Math.max(a.x, b.x) + pad) / cellSize);
    const gy0 = Math.floor((Math.min(a.y, b.y) - pad) / cellSize);
    const gy1 = Math.floor((Math.max(a.y, b.y) + pad) / cellSize);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const key = cellKey(gx, gy);
        if (typeof key === 'string') {
          const bucket = stringBuckets.get(key);
          if (bucket) bucket.push(id); else stringBuckets.set(key, [id]);
          continue;
        }
        if (pairs === pairKeys.length) {
          const k = new Float64Array(pairs * 2); k.set(pairKeys); pairKeys = k;
          const i = new Int32Array(pairs * 2); i.set(pairIds); pairIds = i;
        }
        pairKeys[pairs] = key; pairIds[pairs] = id; pairs++;
      }
    }
  };
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    if (segIdx % 32 === 0) yield;
    const segment = segments[segIdx];
    for (let ptIdx = 0; ptIdx < segment.points.length - 1; ptIdx++) {
      add(segment.points[ptIdx], segment.points[ptIdx + 1], segIdx, ptIdx, segment.width);
    }
  }
  // The routing graph joins ways whose ends are a few metres apart (merged
  // vertices, stitched T-junctions). Without a span across each gap the router
  // planned a crossing the road guard then refused: a bike at the end of a
  // bridge way sat on the shoulder, pulled back toward the last vertex, with
  // the next street's corridor out of reach (bridge sweep, 2026-09-30). A
  // connector carries its way's index and width, and `ptIdx` -1.
  for (let i = 0; i < connectors.length; i++) {
    if (i % 64 === 0) yield;
    const connector = connectors[i];
    const segment = segments[connector.segmentIndex];
    if (!segment) continue;
    add(connector.a, connector.b, connector.segmentIndex, -1 - i, segment.width);
  }
  // Cells by key; each cell's ids in insertion order (a stable counting sort).
  yield;
  const cellOf = new Map<number, number>();
  const counts: number[] = [];
  for (let p = 0; p < pairs; p++) {
    const c = cellOf.get(pairKeys[p]);
    if (c === undefined) { cellOf.set(pairKeys[p], counts.length); counts.push(1); } else counts[c]++;
    if ((p & 0xffff) === 0xffff) yield;
  }
  const order = Float64Array.from(cellOf.keys()).sort();
  const keys = order, offsets = new Int32Array(keys.length + 1), slot = new Int32Array(counts.length);
  for (let c = 0; c < keys.length; c++) {
    const first = cellOf.get(keys[c])!;
    offsets[c + 1] = offsets[c] + counts[first];
    slot[first] = offsets[c];
  }
  yield;
  const ids = new Int32Array(pairs);
  for (let p = 0; p < pairs; p++) {
    ids[slot[cellOf.get(pairKeys[p])!]++] = pairIds[p];
    if ((p & 0xffff) === 0xffff) yield;
  }
  const stringCells = new Map<string, Int32Array>();
  for (const [key, list] of stringBuckets) stringCells.set(key, Int32Array.from(list));
  const widths = new Float64Array(segments.length);
  for (let i = 0; i < segments.length; i++) widths[i] = segments[i].width;
  return {
    cellSize, keys, offsets, ids, stringCells,
    spanSeg: Int32Array.from(spanSegList), spanPt: Int32Array.from(spanPtList), widths,
    segments, connectors, spanCache: new Array(spanSegList.length),
  };
}

/** Span `id` of a packed index, made once and reused. */
function spanOf(index: RoadSpatialIndex, id: number): RoadSpan {
  const cached = index.spanCache[id];
  if (cached) return cached;
  const segIdx = index.spanSeg[id], code = index.spanPt[id], width = index.widths[segIdx];
  let span: RoadSpan;
  if (code >= 0) {
    const points = index.segments[segIdx].points;
    span = { a: points[code], b: points[code + 1], segIdx, ptIdx: code, width };
  } else {
    const connector = index.connectors[-1 - code];
    span = { a: connector.a, b: connector.b, segIdx, ptIdx: -1, width };
  }
  index.spanCache[id] = span;
  return span;
}

/** The cell with numeric key `key`, or −1. */
function cellIndex(keys: Float64Array, key: number): number {
  let lo = 0, hi = keys.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1, k = keys[mid];
    if (k < key) lo = mid + 1; else if (k > key) hi = mid - 1; else return mid;
  }
  return -1;
}

export function buildRoadSpatialIndex(segments: readonly RoadSegmentLike[], cellSize = ROAD_GRID_CELL, connectors: ReadonlyArray<Readonly<{ a: RoadPoint; b: RoadPoint; segmentIndex: number }>> = []): RoadSpatialIndex {
  const stages = roadSurfaceStages(segments, cellSize, connectors);
  let step = stages.next();
  while (!step.done) step = stages.next();
  return step.value;
}

export async function buildRoadSpatialIndexAsync(segments: readonly RoadSegmentLike[], cellSize = ROAD_GRID_CELL, connectors: ReadonlyArray<Readonly<{ a: RoadPoint; b: RoadPoint; segmentIndex: number }>> = [], scheduling: BuildScheduling = {}): Promise<RoadSpatialIndex> {
  return finishBatchedBuild(roadSurfaceStages(segments, cellSize, connectors), scheduling);
}

/** Spans in the (2·ring+1)² cell neighbourhood around a point. */
export function roadsNear(
  index: RoadSpatialIndex,
  x: number,
  y: number,
  ring = 1,
): RoadSpan[] {
  const gx = Math.floor(x / index.cellSize);
  const gy = Math.floor(y / index.cellSize);
  const found: RoadSpan[] = [];
  for (let dx = -ring; dx <= ring; dx++) {
    for (let dy = -ring; dy <= ring; dy++) {
      const key = cellKey(gx + dx, gy + dy);
      if (typeof key === 'string') {
        const list = index.stringCells.get(key);
        if (list) for (let i = 0; i < list.length; i++) found.push(spanOf(index, list[i]));
        continue;
      }
      const c = cellIndex(index.keys, key);
      if (c < 0) continue;
      for (let i = index.offsets[c], end = index.offsets[c + 1]; i < end; i++) found.push(spanOf(index, index.ids[i]));
    }
  }
  return found;
}

/**
 * Road, curb, or off it, from the distance to the nearest centreline and that
 * road's half-width.
 *
 * Nothing nearby at all is grass: a position off the edge of the network is
 * off-road, not on a road of unknown width.
 */
export function classifySurface(distance: number, width: number): Surface {
  if (!Number.isFinite(distance)) return 'grass';
  if (distance < width - CURB_INNER_MARGIN) return 'asphalt';
  if (distance < width + CURB_OUTER_MARGIN) return 'curb';
  return 'grass';
}

/** A candidate road under a query point, with the tangent along it. */
export interface RoadContact {
  x: number;
  y: number;
  dist: number;
  angle: number;
  width: number;
  segIdx: number;
  ptIdx: number;
  /** Unit normal, for placing things beside the road. */
  nx: number;
  ny: number;
  /** Span length, and how far along it (from the start, in the direction of
   *  `angle`) the contact point lies — so street following can tell a way on
   *  from the end of a span. */
  length?: number;
  along?: number;
}

export function contactsAt(spans: readonly RoadSpan[], x: number, y: number): RoadContact[] {
  const contacts: RoadContact[] = [];
  for (const span of spans) {
    const hit = closestPointOnSpan(x, y, span.a, span.b);
    const rdx = span.b.x - span.a.x;
    const rdy = span.b.y - span.a.y;
    const length = Math.hypot(rdx, rdy) || 1;
    contacts.push({
      x: hit.x,
      y: hit.y,
      dist: hit.dist,
      angle: Math.atan2(rdy, rdx),
      width: span.width,
      segIdx: span.segIdx,
      ptIdx: span.ptIdx,
      nx: -rdy / length,
      ny: rdx / length,
      length,
      along: Math.hypot(hit.x - span.a.x, hit.y - span.a.y),
    });
  }
  return contacts;
}

/** px — how much further than the nearest road a contact may be and still be
 *  considered the one the player is on. */
export const ALIGNMENT_DISTANCE_SLACK = 10;
/** px — and how far outside that road's own width. */
export const ALIGNMENT_WIDTH_SLACK = 12;

/**
 * Undirected angular difference, so a way digitised in the opposite direction
 * to the one the player is travelling still counts as the same alignment.
 */
export function headingDifference(angle: number, preferred: number): number {
  const delta = Math.abs(Math.atan2(Math.sin(angle - preferred), Math.cos(angle - preferred)));
  return Math.min(delta, Math.PI - delta);
}

/**
 * Which road the player is actually on, when several overlap.
 *
 * At a junction the geometrically nearest centreline is often the cross street,
 * because the player is a metre past its centre while driving straight through.
 * Naming that street would teach the wrong answer, so among the roads that are
 * near enough to be plausible, the one whose heading matches the player's wins,
 * and distance only breaks ties.
 *
 * With no heading to go on — a click on the map rather than a car in motion —
 * this is just the nearest road.
 */
export function pickRoadContact(
  contacts: readonly RoadContact[],
  preferredAngle: number | null = null,
): RoadContact | null {
  let nearest: RoadContact | null = null;
  for (const contact of contacts) {
    if (!nearest || contact.dist < nearest.dist) nearest = contact;
  }
  if (preferredAngle == null || !nearest) return nearest;

  const plausible = contacts.filter((contact) =>
    contact.dist <= nearest!.dist + ALIGNMENT_DISTANCE_SLACK
    && contact.dist <= contact.width + ALIGNMENT_WIDTH_SLACK);
  let aligned: RoadContact | null = null;
  for (const contact of plausible) {
    if (!aligned) { aligned = contact; continue; }
    const delta = headingDifference(contact.angle, preferredAngle)
      - headingDifference(aligned.angle, preferredAngle);
    if (delta < 0 || (delta === 0 && contact.dist < aligned.dist)) aligned = contact;
  }
  return aligned ?? nearest;
}

/**
 * The contact the road guard should judge the vehicle against.
 *
 * Naming prefers the road whose heading matches the rider (`pickRoadContact`),
 * but containment must not: turning off Marnixstraat into Westerkade at the
 * Bullebakssluis, the heading pick stayed on Marnixstraat while the bike sat
 * on Westerkade's centreline, so every step into the turn read as leaving the
 * road and the guard wedged the bike past the junction (user report
 * 2026-09-28). And not only past the rollback line: on the soft shoulder
 * the guard pulls toward the heading road and turns the bike along it, which
 * undid the turn every frame. So once the vehicle is off the heading road's
 * asphalt, a cross street (more than `GUARD_CROSS_ANGLE` off it) that fully
 * contains the vehicle wins. Since 2026-10-01 any containing corridor wins
 * (see `pickGuardContact`); the angle still separates cross streets in the
 * corner fillet.
 */
export const GUARD_CROSS_ANGLE = Math.PI / 6;

/**
 * World units (12 m) of fillet on the inside of a corner. Road corridors are
 * straight bands, so where two meet the union has a square inside corner and a
 * rider cutting the corner diagonally hit the rollback ("we should be able to
 * cut corners a bit more", Oosterdokskade by LOT 61, 2026-09-28). With the
 * fillet a diagonal line reaches about 3.5 m past both edges.
 */
export const CORNER_FILLET_RADIUS = 36;

/**
 * How far outside the asphalt (x, y) is once the inside corners of the network
 * are filleted: at most the plain distance past the nearest road's edge, less
 * wherever the point sits in the inside corner of two roads that meet or cross
 * at more than `GUARD_CROSS_ANGLE`.
 *
 * "Inside" means both roads' nearest points are perpendicular projections,
 * not an end vertex: the outer corner of an L is usually a building and stays
 * where it was. The fillet is an arc in edge-distance space: with eA and eB
 * the distances past each road's edge, points with hypot(r − eA, r − eB) ≥ r
 * are on the asphalt.
 */
/** The contact is a perpendicular projection onto its span, not an end vertex. */
function perpendicularContact(contact: RoadContact, x: number, y: number): boolean {
  const along = Math.abs((x - contact.x) * contact.ny - (y - contact.y) * contact.nx);
  return along <= 0.2 * contact.dist + 0.5;
}

export function filletedExcess(
  contacts: readonly RoadContact[],
  x: number,
  y: number,
  radius: number = CORNER_FILLET_RADIUS,
): number {
  return filletedEdge(contacts, x, y, radius).excess;
}

/**
 * `filletedExcess`, plus the outward direction at (x, y): for a point in a
 * fillet, the gradient of the arc, (r − eA)·ûA + (r − eB)·ûB normalised, with
 * û the unit vector from each road's nearest point out to (x, y). `null`
 * where no fillet applies.
 */
function filletedEdge(
  contacts: readonly RoadContact[],
  x: number,
  y: number,
  radius: number,
): { excess: number; outward: { x: number; y: number } | null } {
  let best = Infinity;
  let outward: { x: number; y: number } | null = null;
  for (const contact of contacts) best = Math.min(best, contact.dist - contact.width);
  if (best <= 0) return { excess: best, outward };
  const perpendicular = (contact: RoadContact) => perpendicularContact(contact, x, y);
  const inCorner = contacts.filter(contact => {
    const excess = contact.dist - contact.width;
    return excess > 0 && excess <= radius && perpendicular(contact);
  });
  for (let i = 0; i < inCorner.length; i++) {
    for (let j = i + 1; j < inCorner.length; j++) {
      const a = inCorner[i], b = inCorner[j];
      if (headingDifference(a.angle, b.angle) <= GUARD_CROSS_ANGLE) continue;
      const ea = a.dist - a.width, eb = b.dist - b.width;
      const excess = radius - Math.hypot(radius - ea, radius - eb);
      if (excess >= best) continue;
      best = excess;
      const ox = (radius - ea) * (x - a.x) / (a.dist || 1) + (radius - eb) * (x - b.x) / (b.dist || 1);
      const oy = (radius - ea) * (y - a.y) / (a.dist || 1) + (radius - eb) * (y - b.y) / (b.dist || 1);
      const length = Math.hypot(ox, oy) || 1;
      outward = { x: ox / length, y: oy / length };
    }
  }
  return { excess: best, outward };
}

export function pickGuardContact(
  contacts: readonly RoadContact[],
  preferredAngle: number | null = null,
  point: RoadPoint | null = null,
): RoadContact | null {
  // The drivable surface is the union of every corridor, and the guard judges
  // the vehicle against that union, not against one road. Heading only decides
  // which road to report (its angle steers the slide and the shoulder ease).
  // Judging containment against a single heading-picked road was the cause of
  // every bridge trap fixed one by one through September 2026: where a bridge
  // way ends and the street continues as another way, at a cross street, or
  // beside a same-name duplicate, the bike sat on asphalt and was "off" the
  // road the heuristic had picked (bridge sweep, 2026-10-01: 37 wedges in 6
  // drives once the sweep drove every connected bridge).
  const containing = contacts.filter(contact => contact.dist <= contact.width);
  if (containing.length) return pickRoadContact(containing, preferredAngle);
  if (!contacts.length) return null;
  // Outside every corridor: the road the vehicle is least outside of, so the
  // shoulder pull points at the nearest asphalt. Ties keep the heading pick.
  const aligned = pickRoadContact(contacts, preferredAngle)!;
  let chosen = aligned;
  for (const contact of contacts) {
    if (contact.dist - contact.width < chosen.dist - chosen.width - 0.25) chosen = contact;
  }
  if (point) {
    // Inside a corner: report the filleted edge distance, so the guard treats
    // the cut corner as asphalt (or as a shallower shoulder). The contact's
    // point moves onto the arc's inward normal, because the guard pulls toward
    // it and the raw nearest point lies across the corner (bridge sweep,
    // 2026-10-01: Kortrijk, IJdoornlaan, Pracanalaan).
    const { excess, outward } = filletedEdge(contacts, point.x, point.y, CORNER_FILLET_RADIUS);
    if (excess < chosen.dist - chosen.width) {
      const dist = chosen.width + Math.max(0, excess);
      if (!outward || excess <= 0) return { ...chosen, dist };
      return { ...chosen, dist, x: point.x - outward.x * dist, y: point.y - outward.y * dist };
    }
  }
  return chosen;
}

/**
 * Prefer a named corridor (transit leg) when its centreline is nearby.
 * Falls back to ordinary heading pick only when that corridor is absent from
 * the contact set — never steals a far-away preferred line over a near one.
 */
export function pickRoadContactPreferName(
  contacts: readonly RoadContact[],
  segmentNameAt: (segIdx: number) => string,
  preferredName: string,
  preferredAngle: number | null = null,
  maxPreferDist = 90,
): RoadContact | null {
  const named = contacts.filter((contact) =>
    segmentNameAt(contact.segIdx) === preferredName
    && contact.dist <= maxPreferDist);
  if (named.length) return pickRoadContact(named, preferredAngle);
  return pickRoadContact(contacts, preferredAngle);
}

/**
 * The closest centreline carrying a known name.
 *
 * Route-name detection needs heading to avoid adopting a cross street at a
 * junction. Once that name has settled, however, the highlight seed should be
 * the same-name span directly under the player. Reapplying the heading rule can
 * pick a parallel, slightly straighter span at a bend and draw the answer along
 * the edge of the visible road instead of its centre.
 */
export function pickNearestRoadContactForName(
  contacts: readonly RoadContact[],
  segmentNameAt: (segIdx: number) => string,
  name: string,
): RoadContact | null {
  let nearest: RoadContact | null = null;
  for (const contact of contacts) {
    if (segmentNameAt(contact.segIdx) !== name) continue;
    if (!nearest || contact.dist < nearest.dist) nearest = contact;
  }
  return nearest;
}

/** px — how far from a road's centreline its name still applies. */
export const NAME_WIDTH_SLACK = 20;

/** The name of the road under a contact, or '' when it is too far to claim. */
export function roadNameAt(
  segments: readonly RoadSegmentLike[],
  contact: RoadContact | null,
): string {
  if (!contact || contact.dist > contact.width + NAME_WIDTH_SLACK) return '';
  return segments[contact.segIdx]?.name || '';
}

/**
 * The connected run of same-name ways containing `seedIndex`.
 *
 * OSM splits one canal or street at bridges, tag boundaries and administrative
 * edges, so one thing the player sees as a single feature is commonly several
 * source ways. They are joined only where their endpoints actually meet —
 * clustered to `mergeSize` for the rounding two ways store the same node with —
 * because two unrelated stretches of "Prinsengracht" on opposite sides of the
 * city share a name but are not one run, and treating them as one draws a
 * chord across the map.
 *
 * Returns the segments themselves, seed first, in breadth-first order.
 */
export function connectedNamedSegments<T extends RoadSegmentLike>(
  segments: readonly T[],
  seedIndex: number,
  mergeSize: number = NAME_MERGE_SIZE,
): T[] {
  const seed = segments[seedIndex];
  if (!seed || !seed.name) return [];

  const endpointCells = (segment: RoadSegmentLike): string[] => {
    const points = segment.points || [];
    if (!points.length) return [];
    const key = (point: RoadPoint) =>
      `${Math.round(point.x / mergeSize)},${Math.round(point.y / mergeSize)}`;
    return [key(points[0]), key(points[points.length - 1])];
  };

  const buckets = new Map<string, number[]>();
  for (let index = 0; index < segments.length; index++) {
    if (segments[index].name !== seed.name) continue;
    for (const key of endpointCells(segments[index])) {
      const bucket = buckets.get(key);
      if (bucket) bucket.push(index);
      else buckets.set(key, [index]);
    }
  }

  const connected: T[] = [];
  const seen = new Set([seedIndex]);
  const queue = [seedIndex];
  while (queue.length) {
    const index = queue.shift()!;
    connected.push(segments[index]);
    for (const key of endpointCells(segments[index])) {
      const [cx, cy] = key.split(',').map(Number);
      // The neighbourhood, not just the cell: two endpoints a millimetre apart
      // can still round into adjacent cells.
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const neighbour of buckets.get(`${cx + dx},${cy + dy}`) || []) {
            if (seen.has(neighbour)) continue;
            seen.add(neighbour);
            queue.push(neighbour);
          }
        }
      }
    }
  }
  return connected;
}
