/**
 * Which drawn landmark models to give back when too many are resident.
 *
 * Until 2026-10-23 the landmark layer loaded every model that came into view
 * and never dropped one, so residency grew with the length of the ride. A
 * Safari/Mac session lost its WebGL context after 30 landmark GLBs landed in
 * 30 s (Sentry CANAL-RECALL-5: `createShader` returned null mid-frame), and
 * phones that ride across the centre crash after a while.
 *
 * Policy: never evict a model in view (or one that cannot be rebuilt cheaply);
 * above the budget, drop the off-view ones furthest from the camera first, and
 * drop down to `budget - slack` so the next frames do not evict one at a time.
 * A dropped model's extrusion comes back and the model reloads (from the HTTP
 * cache) when it is in view again.
 */

export interface ResidentModel {
  id: string;
  /** Squared distance from the camera centre (any consistent unit). */
  distanceSq: number;
  /** In (or touching) the current view. */
  inView: boolean;
  /** False for models that must stay (being swapped, highlighted, procedural). */
  evictable: boolean;
  /**
   * Behind the camera's heading (desktop-perf 2026-11-27): the ride is leaving it, so it is needed again later than a
   * model ahead at the same distance. Behind ones go first; absent counts as ahead (the old order).
   */
  behind?: boolean;
}

export interface ResidencyBudget {
  budget: number;
  /** Evict this far below the budget once eviction starts. */
  slack?: number;
}

export function pickEvictions(models: readonly ResidentModel[], { budget, slack = 4 }: ResidencyBudget): string[] {
  if (models.length <= budget) return [];
  const target = Math.max(0, budget - slack);
  const candidates = models
    .filter(model => model.evictable && !model.inView)
    .sort((a, b) => (Number(!!b.behind) - Number(!!a.behind)) || b.distanceSq - a.distanceSq);
  const excess = models.length - target;
  return candidates.slice(0, excess).map(model => model.id);
}

/**
 * Resident landmark model count (the budget before 2026-11-27, and the off-switch `?landmarkBudgetMB=0`): 24 on touch
 * devices, 72 on desktop. `?landmarkBudget=N` overrides it for before/after measurement.
 */
export function landmarkResidencyBudget(search: string, coarsePointer: boolean): number {
  // A regex, not URLSearchParams: the bundle also runs in check sandboxes without it.
  const asked = Number(/[?&]landmarkBudget=(\d+)/.exec(search)?.[1]);
  if (Number.isFinite(asked) && asked >= 4) return Math.min(asked, 1000);
  return coarsePointer ? 24 : 72;
}

// ------------------------------------------------------------------ residency by bytes (lane landmark-residency, 2026-11-27)
// The count budget treated a 40 kB street-chunk lod2 and a 6 MB full Rijksmuseum alike. On the belt route at 72 the set
// thrashed: ~45-60 models a minute given back ~260 m off to the side and loaded again when they re-entered the view box,
// never seen in between (desktop-power-20261127.md). The budget is now GPU bytes of the resident levels
// (residentBytes.ts), with a keep radius: nothing within it is given back while anything beyond it can be.

export interface ByteResidentModel extends ResidentModel {
  /** GPU bytes this model's levels hold (drawn level + kept spare). */
  bytes: number;
  /** Models drawing one shared master (shared-mesh clones) carry its key: its bytes count once, freed with the last. */
  sharedKey?: string | null;
}

export interface ByteBudget {
  /** Resident GPU bytes allowed. */
  budgetBytes: number;
  /** Once eviction starts, go this fraction below the budget, so the next checks do not evict one at a time. */
  slackFraction?: number;
  /** A ceiling on the model count as well (per-model CPU walks, draw records); Infinity for none. */
  maxModels?: number;
  /** Models nearer than this (same unit as `distanceSq`) go only once none beyond it is left to give back. */
  keepDistanceSq?: number;
}

/** Resident bytes of a set, a shared master counted once. */
export function residentBytes(models: readonly ByteResidentModel[]): number {
  let total = 0;
  const shared = new Map<string, number>();
  for (const m of models) {
    if (m.sharedKey) shared.set(m.sharedKey, Math.max(shared.get(m.sharedKey) ?? 0, m.bytes));
    else total += m.bytes;
  }
  for (const b of shared.values()) total += b;
  return total;
}

/**
 * Which models to give back so the set fits `budgetBytes` (and `maxModels`). Never one in view or pinned. Order: beyond
 * the keep radius before within it, behind the heading before ahead, furthest first. A shared master's bytes come free
 * only with its last holder.
 */
