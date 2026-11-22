/**
 * Belt review split houses (belt fixes 2026-11-22): a pand split in stage 1 (`picks.json` `houses`, `<pand>#n`) is drawn on
 * its own part of the footprint. The renderer drew the whole pand with the house's fields and cut the slice out of the
 * front, so a house's stated bays and its gable were laid over the whole pand: Herengracht 76-78 drew one front with two
 * identical gables, 50-52 one five-bay block. The footprint is cut at the house's dividers, perpendicular to the framed
 * wall (the photo's wall, left to right as seen); an outer end of the span is not cut (the first house keeps whatever the
 * plan holds left of the wall's start, the last whatever lies past its end).
 *
 * Pure, browser-safe. Positions are [lng, lat]; the cut works in local metres about the wall's start.
 */
export type LngLat = readonly [number, number] | readonly number[];

const M_PER_DEG_LAT = 110_540;

/** The house's span along the wall (metres from its start), and whether each end is a divider to cut at. */
export interface FootprintSlice { fromM: number; toM: number; cutFrom: boolean; cutTo: boolean }

/** The slice of a split house: its span, cut only at the dividers (an end within 5 cm of the span's end is not cut). */
export function houseSlice(spanM: readonly [number, number], wholeM: readonly [number, number]): FootprintSlice {
  return { fromM: spanM[0], toM: spanM[1], cutFrom: spanM[0] > wholeM[0] + 0.05, cutTo: spanM[1] < wholeM[1] - 0.05 };
}

/** One ring cut to the slice (Sutherland-Hodgman against the one or two half-planes), closed; null when under 3 corners. */
export function sliceRing(ring: readonly LngLat[], a: LngLat, b: LngLat, slice: FootprintSlice): number[][] | null {
  const kx = 111_320 * Math.cos(a[1] * Math.PI / 180);
  const bx = (b[0] - a[0]) * kx, by = (b[1] - a[1]) * M_PER_DEG_LAT, len = Math.hypot(bx, by);
  if (!(len > 0)) return null;
  const ux = bx / len, uy = by / len;
  const along = (p: LngLat) => (p[0] - a[0]) * kx * ux + (p[1] - a[1]) * M_PER_DEG_LAT * uy;
  let pts: number[][] = ring.map(p => [p[0], p[1]]);
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  const clip = (keep: (s: number) => number) => {
    const out: number[][] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], dp = keep(along(p)), dq = keep(along(q));
      if (dp >= 0) out.push(p);
      if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    pts = out;
  };
  if (slice.cutFrom) clip(s => s - slice.fromM);
  if (slice.cutTo) clip(s => slice.toM - s);
  if (pts.length < 3) return null;
  return [...pts, [...pts[0]]];
}

/** A Polygon or MultiPolygon geometry cut to the slice (outer rings only: a split house has no courtyard of its own);
 *  null when nothing is left. */
export function sliceGeometry(geometry: { type: string; coordinates: unknown }, a: LngLat, b: LngLat, slice: FootprintSlice): { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] } | null {
  const polys = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []) as number[][][][];
  const cut = polys.map(poly => sliceRing(poly[0] ?? [], a, b, slice)).filter((r): r is number[][] => !!r);
  if (!cut.length) return null;
  return cut.length === 1 ? { type: 'Polygon', coordinates: [cut[0]] } : { type: 'MultiPolygon', coordinates: cut.map(r => [r]) };
}

/** `line:lngA,latA,lngB,latB` (frontLine.ts) -> its two points; null otherwise. */
export function lineOf(wall: unknown): [[number, number], [number, number]] | null {
  if (typeof wall !== 'string' || !wall.startsWith('line:')) return null;
  const v = wall.slice(5).split(',').map(Number);
  return v.length === 4 && v.every(Number.isFinite) ? [[v[0], v[1]], [v[2], v[3]]] : null;
}
