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

export interface RoadSpatialIndex {
  cellSize: number;
  cells: Map<string, RoadSpan[]>;
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

const cellKey = (gx: number, gy: number) => `${gx},${gy}`;

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
export function buildRoadSpatialIndex(
  segments: readonly RoadSegmentLike[],
  cellSize: number = ROAD_GRID_CELL,
): RoadSpatialIndex {
  const cells = new Map<string, RoadSpan[]>();
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const segment = segments[segIdx];
    const width = segment.width;
    for (let ptIdx = 0; ptIdx < segment.points.length - 1; ptIdx++) {
      const a = segment.points[ptIdx];
      const b = segment.points[ptIdx + 1];
      const pad = width + 10;
      const gx0 = Math.floor((Math.min(a.x, b.x) - pad) / cellSize);
      const gx1 = Math.floor((Math.max(a.x, b.x) + pad) / cellSize);
      const gy0 = Math.floor((Math.min(a.y, b.y) - pad) / cellSize);
      const gy1 = Math.floor((Math.max(a.y, b.y) + pad) / cellSize);
      const span: RoadSpan = { a, b, segIdx, ptIdx, width };
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gy = gy0; gy <= gy1; gy++) {
          const key = cellKey(gx, gy);
          const bucket = cells.get(key);
          if (bucket) bucket.push(span);
          else cells.set(key, [span]);
        }
      }
    }
  }
  return { cellSize, cells };
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
      const bucket = index.cells.get(cellKey(gx + dx, gy + dy));
      if (bucket) found.push(...bucket);
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
