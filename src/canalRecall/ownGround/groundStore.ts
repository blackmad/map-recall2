// Streaming data for the own ground in the game (DOM-free; runs in the ground
// worker and on the main thread). docs/research/own-ground-20261009.md.
//
// Cells are the elevation-v1 1 km cells (axis-aligned rectangles in the game's
// local frame, since both frames are equirectangular about the same origin).
// Per cell the store provides: the relief around it (RD 1 km tiles from
// ground-height-v1), its water polygons and shores (elevation-v1), its
// measured and flat bridge decks (elevation-v1 bridges.json, placed on the
// relief), and its OSM ground (own-ground-osm-v1/cells: a way belongs to the
// cell of its midpoint, an area to the cell of its bbox centre).
//
// One `GroundSurface` serves the whole streamed area: its local → RD map is a
// quadratic fit about the origin over ±9 km (residual < 1 cm, measured), so
// heights agree exactly between the worker and the main thread.

import { lngLatToRd } from '../facade/rdNew.js';
import { cellKey, localToLngLat, validateIndex, type BridgeExtract, type ElevationIndex, type WaterCell } from '../elevation/elevationData.js';
import { decodeFallback, decodeProfile, type DeckProfile } from '../elevation/bridgeDeck.js';
import { applyLocalToRd, extendTile, fitLocalToRd, GroundField, readGroundTile, tileKey, type GroundIndex } from './heightField.js';
import { GroundSurface, type DeckSurface, type Vec2 } from './surface.js';
import type { OsmGroundExtract } from './osmGround.js';
import type { ParksCell, ParksManifest } from './parks.js';
import { decodePhotoEvidence, EMPTY_EVIDENCE, isPhotoEvidence, PHOTO_EVIDENCE_FILE, type PhotoEvidence } from './photoEvidence.js';
import { wetGroundRings } from './wetGround.js';
import { decodeRoadLine, roadCellDir, ROAD_CELL_VERSIONS, type RoadCell, type RoadsManifest } from './roadCells.js';
import { decodeMarks, isRoadMarksCell, type RoadMark, type RoadMarksManifest } from './roadMarks.js';
import { decodePlatforms, decodeRail, isRailCell, RAIL_EXTRACT, type RailManifest, type RailPlatform, type RailWay } from './railTracks.js';
import type { CourtyardsCell, CourtyardsManifest } from './courtyards.js';
import { OPEN_GROUND_EXTRACT, type OpenGroundCell, type OpenGroundManifest } from './groundSurface.js';
import { openUnderFootbridges, waterZAt, type OpeningDeck, type WaterGeometry } from './water.js';
import { openUnderHouseboats, type Boat } from './moorings.js';
import type { CellDetail, CellInput } from './groundCell.js';
import { farBlockCells, type FarBlockInput } from './farRing.js';
import { cutWays, isTunnelTags, planCutsSteps, type Cut, type CutWay } from './tunnels.js';
import { CROSSINGS, crossingIndex, type CrossingCutStats, type CrossingIndex } from './crossings.js';
import { pageFrameBudget } from './frameBudget.js';
import { retrying } from './groundResidency.js';

/** Relief ensured (and scanned) this far around a cell with tunnel portals, metres: a ramp's reach from its portal. */

/**
 * End the current task so a frame can run (#129 stutter: a cell's relief, decks, way decks and tunnel cuts ran as one
 * microtask chain after its fetch, 50-90 ms on the main thread at 1x). On the page only; a worker has no frames to keep.
 * scheduler.yield where the browser has it (continues ahead of other tasks), else a zero-delay timeout.
 */
export const yieldToFrame = (): Promise<void> => {
  const g = globalThis as { document?: unknown; scheduler?: { yield?: () => Promise<void> } };
  if (!g.document) return Promise.resolve();
  // One budget per frame across every slice in flight (frameBudget.ts, lane E2): `?groundFrameBudget=0` restores
  // the plain yield.
  const budget = pageFrameBudget();
  if (budget) return budget.yield();
  return g.scheduler?.yield ? g.scheduler.yield() : new Promise(resolve => setTimeout(resolve, 0));
};

/**
 * A yieldToFrame that yields only once `budgetMs` of work ran since the pacer's last yield (or its making): a loop
 * calls it after each step and ends its task every few milliseconds instead of after every step (#129).
 */
export const PACE_BUDGET_MS = 6;

/**
 * Before a fetched cell's JSON.parse (lane E5, #218): end the task that resolved the fetch, so the parse is a slice the
 * frame budget can count and defer (`?groundFrameBudget=1`), not work tacked onto whichever continuation ran first. At
 * ride start the parses ran back to back after `Response.arrayBuffer` with no frame between them (100-133 ms frames on
 * the desktop cold start). `?groundParseYield=0` parses at once, as before.
 */
let parseYieldOn: boolean | undefined;
export const beforeParse = (): Promise<void> => {
  if (parseYieldOn === undefined) {
    try { parseYieldOn = new URLSearchParams((globalThis as { location?: { search?: string } }).location?.search ?? '').get('groundParseYield') !== '0'; } catch { parseYieldOn = true; }
  }
  return parseYieldOn ? yieldToFrame() : Promise.resolve();
};
export const pacer = (budgetMs = PACE_BUDGET_MS): (() => Promise<void>) => {
  let last = performance.now();
  return async () => {
    if (performance.now() - last < budgetMs) return;
    await yieldToFrame();
    last = performance.now();
  };
};

export const CUT_REACH_M = 600;
import { deckReach, movableApproaches, pointInRing } from './decks.js';
import { prepareWays, isBridgeWay } from './streets.js';
import { WAY_DECK_CLEAR_M, WAY_OPENING_REACH_M, bridgeWayBundles, capDeckSides, deckEdgeSides, setDeckSides, ROAD_EDGE_REACH_MAX_M, roadEdgeSides, joinChains, groupWayDecks, wayDeckCrossing, WAY_DECK_GROUP_M, dryWayDeckProfile, narrowDryDeck, isWayDeckFamily, crossesTrack, runOverEndHoles, wayDeckHighway, wayOpeningDeck, type WayDeckInput } from './wayDecks.js';
import { RoadIndex } from './roadSurfaces.js';
import { DRY_EDGE_M, edgesBox, surveyDeckEdges } from './bridgeGaps.js';
import { landedPlatformRings } from './landedPlatforms.js';

/** The game's local frame (galleryPipeline.toLocal), duplicated so the worker bundle stays small. */
export const GAME_ORIGIN = { lng: 4.9, lat: 52.37 } as const;
const KX = 111_320 * Math.cos(GAME_ORIGIN.lat * Math.PI / 180), KY = 110_540;
export const toLocal = (lng: number, lat: number): Vec2 => [(lng - GAME_ORIGIN.lng) * KX, (lat - GAME_ORIGIN.lat) * KY];
export const fromLocal = (x: number, y: number): Vec2 => [GAME_ORIGIN.lng + x / KX, GAME_ORIGIN.lat + y / KY];

export const EXTRACTS = { relief: 'ground-height-v1', osm: 'own-ground-osm-v1', water: 'elevation-v1', parks: 'parks-v1', roads: 'roads-v1', courtyards: 'courtyards-v1', openGround: OPEN_GROUND_EXTRACT, marks: 'road-marks-v1', rail: RAIL_EXTRACT } as const;
/** Water surface, scene z (canal level −0.40 NAP below the +1.37 NAP datum). */
export const WATER_Z = -1.77;
/** Relief loaded this far around a cell before it is built (decks and streets reach past its edge). */
export const CELL_RELIEF_PAD_M = 350;
/** cellInput reads the decks and cuts whose box meets the cell ± this, metres. */
export const CELL_INPUT_PAD_M = 200;
/** Deterministic way decks: bridge ways whose boxes lie within this of each other may join (CHAIN_JOIN_M) or group (WAY_DECK_GROUP_M) and are planned together, metres. */
export const WAY_DECK_LINK_M = WAY_DECK_GROUP_M + 1;

/** Fetch an extract file (path relative to the extract root), gunzipped. */
export type FetchBytes = (path: string) => Promise<Uint8Array>;

/** elevation-v1/water-levels.json (scripts/own-ground/build-polder-levels.ts): NAP metres per cell polygon / shore, a number when uniform. */
export interface WaterLevels { version: 1; defaultNap: number; cells: Record<string, { p: number | number[]; s: number | number[] }> }

export interface OsmCellsManifest { version: 1; area: string; cellSizeM: number; cells: string[]; fetched?: string; attribution?: string }

export type Rect = [number, number, number, number];

/** Inside any of the water polygons (outer ring and holes, even-odd), each tested only within its box. */
/**
 * The OSM bridge ways of these cells a way deck may carry (wayDecks.ts wayDeckHighway), once each, inside `box`,
 * skipping `skip` ids. Only the bridge ways go through prepareWays (the cell's whole street graph is the costly part).
 */
export function bridgeWayInputs(osms: readonly (OsmGroundExtract | null)[], skip: (id: number) => boolean, box: readonly [number, number, number, number]): WayDeckInput[] {
  const ways: WayDeckInput[] = [];
  for (const osm of osms) for (const w of osm ? prepareWays(osm.ways.filter(q => q.tags.bridge && q.tags.bridge !== 'no' && wayDeckHighway(q.tags.highway) && !skip(q.id)), p => toLocal(p[0], p[1])) : []) {
    if (skip(w.id) || ways.some(q => q.id === w.id) || !isBridgeWay(w) || !wayDeckHighway(w.tags.highway)) continue;
    const xs = w.points.map(p => p[0]), ys = w.points.map(p => p[1]);
    if (Math.min(...xs) < box[0] || Math.max(...xs) > box[2] || Math.min(...ys) < box[1] || Math.max(...ys) > box[3]) continue;
    ways.push({ id: w.id, name: w.tags.name ?? '', points: w.points, halfWidth: w.section.halfWidth });
  }
  return ways;
}

/**
 * A dry way deck lies on the chord between its ends' ground: steeper than this, one end has landed in a trench or a
 * tunnel ramp (Nieuwe Leeuwarderweg 1221605945 at the IJtunnel, 22 %: the deck dove to the trench floor at −4.8 m).
 */
export const DRY_DECK_MAX_GRADE = 0.12;
/** Distance from (x, y) to a deck's nearest station inside its span (Infinity outside its box, grown by DRY_EDGE_M). */
export function stationDistance(p: DeckProfile, x: number, y: number): number {
  const [x0, y0, x1, y1] = p.bbox;
  if (x < x0 - DRY_EDGE_M || x > x1 + DRY_EDGE_M || y < y0 - DRY_EDGE_M || y > y1 + DRY_EDGE_M) return Infinity;
  let d = Infinity;
  for (let i = 0; i < p.x.length; i++) if (p.s[i] >= p.deck[0] && p.s[i] <= p.deck[1]) d = Math.min(d, Math.hypot(p.x[i] - x, p.y[i] - y));
  return d;
}
/** The chord grade of a deck between its ends' ground heights. */
export function dryDeckGrade(p: DeckProfile, ground: (x: number, y: number) => number): number {
  // The ends the surface lays the deck between (surface.ts: the profile's first and last stations).
  const n = p.s.length - 1, len = p.s[n] - p.s[0];
  return len > 0 ? Math.abs(ground(p.x[n], p.y[n]) - ground(p.x[0], p.y[0])) / len : 0;
}

/** Survey classes on the ground that keep a dry way deck out (bridgeGaps step 3): a road, cycle path or parking under it. */
export const DRY_DECK_BLOCKERS: ReadonlySet<string> = new Set(['carriage', 'cycle', 'parking']);

/** Within this of a ground-level street or track, a bridge station crosses it (water.ts OpeningOptions.under). */
export const GROUND_CROSSING_M = 1.5;
/** A ground way this close to parallel with the bridge axis is its approach, not something it crosses. */
export const GROUND_CROSSING_PARALLEL = 0.9;
/**
 * True near a mapped way at ground level (no bridge, no tunnel, no layer) running across the bridge axis: what a
 * viaduct crosses, not cut water. The approaches carry on along the axis and do not count.
 */
export function groundCrossing(osms: readonly (OsmGroundExtract | null)[]): GroundCrossingTest {
  const steps = groundCrossingSteps(osms);
  for (;;) { const r = steps.next(); if (r.done) return r.value; }
}

export type GroundCrossingTest = (x: number, y: number, ux: number, uy: number) => boolean;

