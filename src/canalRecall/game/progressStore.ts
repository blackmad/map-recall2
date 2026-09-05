// What survives between sessions in the browser: personal bests per route, and
// the running collection of everything the player has learned or visited.
//
// The storage is injected rather than reached for, because these are rules
// about merging and eviction, not about `localStorage`. Every read tolerates
// absent or corrupt JSON: a player whose stored progress has been mangled
// should get a fresh collection, not a game that will not start.

export const LEADERBOARD_STORAGE_KEY = 'satb_bestTimes';
export const EXPLORATION_STORAGE_KEY = 'canalRecall.exploration.v1';
/** Nominatim cache for the home-address field; cleared with “Clear all data”. */
export const HOME_GEOCODE_CACHE_KEY = 'canalRecall.homeGeocodes.v2';
/** Personal bests are capped and evicted oldest-first. */
export const LEADERBOARD_MAX_ENTRIES = 50;

/** The slice of `Storage` used here. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function removeKey(store: KeyValueStore, key: string): void {
  try {
    if (store.removeItem) store.removeItem(key);
    else store.setItem(key, '');
  } catch {
    /* private mode */
  }
}

function readJson<T>(store: KeyValueStore, key: string, fallback: T): T {
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T | null;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

// ---- Personal bests ----

export interface BestTime {
  /** Seconds. */
  time: number;
  /** ISO 8601; also the eviction order. */
  date: string;
  /** Miles, to two decimals. */
  distance: number;
}

export type BestTimes = Record<string, BestTime>;

export function readBestTimes(store: KeyValueStore): BestTimes {
  return readJson<BestTimes>(store, LEADERBOARD_STORAGE_KEY, {});
}

export function getBestTime(store: KeyValueStore, key: string | null): BestTime | null {
  if (!key) return null;
  return readBestTimes(store)[key] ?? null;
}

/**
 * Record a run if it beats the stored best for that route.
 *
 * Returns whether anything was written, so a caller can tell "personal best" from
 * "finished again". Eviction is oldest-first by recorded date, which keeps the
 * routes a player is currently working on and drops ones they have moved past.
 */
export function recordBestTime(
  store: KeyValueStore,
  key: string | null,
  run: BestTime,
  maxEntries = LEADERBOARD_MAX_ENTRIES,
): boolean {
  if (!key) return false;
  const data = readBestTimes(store);
  const existing = data[key];
  if (existing && run.time >= existing.time) return false;
  data[key] = run;

  const keys = Object.keys(data);
  if (keys.length > maxEntries) {
    keys.sort((a, b) => (data[a].date || '').localeCompare(data[b].date || ''));
    while (Object.keys(data).length > maxEntries) {
      const oldest = keys.shift();
      if (oldest === undefined) break;
      delete data[oldest];
    }
  }
  store.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(data));
  return true;
}

/** Miles, to two decimals — the unit the stored bests have always used. */
export function pixelsToMiles(distancePx: number, pixelsPerMeter: number): number {
  const meters = distancePx / pixelsPerMeter;
  return parseFloat((meters / 1609.344).toFixed(2));
}

// ---- The exploration collection ----

export interface Exploration {
  learnedWaterways: string[];
  learnedStreets: string[];
  visitedNeighborhoods: string[];
  seenLandmarks: string[];
  totalRoutes: number;
  totalCorrect: number;
  totalAttempts: number;
}

export function emptyExploration(): Exploration {
  return {
    learnedWaterways: [], learnedStreets: [],
    visitedNeighborhoods: [], seenLandmarks: [],
    totalRoutes: 0, totalCorrect: 0, totalAttempts: 0,
  };
}

/** Tolerates a partially-shaped stored object, so a schema that gained a field
 *  does not blank a player's whole collection. */
export function readExploration(store: KeyValueStore): Exploration {
  const stored = readJson<Partial<Exploration>>(store, EXPLORATION_STORAGE_KEY, {});
  const base = emptyExploration();
  return {
    learnedWaterways: stored.learnedWaterways ?? base.learnedWaterways,
    learnedStreets: stored.learnedStreets ?? base.learnedStreets,
    visitedNeighborhoods: stored.visitedNeighborhoods ?? base.visitedNeighborhoods,
    seenLandmarks: stored.seenLandmarks ?? base.seenLandmarks,
    totalRoutes: stored.totalRoutes ?? base.totalRoutes,
    totalCorrect: stored.totalCorrect ?? base.totalCorrect,
    totalAttempts: stored.totalAttempts ?? base.totalAttempts,
  };
}

export interface RouteContribution {
  /** Waterways are collected separately from streets: they are two bodies of
   *  knowledge and the finish screen counts them apart. */
  byBoat: boolean;
  learnedNames: Iterable<string>;
  visitedNeighborhoods: Iterable<string>;
  seenLandmarkNames: Iterable<string>;
  correct: number;
  attempts: number;
}

function addUnique(existing: readonly string[], items: Iterable<string>): string[] {
  const set = new Set(existing);
  for (const item of items) set.add(item);
  return [...set];
}

/** The collection after one more route. Pure: the caller decides to persist. */
export function mergeExploration(
  current: Exploration,
  contribution: RouteContribution,
): Exploration {
  return {
    learnedWaterways: contribution.byBoat
      ? addUnique(current.learnedWaterways, contribution.learnedNames)
      : current.learnedWaterways,
    learnedStreets: contribution.byBoat
      ? current.learnedStreets
      : addUnique(current.learnedStreets, contribution.learnedNames),
    visitedNeighborhoods: addUnique(current.visitedNeighborhoods, contribution.visitedNeighborhoods),
    seenLandmarks: addUnique(current.seenLandmarks, contribution.seenLandmarkNames),
    totalRoutes: current.totalRoutes + 1,
    totalCorrect: current.totalCorrect + contribution.correct,
    totalAttempts: current.totalAttempts + contribution.attempts,
  };
}

export function saveExploration(store: KeyValueStore, exploration: Exploration): void {
  store.setItem(EXPLORATION_STORAGE_KEY, JSON.stringify(exploration));
}

/** Wipe the exploration collection (not spaced-repetition knowledge). */
export function clearExploration(store: KeyValueStore): void {
  removeKey(store, EXPLORATION_STORAGE_KEY);
}

/** Wipe personal-best times. */
export function clearBestTimes(store: KeyValueStore): void {
  removeKey(store, LEADERBOARD_STORAGE_KEY);
}

/** Wipe the home-address geocode cache. */
export function clearHomeGeocodeCache(store: KeyValueStore): void {
  removeKey(store, HOME_GEOCODE_CACHE_KEY);
}

/** How much of this route was new — what the finish screen celebrates. */
export interface ExplorationGain {
  newNames: number;
  newNeighborhoods: number;
  newLandmarks: number;
}

export function explorationGain(before: Exploration, after: Exploration): ExplorationGain {
  return {
    newNames: (after.learnedWaterways.length + after.learnedStreets.length)
      - (before.learnedWaterways.length + before.learnedStreets.length),
    newNeighborhoods: after.visitedNeighborhoods.length - before.visitedNeighborhoods.length,
    newLandmarks: after.seenLandmarks.length - before.seenLandmarks.length,
  };
}
