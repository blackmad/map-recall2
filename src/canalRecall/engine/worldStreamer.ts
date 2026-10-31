/**
 * The world streamer (engine programme P3, lane L4 step 4): one priority queue of `world-v1` cells, one worker
 * pool that reads them, and one per-frame budget for what the main thread takes in.
 *
 *  - Rank. A cell's rank is `aheadRank` (streamingLookAhead.ts) from the rider to the cell centre, along the
 *    rider's `MotionEstimate` direction: ahead is near, behind is far. Cells the planned z14 tiles need come
 *    first, in the plan's own order (view, then look-ahead); the rank orders the rest and breaks ties.
 *  - Residency. Decoded cells stay in the worker that read them; above `budget` the off-plan cells furthest
 *    from the rider go first (`pickEvictions`, the landmark layer's policy, so models and cells leave alike).
 *  - Pool. min(cores - 1, 3) workers (`poolSize`). A cell always goes to the same worker (`affinity`), so its
 *    decode is cached once and the tiles that share it are cut from that one copy.
 *  - Budget. `FrameBudget` meters ms and bytes per animation frame; callers spend before main-thread work and
 *    carry the rest to the next frame.
 *
 * Pure apart from the injected clock and workers; world/worldCells.ts drives it in the browser.
 */
import { aheadRank, type LngLat } from '../streamingLookAhead.js';
import { pickEvictions } from '../landmarks/landmarkResidency.js';
import { cellBounds, parseCellKey } from '../world/cellGrid.js';

/** Workers for cell reads: one core is the main thread's, and three readers saturate the network on desktop. */
export function poolSize(cores: number | undefined = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined): number {
  const n = Number.isFinite(cores) ? Math.floor(cores as number) - 1 : 1;
  return Math.max(1, Math.min(3, n));
}

/** Stable worker for a cell key (FNV-1a), so a cell is decoded and cached in one worker only. */
export function affinity(key: string, workers: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return workers > 0 ? h % workers : 0;
}

export function cellCentre(key: string): LngLat {
  const [i, j] = parseCellKey(key), [w, s, e, n] = cellBounds(i, j);
  return [(w + e) / 2, (s + n) / 2];
}

/**
 * Order cells for reading. `planned` (the cells the planned tiles need, in the plan's priority order) come first in
 * that order; within the plan and after it, `aheadRank` from `rider` along `direction` breaks ties.
 */
export function rankCells(planned: readonly string[], rider: LngLat | null, direction: readonly [number, number] | null): Map<string, number> {
  const out = new Map<string, number>();
  const ahead = (key: string) => rider ? aheadRank(rider, cellCentre(key), direction) : 0;
  planned.forEach((key, i) => { if (!out.has(key)) out.set(key, i * 1e6 + Math.min(ahead(key), 1e6 - 1)); });
  return out;
}

export type CellRead = (key: string) => Promise<void>;

/**
 * The cell queue. `want` replaces the wanted set (key -> rank, lower first); queued cells no longer wanted are
 * dropped, reads in flight finish (their cells stay cached). At most `maxInFlight` reads run at once, lowest rank
 * first. `resident` tracks what was read so `evictions` can name what to give back above the budget.
 */
export class CellQueue {
  private wanted = new Map<string, number>();
  private readonly inFlight = new Set<string>();
  private readonly done = new Map<string, number>(); // key -> last time wanted (sequence)
  private seq = 0;
  readonly stats = { reads: 0, failed: 0, dropped: 0, maxQueued: 0 };
  constructor(private readonly read: CellRead, private readonly maxInFlight = 6) {}

  want(ranked: ReadonlyMap<string, number>): void {
    this.seq++;
    for (const key of this.wanted.keys()) if (!ranked.has(key) && !this.inFlight.has(key)) this.stats.dropped++;
    this.wanted = new Map([...ranked].filter(([key]) => !this.inFlight.has(key) && !this.done.has(key)));
    for (const key of ranked.keys()) if (this.done.has(key)) this.done.set(key, this.seq);
    this.stats.maxQueued = Math.max(this.stats.maxQueued, this.wanted.size);
    this.pump();
  }