/** groundCrossing paced: a task ends every PACE_BUDGET_MS between ways and segments (#129: one 33-37 ms task at 4x). */
export async function groundCrossingPaced(osms: readonly (OsmGroundExtract | null)[], pace: () => Promise<void>): Promise<GroundCrossingTest> {
  const steps = groundCrossingSteps(osms);
  for (;;) { const r = steps.next(); if (r.done) return r.value; await pace(); }
}

/** groundCrossing's work as steps (a way collected, a block of segments bucketed); the last returns the test. */
export function* groundCrossingSteps(osms: readonly (OsmGroundExtract | null)[]): Generator<void, GroundCrossingTest, void> {
  const segs: [number, number, number, number][] = [];
  const seen = new Set<number>();
  for (const osm of osms) for (const w of osm?.ways ?? []) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    const t = w.tags;
    if (!(t.highway || t.railway) || (t.bridge && t.bridge !== 'no') || (t.tunnel && t.tunnel !== 'no') || (t.layer && t.layer !== '0') || w.g.length < 2) continue;
    for (let i = 0; i + 1 < w.g.length; i++) { const a = toLocal(w.g[i][0], w.g[i][1]), b = toLocal(w.g[i + 1][0], w.g[i + 1][1]); segs.push([a[0], a[1], b[0], b[1]]); }
    yield;
  }
  const R = GROUND_CROSSING_M;
  // Bucket each segment under every grid cell its R-padded box touches: a point outside that box cannot pass the
  // test below, so looking only at the point's own cell is exact (a linear scan made 200+ ms tasks, #129).
  const G = 32, buckets = new Map<number, [number, number, number, number][]>();
  const cellKey = (i: number, j: number) => i * 1_000_003 + j;
  let n = 0;
  for (const s of segs) {
    const i0 = Math.floor((Math.min(s[0], s[2]) - R) / G), i1 = Math.floor((Math.max(s[0], s[2]) + R) / G);
    const j0 = Math.floor((Math.min(s[1], s[3]) - R) / G), j1 = Math.floor((Math.max(s[1], s[3]) + R) / G);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = cellKey(i, j), b = buckets.get(k);
      if (b) b.push(s); else buckets.set(k, [s]);
    }
    if (++n % 256 === 0) yield;
  }
  return (x, y, ux, uy) => (buckets.get(cellKey(Math.floor(x / G), Math.floor(y / G))) ?? []).some(([ax, ay, bx, by]) => {
    if (x < Math.min(ax, bx) - R || x > Math.max(ax, bx) + R || y < Math.min(ay, by) - R || y > Math.max(ay, by) + R) return false;
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1e-9;
    if (Math.abs(dx * ux + dy * uy) / l > GROUND_CROSSING_PARALLEL) return false;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (l * l)));
    return Math.hypot(ax + dx * t - x, ay + dy * t - y) <= R;
  });
}

export function waterTest(polygons: readonly (readonly (readonly Vec2[])[])[], banded = true): (x: number, y: number) => boolean {
  if (banded) return bandedWaterTest(polygons);
  const polys = polygons.map(poly => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [px, py] of poly[0] ?? []) { a = Math.min(a, px); b = Math.min(b, py); c = Math.max(c, px); d = Math.max(d, py); } return { poly, box: [a, b, c, d] }; });
  return (x, y) => polys.some(({ poly, box }) => { if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) return false; let inside = false; for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; });
}

/** Height of one band of a water polygon's edge index, metres (bandedWaterTest). */
export const WATER_BAND_M = 8;

/**
 * waterTest with each polygon's edges indexed by horizontal band (lane R5-A #260 step 4). Measured 2026-11-09: a LOD 0
 * cell's input spent ~0.5 s in wetGroundRings, nearly all of it in this test, because a canal polygon's box covers most
 * of a cell and the plain test walks every edge of it for every sample. A point in band k only tests the edges whose
 * y-range meets band k; an edge it skips lies wholly above or below the point's y and could not toggle the crossing
 * parity, and the edges it tests run the same comparison in the same arithmetic, so the answer is exactly the plain
 * test's (`banded = false`, `?groundPlanShare=0`).
 */
function bandedWaterTest(polygons: readonly (readonly (readonly Vec2[])[])[]): (x: number, y: number) => boolean {
  const B = WATER_BAND_M;
  const polys = polygons.map(poly => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [px, py] of poly[0] ?? []) { a = Math.min(a, px); b = Math.min(b, py); c = Math.max(c, px); d = Math.max(d, py); }
    const n = b <= d ? Math.floor((d - b) / B) + 1 : 0, lists: number[][] = Array.from({ length: n }, () => []);
    for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      // Bands [b + kB, b + (k+1)B] the edge's y-range meets (closed: a point on a band line tests both neighbours' edges).
      const k0 = Math.max(0, Math.floor((Math.min(yi, yj) - b) / B)), k1 = Math.min(n - 1, Math.floor((Math.max(yi, yj) - b) / B));
      for (let k = k0; k <= k1; k++) lists[k].push(xi, yi, xj, yj);
    }
    return { box: [a, b, c, d] as const, bands: lists.map(l => Float64Array.from(l)) };
  });
  return (x, y) => polys.some(({ box, bands }) => {
    if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) return false;
    const e = bands[Math.min(bands.length - 1, Math.floor((y - box[1]) / B))];
    let inside = false;
    for (let i = 0; i < e.length; i += 4) { const xi = e[i], yi = e[i + 1], xj = e[i + 2], yj = e[i + 3]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; }
    return inside;
  });
}

export class GroundStore {
  relief!: GroundIndex;
  elevation!: ElevationIndex;
  osmCells = new Set<string>();
  /** Cells of the parks-v1 extract (empty when parks are off or the extract is missing). */
  parkCells = new Set<string>();
  /** Cells of the roads-v1 extract (empty when roads are off or the extract is missing); other cells keep the OSM bands. */
  roadCells = new Set<string>();
  /** Cells of the courtyards-v1 extract (BGT block interiors, courtyards.ts; empty when off or missing). */
  courtyardCells = new Set<string>();
  /** Cells of the open-ground-v1 extract (BGT open ground, groundSurface.ts; empty when off or missing). */
  openGroundCells = new Set<string>();
  field!: GroundField;
  surface!: GroundSurface;
  private bridges: BridgeExtract | null = null;
  private readonly reliefTiles = new Set<string>();
  private readonly reliefLoading = new Map<string, Promise<void>>();
  private readonly water = new Map<string, Promise<WaterGeometry | null>>();
  private readonly osm = new Map<string, Promise<OsmGroundExtract | null>>();
  private readonly parks = new Map<string, Promise<ParksCell | null>>();
  private readonly roads = new Map<string, Promise<RoadCell | null>>();
  /** road-marks-v1 (roadMarks.ts): crossing / signal / give-way nodes, loaded with the roads. */
  private readonly marks = new Map<string, Promise<RoadMark[]>>();
  markCells = new Set<string>();
  /** rail-v1 (railTracks.ts): railway tracks on their own corridor, per cell (default on; off for the regression's before). */
  private readonly rail = new Map<string, Promise<{ ways: RailWay[]; platforms: RailPlatform[] }>>();
  railCells = new Set<string>();
  /**
   * Rail cell fetch outcome per key (lane R3-C #232, the owner split of the missing ballast beds): `ok:<ways>`,
   * `empty` (the payload failed isRailCell: a RAIL_VERSION mismatch), `error:<message>`, `absent` (not in the manifest).
   * Diagnostics only; read by the worker's cell message and `OwnGround.cellStats(key).railFetch`.
   */
  readonly railOutcomes = new Map<string, string>();
  /** Extract loads that failed after their retries (the rail manifest, rail cells), newest last; OwnGround.status shows them. */
  readonly loadErrors: string[] = [];
  /** road-marks-v1 photo-evidence.json (photoEvidence.ts), loaded with the roads. */
  evidence: PhotoEvidence = EMPTY_EVIDENCE;
  private readonly courtyards = new Map<string, Promise<CourtyardsCell | null>>();
  private readonly openGround = new Map<string, Promise<OpenGroundCell | null>>();
  /** Polder water levels (null: the extract has none, every polygon sits at WATER_Z). */
  waterLevels: WaterLevels | null = null;
  /** Resident cells' water, for `waterZAt`. */
  private readonly waterResident = new Map<string, WaterGeometry>();
  /** Measured deck surfaces per cell (placed once the cell's relief is resident). */
  private readonly decksByCell = new Map<string, DeckSurface[]>();
  private readonly flatByCell = new Map<string, Vec2[][]>();
  private measuredByCell = new Map<string, BridgeExtract['measured']>();
  private fallbackByCell = new Map<string, BridgeExtract['fallback']>();
  readonly loadedBytes = { relief: 0, water: 0, osm: 0, parks: 0, roads: 0, courtyards: 0, openGround: 0 };
  /**
   * Lane R5-A #260 step 4 (measurement only): told the CPU each data-in phase took, by phase and key (parse per extract,
   * relief tiles, decks, way decks, tunnel cuts, the input's assembly). Null (the default): nothing is timed.
   */
  phaseHook: ((phase: string, key: string, ms: number) => void) | null = null;
  /**
   * Ground determinism (#260 follow-up, diagnostics only): told which plan placed a shared result. `wayDeck`: an OSM
   * bridge way given to a way-deck plan (id: the way id), `deck`: a way deck placed (id: its profile id), `cutScan`: a way
   * scanned for cuts (negative: a tunnel run tried as a slot), `cut`: a cut placed. `plan`: the cell whose plan did it.
   */
  planTrace: ((kind: 'wayDeck' | 'deck' | 'cutScan' | 'cut', id: string, plan: string) => void) | null = null;
  private timed<T>(phase: string, key: string, fn: () => T): T {
    const hook = this.phaseHook;
    if (!hook) return fn();
    const t = performance.now();
    try { return fn(); } finally { hook(phase, key, performance.now() - t); }
  }
  /** A phase's wall time from `t0`, less what it spent waiting (`waitMs`), told to the hook. */
  private told(phase: string, key: string, t0: number, waitMs = 0): void { this.phaseHook?.(phase, key, performance.now() - t0 - waitMs); }
  /** Await `p`, adding the wait to `box.ms` (a phase's own CPU excludes waiting for a fetch). */
  private async waited<T>(p: Promise<T>, box: { ms: number }): Promise<T> { const t = performance.now(); try { return await p; } finally { box.ms += performance.now() - t; } }

