/**
 * Pole of inaccessibility for label placement (the "polylabel" algorithm,
 * Mapbox 2016): the point inside a polygon farthest from its edges. A bounding
 * box centre can fall outside a non-convex area — the Grachtengordel horseshoe's
 * lands on the Dam — and this point never does.
 *
 * Input is `[lat, lon]` rings, as `StreetFeature.areaGeometry` stores them:
 * `multipolygon[polygon][ring][vertex]`, first ring outer, the rest holes.
 * Work is done in a local equirectangular plane (lon scaled by cos(lat)) so
 * "farthest" means metres, not degrees.
 */
export type LatLon = [number, number];
export type MultiPolygon = LatLon[][][];

const METRES_PER_DEGREE_LAT = 111_320;

interface Cell {
  x: number;
  y: number;
  /** Half the cell size. */
  h: number;
  /** Signed distance from the centre to the polygon outline (positive inside). */
  d: number;
  /** Upper bound of the distance anywhere inside this cell. */
  max: number;
}

type Ring = Array<[number, number]>;

/** Point of the multipolygon farthest from any edge, within `precisionMetres`. */
export function polygonLabelPoint(geometry: MultiPolygon, precisionMetres = 1): LatLon | null {
  const polygons = geometry.filter((polygon) => polygon.length && polygon[0].length >= 3);
  if (!polygons.length) return null;

  let latSum = 0;
  let latCount = 0;
  for (const polygon of polygons) for (const [lat] of polygon[0]) { latSum += lat; latCount++; }
  const lat0 = latSum / latCount;
  const kx = Math.cos((lat0 * Math.PI) / 180) * METRES_PER_DEGREE_LAT;
  const ky = METRES_PER_DEGREE_LAT;

  // Planar metres: x east, y north.
  const planar: Ring[][] = polygons.map((polygon) => polygon.map((ring) => ring.map(([lat, lon]) => [lon * kx, lat * ky] as [number, number])));

  let best: [number, number] | null = null;
  let bestDistance = -Infinity;
  // Each polygon in turn; the best of them wins. Distances to other polygons'
  // edges do not matter for a point inside this one (multipolygon parts do not overlap).
  for (const rings of planar) {
    const result = poleOfInaccessibility(rings, precisionMetres);
    if (result.d > bestDistance) { bestDistance = result.d; best = [result.x, result.y]; }
  }
  if (!best) return null;
  return [best[1] / ky, best[0] / kx];
}

function poleOfInaccessibility(rings: Ring[], precision: number): { x: number; y: number; d: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of rings[0]) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  if (cellSize === 0) return { x: minX, y: minY, d: 0 };
  let h = cellSize / 2;

  const queue = new MaxHeap<Cell>((a, b) => a.max - b.max);
  const makeCell = (x: number, y: number, half: number): Cell => {
    const d = signedDistance(x, y, rings);
    return { x, y, h: half, d, max: d + half * Math.SQRT2 };
  };

  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) queue.push(makeCell(x + h, y + h, h));
  }

  // First guesses: the area centroid and the bbox centre.
  let best = centroidCell(rings, makeCell);
  const bboxCell = makeCell(minX + width / 2, minY + height / 2, 0);
  if (bboxCell.d > best.d) best = bboxCell;

  while (queue.size) {
    const cell = queue.pop()!;
    if (cell.d > best.d) best = cell;
    if (cell.max - best.d <= precision) continue;
    h = cell.h / 2;
    queue.push(makeCell(cell.x - h, cell.y - h, h));
    queue.push(makeCell(cell.x + h, cell.y - h, h));
    queue.push(makeCell(cell.x - h, cell.y + h, h));
    queue.push(makeCell(cell.x + h, cell.y + h, h));
  }
  return { x: best.x, y: best.y, d: best.d };
}

function centroidCell(rings: Ring[], makeCell: (x: number, y: number, h: number) => Cell): Cell {
  const ring = rings[0];
  let area = 0, x = 0, y = 0;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[j];
    const f = ax * by - bx * ay;
    x += (ax + bx) * f;
    y += (ay + by) * f;
    area += f * 3;
  }
  if (area === 0) return makeCell(ring[0][0], ring[0][1], 0);
  return makeCell(x / area, y / area, 0);
}

/** Distance from the point to the nearest ring edge; negative outside the polygon (holes count as outside). */
function signedDistance(x: number, y: number, rings: Ring[]): number {
  let inside = false;
  let minSq = Infinity;
  for (const ring of rings) {
    for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
      minSq = Math.min(minSq, segmentDistanceSq(x, y, a, b));
    }
  }
  return minSq === Infinity ? 0 : (inside ? 1 : -1) * Math.sqrt(minSq);
}

function segmentDistanceSq(px: number, py: number, a: [number, number], b: [number, number]): number {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = px - x;
  dy = py - y;
  return dx * dx + dy * dy;
}

/** Even-odd test of a `[lat, lon]` point against a multipolygon with holes. */
export function pointInMultiPolygon(point: LatLon, geometry: MultiPolygon): boolean {
  const [lat, lon] = point;
  for (const polygon of geometry) {
    let inside = false;
    for (const ring of polygon) {
      for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
        const [aLat, aLon] = ring[i];
        const [bLat, bLon] = ring[j];
        if ((aLat > lat) !== (bLat > lat) && lon < ((bLon - aLon) * (lat - aLat)) / (bLat - aLat) + aLon) inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

class MaxHeap<T> {
  private items: T[] = [];
  constructor(private readonly compare: (a: T, b: T) => number) {}
  get size() { return this.items.length; }
  push(item: T) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(items[i], items[parent]) <= 0) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }
  pop(): T | undefined {
    const items = this.items;
    if (!items.length) return undefined;
    const top = items[0];
    const last = items.pop()!;
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let largest = i;
        if (left < items.length && this.compare(items[left], items[largest]) > 0) largest = left;
        if (right < items.length && this.compare(items[right], items[largest]) > 0) largest = right;
        if (largest === i) break;
        [items[i], items[largest]] = [items[largest], items[i]];
        i = largest;
      }
    }
    return top;
  }
}