  /** A cell read elsewhere (a tile request) counts as resident. */
  noteResident(key: string): void { this.done.set(key, this.seq); this.wanted.delete(key); }
  forget(key: string): void { this.done.delete(key); }

  get queued(): number { return this.wanted.size; }
  get running(): number { return this.inFlight.size; }
  get residentKeys(): string[] { return [...this.done.keys()]; }

  private pump(): void {
    while (this.inFlight.size < this.maxInFlight && this.wanted.size) {
      let pick: string | null = null, best = Infinity;
      for (const [key, rank] of this.wanted) if (rank < best) { best = rank; pick = key; }
      if (pick === null) break;
      this.wanted.delete(pick);
      this.inFlight.add(pick);
      this.stats.reads++;
      const key = pick;
      this.read(key).then(() => { this.done.set(key, this.seq); }, () => { this.stats.failed++; })
        .finally(() => { this.inFlight.delete(key); this.pump(); });
    }
  }

  /**
   * Cells to give back: above `budget` resident, the ones not wanted now (`inPlan` false) furthest from `rider`,
   * down to budget - slack. Callers evict them from the worker caches and call `forget`.
   */
  evictions(budget: number, rider: LngLat | null, inPlan: (key: string) => boolean, slack = 4): string[] {
    const models = this.residentKeys.map(id => {
      const c = cellCentre(id), d = rider ? aheadRank(rider, c, null) : 0;
      return { id, distanceSq: d * d, inView: inPlan(id), evictable: true };
    });
    return pickEvictions(models, { budget, slack });
  }
}

/**
 * Main-thread intake per animation frame: `ms` of work and `bytes` of new data. `begin` opens a frame (call it
 * from the frame callback); `take(bytes)` says whether this piece fits, and spends it if so. The first piece of a
 * frame always fits, so a piece larger than the whole budget still goes through, one per frame.
 */
export class FrameBudget {
  private started = 0;
  private spentBytes = 0;
  private pieces = 0;
  constructor(readonly ms: number, readonly bytes: number, private readonly now: () => number = () => performance.now()) {}
  begin(): void { this.started = this.now(); this.spentBytes = 0; this.pieces = 0; }
  take(bytes: number): boolean {
    if (this.pieces > 0 && (this.now() - this.started >= this.ms || this.spentBytes + bytes > this.bytes)) return false;
    this.pieces++; this.spentBytes += bytes;
    return true;
  }
  get spent(): { pieces: number; bytes: number; ms: number } { return { pieces: this.pieces, bytes: this.spentBytes, ms: this.now() - this.started }; }
}

// --- Chunk builds ---------------------------------------------------------------------------------------------
// (was chunkBuildQueue.ts) The three.js building layer's queue of chunk builds; its jobs go to idle workers of the
// one pool (engine/workerPool.ts).

/**
 * Tile bursts keep only each chunk's newest build. Without a rank, builds run in first-request order; with one
 * (`setRank`), the lowest-ranked chunk builds next (ties in request order): the facade layer ranks chunks by
 * how far ahead of the rider they lie (streamingLookAhead.ts aheadRank), so a tile flush no longer builds the
 * block behind the rider before the one it is riding into (docs/perf-pop-in-20261016.md).
 */
export class ChunkBuildQueue {
  private readonly jobs = new Map<string, () => void>();
  private rank: ((key: string) => number) | null = null;
  get length(): number { return this.jobs.size; }
  push(key: string, job: () => void): void { this.jobs.set(key, job); }
  /** Rank evaluated when the next job is taken (the rider moves between builds); null restores request order. */
  setRank(rank: ((key: string) => number) | null): void { this.rank = rank; }
  shift(): (() => void) | undefined {
    let pick: string | undefined;
    if (this.rank && this.jobs.size > 1) {
      let best = Infinity;
      for (const key of this.jobs.keys()) {
        const r = this.rank(key);
        if (r < best) { best = r; pick = key; }
      }
    }
    if (pick === undefined) {
      const first = this.jobs.keys().next();
      if (first.done) return undefined;
      pick = first.value;
    }
    const job = this.jobs.get(pick)!;
    this.jobs.delete(pick);
    return job;
  }
  clear(): void { this.jobs.clear(); }
}