  /** `parks`: load the parks-v1 extract (BGT park surfaces and furniture, parks.ts); off with `?parks=0`. */
  /** `courtyards`: load the courtyards-v1 extract (BGT courtyard and back-garden cover); off for the regression's before. */
  /** `moorings`: open the water under houseboats the generalised water cuts (moorings.ts); off for the regression's before. */
  /** `roads`: load the roads-v1 extract (BGT road partition, roadSurfaces.ts); phase 1 is opt-in (`?roads=bgt`), so the default is off. */
  /**
   * `reliefTile`: fetch and decode one relief tile elsewhere (the game passes a worker, so the gunzip and
   * the predictor decode of every tile under the rider's ring leave the main thread; the motion profile had
   * them in 100–200 ms bursts, docs/perf-motion-stutter-20261016.md). Same decode, same heights.
   */
  constructor(private readonly fetchBytes: FetchBytes, private readonly options: { parks?: boolean; courtyards?: boolean; /** `openGround`: load open-ground-v1 (groundSurface.ts); default on, off: `?openGround=0` (the lane's before). */ openGround?: boolean; openings?: boolean; moorings?: boolean; approaches?: boolean; clipDecks?: boolean; roads?: boolean; reliefTile?: ReliefTileLoader; /** Decks for OSM bridge ways the extract does not carry (wayDecks.ts); default on. */ wayDecks?: boolean; /** Deck ends landed under the survey (footprints over the reach, covered tops sunk past the span); default on, off only for the regression's pin. */ deckEnds?: boolean; /** Way decks run on over a hole in the relief past the water (wayDecks.ts HOLE_M); default on. */ wayDeckHoles?: boolean; /** Bridge ways meeting end to end join before the way decks are drawn (wayDecks.ts joinChains); default on. */ wayDeckChains?: boolean; /** Open the water under OSM bridge ways whose water stops at the bridge (wayDecks.ts WAY_OPENING_REACH_M); default on, off only for the regression's before. */ wayOpenings?: boolean; /** roads-v1: way decks widen to the road surfaces' outer edges (wayDecks.ts roadEdgeSides); default on. */ wayDeckCarriage?: boolean; /** Road surfaces carried across bridges without gaps (lane road-bridge-gaps 2026-11-01, issue #178); default on, off: `?bridgeGaps=0` (the A/B's before). */ bridgeGaps?: boolean; /** Road surfaces carried across bridges (deckCarry.ts, lane R5-C1 issue #262); default on, off: `?bridgeCarry=0`. */ bridgeCarry?: boolean; /** One red owner per junction mouth, red on its own plane (lane R5-C1 issue #262); default on, off: `?redDedupe=0`. */ redDedupe?: boolean; /** bridgeGaps step 3: way decks for bridge ways over land (wayDecks.ts dryWayDeckProfile); default off (integrator 2026-11-02: slivers and hairlines at the bus station, the IJtunnel trench height), `?dryWayDecks=1` turns it on. */ dryWayDecks?: boolean; /** With dryWayDecks off, the dry way decks of the bridge ways over a railway track only (wayDecks.ts crossesTrack, lane rails-uncover 2026-11-10: the Radarweg bridge over the Sloterdijk rail trench); default on, off: `?railDecks=0` (the before). */ railDecks?: boolean; /** Tunnel cuts: ramps into tunnels and slots through embankments (tunnels.ts); default on. */ tunnels?: boolean; /** The crossing register (crossings.ts, lane G3): reviewed records replace inferred cuts, portals and rail spans in their zones; default on, off: `?crossings=0`. */ crossings?: boolean; /** Ground triangles clipped at the tunnel walls (tunnels.ts clipMeshAtCuts, R5-C2); default on, off: `?portalClip=0`. */ portalClip?: boolean; /** The portal clip across a mouth's end line and along the walls up to it (tunnels.ts PortalClipOptions.ends, #269); default on, off: `?portalEnds=0`. */ portalEnds?: boolean; /** A long same-side wall gap in a ramp bridged where the bank carries on (tunnels.ts bridgeBankGaps, #270); default on, off: `?rampGaps=0`. */ rampGaps?: boolean; /** roads-v1 version-3 cells (junction slivers merged, roadSlivers.ts) where the manifest publishes them; default on, off: `?roadSlivers=0` reads the version-2 cells. */ roadSlivers?: boolean; /** Railway tracks from rail-v1 (railTracks.ts); default on. */ rails?: boolean; /** Rail cell and manifest fetches retried, a failed cell fetch never cached as "no rails" (groundResidency.ts, #232); default on, off: `?railRetry=0`. */ railRetry?: boolean; /** Rail fetch backoff, ms (groundResidency.ts RAIL_RETRY_MS; tests pass short ones). */ railRetryMs?: readonly number[]; /** The rail manifest's cell keys as the main thread loaded them (the worker is handed them: one source of truth, #232); absent: fetch cells.json. */ railManifest?: readonly string[]; /** Rail corridors in the far ring (farRing.ts); default on, off: `?farRail=0`. */ farRails?: boolean; /** Far rail bands draped on the far land (farRing.ts FAR_RAIL_STEP_M, #232); default on, off: `?farRailDrape=0`. */ farRailDrape?: boolean; /** Rail levels and the never-under-the-ground floor (railProfile.ts); default on, off: the #145 build (for measuring). */ railLevels?: boolean; /** Piers, girders and railings under the rail decks (railBridge.ts); default on, off: the round-2 build (for measuring). */ railBridges?: boolean; /** rail-v1 as shipped in build 04e3c88 (railTracks `legacy`): the rail regressions' pre-fix build only. */ railLegacy?: boolean; /** Rails flat on the street they lie on or cross within the bed's reach (railTracks.ts onStreetTest, lane rails-class); default on, off: the centreline-crossing test only (for measuring). */ railOnStreet?: boolean; /** Deck spans where a street passes under a track off the bridges (railSpans.ts, lane rails-classb); default on, off: the build before it (for measuring). */ railSpans?: boolean; /** Level crossings ramp the bed at the track's grade (railTracks.ts `ramps`, lane rails-uncover); default on, off: the before (for measuring). */ railRamps?: boolean; /** The deck spans' headroom, metres (railSpans.ts SPAN_HEADROOM_M); measuring only. */ railSpanHeadroom?: number; /** roads-v1 ground polygons over water at street height count as decks for the water mask (wetGround.ts); default on, off only for the regression's pin. */ wetGround?: boolean; /** The main thread's store: it prepares cells (decks, way decks, tunnel cuts) and answers heights but never builds one (the worker does), so cells keep only what prepareCell reads: OSM ways without the areas, road surfaces without kerbs and cover ways. cellInput/farInput refuse. */ prepareOnly?: boolean; /** Lane R5-A #260 step 4: the water tests use the banded edge index (bandedWaterTest, exact) and the 3×3 planning a cell repeats is shared; default on, off: `?groundPlanShare=0`. */ planShare?: boolean; /** Ground determinism (#260 follow-up): a cell's mesh does not depend on which cells its store prepared before it (way decks planned per bridge component, tunnel cuts per portal cell with the lowest-keyed plan winning an overlap, decks laid on the bare relief, inputs in id order); default on, off: `?groundDeterministic=0` (first plan to reach a way wins). */ deterministic?: boolean; /** Work between yields while planning way decks and cuts on the page (pacer), ms; default PACE_BUDGET_MS, 0: yield after every step (the exactness pin). */ paceMs?: number } = {}) {}
  /** Houseboat footprints (houseboats.json, game frame), by elevation cell of their centroid. */
  private boatsByCell = new Map<string, Boat[]>();
  /** Boats whose berth was opened, per cell (named regressions, the lane report). */
  readonly openedBerths = new Map<string, string[]>();

  private async json<T>(path: string): Promise<T> {
    const bytes = await this.fetchBytes(path);
    await beforeParse();
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  }

  /**
   * Load the manifests once. A second load replaced `surface` and dropped the decks earlier cell builds had registered
   * on it while the per-cell caches stayed, so a later cell's deck road polygons stood over no deck
   * (check:own-ground-cells -1_-1: 13 -> 58 once a regression re-inited the shared roads store, 2026-10-16).
   */
  /** The crossing register placed in the local frame (crossings.ts); null when off or empty (byte-identical builds). */
  private crossingIdx: CrossingIndex | null | undefined;
  /** What the register did to the planned cuts (diagnostics). */
  readonly crossingCutStats: CrossingCutStats = { dropped: 0, sliced: 0, portalsDropped: 0 };
  get crossings(): CrossingIndex | null {
    if (this.crossingIdx === undefined) { const idx = this.options.crossings === false ? null : crossingIndex(CROSSINGS, p => toLocal(p[0], p[1])); this.crossingIdx = idx && idx.size ? idx : null; }
    return this.crossingIdx;
  }

  init(): Promise<void> {
    return (this.loading ??= this.load());
  }
  private loading?: Promise<void>;

  private async load(): Promise<void> {
    const [relief, elevation, bridges, manifest, levels] = await Promise.all([
      this.json<GroundIndex>(`${EXTRACTS.relief}/index.json`),
      this.json<unknown>(`${EXTRACTS.water}/index.json`).then(validateIndex),
      this.json<BridgeExtract>(`${EXTRACTS.water}/bridges.json`),
      this.json<OsmCellsManifest>(`${EXTRACTS.osm}/cells.json`).catch(() => null),
      this.json<WaterLevels>(`${EXTRACTS.water}/water-levels.json`).catch(() => null),
    ]);
    const boats = this.options.moorings === false ? null : await this.json<{ boats: { id: string; ring: [number, number][] }[] }>('houseboats.json').catch(() => null);
    const parks = this.options.parks === false ? null : await this.json<ParksManifest>(`${EXTRACTS.parks}/cells.json`).catch(() => null);
    this.parkCells = new Set(parks?.version === 1 ? parks.cells : []);
    const roads = this.options.roads === true ? await this.json<RoadsManifest>(`${EXTRACTS.roads}/cells.json`).catch(() => null) : null;
    this.roadCells = new Set(roads?.version === 1 ? roads.cells : []);
    // Version-3 cells (junction slivers merged, roadSlivers.ts) live beside the version-2 ones until `?roadSlivers=0` is retired.
    this.roadCellDir = roads?.version === 1 && this.options.roadSlivers !== false ? roadCellDir(roads) : 'cells';
    const marks = this.options.roads === true ? await this.json<RoadMarksManifest>(`${EXTRACTS.marks}/cells.json`).catch(() => null) : null;
    this.markCells = new Set(marks?.version === 1 ? marks.cells : []);
    if (this.options.rails !== false && this.options.railManifest && this.options.railRetry !== false) this.railCells = new Set(this.options.railManifest);
    else {
      const path = `${EXTRACTS.rail}/cells.json`;
      // A manifest that fails to load turned every rail off for the ride, silently (#232): retried, then logged.
      const rail = this.options.rails === false ? null : this.options.railRetry === false ? await this.json<RailManifest>(path).catch(() => null)
        : await retrying(() => this.json<RailManifest>(path), this.options.railRetryMs).catch(error => { this.loadErrors.push(`rail manifest: ${String((error as Error)?.message ?? error).slice(0, 160)}`); return null; });
      this.railCells = new Set(rail?.version === 1 ? rail.cells : []);
    }
    // What the orthophoto backs of the tag-driven paint (photoEvidence.ts): absent → no lane ribbons, no centre dashes.
    const evidence = this.options.roads === true ? await this.json<unknown>(`${EXTRACTS.marks}/${PHOTO_EVIDENCE_FILE}`).catch(() => null) : null;
    this.evidence = decodePhotoEvidence(isPhotoEvidence(evidence) ? evidence : null);
    const courtyards = this.options.courtyards === false ? null : await this.json<CourtyardsManifest>(`${EXTRACTS.courtyards}/cells.json`).catch(() => null);
    this.courtyardCells = new Set(courtyards?.version === 1 ? courtyards.cells : []);
    const openGround = this.options.openGround === false || this.options.prepareOnly ? null : await this.json<OpenGroundManifest>(`${EXTRACTS.openGround}/cells.json`).catch(() => null);
    this.openGroundCells = new Set(openGround?.version === 1 ? openGround.cells : []);
    this.waterLevels = levels?.version === 1 ? levels : null;
    this.relief = relief;
    this.elevation = elevation;
    this.bridges = bridges;
    this.osmCells = new Set(manifest?.cells ?? []);
    this.field = new GroundField(relief.stepM, relief.tileSizeM);
    const toRd = (x: number, y: number): [number, number] => { const p = lngLatToRd(fromLocal(x, y)); return [p.x, p.y]; };
    const { map } = fitLocalToRd(toRd, 0, 0, 9000);
    this.surface = new GroundSurface(this.field, map, relief.sceneDatumNAP);
    const quant = elevation.quantization.xy, size = elevation.cellSizeM;
    const cellOf = (x: number, y: number) => cellKey(Math.floor(x * quant / size), Math.floor(y * quant / size));
    this.measuredByCell = new Map();
    for (const b of bridges.measured) { const k = cellOf(b.p[0], b.p[1]); (this.measuredByCell.get(k) ?? this.measuredByCell.set(k, []).get(k)!).push(b); }
    this.fallbackByCell = new Map();
    for (const b of bridges.fallback) { const k = cellOf(b.ring[0], b.ring[1]); (this.fallbackByCell.get(k) ?? this.fallbackByCell.set(k, []).get(k)!).push(b); }
    this.boatsByCell = new Map();
    for (const b of boats?.boats ?? []) {
      if (b.ring.length < 4) continue;
      const ring = b.ring.map(([lng, lat]) => toLocal(lng, lat));
      const k = this.cellAt(ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length);
      (this.boatsByCell.get(k) ?? this.boatsByCell.set(k, []).get(k)!).push({ id: b.id, ring });
    }
  }

  /** elevation-v1 storage metres → game local metres. */
  toScene = (x: number, y: number): Vec2 => { const [lng, lat] = localToLngLat(this.elevation, x, y); return toLocal(lng, lat); };

  /** A cell's rectangle in the game frame. */
  cellRect(key: string): Rect {
    const [cx, cy] = key.split('_').map(Number), s = this.elevation.cellSizeM;
    const [x0, y0] = this.toScene(cx * s, cy * s), [x1, y1] = this.toScene((cx + 1) * s, (cy + 1) * s);
    return [x0, y0, x1, y1];
  }

