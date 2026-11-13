/**
 * Structure prior (lane PR1, docs/house-line.md §13): the storey count and window columns a generic pre-1945 pand with no
 * reading draws, from the read houses around it, the way the measured wall pool (look/measuredWallPool.ts) gives an
 * unmeasured wall its colour.
 *
 * The table (structure-prior.json, written by scripts/house-line/structure/fit.ts) holds every read house the fit kept:
 * where it stands, its build year, the exposed height and width of its street run as the mesher lays it, and its read
 * storeys and window columns. For a street run of a pand with no HouseSpec count:
 *   storeys = the most common read count among the k read houses nearest in (year / yearScale, height / heightScale,
 *             metres apart / distanceScale), the nearest of them breaking a tie;
 *   columns = the same over (year, run width, metres apart).
 * The scales and k per field were chosen by 5-fold cross-validation over 300 m blocks of the training houses (fit.ts).
 * The mesher then draws the guess through the HouseSpec fit (streetFacadeRendering.ts specStoreyFit nearest,
 * specCellCount, axisUnitPlan), so a guess the wall cannot hold within the clamps draws the nearest it can.
 *
 * Flag: `?structurePrior=1` in the page (forwarded to the building worker), STRUCTURE_PRIOR=1 in Node; default off.
 * Off, meshBuildingFor sets no prior and the mesher draws exactly as before (structurePrior.test.ts).
 */
import TABLE from './structure-prior.json' with { type: 'json' };

export type KnnParams = { k: number; yearScale: number; sizeScale: number; distanceScale: number };
/** One read house: [lng, lat, year, exposedM, widthM, storeys (0 = unread), columns (0 = unread)]. */
export type PriorRow = readonly [number, number, number, number, number, number, number];
export type StructurePriorTable = { v: number; fitted?: string; maxYear: number; storeys: KnnParams; columns: KnnParams; rows: readonly PriorRow[] };
const table = TABLE as unknown as StructurePriorTable;

/** Metres per degree at Amsterdam (the pool's and the mesher's local frame). */
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;

let cached: boolean | undefined;
/** `?structurePrior=1|0` in the page first, then STRUCTURE_PRIOR=1|0 in Node. Default off. */
export function structurePriorEnabled(search: string | null, env: string | null | undefined): boolean {
  const q = search ? /[?&]structurePrior=([^&]*)/.exec(search)?.[1] : undefined;
  const v = q ?? env ?? undefined;
  return v === '1';
}
export function structurePriorOn(): boolean {
  if (cached !== undefined) return cached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (cached = structurePriorEnabled(g.location?.search ?? null, g.process?.env?.STRUCTURE_PRIOR ?? null));
}
/** Tests only: forget the cached flag. */
export const resetStructurePriorFlag = () => { cached = undefined; };

/** A field gets no guess when no read house's height (storeys) or width (columns) lies within this many metres. */
export const SIZE_GAP_M = 1.5;

function knn(rows: readonly PriorRow[], field: 5 | 6, size: 3 | 4, q: { lng: number; lat: number; year: number; size: number }, p: KnnParams): number | null {
  const best: { d: number; v: number }[] = [];
  // Outside the read houses' range (a 60 m block front, a tower): no guess. The nearest read size must lie within SIZE_GAP_M.
  let nearestSize = Infinity;
  for (const r of rows) if (r[field]) nearestSize = Math.min(nearestSize, Math.abs(r[size] - q.size));
  if (!(nearestSize <= SIZE_GAP_M)) return null;
  for (const r of rows) {
    const v = r[field];
    if (!v) continue;
    const d = Math.hypot((r[2] - q.year) / p.yearScale, (r[size] - q.size) / p.sizeScale) + (p.distanceScale > 0 ? Math.hypot((r[0] - q.lng) * KX, (r[1] - q.lat) * KY) / p.distanceScale : 0);
    if (best.length < p.k) { best.push({ d, v }); best.sort((a, b) => a.d - b.d); continue; }
    if (d >= best[best.length - 1].d) continue;
    best[best.length - 1] = { d, v };
    best.sort((a, b) => a.d - b.d);
  }
  if (!best.length) return null;
  // The most common count; nearest first, so a tie goes to the count of the nearer house.
  const count = new Map<number, number>();
  let mode = best[0].v, n = 0;
  for (const { v } of best) { const c = (count.get(v) ?? 0) + 1; count.set(v, c); if (c > n) { n = c; mode = v; } }
  return mode;
}

export type StructureGuess = { storeys: number | null; columns: number | null };
/**
 * The prior's storeys (ground included, the HouseSpec convention) and window columns for a street run, or null when the
 * pand has no year or is past the table's `maxYear` (post-war fronts keep the style's own grid).
 */
export function structureGuess(q: { lng: number; lat: number; year: number | null | undefined; exposedM: number; widthM: number }, t: StructurePriorTable = table): StructureGuess | null {
  if (q.year === null || q.year === undefined || !Number.isFinite(q.year) || q.year >= t.maxYear || !t.rows?.length) return null;
  if (!(q.exposedM > 0) || !(q.widthM > 0)) return null;
  const storeys = knn(t.rows, 5, 3, { lng: q.lng, lat: q.lat, year: q.year, size: q.exposedM }, t.storeys);
  const columns = knn(t.rows, 6, 4, { lng: q.lng, lat: q.lat, year: q.year, size: q.widthM }, t.columns);
  return { storeys, columns };
}

export const STRUCTURE_PRIOR_TABLE = table;