// --- Ground residency ------------------------------------------------------------------------------------------
// (was ownGround/residency.ts) The own ground's resident radius from the camera; pure.
//
//
// The ring has to reach what the camera sees. In the chase view (zoom ~17,
// pitch ~60°) that is about 1.5 km from the rider, which the 1.4 km base ring
// covers. From the air (the user's Da Costakade 13 shot, ~300 m up over
// Nieuw-West, looking east) the top of the screen is several km away and the
// ring ended in a hard edge against the flat basemap. The radius follows the
// camera: the distance from the rider to the ground under the screen's top
// edge, from the zoom and pitch, in whole steps (so residency is not re-planned
// on every frame of a zoom ease) and capped, because every ring of cells costs
// worker build time and resident triangles (HISTORY 2026-10-13 has the table).

/** MapLibre's vertical field of view (radians) and the camera's distance to the centre in viewport heights (0.5 / tan(fov / 2)). */
const FOV = 0.6435011087932844;
const CENTRE_DISTANCE_VIEWPORTS = 0.5 / Math.tan(FOV / 2);
/** Assumed viewport height, pixels (desktop). */
export const VIEWPORT_PX = 900;
/** Radius steps, metres. */
export const RADIUS_STEP_M = 400;

/** Metres from the rider to the ground at the top edge of the screen (rider under the screen centre). */
export function viewReachM(zoom: number, pitchDeg: number, latDeg: number): number {
  const mpp = 40075016.686 * Math.cos(latDeg * Math.PI / 180) / (512 * 2 ** zoom);
  const distance = CENTRE_DISTANCE_VIEWPORTS * VIEWPORT_PX * mpp;
  const pitch = Math.min(pitchDeg, 85) * Math.PI / 180;
  const height = distance * Math.cos(pitch);
  const topEdge = Math.min(pitch + FOV / 2, 86 * Math.PI / 180);
  // The camera sits behind the centre by distance·sin(pitch); the top ray lands height·tan(topEdge) ahead of the camera's foot.
  return Math.max(0, height * Math.tan(topEdge) - distance * Math.sin(pitch));
}

/** Resident radius for a view reaching `reachM` ahead of the rider: at least `baseM`, in steps, at most `maxM`. */
export function residentRadius(reachM: number, baseM: number, maxM: number): number {
  if (maxM <= baseM || reachM <= baseM) return baseM;
  return Math.min(maxM, baseM + Math.ceil((reachM - baseM) / RADIUS_STEP_M) * RADIUS_STEP_M);
}

// Touch ring (CANAL-RECALL-7). The desktop rule above assumes a 900 px viewport and grows in 400 m steps, so the
// iPad chase view (734 px tall, the top centre ~360 m ahead) stepped from the 400 m touch base to 800 m and kept 6–7
// cells, though nothing past ~470 m is on screen. A touch device fits the ring to its own viewport instead: the
// farthest ground the screen shows (a top corner), plus a margin for the build latency at riding speed, in 100 m
// steps. Desktop keeps the rule above, byte-identical.

/** Touch ring steps, metres. */
export const TOUCH_RADIUS_STEP_M = 100;
/** Metres added to the farthest visible ground point before the step, standing still (that point is exact: the gpu-load script measures 464 m by unprojecting the iPad corners, as viewCornerReachM computes). */
export const TOUCH_RING_MARGIN_M = 25;
/**
 * Seconds of travel a touch ring reaches past the screen in the riding direction: a cell ahead is asked for when the
 * rider will see it in this long. A touch cell builds in ~0.85 s on a desktop CPU (coarse level, HISTORY 2026-10-28);
 * an iPad is slower and the worker queue adds more. Measured clean by scripts/ring-edge-ride.mjs.
 */
export const TOUCH_AHEAD_S = 4;
/** Never more than this ahead margin, metres. */
export const TOUCH_AHEAD_MAX_M = 400;