  /** Cell key containing a game-frame point. */
  cellAt(x: number, y: number): string {
    const [lng, lat] = fromLocal(x, y), s = this.elevation.cellSizeM;
    const ex = (lng - this.elevation.origin[0]) * this.elevation.metresPerDegree[0], ey = (lat - this.elevation.origin[1]) * this.elevation.metresPerDegree[1];
    return cellKey(Math.floor(ex / s), Math.floor(ey / s));
  }

  /**
   * Does the ground draw this cell? It needs its OSM cell and relief under at
   * least part of it: a partly covered edge cell is drawn whole, its missing
   * relief tiles extended from their neighbours (`synthesiseTile`), so the
   * basemap no longer shows through at the streaming area's edge.
   */
  covers(key: string): boolean {
    if (!this.osmCells.has(key)) return false;
    const [x0, y0, x1, y1] = this.cellRect(key);
    return this.rdTilesFor([x0 + 1, y0 + 1, x1 - 1, y1 - 1]).some(k => this.hasReliefTile(k));
  }

  /** Is the cell's relief all measured (no extended tiles)? Diagnostics. */
  fullyCovered(key: string): boolean {
    if (!this.osmCells.has(key)) return false;
    const [x0, y0, x1, y1] = this.cellRect(key);
    return this.rdTilesFor([x0 + 1, y0 + 1, x1 - 1, y1 - 1]).every(k => this.hasReliefTile(k));
  }

  private tileSet: Map<string, readonly number[]> | null = null;
  private tileEntry(k: string): readonly number[] | undefined { return (this.tileSet ??= new Map(this.relief.tiles.map(t => [tileKey(t[0], t[1]), t]))).get(k); }
  private hasReliefTile(k: string): boolean { return !!this.tileEntry(k); }
  /** Extract tiles among the 8 neighbours of a tile key. */
  private reliefNeighbours(k: string): string[] {
    const [tx, ty] = k.split('_').map(Number), out: string[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && this.hasReliefTile(tileKey(tx + dx, ty + dy))) out.push(tileKey(tx + dx, ty + dy));
    return out;
  }
  /** Relief is available for a tile: in the extract, or extendable from an extract neighbour. */
  private reliefAvailable(k: string): boolean { return this.hasReliefTile(k) || this.reliefNeighbours(k).length > 0; }

  /** Does the extract have relief at this game-frame point at all (resident or not, measured or extended)? */
  reliefCovered(x: number, y: number): boolean {
    const p = lngLatToRd(fromLocal(x, y)), T = this.relief.tileSizeM;
    return this.reliefAvailable(tileKey(Math.floor(p.x / T), Math.floor(p.y / T)));
  }

  /** Tiles extended from their neighbours (not in the extract), resident now. */
  readonly synthesised = new Set<string>();

  /**
   * A tile the extract lacks, next to tiles it has: the neighbours' samples
   * on a 3×3-tile canvas, pull-push filled (heightField.ts), centre kept. The
   * relief continues smoothly past the extract's edge and flattens toward
   * the neighbours' mean instead of dropping to the flat fallback in a step.
   * Deterministic from the extract, so worker and main thread agree.
   */
  private synthesiseTile(k: string): void {
    const [tx, ty] = k.split('_').map(Number);
    // Extract tiles only (never another extended tile): deterministic. Smooth fill, so no finer than the coarsest data.
    const coarsest = this.relief.tiles.reduce((m, t) => Math.max(m, t[3] ?? this.relief.stepM), this.relief.stepM);
    this.field.addTile(tx, ty, extendTile(this.field, tx, ty, (a, b) => this.hasReliefTile(tileKey(a, b))), coarsest);
    this.reliefTiles.add(k);
    this.synthesised.add(k);
  }

  private rdTilesFor([x0, y0, x1, y1]: Rect): string[] {
    const T = this.relief.tileSizeM, keys = new Set<string>();
    const toRd = (x: number, y: number) => lngLatToRd(fromLocal(x, y));
    const cs = [toRd(x0, y0), toRd(x1, y0), toRd(x0, y1), toRd(x1, y1)];
    for (let tx = Math.floor(Math.min(...cs.map(c => c.x)) / T); tx <= Math.floor(Math.max(...cs.map(c => c.x)) / T); tx++)
      for (let ty = Math.floor(Math.min(...cs.map(c => c.y)) / T); ty <= Math.floor(Math.max(...cs.map(c => c.y)) / T); ty++) keys.add(tileKey(tx, ty));
    return [...keys];
  }

  /** Load the relief tiles under a game-frame rectangle (missing tiles are simply absent: flat fallback). */
  async ensureRelief(rect: Rect): Promise<void> {
    const keys = this.rdTilesFor(rect);
    // Tiles to extend need all their extract neighbours resident first.
    const extend = keys.filter(k => !this.hasReliefTile(k) && !this.reliefTiles.has(k) && this.reliefNeighbours(k).length);
    const load = new Set([...keys.filter(k => this.hasReliefTile(k)), ...extend.flatMap(k => this.reliefNeighbours(k))]);
    await this.loadTiles([...load]);
    for (const k of extend) if (!this.reliefTiles.has(k)) this.timed('relief:synth', k, () => this.synthesiseTile(k));
  }

  private async loadTiles(keys: string[]): Promise<void> {
    await Promise.all(keys.map(k => {
      if (this.reliefTiles.has(k)) return undefined;
      let p = this.reliefLoading.get(k);
      if (!p) {
        const path = `${EXTRACTS.relief}/tiles/${k}.bin`, entry = this.tileEntry(k)!;
        const load = this.options.reliefTile
          ? this.options.reliefTile(path, this.relief, entry)
          : this.fetchBytes(path).then(bytes => ({ heights: this.timed('relief:decode', k, () => readGroundTile(this.relief, entry, bytes)), bytes: bytes.byteLength }));
        p = load.then(async ({ heights, bytes }) => {
          await yieldToFrame(); // one relief tile's field insert per task, not every tile of the batch in one
          this.loadedBytes.relief += bytes;
          const [tx, ty] = k.split('_').map(Number);
          this.timed('relief:insert', k, () => this.field.addTile(tx, ty, heights, entry[3] ?? this.relief.stepM));
          this.reliefTiles.add(k);
        }).finally(() => this.reliefLoading.delete(k));
        this.reliefLoading.set(k, p);
      }
      return p;
    }));
  }

  get reliefTileCount(): number { return this.reliefTiles.size; }

  /** Is measured (or filled) relief resident under this game-frame point? */
  hasRelief(x: number, y: number): boolean {
    if (!this.surface) return false;
    const [rx, ry] = applyLocalToRd(this.surface.localToRd, x, y);
    return this.field.heightRd(rx, ry) === this.field.heightRd(rx, ry);
  }

  /** Drop relief tiles whose centre is farther than `keepM` from a game-frame point. */
  evictRelief(x: number, y: number, keepM: number): number {
    const T = this.relief.tileSizeM, [rx, ry] = (() => { const p = lngLatToRd(fromLocal(x, y)); return [p.x, p.y]; })();
    let n = 0;
    for (const k of [...this.reliefTiles]) {
      const [tx, ty] = k.split('_').map(Number);
      if (Math.hypot((tx + 0.5) * T - rx, (ty + 0.5) * T - ry) <= keepM) continue;
      this.field.removeTile(tx, ty);
      this.reliefTiles.delete(k);
      this.synthesised.delete(k);
      n++;
    }
    return n;
  }

  /**
   * Make a cell ready to build or sample: its relief (plus pad) and its
   * measured decks placed on it. Decks are placed once and kept (a few
   * hundred at most city-wide; their heights are fixed at placement).
   */
  async prepareCell(key: string): Promise<void> {
    const [x0, y0, x1, y1] = this.cellRect(key), pad = CELL_RELIEF_PAD_M;
    await this.ensureRelief([x0 - pad, y0 - pad, x1 + pad, y1 + pad]);
    await yieldToFrame();
    this.placeDecks(key);
    // A bridge belongs to the cell of its first station but may reach into
    // this one: place neighbours' decks too, so streets and the rider here
    // see the hump (their approach ends lie within the relief pad).
    // Deterministic: as far as cellInput reads them (its `near`, 200 m), so a fresh store holds every deck the cell draws.
    const m = this.det ? CELL_INPUT_PAD_M : 60;
    for (const n of GroundStore.neighbours(key)) if (n !== key) this.placeDecks(n, [x0 - m, y0 - m, x1 + m, y1 + m]);
    await yieldToFrame();
    // One width per deck side (bridgeGaps, issue #178): the measured decks around take the survey's deck-level edges
    // before anything here reads them (each deck once, from its owner cell's roads, so every store agrees).
    if (this.bridgeGapsOn) await Promise.all(GroundStore.neighbours(key).flatMap(n => this.decks(n).filter(d => !isWayDeckFamily(d.profile.family)).map(d => this.deckEdges(n, d))));
    if (this.options.wayDecks !== false) await this.placeWayDecks(key);
    await yieldToFrame();
    if (this.options.tunnels !== false) await Promise.all(GroundStore.neighbours(key).map(n => this.planCutsFor(n)));
  }

  /**
   * Way decks and tunnel cuts are planned one at a time (placeWayDecks, planCutsFor): a plan now spans several tasks
   * (pacer), and plans share state (the way ids given a deck, the ways scanned for cuts, the surface they read), so one
   * plan runs to its end before the next starts, in the order they asked, as they did when each was a single task.
   */
  private planQueue: Promise<unknown> = Promise.resolve();
  /** Ground determinism on (the default): see the `deterministic` option. */
  private get det(): boolean { return this.options.deterministic !== false; }
  /** What decks stand on: the bare relief when deterministic (no dependence on the cuts planned so far), else the surface's ground. */
  private get deckGround(): (x: number, y: number) => number { return this.det ? this.surface.relief : this.surface.ground; }
  private planning<T>(plan: () => Promise<T>): Promise<T> {
    const run = this.planQueue.then(plan);
    this.planQueue = run.catch(() => undefined);
    return run;
  }

  /** Tunnel cuts planned per cell (the cell holding the portals), once each. */
  private readonly cutPlans = new Map<string, Promise<void>>();
  /** Way ids scanned for cuts (each scanned once, by the first plan that reaches it; deterministic: by any plan, a record only); negative ids: tunnel runs tried as slots. */
  private readonly cutScanned = new Set<number>();
  /**
   * Plan the tunnel cuts whose portals lie in cell `n` (tunnels.ts planCuts) and place them on the surface: the OSM of
   * its 3×3 neighbourhood is the road graph, the relief is ensured over the cell and CUT_REACH_M around it (a ramp runs
   * a few hundred metres from its portal) and only stations in that box are scanned, so the worker and the main thread
   * plan the same cuts whatever else they hold.
   */
  /** A cell's candidate roads for the cuts (tunnels.ts cutWays), converted once (each plan reads its 3×3). */
  private readonly cutWayCells = new Map<string, Promise<CutWay[]>>();
  private cutWaysOf(k: string): Promise<CutWay[]> {
    let p = this.cutWayCells.get(k);
    if (!p) { p = this.osmCell(k).then(async o => { await yieldToFrame(); return this.timed('cuts:ways', k, () => cutWays(o?.ways ?? [], q => toLocal(q[0], q[1]))); }); this.cutWayCells.set(k, p); } // a task per cell's conversion (#129)
    return p;
  }

