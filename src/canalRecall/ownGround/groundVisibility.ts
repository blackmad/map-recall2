// Visibility-weighted concentration score for the ground audit (lane G0 r2, 2026-11-11; pure).
//
// Raw defect area tracks what a cell contains (parks, lawn float), not what the rider sees: the nine named places sat
// 93rd to 7,000th of 17,321 tiles. A defect matters in proportion to how often and how closely it is seen, and it
// matters most where ground meets a structure. So each defect square metre is weighted by
//   vis    1 within 15 m of a rideable way's centreline, fading linearly to 0 at 60 m;
//   cross  3 within 30 m of a deck, cut, slot, portal or rail bed, else 1;
//   prio   1 + the ride-priority share of the cell (ridePriority.ts);
// and the tile's score is the weighted defect m2 per hectare of weighted area (the same weights over every sample),
// so a tile is not rewarded for being large or for having much green.

export type Vec2 = [number, number];
export type Seg = [number, number, number, number];

export const VIS = { fullM: 15, zeroM: 60, crossM: 30, crossFactor: 3, minAreaHa: 0.5 } as const;

/** OSM highway classes a rider can use (the cycling presentation: no motorway or trunk, no private service). */
export const RIDEABLE_HIGHWAYS: ReadonlySet<string> = new Set(['cycleway', 'path', 'footway', 'pedestrian', 'living_street', 'residential', 'unclassified', 'tertiary', 'tertiary_link', 'secondary', 'secondary_link', 'primary', 'primary_link', 'track', 'bridleway']);

/** 1 within `fullM`, linear to 0 at `zeroM`. */
export const visWeight = (distM: number): number => (distM <= VIS.fullM ? 1 : distM >= VIS.zeroM ? 0 : (VIS.zeroM - distM) / (VIS.zeroM - VIS.fullM));
/** ×3 within 30 m of a structure. */
export const crossWeight = (distM: number): number => (distM <= VIS.crossM ? VIS.crossFactor : 1);

/** Polyline points to segments. */
export function segmentsOf(line: readonly Vec2[], out: Seg[] = []): Seg[] {
  for (let i = 0; i + 1 < line.length; i++) out.push([line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]]);
  return out;
}
/** A closed ring to segments. */
export function ringSegments(ring: readonly Vec2[], out: Seg[] = []): Seg[] {
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; out.push([a[0], a[1], b[0], b[1]]); }
  return out;
}

/**
 * Distance from every node of a grid (origin x0,y0; n×n nodes `step` apart) to the nearest segment, capped at `capM`.
 * Each segment stamps only the nodes within `capM` of it.
 */
export function distanceGrid(segs: readonly Seg[], x0: number, y0: number, n: number, step: number, capM: number): Float32Array {
  const d = new Float32Array(n * n).fill(capM);
  const x1 = x0 + n * step, y1 = y0 + n * step;
  for (const [ax, ay, bx, by] of segs) {
    if (Math.max(ax, bx) < x0 - capM || Math.min(ax, bx) > x1 + capM || Math.max(ay, by) < y0 - capM || Math.min(ay, by) > y1 + capM) continue;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - capM - x0) / step)), i1 = Math.min(n - 1, Math.ceil((Math.max(ax, bx) + capM - x0) / step));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - capM - y0) / step)), j1 = Math.min(n - 1, Math.ceil((Math.max(ay, by) + capM - y0) / step));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = x0 + (i + 0.5) * step, py = y0 + (j + 0.5) * step;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      const dist = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (dist < d[j * n + i]) d[j * n + i] = dist;
    }
  }
  return d;
}

/** A per-tile weight lookup (vis × cross, no priority), on a coarse grid. */
export interface WeightField { at(x: number, y: number): number }
export function weightField(ways: readonly Seg[], structures: readonly Seg[], x0: number, y0: number, sizeM: number, step = 2): WeightField {
  const n = Math.ceil(sizeM / step);
  const dw = distanceGrid(ways, x0, y0, n, step, VIS.zeroM), ds = distanceGrid(structures, x0, y0, n, step, VIS.crossM + 1);
  return { at(x, y) { const i = Math.min(n - 1, Math.max(0, Math.floor((x - x0) / step))), j = Math.min(n - 1, Math.max(0, Math.floor((y - y0) / step))); return visWeight(dw[j * n + i]) * crossWeight(ds[j * n + i]); } };
}

/** Weighted defect m2 per hectare of weighted area; the area is floored so a tile far from any way cannot score on a sliver of it. */
export function concentration(weightedDefectM2: number, weightedAreaM2: number, prioShare: number): number {
  return ((weightedDefectM2 * (1 + prioShare)) / Math.max(VIS.minAreaHa, weightedAreaM2 / 10_000));
}