/** The extra reach ahead of a rider at `speedMps` (TOUCH_AHEAD_S of travel, capped). */
export function touchAheadMarginM(speedMps: number): number {
  return Math.min(TOUCH_AHEAD_MAX_M, Math.max(0, speedMps) * TOUCH_AHEAD_S);
}

/**
 * Whether a cell `d` metres away (to its nearest point, at `cos` of the angle between the riding direction and that
 * point) is in a touch ring of `radiusM` with `aheadM` reach ahead: the whole margin straight ahead, none beside or
 * behind, where the plain disc already covers everything the screen shows.
 */
export function inTouchRing(d: number, cos: number, radiusM: number, aheadM: number): boolean {
  return d <= radiusM + aheadM * Math.max(0, cos);
}

/** Metres from the rider (under the screen centre) to the ground at the screen's top corners, for a `widthPx`×`heightPx` view. */
export function viewCornerReachM(zoom: number, pitchDeg: number, latDeg: number, widthPx: number, heightPx: number): number {
  const mpp = 40075016.686 * Math.cos(latDeg * Math.PI / 180) / (512 * 2 ** zoom);
  const distance = CENTRE_DISTANCE_VIEWPORTS * heightPx * mpp;
  const pitch = Math.min(pitchDeg, 85) * Math.PI / 180;
  const height = distance * Math.cos(pitch);
  const topEdge = Math.min(pitch + FOV / 2, 86 * Math.PI / 180);
  const ahead = Math.max(0, height * Math.tan(topEdge) - distance * Math.sin(pitch));
  // The top ray's depth along the view axis, times the horizontal half-angle's tangent (aspect × tan(fov / 2)).
  const depth = height / Math.cos(topEdge) * Math.cos(FOV / 2);
  const halfWidth = depth * Math.tan(FOV / 2) * widthPx / Math.max(1, heightPx);
  return Math.hypot(ahead, halfWidth);
}

/** Touch resident radius: the visible reach plus the margin, in 100 m steps, at least `baseM`, at most `maxM`. */
export function touchResidentRadius(cornerReachM: number, baseM: number, maxM: number): number {
  const want = Math.ceil((cornerReachM + TOUCH_RING_MARGIN_M) / TOUCH_RADIUS_STEP_M) * TOUCH_RADIUS_STEP_M;
  return Math.max(baseM, Math.min(Math.max(baseM, maxM), want));
}

// --- Draw residency --------------------------------------------------------------------------------------------
// (was rendererShared/residency.ts)
// Draw residency: which loaded models take part in this frame.
//
// Loading residency (what is decoded and in memory) stays with each layer.
// This is the cheaper per-frame question — is a model near enough to the view
// to be worth a draw call — answered the same way for every participant, so a
// landmark, a zoo animal and a roof cap appear and disappear at the same edge.

export type LngLatBounds = { west: number; east: number; south: number; north: number };

/** Degrees added around the view: about 280 m east-west and 220 m north-south in Amsterdam. */
export const DEFAULT_RESIDENCY_PAD = { lng: 0.004, lat: 0.002 } as const;

const METRES_PER_DEGREE_LAT = 111320;

/**
 * True when a model anchored at `anchor` with a horizontal radius of
 * `radiusM` metres can touch the padded view bounds. Large footprints (the
 * Rijksmuseum, Centraal) widen their own margin so they never pop at an edge.
 */
export function withinView(
  bounds: LngLatBounds,
  anchor: readonly [number, number] | null | undefined,
  radiusM = 0,
  pad: { lng: number; lat: number } = DEFAULT_RESIDENCY_PAD,
): boolean {
  if (!anchor) return false;
  const dy = radiusM / METRES_PER_DEGREE_LAT;
  const dx = dy / Math.max(0.1, Math.cos((anchor[1] * Math.PI) / 180));
  return anchor[0] >= bounds.west - pad.lng - dx && anchor[0] <= bounds.east + pad.lng + dx
    && anchor[1] >= bounds.south - pad.lat - dy && anchor[1] <= bounds.north + pad.lat + dy;
}

/** MapLibre LngLatBounds → plain bounds. */
export function plainBounds(b: { getWest(): number; getEast(): number; getSouth(): number; getNorth(): number }): LngLatBounds {
  return { west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() };
}