  planCutsFor(n: string): Promise<void> {
    let p = this.cutPlans.get(n);
    if (!p) {
      p = (async () => {
        const osm = await this.osmCell(n);
        if (!osm?.ways.some(w => isTunnelTags(w.tags))) return;
        const [x0, y0, x1, y1] = this.cellRect(n), box: Rect = [x0 - CUT_REACH_M, y0 - CUT_REACH_M, x1 + CUT_REACH_M, y1 + CUT_REACH_M];
        const [around] = await Promise.all([Promise.all(GroundStore.neighbours(n).map(k => this.cutWaysOf(k))), this.ensureRelief(box)]);
        await this.planning(async () => {
          const t0 = performance.now();
          await yieldToFrame();
          // A way crossing a cell edge is in both cells' extracts: once each.
          const seen = new Set<number>(), ways = around.flat().filter(w => !seen.has(w.id) && !!seen.add(w.id));
          const inCell = (q: Vec2) => q[0] >= x0 && q[0] < x1 && q[1] >= y0 && q[1] < y1;
          // A step per way scanned, a task every PACE_BUDGET_MS (one plan was a 60-120 ms task while riding, #129).
          // Deterministic: each portal cell's plan scans with its own skip set (a pure function of the cell), and placeCuts
          // settles overlaps between plans by key; otherwise a way is scanned once, by the first plan to reach it.
          const skip = this.det ? new Set<number>() : this.cutScanned;
          const steps = planCutsSteps(ways, this.surface.relief, inCell, skip, box, { portalEnds: this.options.portalEnds !== false, rampGaps: this.options.rampGaps !== false }), pace = pacer(this.options.paceMs);
          const scannedBefore = this.planTrace ? new Set(this.cutScanned) : null;
          for (let r = steps.next(); ; r = steps.next()) {
            if (r.done) { const planned = this.crossings ? this.crossings.cuts(r.value, this.crossingCutStats) : r.value; if (this.det) this.placeCuts(n, planned); else for (const c of planned) { this.surface.addCut(c); this.planTrace?.('cut', c.id, n); } break; }
            await pace();
          }
          // Deterministic: the ways this plan scanned are still recorded (diagnostics, the prepareOnly pin), never skipped.
          if (this.det) for (const id of skip) this.cutScanned.add(id);
          if (scannedBefore) for (const id of this.cutScanned) if (!scannedBefore.has(id)) this.planTrace?.('cutScan', String(id), n);
          this.told('cuts:plan', n, t0);
        });
      })();
      this.cutPlans.set(n, p);
    }
    return p;
  }

  /** Deterministic cut plans: every plan's cuts by kind and way, with the plan's cell key. */
  private readonly cutPool = new Map<string, { cut: Cut; plan: string; on: boolean }[]>();
  /**
   * Place plan `plan`'s cuts. Where two plans cut the same way (kind and way id) and their boxes overlap, the cut of the
   * lower-keyed plan stands and the other is off the surface; the outcome is a function of the plans run, not their order.
   */
  private placeCuts(plan: string, cuts: readonly Cut[]): void {
    const touched = new Set<string>();
    for (const cut of cuts) {
      const k = `${cut.kind}:${cut.way}`;
      (this.cutPool.get(k) ?? this.cutPool.set(k, []).get(k)!).push({ cut, plan, on: false });
      touched.add(k);
    }
    const meets = (a: Cut, b: Cut) => a.bbox[0] <= b.bbox[2] && b.bbox[0] <= a.bbox[2] && a.bbox[1] <= b.bbox[3] && b.bbox[1] <= a.bbox[3];
    for (const k of touched) for (const e of this.cutPool.get(k)!) {
      const on = !this.cutPool.get(k)!.some(o => o !== e && o.plan < e.plan && meets(o.cut, e.cut));
      if (on === e.on) continue;
      e.on = on;
      if (on) { this.surface.addCut(e.cut); this.planTrace?.('cut', e.cut.id, e.plan); } else this.surface.removeCut(e.cut);
    }
  }

