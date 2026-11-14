/**
 * The measured wall pool (lane W1, 2026-11-12, flag `?wallPool=0`, `WALL_POOL=0`): an unmeasured pre-1945 pand draws a
 * wall measured on its neighbours' photos instead of its buurt profile's or the period palette's swatch.
 *
 * Why (measured on the F4 benchmark round 0, 193 pands framed in the game beside their winter panorama; the per-stage
 * table is in docs/house-line.md §11):
 *  - 152 of the 193 pands drew a buurt profile swatch; their drawn wall had **no correlation with the photo's**
 *    (Pearson r 0.000 on OKLab L), mean dE 0.21 at the source (dL +0.14: whites, slate greys and orange terracotta
 *    drawn where the photos show dark brown brick). The profile pools hold the misread entries docs/house-line.md §9
 *    traced (dark brick called painted under an overcast cast) and cannot be re-derived here: their thumbnail source is
 *    not archived.
 *  - The 1,364 photo readings of the house-spec extract draw (decorate.ts specWallColour) within dL -0.01 of the same
 *    winter frames on average, and the critic named wall colour on 0 of the 13 spec-wall pairs.
 * So an unmeasured pand takes one of its nearest measured neighbours' drawn walls: the same archetype within
 * POOL.radiusM (else any pre-1945 archetype), the POOL.k nearest, then the POOL.central of those nearest the pool's median
 * colour (per OKLab axis; a painted white or black front, or an orange outlier, among brown brick is not copied onto its
 * unmeasured neighbours), picked by the pand's id hash. The median-nearest pick was chosen over a 35-65 % lightness band
 * on the house:frames pairs: the band drew orange-red outliers (#783721, #803e27) beside low-chroma brown photos.
 * Fewer than POOL.minN neighbours: null, and the pand keeps its profile/period colour.
 *
 * The table (`measured-wall-pool.json`) is written by scripts/house-specs/measured-wall-pool.ts --publish.
 * Pure, no DOM: the flag is read from the page's (or worker's) query, or WALL_POOL in Node, once.
 */
import TABLE from './measured-wall-pool.json' with { type: 'json' };
import { hexToOklab } from '../houseSpec/wallColour.js';

export const POOL_ARCHETYPES = ['canal', 'c19', 'school'] as const;
export type PoolArchetype = (typeof POOL_ARCHETYPES)[number];
export const POOL = {
  /** Neighbours within this distance (m) are candidates. */
  radiusM: 600,
  /** The nearest this many candidates make the pool. */
  k: 12,
  /** At least this many candidates, or no pool. */
  minN: 6,
  /** The pick comes from this many pool walls nearest the pool's median colour (per OKLab axis). */
  central: 3,
} as const;

export const rgbToOklab = (hex: string) => hexToOklab(hex);

export const WALL_POOL_DEFAULT_ON = true;
export function wallPoolEnabled(search?: string | null, env?: string | null): boolean {
  const q = search ? /[?&]wallPool=(\w+)/.exec(search)?.[1] : undefined, v = q ?? env;
  return v === '0' ? false : v === '1' ? true : WALL_POOL_DEFAULT_ON;
}
let cached: boolean | undefined;
/** The flag as the runtime sees it: the page's (or the pool worker's) query, WALL_POOL in Node. Read once. */
export function wallPoolOn(): boolean {
  if (cached !== undefined) return cached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  return (cached = wallPoolEnabled(g.location?.search ?? null, g.process?.env?.WALL_POOL ?? null));
}
/** Tests only: forget the cached flag. */
export const resetWallPoolFlag = () => { cached = undefined; };

type Point = { x: number; y: number; hex: string; arch: number; painted: boolean; L: number };
type Table = { points: readonly (readonly [number, number, string, number, number?])[] };

/**
 * The draw (lane W2, 2026-11-12, flag `?wallVariety=0`, `WALL_VARIETY=0`): instead of one of the walls nearest the pool's
 * median, an unmeasured pand draws from its measured neighbours' distribution. The neighbours (POOL_DRAW.k nearest, the
 * same archetype as the pool) are sorted by lightness then hue and weighted by distance (exp(-d / kernelM)); a quantile
 * picks one through the weighted CDF. The quantile comes from where the pand stands: a rank-1 lattice over cellM cells
 * (golden and plastic ratios), so consecutive pands along a row take well-spread quantiles and a row keeps its darks,
 * reds and pales in about the proportions measured around it. A small id-hash jitter separates two pands in one cell.
 * Why the kernel: leave-one-out on the 1,051 measured walls, the nearest measured wall within 25 m predicts a wall at dE
 * 0.041 against the median pick's 0.058, and the kernel draw at 5-15 m at 0.048-0.051; a uniform draw from the 12 nearest
 * scores 0.080. Rows and split buildings share their colour; the kernel keeps that and still spreads.
 * A drawn wall the table marks painted (a stucco or light register finish, or a drawn L of PAINTED_L or more: no brick
 * reading reaches 0.58) gives the pand a painted finish: smooth render cells (bayLook.ts paintedLayers), not brick.
 */
