/**
 * Landmark stamps for My progress. The ride keeps them in localStorage
 * ('canalRecall.poiStamps.v1', collection/browser.ts) and, when signed in, in
 * users/{uid}/poiStamps; this page is another bundle, so it reads the same
 * storage and the same pure module rather than the ride's global.
 */
import {
  allStamps, collectiblePool, loadPoolSnapshot, loadStamps, stampProgress,
  type CollectibleFeature, type PoolEntry, type StampRecord,
} from '../canalRecall/collection/poiCollection';
import type { StampCollection } from './progressData';

/** The extract the ride's default pool comes from, served next to the site. */
export const LANDMARKS_URL = '/data/extracts/amsterdam/landmarks.json';

const storage = () => {
  try { return localStorage; } catch { return null; }
};

export function stampView(records: readonly StampRecord[], pool: readonly PoolEntry[]): StampCollection & { records: StampRecord[] } {
  const map = Object.fromEntries(records.map(record => [record.id, record]));
  const list = allStamps(map);
  return {
    records: list,
    progress: () => stampProgress(map, pool),
    all: () => list,
  };
}

let poolPromise: Promise<PoolEntry[]> | null = null;

/**
 * The collectible pool: the one the ride last used (it merges the manual
 * destinations), else the raw extract, fetched once per page; empty when
 * neither is available.
 */
export function loadPool(fetcher: typeof fetch = fetch): Promise<PoolEntry[]> {
  const snapshot = loadPoolSnapshot(storage());
  if (snapshot) return Promise.resolve(snapshot);
  poolPromise ??= (async () => {
    try {
      const response = await fetcher(LANDMARKS_URL);
      if (!response.ok) return [];
      return collectiblePool(await response.json() as CollectibleFeature[]);
    } catch {
      return [];
    }
  })();
  return poolPromise;
}

/** This device's stamps against the pool. */
export async function loadLocalStamps(): Promise<StampCollection> {
  const pool = await loadPool();
  return stampView(allStamps(loadStamps(storage())), pool);
}
