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

type Point = { x: number; y: number; hex: string; arch: number };
type Table = { points: readonly (readonly [number, number, string, number])[] };
const M_PER_DEG_LAT = 111_320;
const CELL_M = 300;

/** A grid of measured walls, metres on a local equirectangular plane. */
export class MeasuredWallPool {
  private readonly cells = new Map<string, Point[]>();
  private readonly kx: number;
  constructor(table: Table, lat0 = 52.37) {
    this.kx = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
    for (const [lngE5, latE5, hex, arch] of table.points) {
      const p: Point = { x: (lngE5 / 1e5) * this.kx, y: (latE5 / 1e5) * M_PER_DEG_LAT, hex, arch };
      const key = `${Math.floor(p.x / CELL_M)},${Math.floor(p.y / CELL_M)}`;
      const c = this.cells.get(key);
      if (c) c.push(p); else this.cells.set(key, [p]);
    }
  }
  /** Measured walls within POOL.radiusM of (lng, lat), nearest first, with their distance. */
  near(lng: number, lat: number): Array<Point & { d: number }> {
    const x = lng * this.kx, y = lat * M_PER_DEG_LAT, cx = Math.floor(x / CELL_M), cy = Math.floor(y / CELL_M), r = Math.ceil(POOL.radiusM / CELL_M);
    const out: Array<Point & { d: number }> = [];
    for (let i = cx - r; i <= cx + r; i++) for (let j = cy - r; j <= cy + r; j++) for (const p of this.cells.get(`${i},${j}`) ?? []) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= POOL.radiusM && d > 0.5) out.push({ ...p, d });
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
}

let shared: MeasuredWallPool | undefined;
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