export const POOL_DRAW = {
  /** Distance weight scale, m, added to the nearest candidate's distance (the frames' pands sit ~160 m from a reading). */
  kernelM: 15,
  /** The nearest this many candidates (a split building's repeated reading counts once) are drawn from. */
  k: 24,
  /** The lattice cell (about one canal-house width), m. */
  cellM: 7,
  /**
   * The central share of the weighted distribution drawn from: 0 = the weighted median, 1 = the whole distribution. On the
   * 114 W1 pairs, 0.5: mean dE 0.104 (W1 0.097), row lightness spread 0.83 of the photos' (W1 0.70); 1: 0.128 and 1.16.
   */
  band: 0.5,
  /** Two readings of one colour this close are one building's split pands, m. */
  sameBuildingM: 40,
};
/** Tests and tuning only (scripts/house-frames/wall-predict.ts): override POOL_DRAW. */
export function tunePoolDraw(over: Partial<typeof POOL_DRAW>) { Object.assign(POOL_DRAW, over); }
/** A measured wall this light is painted render or stucco (the brick readings top out at L 0.58). */
export const PAINTED_L = 0.62;
/**
 * On by default since round 124 (integrator, 2026-11-13), band 0.5 (POOL_DRAW.band). W2's 114 pairs were picked where
 * the game drew pale over dark brick, so they penalised any spread by construction. W3's unbiased, ride-weighted
 * benchmark-v2 (146 pairs, docs/house-line.md §13) gives mean dE: W1 0.097, band 0.5 0.091 (vs W1 -0.006,
 * 95 % CI [-0.014, -0.0002]), band 1 0.102; the blind critic is flat. `?wallVariety=0` is W1's draw.
 */
export const WALL_VARIETY_DEFAULT_ON = true;
/** `?wallVariety=` value: '0' off; a band in (0, 1] on with that POOL_DRAW.band (1 = the whole distribution); absent: the default. */
const varietyValue = (search?: string | null, env?: string | null) => (search ? /[?&]wallVariety=([\d.]+)/.exec(search)?.[1] : undefined) ?? env ?? undefined;
export function wallVarietyEnabled(search?: string | null, env?: string | null): boolean {
  const v = varietyValue(search, env);
  return v === '0' ? false : v !== undefined && Number(v) > 0 ? true : WALL_VARIETY_DEFAULT_ON;
}
let varietyCached: boolean | undefined;
export function wallVarietyOn(): boolean {
  if (varietyCached !== undefined) return varietyCached;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  const v = varietyValue(g.location?.search ?? null, g.process?.env?.WALL_VARIETY ?? null), n = Number(v);
  if (v !== undefined && n > 0 && n <= 1) POOL_DRAW.band = n;
  return (varietyCached = wallVarietyEnabled(g.location?.search ?? null, g.process?.env?.WALL_VARIETY ?? null));
}
/** Tests only: forget the cached variety flag. */
export const resetWallVarietyFlag = () => { varietyCached = undefined; };
export type PoolDraw = { hex: string; painted: boolean };
const frac = (v: number) => v - Math.floor(v);
const M_PER_DEG_LAT = 111_320;
const CELL_M = 300;

