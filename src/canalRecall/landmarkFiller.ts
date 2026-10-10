/**
 * Grid geometry and named regressions for the landmark-filler audit
 * (`scripts/audit-landmark-filler.ts`): generic city-tile buildings that a
 * landmark model hides without drawing, or that sit inside / against one.
 *
 * Everything is measured on one shared 0.5 m grid in a local equirectangular
 * frame around central Amsterdam, so model triangles and tile footprints from
 * different places land in the same cells.
 */

export type Ring = number[][];

/** Grid cell size in metres. */
export const CELL = 0.5;
const LON0 = 4.9, LAT0 = 52.37;
const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KY = 111320;
const OFFSET = 500000, STRIDE = 1e6;

/** lng/lat → local metres east/north of the grid origin. */
export const toLocal = (lng: number, lat: number): [number, number] => [(lng - LON0) * KX, (lat - LAT0) * KY];

/** Integer cell indices → one safe-integer key; neighbours differ by ±1 (north) and ±1e6 (east). */
export const cellKey = (ix: number, iy: number): number => (ix + OFFSET) * STRIDE + (iy + OFFSET);
export const cellOf = (key: number): [number, number] => [Math.floor(key / STRIDE) - OFFSET, (key % STRIDE) - OFFSET];

const inRing = (x: number, y: number, ring: Ring): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Keys of cells whose centre lies inside a polygon (outer ring + holes) given in local metres. */
export function cellsOfPolygon(rings: Ring[]): number[] {
  const outer = rings[0];
  if (!outer || outer.length < 3) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const out: number[] = [];
  for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++) {
    const x = (ix + 0.5) * CELL;
    for (let iy = Math.floor(minY / CELL); iy <= Math.floor(maxY / CELL); iy++) {
      const y = (iy + 0.5) * CELL;
      if (inRing(x, y, outer) && !rings.slice(1).some(h => inRing(x, y, h))) out.push(cellKey(ix, iy));
    }
  }
  return out;
}

/**
 * Marks the plan projection of one triangle ([x, y, elevation] × 3, local metres)
 * in `occ`, keeping each cell's highest elevation. Vertical faces (walls) have
 * no plan area, so their edges are sampled too: an open-top wall still counts.
 */
export function markTriangle(p: number[], occ: Map<number, number>): void {
  const h = Math.max(p[2], p[5], p[8]);
  const put = (ix: number, iy: number) => { const k = cellKey(ix, iy); if ((occ.get(k) ?? -Infinity) < h) occ.set(k, h); };
  const ax = p[0], ay = p[1], bx = p[3], by = p[4], cx = p[6], cy = p[7];
  const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (Math.abs(area) > 1e-4) {
    const minX = Math.min(ax, bx, cx), maxX = Math.max(ax, bx, cx), minY = Math.min(ay, by, cy), maxY = Math.max(ay, by, cy);
    for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++) {
      const x = (ix + 0.5) * CELL;
      for (let iy = Math.floor(minY / CELL); iy <= Math.floor(maxY / CELL); iy++) {
        const y = (iy + 0.5) * CELL;
        const w0 = (bx - x) * (cy - y) - (cx - x) * (by - y), w1 = (cx - x) * (ay - y) - (ax - x) * (cy - y), w2 = (ax - x) * (by - y) - (bx - x) * (ay - y);
        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) put(ix, iy);
      }
    }
  }
  for (const [x0, y0, x1, y1] of [[ax, ay, bx, by], [bx, by, cx, cy], [cx, cy, ax, ay]]) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (CELL / 2));
    for (let i = 0; i <= n; i++) { const t = n ? i / n : 0; put(Math.floor((x0 + (x1 - x0) * t) / CELL), Math.floor((y0 + (y1 - y0) * t) / CELL)); }
  }
}

export type FillerRegression = {
  name: string;
  /** Tile ids that must not be hidden by a model that does not draw them. */
  notOrphan?: string[];
  /** Models no generic building may sit ≥30% inside. */
  noDuplicateOf?: string[];
  /** Annexes that must be walled by this landmark kit (kit name → ids), not drawn in random prior colours. */
  kitBody?: { kit: string; ids: string[] };
  /** Generic ids measured inside a model but accepted (documented in `why`). */
  allowDuplicate?: string[];
  why: string;
};

/** Reported failures pinned by place. */
export const FILLER_REGRESSIONS: readonly FillerRegression[] = [
  {
    name: 'Mövenpick Amsterdam City Centre (Piet Heinkade 11)',
    notOrphan: ['w755464126', 'w755464128'],
    why: 'The Muziekgebouw model suppressed the hotel podium deck and 65 m tower parts it does not model; the label sat over a 43 m² canopy.',
  },
  {
    name: 'Westerkerk (Westermarkt / Prinsengracht)',
    noDuplicateOf: ['westerkerk'],
    kitBody: { kit: 'Westerkerk', ids: [
      'NL.IMBAG.Pand.0363100012174406', 'NL.IMBAG.Pand.0363100012174405', 'NL.IMBAG.Pand.0363100012174404',
      'NL.IMBAG.Pand.0363100012174226', 'NL.IMBAG.Pand.0363100012174225', 'NL.IMBAG.Pand.0363100012174224', 'NL.IMBAG.Pand.0363100012168591',
    ] },
    why: 'Generic boxes inside the church model z-fight its walls. The lean-to shops (Westermarkt 60-74) abut the nave between the buttresses and are under the 14 m² facade minimum, so they drew as teal/beige/tan prior-colour boxes; they take the church kit brick.',
  },
];
