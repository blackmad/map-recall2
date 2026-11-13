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
 * Flag (forwarded to the building worker; STRUCTURE_PRIOR in Node): `?structurePrior=0` off, `columns` (the default, integrator
 * ruling on PR1: columns +26.8 points held out) the window columns only, `storeys` / `all` columns and storeys (storeys
 * +6.3 points, held until D1's adjudicated labels). Off, meshBuildingFor sets no prior and the mesher draws exactly as
 * main did before PR1 (structurePrior.test.ts, odd-cells-hash).
 */
import TABLE from './structure-prior.json' with { type: 'json' };

export type KnnParams = { k: number; yearScale: number; sizeScale: number; distanceScale: number };
/** One read house: [lng, lat, year, exposedM, widthM, storeys (0 = unread), columns (0 = unread)]. */
export type PriorRow = readonly [number, number, number, number, number, number, number];
export type StructurePriorTable = { v: number; fitted?: string; maxYear: number; storeys: KnnParams; columns: KnnParams; rows: readonly PriorRow[] };
const table = TABLE as unknown as StructurePriorTable;

/** Metres per degree at Amsterdam (the pool's and the mesher's local frame). */
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;

/** What the prior draws: nothing, the window columns (the default since the integrator's PR1 ruling), or columns and storeys. */
export type StructurePriorMode = 'off' | 'columns' | 'all';
let cached: StructurePriorMode | undefined;
/**
 * `?structurePrior=` in the page first, then STRUCTURE_PRIOR in Node: `0` off; `columns` (or absent) the window columns;
 * `storeys`, `all` or `1` the columns and the storey count. Anything else keeps the default.
 */
export function structurePriorMode(search: string | null, env: string | null | undefined): StructurePriorMode {
  const q = search ? /[?&]structurePrior=([^&]*)/.exec(search)?.[1] : undefined;
  const v = q ?? env ?? undefined;
  if (v === '0' || v === 'off') return 'off';
  if (v === 'storeys' || v === 'all' || v === '1') return 'all';
  return 'columns';
}
/** The mode this page or process runs (cached). */
export function structurePriorModeNow(): StructurePriorMode {
  if (cached !== undefined) return cached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (cached = structurePriorMode(g.location?.search ?? null, g.process?.env?.STRUCTURE_PRIOR ?? null));
}
/** Whether the prior reaches the mesher at all (`?structurePrior=0` turns it off). */
export const structurePriorOn = (): boolean => structurePriorModeNow() !== 'off';
/** Whether the prior's storey count is drawn (`?structurePrior=storeys|all`; held by default). */
export const structurePriorStoreys = (): boolean => structurePriorModeNow() === 'all';
/** Tests only: forget the cached flag. */
export const resetStructurePriorFlag = () => { cached = undefined; };

/** A field gets no guess when no read house's height (storeys) or width (columns) lies within this many metres. */
export const SIZE_GAP_M = 1.5;
type Index = { bySize: Record<5 | 6, PriorRow[]>; memo: Map<string, number | null> };
const indexes = new WeakMap<StructurePriorTable, Index>();
function indexOf(t: StructurePriorTable): Index {
  let ix = indexes.get(t);
  if (ix) return ix;
  // The rows that read each field, sorted by the size that field is matched on (storeys: height, columns: width).
  const sorted = (field: 5 | 6, i: 3 | 4) => t.rows.filter(r => r[field]).slice().sort((a, b) => a[i] - b[i]);
  ix = { bySize: { 5: sorted(5, 3), 6: sorted(6, 4) }, memo: new Map() };
  indexes.set(t, ix);
  return ix;
}

/**
 * The k nearest read houses' most common count (a tie to the nearer house's). Exact: the same k a full scan finds, read
 * outward from the query's size in the size-sorted rows while an unread row could still be nearer (its size gap over
 * sizeScale is a lower bound on its distance). A query is memoised (a building's walls, extras and shell passes ask the same).
 */
function knn(t: StructurePriorTable, field: 5 | 6, size: 3 | 4, q: { lng: number; lat: number; year: number; size: number }, p: KnnParams): number | null {
  const ix = indexOf(t), rows = ix.bySize[field];
  const key = `${field}|${q.lng.toFixed(6)}|${q.lat.toFixed(6)}|${q.year}|${q.size.toFixed(3)}`;
  if (ix.memo.has(key)) return ix.memo.get(key)!;
  let lo = 0, hi = rows.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m][size] < q.size) lo = m + 1; else hi = m; }
  // Outside the read houses' range (a 60 m block front, a tower): no guess.
  const gap = Math.min(lo < rows.length ? rows[lo][size] - q.size : Infinity, lo > 0 ? q.size - rows[lo - 1][size] : Infinity);
  if (!(gap <= SIZE_GAP_M)) { remember(ix, key, null); return null; }
  const best: { d: number; v: number }[] = [];
  const consider = (r: PriorRow) => {
    const d = Math.hypot((r[2] - q.year) / p.yearScale, (r[size] - q.size) / p.sizeScale) + (p.distanceScale > 0 ? Math.hypot((r[0] - q.lng) * KX, (r[1] - q.lat) * KY) / p.distanceScale : 0);
    if (best.length === p.k && d >= best[p.k - 1].d) return;
    let i = best.length === p.k ? p.k - 1 : best.length;
    if (best.length < p.k) best.push({ d, v: r[field] });
    while (i > 0 && best[i - 1].d > d) { best[i] = best[i - 1]; i--; }
    best[i] = { d, v: r[field] };
  };
  let a = lo - 1, b = lo;
  while (a >= 0 || b < rows.length) {
    const ga = a >= 0 ? q.size - rows[a][size] : Infinity, gb = b < rows.length ? rows[b][size] - q.size : Infinity;
    const g = Math.min(ga, gb);
    if (best.length === p.k && g / p.sizeScale >= best[p.k - 1].d) break;
    if (ga <= gb) consider(rows[a--]); else consider(rows[b++]);
  }
  let mode: number | null = null;
  if (best.length) {
    const count = new Map<number, number>();
    let n = 0; mode = best[0].v;
    for (const { v } of best) { const c = (count.get(v) ?? 0) + 1; count.set(v, c); if (c > n) { n = c; mode = v; } }
  }
  remember(ix, key, mode);
  return mode;
}
const remember = (ix: Index, key: string, v: number | null) => { if (ix.memo.size > 200_000) ix.memo.clear(); ix.memo.set(key, v); };

export type StructureGuess = { storeys: number | null; columns: number | null };
/**
 * The prior's storeys (ground included, the HouseSpec convention) and window columns for a street run, or null when the
 * pand has no year or is past the table's `maxYear` (post-war fronts keep the style's own grid).
 */
export function structureGuess(q: { lng: number; lat: number; year: number | null | undefined; exposedM: number; widthM: number }, t: StructurePriorTable = table): StructureGuess | null {
  if (q.year === null || q.year === undefined || !Number.isFinite(q.year) || q.year >= t.maxYear || !t.rows?.length) return null;
  if (!(q.exposedM > 0) || !(q.widthM > 0)) return null;
  const storeys = knn(t, 5, 3, { lng: q.lng, lat: q.lat, year: q.year, size: q.exposedM }, t.storeys);
  const columns = knn(t, 6, 4, { lng: q.lng, lat: q.lat, year: q.year, size: q.widthM }, t.columns);
  return { storeys, columns };
}

export const STRUCTURE_PRIOR_TABLE = table;