  /**
   * True where a measured deck (placed or not) or a flat footprint of these cells carries the point (within
   * WAY_DECK_CLEAR_M): a way deck or a way opening there would be a second bridge beside it.
   */
  private claimedBy(around: readonly string[]): (x: number, y: number) => boolean {
    const flats = around.flatMap(k => this.flatDecks(k));
    // Every measured bridge around, placed or not (a deck is placed only near the cell being prepared).
    const quant = this.elevation.quantization.xy;
    const measuredProfiles = around.flatMap(k => this.measuredByCell.get(k) ?? []).map(b => decodeProfile(b, quant, this.toScene));
    const nearRing = (ring: Vec2[], x: number, y: number) => pointInRing(ring, x, y) || ring.some((a, i) => { const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1e-9))); return Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y) < WAY_DECK_CLEAR_M; });
    return (x: number, y: number) => measuredProfiles.some(p => {
      const [a0, b0, a1, b1] = p.bbox;
      if (x < a0 - 30 || x > a1 + 30 || y < b0 - 30 || y > b1 + 30) return false;
      let best = Infinity, at = 0;
      for (let i = 0; i + 1 < p.x.length; i++) { const dx = p.x[i + 1] - p.x[i], dy = p.y[i + 1] - p.y[i], t = Math.max(0, Math.min(1, ((x - p.x[i]) * dx + (y - p.y[i]) * dy) / (dx * dx + dy * dy || 1e-9))), d = Math.hypot(p.x[i] + dx * t - x, p.y[i] + dy * t - y); if (d < best) { best = d; at = i; } }
      const half = Math.max(p.halfWidth[at], ...(p.sides ?? []));
      return p.s[at] >= p.deck[0] - 1 && p.s[at] <= p.deck[1] + 1 && best <= half + WAY_DECK_CLEAR_M;
    })
      || flats.some(r => nearRing(r, x, y));
  }

  /** Water found beside each edge of an OSM bridge way's opening, by deck id (wayDecks.ts capDeckSides). */
  private readonly wayOpeningSides = new Map<string, [number, number]>();
  /** OSM bridge ways given a deck (wayDecks.ts), by way id. */
  private wayDeckIds = new Set<number>();
  /**
   * Decks for the OSM bridge ways of this cell and its neighbours that no measured deck or flat footprint carries
   * (wayDecks.ts, user 2026-10-16: the Jan Evertsenstraat over the Erasmusgracht drew no bridge). Each is placed once,
   * owned by the cell of its first point, when its box lies within this cell's relief pad.
   */
  /** Deterministic way decks: bridge way ids whose component has been planned. */
  private readonly wayDeckDone = new Set<number>();
  /**
   * Deterministic way decks: the bridge ways of this plan's box (`box`) and those owned by its cell (`cell`), widened to everything they may join or group
   * with (a chain end or a group within WAY_DECK_LINK_M, transitively, over the 3×3's bridge ways), less components an
   * earlier plan did, in id order. A component's decks then come out the same whichever cell plans it.
   */
  private wayDeckComponents(osms: readonly (OsmGroundExtract | null)[], box: Rect, cell: Rect): WayDeckInput[] {
    const all = bridgeWayInputs(osms, () => false, [-Infinity, -Infinity, Infinity, Infinity]).sort((a, b) => a.id - b.id);
    const boxes = all.map(w => [Math.min(...w.points.map(q => q[0])), Math.min(...w.points.map(q => q[1])), Math.max(...w.points.map(q => q[0])), Math.max(...w.points.map(q => q[1]))] as Rect);
    const L = WAY_DECK_LINK_M, linked = (i: number, j: number) => boxes[i][0] - L <= boxes[j][2] && boxes[j][0] - L <= boxes[i][2] && boxes[i][1] - L <= boxes[j][3] && boxes[j][1] - L <= boxes[i][3];
    const comp = all.map((_, i) => i), root = (i: number): number => comp[i] === i ? i : (comp[i] = root(comp[i]));
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (linked(i, j)) { const a = root(i), b = root(j); if (a !== b) comp[Math.max(a, b)] = Math.min(a, b); }
    // In the box, or owned here (its first point in this cell: the deck is this cell's to draw, wherever the way runs).
    const inBox = (i: number) => (boxes[i][0] >= box[0] && boxes[i][2] <= box[2] && boxes[i][1] >= box[1] && boxes[i][3] <= box[3])
      || (all[i].points[0][0] >= cell[0] && all[i].points[0][0] < cell[2] && all[i].points[0][1] >= cell[1] && all[i].points[0][1] < cell[3]);
    const wanted = new Set<number>();
    for (let i = 0; i < all.length; i++) if (inBox(i)) wanted.add(root(i));
    const out = all.filter((w, i) => wanted.has(root(i)) && !all.some((q, j) => root(j) === root(i) && this.wayDeckDone.has(q.id)));
    for (const w of out) this.wayDeckDone.add(w.id);
    return out;
  }

  private async placeWayDecks(key: string): Promise<void> {
    const around = GroundStore.neighbours(key);
    const [osms, waters] = await Promise.all([Promise.all(around.map(k => this.osmCell(k))), Promise.all(around.map(k => this.waterCell(k)))]);
    await this.planning(() => this.planWayDecks(key, around, osms, waters));
  }

  private async planWayDecks(key: string, around: string[], osms: (OsmGroundExtract | null)[], waters: (WaterGeometry | null)[]): Promise<void> {
    const t0 = performance.now(), wait = { ms: 0 };
    try { await this.planWayDecksTimed(key, around, osms, waters, wait); } finally { this.told('waydecks', key, t0, wait.ms); }
  }
  private async planWayDecksTimed(key: string, around: string[], osms: (OsmGroundExtract | null)[], waters: (WaterGeometry | null)[], wait: { ms: number }): Promise<void> {
    const [x0, y0, x1, y1] = this.cellRect(key), pad = CELL_RELIEF_PAD_M - 50;
    await yieldToFrame(); // the cells' JSON decode above and the deck grouping below are separate tasks
    // Each step below is short; a task ends every PACE_BUDGET_MS (the grouping, the road index and the edge search
    // ran as one 60-120 ms task while riding, #129). Same steps in the same order as one task.
    const pace = pacer(this.options.paceMs);
    // Each polygon with its box: a station tests only the polygons around it.
    const wet = waterTest(waters.flatMap(w => w?.polygons ?? []), this.options.planShare !== false);
    const claimed = this.claimedBy(around);
    const ways = this.det ? this.wayDeckComponents(osms, [x0 - pad, y0 - pad, x1 + pad, y1 + pad], [x0, y0, x1, y1]) : bridgeWayInputs(osms, id => this.wayDeckIds.has(id), [x0 - pad, y0 - pad, x1 + pad, y1 + pad]);
    // A component may reach past this cell's relief pad: its relief too, so the answer does not depend on what else is loaded.
    if (this.det && ways.length) {
      const r = WAY_DECK_LINK_M + ROAD_EDGE_REACH_MAX_M + 10;
      await this.waited(this.ensureRelief([Math.min(...ways.flatMap(w => w.points.map(q => q[0]))) - r, Math.min(...ways.flatMap(w => w.points.map(q => q[1]))) - r, Math.max(...ways.flatMap(w => w.points.map(q => q[0]))) + r, Math.max(...ways.flatMap(w => w.points.map(q => q[1]))) + r]), wait);
    }
    // Consecutive pieces of one bridge join first (wayDecks.ts joinChains).
    const joined = this.options.wayDeckChains === false ? { ways, members: new Map(ways.map(w => [w.id, [w.id]])) } : joinChains(ways), chained = joined.ways, ground = this.options.wayDeckHoles === false ? undefined : this.deckGround;
    await pace();
    const crossings: ReturnType<typeof wayDeckCrossing>[] = [];
    for (const w of chained) { crossings.push(wayDeckCrossing(w, wet, claimed, ground)); await pace(); }
    const { profiles, covered } = groupWayDecks(crossings, wet, ground), dry = new Set<DeckProfile>();
    // bridgeGaps step 3 (issue #178): bridge ways over land the survey draws as a deck with no road under it.
    // With step 3 off, only the bridge ways over a railway track (wayDecks.ts crossesTrack, lane rails-uncover): `railDecks`.
    const allDry = this.options.dryWayDecks === true, railDry = !allDry && this.options.railDecks !== false && this.options.rails !== false;
    if (this.bridgeGapsOn && (allDry || railDry)) {
      // Piece by piece (not the joined chains): a bus station's platform ways chain into one long line that bends.
      const done = new Set(covered), open = new Set(chained.flatMap((w, i) => crossings[i].p || done.has(w.id) ? [] : joined.members.get(w.id) ?? [w.id]));
      let rest = ways.filter(w => open.has(w.id));
      if (railDry && rest.length) {
        const tracks = (await this.waited(Promise.all(around.map(k => this.railCell(k).catch(() => [] as RailWay[]))), wait)).flat().filter(t => !t.bridge).map(t => t.points);
        rest = tracks.length ? rest.filter(w => crossesTrack(w.points, tracks)) : [];
      }
      if (rest.length) {
        const pad = Math.max(...rest.map(w => w.halfWidth)) + 12;
        const box: Rect = [Math.min(...rest.flatMap(w => w.points.map(q => q[0]))) - pad, Math.min(...rest.flatMap(w => w.points.map(q => q[1]))) - pad, Math.max(...rest.flatMap(w => w.points.map(q => q[0]))) + pad, Math.max(...rest.flatMap(w => w.points.map(q => q[1]))) + pad];
        const idx = await RoadIndex.paced([null, ...await this.waited(Promise.all(around.map(k => this.roadCell(k))), wait)], box, pace);
        const roadBelow = (x: number, y: number) => idx.onGround(x, y, DRY_DECK_BLOCKERS);
        const dryAt = (x: number, y: number) => !wet(x, y) && idx.onDeck(x, y) && !roadBelow(x, y);
        // On another deck's carriageway (no clearance: a bus station's platform lanes run side by side on one structure).
        const near = (p: DeckProfile, x: number, y: number) => {
          const [a0, b0, a1, b1] = p.bbox;
          if (x < a0 || x > a1 || y < b0 || y > b1) return false;
          for (let i = 0; i < p.x.length; i++) if (p.s[i] >= p.deck[0] && p.s[i] <= p.deck[1] && Math.hypot(p.x[i] - x, p.y[i] - y) <= p.halfWidth[i]) return true;
          return false;
        };
        for (const w of rest) {
          // A claimed end (the deck of the lane it merges into) trims the run; a claim inside it keeps the way off.
          const taken = (x: number, y: number) => claimed(x, y) || profiles.some(q => near(q, x, y));
          const p = dryWayDeckProfile(w, (x, y) => dryAt(x, y) && !taken(x, y), taken);
          if (p && dryDeckGrade(p, this.deckGround) <= DRY_DECK_MAX_GRADE) { if (railDry) runOverEndHoles(p, this.deckGround); profiles.push(p); dry.add(p); }
          await pace();
        }
        // Only now (the loop above reads the earlier decks' half-widths as their carriageways): the survey sets the width.
        for (const p of dry) narrowDryDeck(p);
      }
    }
    for (const w of ways) { this.wayDeckIds.add(w.id); this.planTrace?.('wayDeck', String(w.id), key); }
    // roads-v1: the parapets stand at the road surfaces' outer edges (carriageway, cycle path, footway), not the way's drawn half-width (wayDecks.ts roadEdgeSides).
    if (profiles.length && this.options.roads === true && this.options.wayDeckCarriage !== false) {
      const cells = await this.waited(Promise.all(around.map(k => this.roadCell(k))), wait);
      await yieldToFrame();
      // Only the road polygons the edge search can reach (the profiles' boxes, padded by the widest reach): the full
      // 3×3 earcut was the largest main-thread task while riding (#129, 50-90 ms). A null first cell, because
      // SurfaceIndex keeps every polygon of its first cell.
      const reach = Math.max(...profiles.map(p => Math.max(...p.halfWidth))) + ROAD_EDGE_REACH_MAX_M + 2;
      const within: Rect = [
        Math.min(...profiles.map(p => p.bbox[0])) - reach, Math.min(...profiles.map(p => p.bbox[1])) - reach,
        Math.max(...profiles.map(p => p.bbox[2])) + reach, Math.max(...profiles.map(p => p.bbox[3])) + reach,
      ];
      const index = await RoadIndex.paced([null, ...cells], within, pace);
      await yieldToFrame();
      const onRoad = (x: number, y: number) => index.classAt(x, y, true) !== null;
      for (const profile of profiles) {
        if (dry.has(profile)) continue; // the survey's deck polygon sets a dry deck's width, not the road surfaces beside it
        const sides = roadEdgeSides(profile, onRoad);
        await pace();
        if (!sides) continue;
        profile.sides = sides;
        const r = Math.max(0, Math.max(...sides) - Math.max(...profile.halfWidth));
        profile.bbox = [profile.bbox[0] - r, profile.bbox[1] - r, profile.bbox[2] + r, profile.bbox[3] + r];
      }
    }
    // Over water opened under the way (withOpenings), the deck stops where the water beside the bridge begins: a bundle's
    // half-width or the road edges can reach past it (the De Clercqstraat's four ways, 41 m, over a 30 m bridge).
    let deckIndex: RoadIndex | null = null;
    // Only the polygons deckEdgeSides can probe: each opened profile's box padded by its reach (onDeck asks which
    // polygons contain a point, so the rest cannot answer). The full 3x3 earcut was a 100+ ms task while riding (#129).
    let deckWithin: Rect | null = null;
    for (const profile of profiles) {
      const open = this.wayOpeningSides.get(profile.id);
      if (!open) continue;
      const r = Math.max(...profile.halfWidth, ...open) + ROAD_EDGE_REACH_MAX_M + 2, b = profile.bbox;
      deckWithin = deckWithin
        ? [Math.min(deckWithin[0], b[0] - r), Math.min(deckWithin[1], b[1] - r), Math.max(deckWithin[2], b[2] + r), Math.max(deckWithin[3], b[3] + r)]
        : [b[0] - r, b[1] - r, b[2] + r, b[3] + r];
    }
    for (const profile of profiles) {
      const open = this.wayOpeningSides.get(profile.id);
      if (!open) continue;
      // The survey's deck-level polygons outline the bridge (wayDecks.ts deckEdgeSides); the opening's water is the cap.
      if (this.options.roads === true) {
        if (!deckIndex) { deckIndex = await RoadIndex.paced([null, ...await this.waited(Promise.all(around.map(k => this.roadCell(k))), wait)], deckWithin ?? undefined, pace); await yieldToFrame(); }
        const idx = deckIndex, e = deckEdgeSides(profile, (x, y) => idx.onDeck(x, y), Math.max(...profile.halfWidth, ...open) + ROAD_EDGE_REACH_MAX_M);
        if (e[0] !== undefined || e[1] !== undefined) setDeckSides(profile, [e[0] ?? open[0], e[1] ?? open[1]]);
        else capDeckSides(profile, open);
      } else capDeckSides(profile, open);
      await pace();
    }
    // One width per deck side (bridgeGaps): the way decks too reach the survey's deck-level edges.
    if (profiles.length && this.bridgeGapsOn) {
      const reach = Math.max(...profiles.map(p => Math.max(...p.halfWidth, ...(p.sides ?? []), dry.has(p) ? DRY_EDGE_M : 0))) + 4;
      const within: Rect = [Math.min(...profiles.map(p => p.bbox[0])) - reach, Math.min(...profiles.map(p => p.bbox[1])) - reach, Math.max(...profiles.map(p => p.bbox[2])) + reach, Math.max(...profiles.map(p => p.bbox[3])) + reach];
      const idx = await RoadIndex.paced([null, ...await this.waited(Promise.all(around.map(k => this.roadCell(k))), wait)], within, pace);
      for (const profile of profiles) {
        // A dry way deck's edge also stops halfway to the next dry way deck (the bus station's lanes share one structure:
        // each takes its own half of the survey polygon, so the pieces meet edge to edge instead of overlapping).
        const others = dry.has(profile) ? [...dry].filter(q => q !== profile) : [];
        const nearer = (x: number, y: number) => {
          if (!others.length) return false;
          const own = stationDistance(profile, x, y);
          return others.some(q => stationDistance(q, x, y) < own);
        };
        const edges = surveyDeckEdges(profile, (x, y) => idx.onDeck(x, y), (x, y) => (idx.onGround(x, y) && !idx.onDeck(x, y)) || nearer(x, y), dry.has(profile) ? DRY_EDGE_M : 0);
        if (edges) { profile.edges = edges; profile.bbox = edgesBox(profile, edges); }
        await pace();
      }
    }
    for (const profile of profiles) {
      const owner = this.cellAt(profile.x[0], profile.y[0]);
      (this.decksByCell.get(owner) ?? this.decksByCell.set(owner, []).get(owner)!).push(this.surface.addDeck(profile, this.deckGround));
      this.planTrace?.('deck', profile.id, key);
    }
  }

  /** bridgeGaps (issue #178): on by default with the road survey; `bridgeGaps: false` keeps the pre-fix decks (the A/B's before). */
  private get bridgeGapsOn(): boolean { return this.options.roads === true && this.options.bridgeGaps !== false; }
  /** Survey edges per measured deck id (bridgeGaps), planned once. */
  private readonly edgePlans = new Map<string, Promise<void>>();
  /**
   * A measured deck's riding edges from the road survey's deck-level polygons around its owner cell (bridgeGaps.ts
   * surveyDeckEdges): the riding surface, its weight, the deck footprint and the kit's widths then all read them.
   */
  private deckEdges(owner: string, deck: DeckSurface): Promise<void> {
    let plan = this.edgePlans.get(deck.profile.id);
    if (!plan) {
      plan = (async () => {
        const cells = await Promise.all(GroundStore.neighbours(owner).map(k => this.roadCell(k)));
        if (!cells.some(c => c)) return;
        const t0 = performance.now();
        const p = deck.profile, reach = Math.max(...p.halfWidth, ...(p.sides ?? [])) + 4, [x0, y0, x1, y1] = p.bbox;
        // A null first cell: SurfaceIndex keeps every polygon of its first cell (only the deck's box is wanted).
        const index = await RoadIndex.paced([null, ...cells], [x0 - reach, y0 - reach, x1 + reach, y1 + reach], pacer(this.options.paceMs));
        const edges = surveyDeckEdges(p, (x, y) => index.onDeck(x, y), (x, y) => index.onGround(x, y) && !index.onDeck(x, y));
        if (edges) this.surface.widenDeck(deck, edges, edgesBox(p, edges));
        this.told('decks:edges', deck.profile.id, t0);
      })();
      this.edgePlans.set(deck.profile.id, plan);
    }
    return plan;
  }

  /** Measured decks assigned to `key` (optionally only those whose bbox meets `within`), each placed once. */
  private placeDecks(key: string, within?: Rect): void {
    this.timed('decks:place', key, () => this.placeDecksNow(key, within));
  }
  private placeDecksNow(key: string, within?: Rect): void {
    const quant = this.elevation.quantization.xy;
    let placed = this.decksByCell.get(key);
    if (!placed) { placed = []; this.decksByCell.set(key, placed); }
    const done = new Set(placed.map(d => d.profile.id));
    for (const b of this.measuredByCell.get(key) ?? []) {
      if (done.has(b.id)) continue;
      const profile = decodeProfile(b, quant, this.toScene);
      if (within) {
        const [a0, b0, a1, b1] = profile.bbox;
        if (a1 < within[0] || a0 > within[2] || b1 < within[1] || b0 > within[3]) continue;
      }
      placed.push(this.surface.addDeck(profile, this.deckGround));
    }
  }

  decks(key: string): DeckSurface[] { return this.decksByCell.get(key) ?? []; }

  /** Unmeasured (flat) deck footprints whose first vertex lies in the cell, game frame. */
  flatDecks(key: string): Vec2[][] {
    let rings = this.flatByCell.get(key);
    if (!rings) {
      const quant = this.elevation.quantization.xy;
      rings = (this.fallbackByCell.get(key) ?? []).map(b => {
        const ring = decodeFallback(b, quant, this.toScene).ring, pts: Vec2[] = [];
        for (let i = 0; i < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
        return pts;
      });
      this.flatByCell.set(key, rings);
    }
    return rings;
  }
  /** Register id and movable flag of each flat deck of `flatDecks(key)`, same order. */
  flatDeckMeta(key: string): { id: string; movable: boolean }[] {
    return (this.fallbackByCell.get(key) ?? []).map(b => ({ id: b.id, movable: b.type === 'Beweegbare brug' }));
  }

  /** Measured bridge ids per cell, for diagnostics and named regressions. */
  deckIds(key: string): string[] { return this.decks(key).map(d => d.profile.id); }

  /** A cell's water polygons and shores in the game frame (null: no water cell). */
  waterCell(key: string): Promise<WaterGeometry | null> {
    let p = this.water.get(key);
    if (!p) {
      const [ex, ey] = key.split('_').map(Number);
      if (!this.elevation.cells.some(([cx, cy]) => cx === ex && cy === ey)) p = Promise.resolve(null);
      else p = this.fetchBytes(`${EXTRACTS.water}/cells/${key}.json`).then(async bytes => {
        this.loadedBytes.water += bytes.byteLength;
        await beforeParse();
        const geo = this.timed('parse:water', key, () => {
          const cell = JSON.parse(new TextDecoder().decode(bytes)) as WaterCell;
          const quant = this.elevation.quantization.xy, ox = cell.cell[0] * this.elevation.cellSizeM, oy = cell.cell[1] * this.elevation.cellSizeM;
          const ring = (r: number[]) => { const out: Vec2[] = []; for (let i = 0; i < r.length; i += 2) out.push(this.toScene(ox + r[i] * quant, oy + r[i + 1] * quant)); return out; };
          const geo: WaterGeometry = { polygons: cell.water.map(poly => poly.map(ring)), shores: cell.shore.map(ring) };
          this.attachLevels(key, geo);
          return geo;
        });
        return (this.options.openings === false ? Promise.resolve(geo) : this.withOpenings(key, geo)).then(out => { this.waterResident.set(key, out); return out; });
      }).catch(() => null);
      this.water.set(key, p);
    }
    return p;
  }

  /** Measured deck profiles decoded for the openings rule (not placed on the surface), by register id. */
  private readonly openingProfiles = new Map<string, OpeningDeck & { bbox: [number, number, number, number] }>();
  /** Water ids opened per cell (named regressions, the lane report). */
  readonly openedDecks = new Map<string, string[]>();

  /** Open the water under footbridges whose water polygon stops at the bridge (water.ts openUnderFootbridges). */
  private async withOpenings(key: string, geo: WaterGeometry): Promise<WaterGeometry> {
    const t0 = performance.now(), wait = { ms: 0 };
    try { return await this.withOpeningsTimed(key, geo, wait); } finally { this.told('water:openings', key, t0, wait.ms); }
  }
  private async withOpeningsTimed(key: string, geo: WaterGeometry, wait: { ms: number }): Promise<WaterGeometry> {
    const rect = this.cellRect(key), quant = this.elevation.quantization.xy, decks: OpeningDeck[] = [];
    for (const k of GroundStore.neighbours(key)) for (const b of this.measuredByCell.get(k) ?? []) {
      let p = this.openingProfiles.get(b.id);
      if (!p) { p = decodeProfile(b, quant, this.toScene); this.openingProfiles.set(b.id, p); }
      const [a0, b0, a1, b1] = p.bbox;
      if (!(a1 < rect[0] || a0 > rect[2] || b1 < rect[1] || b0 > rect[3])) decks.push(p);
    }
    let r = openUnderFootbridges(geo, decks, rect, WATER_Z);
    if (this.options.wayOpenings !== false) {
      // OSM bridge ways over water cut at the bridge, no register outline carrying them (wayDecks.ts WAY_OPENING_REACH_M).
      const around = GroundStore.neighbours(key), osms = await this.waited(Promise.all(around.map(k => this.osmCell(k))), wait);
      // The cell's decode, the bridge ways and the ground crossings are separate tasks (#129: one water cell's decode
      // chain was an 11+ ms task while riding at 1x). Same steps, same order.
      await yieldToFrame();
      const claimed = this.claimedBy(around), m = 30;
      const ways = bridgeWayInputs(osms, () => false, [rect[0] - m, rect[1] - m, rect[2] + m, rect[3] + m]);
      // A way with any station a measured deck or footprint carries is that bridge's (its end nodes can lie past the deck span).
      // Tested a way per step (#129 hand-back 16: the whole filter was one 18-32 ms task at 4x); same test, same order.
      const unclaimed: typeof ways = [], paceWays = pacer(this.options.paceMs);
      for (const w of ways) {
        const d = wayOpeningDeck(w);
        let free = true;
        for (let i = 0; i < d.x.length && free; i++) if (claimed(d.x[i], d.y[i])) free = false;
        if (free) unclaimed.push(w);
        await paceWays();
      }
      const free = bridgeWayBundles(unclaimed);
      if (free.length) {
        await yieldToFrame();
        // Paced like the planning (#129: groundCrossing alone was a 33-37 ms task at 4x); the same test either way.
        const under = await groundCrossingPaced(osms, pacer(this.options.paceMs));
        await yieldToFrame();
        const w = openUnderFootbridges(r.geo, free.map(wayOpeningDeck), rect, WATER_Z, { maxWidth: Infinity, reach: WAY_OPENING_REACH_M, under });
        for (const [id, sd] of w.sides) this.wayOpeningSides.set(id, sd);
        r = { ...w, opened: [...r.opened, ...w.opened] };
      }
    }
    if (r.opened.length) this.openedDecks.set(key, r.opened);
    const boats = this.boatsByCell.get(key);
    if (!boats?.length) return r.geo;
    await yieldToFrame();
    const m = openUnderHouseboats(r.geo, boats, rect, WATER_Z);
    if (m.opened.length) this.openedBerths.set(key, m.opened);
    return m.geo;
  }

  /** Scene z of a NAP level under this extract's datum. */
  sceneZ(nap: number): number { return +(nap - this.relief.sceneDatumNAP).toFixed(3); }

  /** Per-polygon / per-shore water surface from water-levels.json (ignored when its counts do not match the cell). */
  private attachLevels(key: string, geo: WaterGeometry): void {
    const e = this.waterLevels?.cells[key];
    if (!e) return;
    const expand = (v: number | number[], n: number) => Array.isArray(v) ? (v.length === n ? v : null) : Array.from({ length: n }, () => v);
    const p = expand(e.p, geo.polygons.length), s = expand(e.s, geo.shores.length);
    if (p) geo.levels = p.map(v => this.sceneZ(v));
    if (s) geo.shoreLevels = s.map(v => this.sceneZ(v));
  }

  /** Water surface (scene z) at a game-frame point if it lies on resident water, else the canal level. */
  waterZ(x: number, y: number): number {
    return waterZAt([...this.waterResident.values()], x, y, WATER_Z);
  }

  /** A cell's OSM ground (null: outside the fetched area). */
  osmCell(key: string): Promise<OsmGroundExtract | null> {
    let p = this.osm.get(key);
    if (!p) {
      p = this.osmCells.has(key)
        ? this.fetchBytes(`${EXTRACTS.osm}/cells/${key}.json.gz`).then(async bytes => { this.loadedBytes.osm += bytes.byteLength; await beforeParse(); const o = this.timed('parse:osm', key, () => JSON.parse(new TextDecoder().decode(bytes)) as OsmGroundExtract); return this.options.prepareOnly ? { ...o, areas: [] } : o; }).catch(() => null)
        : Promise.resolve(null);
      this.osm.set(key, p);
    }
    return p;
  }

  /** A cell's parks (null: no park in it, or parks off). */
  parkCell(key: string): Promise<ParksCell | null> {
    let p = this.parks.get(key);
    if (!p) {
      p = this.parkCells.has(key)
        ? this.fetchBytes(`${EXTRACTS.parks}/cells/${key}.json.gz`).then(async bytes => { this.loadedBytes.parks += bytes.byteLength; await beforeParse(); return this.timed('parse:parks', key, () => JSON.parse(new TextDecoder().decode(bytes)) as ParksCell); }).catch(() => null)
        : Promise.resolve(null);
      this.parks.set(key, p);
    }
    return p;
  }

  /** The roads-v1 directory the cells are read from (roadCells.ts roadCellDir; `cells` with `?roadSlivers=0`). */
  roadCellDir = 'cells';

  /** A cell's road partition (null: no roads-v1 cell for it, or roads off). */
  roadCell(key: string): Promise<RoadCell | null> {
    let p = this.roads.get(key);
    if (!p) {
      p = this.roadCells.has(key)
        ? this.fetchBytes(`${EXTRACTS.roads}/${this.roadCellDir}/${key}.json.gz`).then(async bytes => { this.loadedBytes.roads += bytes.byteLength; await beforeParse(); const c = this.timed('parse:roads', key, () => JSON.parse(new TextDecoder().decode(bytes)) as RoadCell); return ROAD_CELL_VERSIONS.includes(c.version) ? (this.options.prepareOnly ? { ...c, kerbs: [], coverWays: [] } : c) : null; }).catch(() => null)
        : Promise.resolve(null);
      this.roads.set(key, p);
    }
    return p;
  }

  /** A cell's road-marking nodes (empty: none, or roads off). */
  markCell(key: string): Promise<RoadMark[]> {
    let p = this.marks.get(key);
    if (!p) {
      p = this.markCells.has(key)
        ? this.fetchBytes(`${EXTRACTS.marks}/cells/${key}.json.gz`).then(async bytes => { this.loadedBytes.roads += bytes.byteLength; await beforeParse(); return this.timed('parse:marks', key, () => { const c = JSON.parse(new TextDecoder().decode(bytes)); return isRoadMarksCell(c) ? decodeMarks(c) : []; }); }).catch(() => [])
        : Promise.resolve([]);
      this.marks.set(key, p);
    }
    return p;
  }

  /** A cell's railway tracks (empty: none, or rails off). */
  railCell(key: string): Promise<RailWay[]> {
    return this.railData(key).then(r => r.ways);
  }

  /** A cell's railway platforms above ground (railTracks.ts RailPlatform; empty: none, or an extract without them). */
  railPlatformCell(key: string): Promise<RailPlatform[]> {
    return this.railData(key).then(r => r.platforms);
  }

  private railData(key: string): Promise<{ ways: RailWay[]; platforms: RailPlatform[] }> {
    let p = this.rail.get(key);
    if (!p) {
      const none = { ways: [], platforms: [] };
      const outcome = (o: string) => { this.railOutcomes.set(key, o); };
      const path = `${EXTRACTS.rail}/cells/${key}.json.gz`, retry = this.options.railRetry !== false;
      const fetchBytes = () => retry ? retrying(() => this.fetchBytes(path), this.options.railRetryMs) : this.fetchBytes(path);
      const loaded = this.railCells.has(key)
        ? fetchBytes().then(async bytes => { this.loadedBytes.osm += bytes.byteLength; await beforeParse(); const c = this.timed('parse:rail', key, () => JSON.parse(new TextDecoder().decode(bytes))); if (!isRailCell(c)) { outcome('empty'); if (retry) this.loadErrors.push(`rail ${key}: not a rail-v1 cell`); return none; } const r = { ways: decodeRail(c), platforms: decodePlatforms(c) }; outcome(`ok:${r.ways.length}`); return r; })
        : (outcome('absent'), Promise.resolve(none));
      p = loaded.catch(error => {
        const message = String((error as Error)?.message ?? error).slice(0, 120);
        outcome(`error:${message}`);
        // `?railRetry=0`: cached as "no rails" until forgetCells, and the cell built without its tracks (the pre-#232 build).
        if (!retry) return none;
        // Not cached: the next build asks again. This build fails (and is retried) rather than drawing a cell without rails.
        if (this.rail.get(key) === p) this.rail.delete(key);
        this.loadErrors.push(`rail ${key}: ${message}`);
        throw new Error(`rail cell ${key}: ${message}`);
      });
      this.rail.set(key, p);
    }
    return p;
  }

  /** A cell's BGT courtyards (null: none, or courtyards off). */
  courtyardCell(key: string): Promise<CourtyardsCell | null> {
    let p = this.courtyards.get(key);
    if (!p) {
      p = this.courtyardCells.has(key)
        ? this.fetchBytes(`${EXTRACTS.courtyards}/cells/${key}.json.gz`).then(async bytes => { this.loadedBytes.courtyards += bytes.byteLength; await beforeParse(); return this.timed('parse:courtyards', key, () => JSON.parse(new TextDecoder().decode(bytes)) as CourtyardsCell); }).catch(() => null)
        : Promise.resolve(null);
      this.courtyards.set(key, p);
    }
    return p;
  }

  /** A cell's BGT open ground (null: none, or open ground off). */
  openGroundCell(key: string): Promise<OpenGroundCell | null> {
    let p = this.openGround.get(key);
    if (!p) {
      p = this.openGroundCells.has(key)
        ? this.fetchBytes(`${EXTRACTS.openGround}/cells/${key}.json.gz`).then(async bytes => { this.loadedBytes.openGround += bytes.byteLength; await beforeParse(); return this.timed('parse:openGround', key, () => JSON.parse(new TextDecoder().decode(bytes)) as OpenGroundCell); }).catch(() => null)
        : Promise.resolve(null);
      this.openGround.set(key, p);
    }
    return p;
  }

  private readonly wetGroundMemo = new WeakMap<RoadCell, Vec2[][]>();
  /** The road cell's ground polygons over water that stand as a deck (wetGround.ts), memoised per loaded cell. */
  private wetGroundOf(cell: RoadCell | null, waterAround: readonly (WaterGeometry | null)[]): Vec2[][] {
    if (!cell) return [];
    const hit = this.wetGroundMemo.get(cell);
    if (hit) return hit;
    const geos = waterAround.filter((g): g is WaterGeometry => !!g), polys = geos.flatMap(g => g.polygons);
    let box: [number, number, number, number] | null = null;
    for (const poly of polys) for (const [x, y] of poly[0] ?? []) box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)] : [x, y, x, y];
    const rings = wetGroundRings(cell.surfaces, { wet: waterTest(polys, this.options.planShare !== false), ground: (x, y) => this.surface.ground(x, y), waterZ: (x, y) => waterZAt(geos, x, y, WATER_Z), waterBox: box });
    this.wetGroundMemo.set(cell, rings);
    return rings;
  }

  /** Forget cached water/OSM data for cells far away (relief is evicted separately). */
  forgetCells(keep: ReadonlySet<string>): void {
    for (const map of [this.water, this.osm, this.parks, this.roads, this.marks, this.rail, this.courtyards, this.openGround, this.waterResident, this.cutWayCells] as Map<string, unknown>[]) for (const k of [...map.keys()]) if (!keep.has(k)) map.delete(k);
  }

  /**
   * Everything a cell build needs, loaded: its relief and decks, the water and
   * OSM of its 3×3 neighbourhood, and the deck footprints near it.
   */
  async cellInput(key: string, lod: 0 | 1, detail: CellDetail = 'full'): Promise<CellInput> {
    if (this.options.prepareOnly) throw new Error('GroundStore: a prepareOnly store keeps no OSM areas or kerbs and cannot build a cell');
    await this.prepareCell(key);
    const around = GroundStore.neighbours(key);
    const [water, waterAround, osm, osmAround, parksAround, roadsAround, courtyardsAround, marksAround, railsAround, openGroundAround] = await Promise.all([
      this.waterCell(key),
      Promise.all(around.map(k => this.waterCell(k))),
      this.osmCell(key),
      Promise.all(around.filter(k => k !== key).map(k => this.osmCell(k))),
      Promise.all(around.map(k => this.parkCell(k))),
      Promise.all(around.map(k => this.roadCell(k))),
      Promise.all(around.map(k => this.courtyardCell(k))),
      Promise.all(around.map(k => this.markCell(k))),
      Promise.all(around.map(k => this.railCell(k))),
      Promise.all(around.map(k => this.openGroundCell(k))),
    ]);
    const tAssemble = performance.now();
    const rails = railsAround[around.indexOf(key)] ?? [];
    // Platforms of the 3×3 (a platform crossing a seam is in both cells' lists: once here).
    const platformSeen = new Set<string>(), railPlatforms = rails.length ? (await Promise.all(around.map(k => this.railPlatformCell(k)))).flat().filter(p => { const k = p.ring.map(q => `${q[0]},${q[1]}`).join(';'); return !platformSeen.has(k) && !!platformSeen.add(k); }) : [];
    // Path ways a park's BGT path polygons replace may run into the neighbours' junction graph: drop them everywhere.
    const dropWays = parksAround.flatMap(p => p?.dropWays ?? []);
    // Ways the road polygons cover (roads-v1) likewise: a covered way's bands are gone wherever it is drawn.
    const coverWays = [...new Set(roadsAround.flatMap(r => r?.coverWays ?? []))];
    const hasRoads = roadsAround.some(r => !!r);
    const rect = this.cellRect(key), pad = CELL_INPUT_PAD_M;
    // Deterministic: decks and cuts in id order (a store's arrival order is its history).
    const byId = <T>(id: (t: T) => string) => (a: T, b: T) => id(a) < id(b) ? -1 : id(a) > id(b) ? 1 : 0;
    const deckOrder = <T extends DeckSurface>(list: readonly T[]): T[] => this.det ? [...list].sort(byId<T>(d => d.profile.id)) : [...list];
    const near = (b: [number, number, number, number]) => !(b[2] < rect[0] - pad || b[0] > rect[2] + pad || b[3] < rect[1] - pad || b[1] > rect[3] + pad);
    // Movable leaves get the fixed spans to the quays their bridge way crosses (decks.ts movableApproaches).
    const bridgeLines = this.options.approaches === false ? [] : [osm, ...osmAround].flatMap(o => o?.ways ?? [])
      .filter(w => w.tags.bridge && w.tags.bridge !== 'no').map(w => w.g.map(p => toLocal(p[0], p[1])));
    const approaches = (k: string) => {
      const meta = this.flatDeckMeta(k);
      return this.flatDecks(k).flatMap((ring, i) => meta[i]?.movable && bridgeLines.length ? movableApproaches(ring, bridgeLines).map(r => ({ ring: r, id: `${meta[i].id}-approach` })) : []);
    };
    const own = approaches(key);
    // A measured deck's footprint reaches over the water past its span to the bank (decks.ts deckReach, as the deck top
    // and the kit draw it): the survey's ground polygons (h = 0) that end at the bridge's surveyed start overlie that
    // water, and the street mask cut them there, leaving the grey deck top as a jagged band across the road at both
    // ends (user 2026-10-16, a Prinsengracht bridge). The reach is read off the water polygons (the mask is built from these rings).
    const wetAround = waterTest(waterAround.flatMap(g => g?.polygons ?? []), this.options.planShare !== false);
    const wetGround = this.options.wetGround === false ? [] : this.wetGroundOf(roadsAround[around.indexOf(key)] ?? null, waterAround);
    const deckRingsAround: Vec2[][] = [
      // Deterministic: the decks of the 3×3 (a store that prepared the neighbours also holds decks of cells beyond it).
      ...deckOrder((this.det ? around.flatMap(k => this.decks(k)) : this.surface.decks).filter(d => near(d.profile.bbox))).map(d => GroundSurface.footprint(d, this.options.deckEnds === false ? undefined : deckReach(d, wetAround).reach)),
      ...around.flatMap(k => [...this.flatDecks(k), ...(k === key ? own : approaches(k)).map(a => a.ring)]),
      // Ground polygons standing over mapped water at street height (a plein over a canal: the Muntplein over the Singel,
      // wetGround.ts): decks too, so the water mask never cuts them (user 2026-10-30, water through the Muntplein).
      ...wetGround,
      // roads-v1 deck polygons (h ≥ 1): the water mask never cuts a surveyed bridge surface (or the bands over it).
      ...roadsAround.flatMap(r => (r ? r.surfaces.filter(s => s.h >= 1).map(s => decodeRoadLine(s.r[0])).filter(ring => ring.length >= 3 && near([Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1])), Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))])) : [])),
    ];
    const input: CellInput = {
      key, lod, detail, rect, surface: this.surface, water,
      waterAround: waterAround.filter((g): g is WaterGeometry => !!g),
      decks: this.det ? deckOrder(this.decks(key)) : this.decks(key), deckRingsAround, wetGround,
      cuts: this.det ? this.surface.cuts.filter(c => near(c.bbox)).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : a.bbox[0] - b.bbox[0] || a.bbox[1] - b.bbox[1]) : this.surface.cuts.filter(c => near(c.bbox)),
      flatDecks: [...this.flatDecks(key), ...own.map(a => a.ring)],
      // bridgeGaps: the survey's deck polygons are drawn on the flat footprints around (a polygon's point may lie in a neighbour's).
      ...(this.bridgeGapsOn ? { flatDecksAround: around.flatMap(k => this.flatDecks(k)) } : {}),
      flatDeckMeta: [...this.flatDeckMeta(key), ...own.map(a => ({ id: a.id, movable: false }))],
      // Landed platforms near the cell (landedPlatforms.ts): the quay wall leaves them out, their own stone walls meet it.
      landedPlatforms: landedPlatformRings(toLocal).filter(r => near(r.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number]))),
      osm, osmAround: osmAround.filter((o): o is OsmGroundExtract => !!o),
      parks: parksAround[around.indexOf(key)] ?? null, parksAround, dropWays, ...(this.options.clipDecks === false ? { clipDecks: false } : {}), ...(this.options.deckEnds === false ? { deckEnds: false } : {}), ...(this.options.bridgeGaps === false ? { bridgeGaps: false } : {}), ...(this.options.bridgeCarry === false ? { bridgeCarry: false } : {}), ...(this.options.redDedupe === false ? { redDedupe: false } : {}), ...(this.options.portalClip === false ? { portalClip: false } : {}), ...(this.options.portalEnds === false ? { portalEnds: false } : {}),
      ...(hasRoads ? { roads: roadsAround[around.indexOf(key)] ?? null, roadsAround, coverWays, marks: marksAround.flat(), evidence: this.evidence } : {}),
      courtyards: courtyardsAround[around.indexOf(key)] ?? null, courtyardsAround,
      // open-ground-v1 only where the neighbourhood has some: a cell without it builds byte-identical to before.
      ...(openGroundAround.some(o => !!o) ? { openGround: openGroundAround[around.indexOf(key)] ?? null, openGroundAround } : {}),
      ...(rails.length ? { rails, railsAround: railsAround.flat(), ...(railPlatforms.length ? { railPlatforms } : {}), ...(this.options.railLevels === false ? { railLevels: false } : {}), ...(this.options.railBridges === false ? { railBridges: false } : {}), ...(this.options.railLegacy ? { railLegacy: true } : {}), ...(this.options.railOnStreet === false ? { railOnStreet: false } : {}), ...(this.options.railSpans === false ? { railSpans: false } : {}), ...(this.crossings ? { crossings: true } : {}), ...(this.options.railRamps === false ? { railRamps: false } : {}), ...(this.options.railSpanHeadroom !== undefined ? { railSpanHeadroom: this.options.railSpanHeadroom } : {}) } : {}),
      project: p => toLocal(p[0], p[1]),
    };
    this.told('assemble', key, tAssemble);
    return input;
  }

  /**
   * A far block's input (farRing.ts): its streamed cells that the OSM extract and the relief cover, their water and
   * OSM ground, and the relief over the block (loaded here; the next eviction drops it again). Null: nothing to draw.
   */
  async farInput(blockKey: string): Promise<FarBlockInput | null> {
    if (this.options.prepareOnly) throw new Error('GroundStore: a prepareOnly store keeps no OSM areas and cannot build a far block');
    const keys = farBlockCells(blockKey).filter(k => this.osmCells.has(k) && this.covers(k));
    if (!keys.length) return null;
    const rects = keys.map(k => this.cellRect(k));
    const rect: Rect = [Math.min(...rects.map(r => r[0])), Math.min(...rects.map(r => r[1])), Math.max(...rects.map(r => r[2])), Math.max(...rects.map(r => r[3]))];
    await this.ensureRelief(rect);
    // Far rail corridors (farRing.ts, lane R1-B #224) unless `farRails: false` (`?farRail=0`) or rails are off.
    const farRails = this.options.rails !== false && this.options.farRails !== false;
    const [water, osm, rails] = await Promise.all([Promise.all(keys.map(k => this.waterCell(k))), Promise.all(keys.map(k => this.osmCell(k))), farRails ? Promise.all(keys.map(k => this.railCell(k).catch(() => [] as RailWay[]))) : Promise.resolve(null)]);
    return {
      key: blockKey, rect, ...(this.options.farRailDrape === false ? { railDrape: false } : {}),
      cells: keys.map((k, i) => ({ key: k, rect: rects[i], water: water[i], osm: osm[i], ...(rails?.[i]?.length ? { rails: rails[i] } : {}) })),
      ground: (x, y) => { const z = this.surface.ground(x, y); return z === z ? z : 0; },
      project: p => toLocal(p[0], p[1]),
    };
  }

  /** The 3×3 neighbourhood of a cell. */
  static neighbours(key: string): string[] {
    const [cx, cy] = key.split('_').map(Number), out: string[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push(cellKey(cx + dx, cy + dy));
    return out;
  }
}

/** Fetches and decodes one relief tile (extract-relative path, the relief index, the tile's index entry). */
export type ReliefTileLoader = (path: string, index: GroundIndex, entry: readonly number[]) => Promise<{ heights: Float32Array; bytes: number }>;

/** Gunzip if the bytes are gzip (the dev server may or may not decode .gz for us). */
export async function maybeGunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A FetchBytes over HTTP for an extract root URL. */
export function httpFetchBytes(root: string): FetchBytes {
  return async path => {
    const r = await fetch(`${root}/${path}`);
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return maybeGunzip(new Uint8Array(await r.arrayBuffer()));
  };
}