export function pickEvictionsByBytes(models: readonly ByteResidentModel[], { budgetBytes, slackFraction = 0.05, maxModels = Infinity, keepDistanceSq = 0 }: ByteBudget): string[] {
  let total = residentBytes(models), count = models.length;
  if (total <= budgetBytes && count <= maxModels) return [];
  const targetBytes = budgetBytes * (1 - slackFraction), targetCount = Number.isFinite(maxModels) ? Math.max(0, maxModels - 4) : Infinity;
  const holders = new Map<string, number>();
  for (const m of models) if (m.sharedKey) holders.set(m.sharedKey, (holders.get(m.sharedKey) ?? 0) + 1);
  const kept = (m: ByteResidentModel) => Number(m.distanceSq < keepDistanceSq);
  const candidates = models
    .filter(m => m.evictable && !m.inView)
    .sort((a, b) => (kept(a) - kept(b)) || (Number(!!b.behind) - Number(!!a.behind)) || b.distanceSq - a.distanceSq);
  const out: string[] = [];
  for (const m of candidates) {
    if (total <= targetBytes && count <= targetCount) break;
    out.push(m.id);
    count--;
    if (m.sharedKey) {
      const left = (holders.get(m.sharedKey) ?? 1) - 1;
      holders.set(m.sharedKey, left);
      if (left === 0) total -= m.bytes;
    } else total -= m.bytes;
  }
  return out;
}

/** Per-tier byte budgets (MB): measured on the belt route, see desktop-power-20261127.md "Residency by bytes". */
export const LANDMARK_BUDGET_MB = { desktop: 256, touch: 20 };
/** The keep radius in metres (`?landmarkKeepM=`; 0 turns it off). */
export const LANDMARK_KEEP_M = 500;
/** The model-count ceiling under the byte budget. */
export const LANDMARK_MAX_MODELS = { desktop: 400, touch: 24 };

export interface ResidencyPolicy {
  /** 'bytes' (the default) or 'count' (the fixed model count before, `?landmarkBudgetMB=0` or `?landmarkBudget=N`). */
  mode: 'bytes' | 'count';
  /** Count mode: the model budget. Bytes mode: the model ceiling. */
  models: number;
  /** Bytes mode: the byte budget. */
  budgetBytes: number;
  /** Bytes mode: the keep radius in metres (0: none). */
  keepM: number;
  /**
   * Bytes mode, from the air (isAerialView): the count budget before. The aerial pan's GPU row (aerialGlMaxMB) is already
   * over its 700 MB budget and from the air the in-view set alone fills it, so the byte budget is a street-level policy.
   */
  airModels: number;
}

/**
 * The residency policy from the page's query. `?landmarkBudgetMB=N` sets the byte budget (0: the count budget before);
 * `?landmarkBudget=N` alone asks for the old count budget of N (measurement A/B, as before); `?landmarkKeepM=N` sets the
 * keep radius (0: off).
 */
export function landmarkResidencyPolicy(search: string, coarsePointer: boolean): ResidencyPolicy {
  const tier = coarsePointer ? 'touch' : 'desktop';
  const mbMatch = /[?&]landmarkBudgetMB=(\d+(?:\.\d+)?)/.exec(search), countAsked = /[?&]landmarkBudget=(\d+)/.test(search);
  const keepMatch = /[?&]landmarkKeepM=(\d+)/.exec(search);
  const keepM = keepMatch ? Number(keepMatch[1]) : LANDMARK_KEEP_M;
  const mb = mbMatch ? Number(mbMatch[1]) : null;
  const count = landmarkResidencyBudget(search, coarsePointer);
  if (mb === 0 || (mb === null && countAsked)) return { mode: 'count', models: count, budgetBytes: Infinity, keepM: 0, airModels: count };
  const budgetBytes = Math.max(1, mb ?? LANDMARK_BUDGET_MB[tier]) * 1024 * 1024;
  return { mode: 'bytes', models: countAsked ? count : LANDMARK_MAX_MODELS[tier], budgetBytes, keepM, airModels: count };
}

/**
 * Landmark reach (lane R1-C, #225): metres from the view centre within which a landmark model loads and counts as
 * "in view" for residency. A pitched view's bounds reach the horizon (mapCamera.ts visibleBounds clamps at 20 km), so
 * from the air "in view" was every landmark in Amsterdam: the 3-minute aerial pan held up to 627 models resident
 * against a budget of 72 (none could be evicted while in view) and re-uploaded ~12 GB of GPU data as they cycled
 * (scripts/aerial-pan.mjs, 2026-11-06). Beyond the reach a model is never requested and, once over budget, is given
 * back to its extrusion furthest-first like an off-view one. 2000 m on desktop (the 12 resident z14 building tiles reach
 * about as far), 1000 m on touch. `?landmarkReach=0` turns it off (the horizon-deep reach before); `?landmarkReach=N`
 * sets it.
 */
export function landmarkReachM(search: string, coarsePointer: boolean): number {
  const m = /[?&]landmarkReach=(\d+)/.exec(search);
  if (m) { const v = Number(m[1]); return v === 0 ? Infinity : Math.max(200, v); }
  return coarsePointer ? 1000 : 2000;
}