/** A grid of measured walls, metres on a local equirectangular plane. */
export class MeasuredWallPool {
  private readonly cells = new Map<string, Point[]>();
  private readonly kx: number;
  constructor(table: Table, lat0 = 52.37) {
    this.kx = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
    for (const [lngE5, latE5, hex, arch, painted] of table.points) {
      const p: Point = { x: (lngE5 / 1e5) * this.kx, y: (latE5 / 1e5) * M_PER_DEG_LAT, hex, arch, painted: painted === 1, L: hexToOklab(hex)[0] };
      const key = `${Math.floor(p.x / CELL_M)},${Math.floor(p.y / CELL_M)}`;
      const c = this.cells.get(key);
      if (c) c.push(p); else this.cells.set(key, [p]);
    }
  }
  /** Measured walls within POOL.radiusM of (lng, lat), nearest first, with their distance. */
  near(lng: number, lat: number, radiusM: number = POOL.radiusM): Array<Point & { d: number }> {
    const x = lng * this.kx, y = lat * M_PER_DEG_LAT, cx = Math.floor(x / CELL_M), cy = Math.floor(y / CELL_M), r = Math.ceil(radiusM / CELL_M);
    const out: Array<Point & { d: number }> = [];
    for (let i = cx - r; i <= cx + r; i++) for (let j = cy - r; j <= cy + r; j++) for (const p of this.cells.get(`${i},${j}`) ?? []) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= radiusM && d > 0.5) out.push({ ...p, d });
    }
    return out.sort((a, b) => a.d - b.d || a.hex.localeCompare(b.hex));
  }
  /**
   * The wall an unmeasured pand at (lng, lat) of `archetype` draws, or null (too few measured neighbours). `seed` is the
   * pand's id hash. The point itself (d <= 0.5 m: a measured pand) is never its own neighbour.
   */
  wallFor(lng: number, lat: number, archetype: string, seed: number): string | null {
    const all = this.near(lng, lat), arch = POOL_ARCHETYPES.indexOf(archetype as PoolArchetype);
    if (arch < 0) return null;
    const same = all.filter(p => p.arch === arch);
    const cands = (same.length >= POOL.minN ? same : all).slice(0, POOL.k);
    if (cands.length < POOL.minN) return null;
    const labs = cands.map(p => ({ hex: p.hex, v: hexToOklab(p.hex) }));
    const med = [0, 1, 2].map(i => labs.map(x => x.v[i]).sort((a, b) => a - b)[Math.floor(labs.length / 2)]);
    const dist = (v: number[]) => Math.hypot(v[0] - med[0], v[1] - med[1], v[2] - med[2]);
    const central = [...labs].sort((a, b) => dist(a.v) - dist(b.v) || a.hex.localeCompare(b.hex)).slice(0, POOL.central);
    return central[(seed >>> 0) % central.length].hex;
  }
  /** The variety draw (POOL_DRAW) for an unmeasured pand at (lng, lat), or null (too few measured neighbours). */
  drawFor(lng: number, lat: number, archetype: string, seed: number, radiusM: number = POOL.radiusM): PoolDraw | null {
    const all = this.near(lng, lat, radiusM), arch = POOL_ARCHETYPES.indexOf(archetype as PoolArchetype);
    if (arch < 0) return null;
    const same = all.filter(p => p.arch === arch);
    const cands = (same.length >= POOL.minN ? same : all).slice(0, POOL_DRAW.k);
    if (cands.length < POOL.minN) return null;
    const hue = (hex: string) => { const [, a, b] = hexToOklab(hex); return Math.atan2(b, a); };
    // One building split into pands carries one reading on each: a repeat of a kept wall's colour within POOL_DRAW.sameBuildingM
    // counts once. Farther repeats are other buildings (the readings are quantised; #6d5743 is 22 pands across the city).
    const distinct: typeof cands = [];
    for (const p of cands) if (!distinct.some(q => q.hex === p.hex && Math.hypot(q.x - p.x, q.y - p.y) <= POOL_DRAW.sameBuildingM)) distinct.push(p);
    const d0 = distinct[0].d, scale = POOL_DRAW.kernelM + d0;
    const sorted = distinct.map(p => ({ p, w: Math.exp(-(p.d - d0) / scale), h: hue(p.hex) })).sort((a, b) => a.p.L - b.p.L || a.h - b.h || a.p.hex.localeCompare(b.p.hex));
    const total = sorted.reduce((s, c) => s + c.w, 0);
    const x = lng * this.kx, y = lat * M_PER_DEG_LAT;
    const u0 = frac(Math.floor(x / POOL_DRAW.cellM) * 0.6180339887 + Math.floor(y / POOL_DRAW.cellM) * 0.7548776662 + ((seed >>> 0) % 1024) / 1024 * 0.05);
    wallVarietyOn(); // a `?wallVariety=0.5` band is applied on the first read
    const u = 0.5 + (u0 - 0.5) * POOL_DRAW.band;
    let acc = 0, pick = sorted[sorted.length - 1].p;
    for (const c of sorted) { acc += c.w / total; if (u < acc) { pick = c.p; break; } }
    return { hex: pick.hex, painted: pick.painted };
  }
}