/** Ground metres between an anchor and the view centre ([lng, lat] each), the equirectangular approximation. */
export function anchorDistanceM(anchor: readonly [number, number], centre: { lng: number; lat: number }): number {
  const cos = Math.cos((centre.lat * Math.PI) / 180);
  return Math.hypot((anchor[0] - centre.lng) * cos, anchor[1] - centre.lat) * 111_320;
}

/** Is the anchor within reach of the centre (always, with the reach off)? `radiusM` is the model's half-diagonal. */
export function withinReach(anchor: readonly [number, number] | null | undefined, centre: { lng: number; lat: number }, reachM: number, radiusM = 0): boolean {
  if (!anchor || !Number.isFinite(reachM)) return true;
  return anchorDistanceM(anchor, centre) - radiusM <= reachM;
}

/**
 * Residency hysteresis (lane P2, #325; on with `?popFade`, engine/popFade.ts): a model enters at the reach and is kept
 * while within KEEP_FACTOR x the reach, and none is given back within MIN_DWELL_MS of arriving, so a camera that
 * hovers at the reach does not swap the same model in and out (the user's far pop).
 */
export const RESIDENCY_KEEP_FACTOR = 1.25;
export const RESIDENCY_MIN_DWELL_MS = 10_000;

/** The reach a resident model is judged against: the entry reach, or the keep reach with hysteresis on. */
export function keepReachM(reachM: number, hysteresis: boolean): number {
  return hysteresis && Number.isFinite(reachM) ? reachM * RESIDENCY_KEEP_FACTOR : reachM;
}

/** Whether a model that arrived at `addedAt` may be evicted at `now` (always with hysteresis off or no arrival time). */
export function pastMinDwell(addedAt: number | undefined, now: number, hysteresis: boolean): boolean {
  return !hysteresis || addedAt === undefined || !Number.isFinite(addedAt) || now - addedAt >= RESIDENCY_MIN_DWELL_MS;
}

// ------------------------------------------------------------------ re-arrival cool-down (desktop-perf 2026-11-27)
// On the belt route at the desktop budget of 72 the set thrashed: 127-218 leaves a minute and ~65 re-arrivals, the same
// id given back at ~260 m off view and loaded again 1-25 s later (median 7 s), never on screen when it came back
// (pop-in lane, lane/popin-colour-20261127). Each re-arrival is a fetch, a parse, an upload, a weld and a dissolve nobody
// sees. A model given back now waits LANDMARK_COOLDOWN_MS before it is asked for again, unless it is on screen through
// the last drawn camera: what the rider can see still loads at once. `?landmarkCooldown=0` (or
// `__canalRecallLandmarkCooldown = false`) asks again at once; `?landmarkCooldownS=` tunes it.

export const LANDMARK_COOLDOWN_MS = 30_000;

/** The cool-down in ms (0: off). */
export function landmarkCooldownMs(search: string, global?: unknown): number {
  if (global === false) return 0;
  if (/[?&]landmarkCooldown=(0|false|off)\b/.test(search)) return 0;
  const s = Number(/[?&]landmarkCooldownS=(\d+)/.exec(search)?.[1]);
  return Number.isFinite(s) ? s * 1000 : LANDMARK_COOLDOWN_MS;
}

/** Whether a model given back at `evictedAt` is still cooling at `now` (never when it is on screen). */
export function coolingDown(evictedAt: number | undefined, now: number, cooldownMs: number, onScreen: boolean): boolean {
  return !onScreen && cooldownMs > 0 && evictedAt !== undefined && now - evictedAt < cooldownMs;
}

/**
 * Whether a sphere (world `centre`, `radius`) is inside the view of the column-major `clipFromWorld`, with `marginNdc`
 * to spare: its centre in front of the camera and its screen extent touching [-1, 1]².
 */
export function sphereOnScreen(clipFromWorld: ArrayLike<number>, centre: readonly [number, number, number], radius: number, marginNdc = 0.1): boolean {
  const m = clipFromWorld, [x, y, z] = centre;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (!(w > 1e-9)) return false;
  const nx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, ny = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  // The radius in NDC: the largest offset of the three axis points (as projectedRadiusPx).
  let r = 0;
  for (let k = 0; k < 3; k++) {
    const dx = k === 0 ? radius : 0, dy = k === 1 ? radius : 0, dz = k === 2 ? radius : 0;
    const pw = m[3] * (x + dx) + m[7] * (y + dy) + m[11] * (z + dz) + m[15];
    if (!(pw > 1e-9)) { r = Infinity; break; }
    const px = (m[0] * (x + dx) + m[4] * (y + dy) + m[8] * (z + dz) + m[12]) / pw, py = (m[1] * (x + dx) + m[5] * (y + dy) + m[9] * (z + dz) + m[13]) / pw;
    r = Math.max(r, Math.abs(px - nx), Math.abs(py - ny));
  }
  return Math.abs(nx) - r <= 1 + marginNdc && Math.abs(ny) - r <= 1 + marginNdc;
}