let shared: MeasuredWallPool | undefined;
/**
 * The pool's draw for an unmeasured pand (flag `?wallVariety=0` falls back to the median pick, painted false), or null
 * (pool off, not a pre-1945 archetype, too few neighbours). `at` should be the footprint's centroid, as the table's are.
 */
export function measuredPoolDraw(lng: number, lat: number, archetype: string, seed: number): PoolDraw | null {
  if (!wallPoolOn() || !(POOL_ARCHETYPES as readonly string[]).includes(archetype)) return null;
  shared ??= new MeasuredWallPool(TABLE as unknown as Table);
  if (!wallVarietyOn()) { const hex = shared.wallFor(lng, lat, archetype, seed); return hex ? { hex, painted: false } : null; }
  return shared.drawFor(lng, lat, archetype, seed);
}
/**
 * The realLook walls lever (look/realLook.ts, `?realLook=walls`): the same variety draw as measuredPoolDraw, but the nearest
 * measured walls are searched out to `radiusM` (default REAL_LOOK_WALL_RADIUS_M), so a pand beyond the W1 pool's 600 m
 * still draws from the measured distribution of its nearest measured neighbours (the kernel then weights them by distance)
 * instead of a buurt profile swatch. `?wallPool=0` turns it off with the pool.
 */
export const REAL_LOOK_WALL_RADIUS_M = 3000;
export function measuredPoolDrawWide(lng: number, lat: number, archetype: string, seed: number, radiusM = REAL_LOOK_WALL_RADIUS_M): PoolDraw | null {
  if (!wallPoolOn() || !(POOL_ARCHETYPES as readonly string[]).includes(archetype)) return null;
  shared ??= new MeasuredWallPool(TABLE as unknown as Table);
  // Search the nearer ring first (most of the ride area has a measured wall within 1.2 km): a third of the cost.
  return (radiusM > 1200 ? shared.drawFor(lng, lat, archetype, seed, 1200) : null) ?? shared.drawFor(lng, lat, archetype, seed, radiusM);
}
/** The published pool's wall for an unmeasured pand, or null (flag off, not a pre-1945 archetype, too few neighbours). */
export function measuredPoolWall(lng: number, lat: number, archetype: string, seed: number): string | null {
  if (!wallPoolOn() || !(POOL_ARCHETYPES as readonly string[]).includes(archetype)) return null;
  shared ??= new MeasuredWallPool(TABLE as unknown as Table);
  return shared.wallFor(lng, lat, archetype, seed);
}

/** The deciles (by OKLab L, 5 % .. 95 %) of a list of walls, the entries a hash pick draws from. */
export function lightnessDeciles(hexes: readonly string[]): string[] {
  const byL = hexes.map(hex => ({ hex, L: hexToOklab(hex)[0] })).sort((a, b) => a.L - b.L || a.hex.localeCompare(b.hex));
  return [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95].map(f => byL[Math.min(byL.length - 1, Math.floor(f * byL.length))].hex);
}
/** Fewer measured walls of an archetype than this city-wide and its period palette stays as authored. */
export const PERIOD_LIST_MIN_N = 30;
let periodLists: Partial<Record<PoolArchetype, string[] | null>> | undefined;
/**
 * The period palette of a pre-1945 archetype under the pool flag: the deciles of every measured wall of that archetype
 * city-wide (`PERIOD_WALLS.photo` was authored: orange terracotta #b05a40/#bd6a45, slate grey #3e4a40/#5d605a, cream
 * stucco half of c19). It serves pands with no profile era and no measured neighbour, and the held-wall brick fallback
 * (wallColour.ts heldBrickWall). Null with the flag off, for another archetype, or under PERIOD_LIST_MIN_N walls.
 */
export function measuredPeriodList(archetype: string): readonly string[] | null {
  if (!wallPoolOn() || !(POOL_ARCHETYPES as readonly string[]).includes(archetype)) return null;
  if (!periodLists) {
    const t = TABLE as unknown as Table;
    periodLists = Object.fromEntries(POOL_ARCHETYPES.map((a, i) => { const hs = t.points.filter(p => p[3] === i).map(p => p[2]); return [a, hs.length >= PERIOD_LIST_MIN_N ? lightnessDeciles(hs) : null]; }));
  }
  return periodLists[archetype as PoolArchetype] ?? null;
}
