/**
 * Browser adapter for POI stamps. Bundle (npm run build:canal-collection):
 *   esbuild src/canalRecall/collection/browser.ts --bundle --format=iife \
 *     --outfile=public/canal-drive/js/collection.bundle.js --minify
 *
 * Exposes window.CanalCollection = { record(event), progress(), all() } and
 * dispatches a `canal-stamp` CustomEvent on window when a stamp is new
 * (detail: { record, progress }). Extras for the integrator and the account
 * lane: setPool(features), ready, merge(remoteDocs) and docs(). Storage is
 * localStorage 'canalRecall.poiStamps.v1', every access guarded.
 */
import {
  allStamps,
  collectiblePool,
  fromStampDocs,
  loadStamps,
  mergeStamps,
  recordStamp,
  saveStamps,
  stampProgress,
  toStampDoc,
  type CollectibleFeature,
  type CollectiblePoi,
  type StampEvent,
  type StampMap,
  type StampProgress,
  type StampRecord,
  type StorageLike,
} from './poiCollection';

export interface CanalCollectionApi {
  record(event: StampEvent): { isNew: boolean; record: StampRecord } | null;
  progress(): StampProgress;
  all(): StampRecord[];
  setPool(features: readonly CollectibleFeature[]): void;
  merge(remote: readonly unknown[]): StampRecord[];
  docs(): ReturnType<typeof toStampDoc>[];
  ready: Promise<void>;
}

function storage(): StorageLike | null {
  try { return window.localStorage; } catch { return null; }
}

const scriptSrc = (() => {
  try { return (document.currentScript as HTMLScriptElement | null)?.src || window.location.href; } catch { return ''; }
})();

let stamps: StampMap = loadStamps(storage());
let pool: CollectiblePoi[] = [];

function emit(record: StampRecord): void {
  try {
    window.dispatchEvent(new CustomEvent('canal-stamp', { detail: { record, progress: stampProgress(stamps, pool) } }));
  } catch { /* an old browser without CustomEvent just loses the toast */ }
}

const api: CanalCollectionApi = {
  record(event) {
    if (!event || typeof event.id !== 'string' || !event.id) return null;
    if (event.kind !== 'tour' && event.how !== 'arrived' && event.how !== 'named') return null;
    const result = recordStamp(stamps, event);
    stamps = result.stamps;
    saveStamps(storage(), stamps);
    if (result.isNew) emit(result.record);
    return { isNew: result.isNew, record: result.record };
  },
  progress: () => stampProgress(stamps, pool),
  all: () => allStamps(stamps),
  setPool(features) { pool = collectiblePool(features); },
  merge(remote) {
    const theirs = fromStampDocs(remote);
    stamps = mergeStamps(stamps, theirs);
    saveStamps(storage(), stamps);
    return allStamps(stamps);
  },
  docs: () => allStamps(stamps).map(toStampDoc),
  ready: Promise.resolve(),
};

// The default pool comes from the cached extract next to the page; the game
// may replace it with its manual-POI-merged features via setPool.
api.ready = (async () => {
  try {
    const url = new URL('../../data/extracts/amsterdam/landmarks.json', scriptSrc);
    const response = await fetch(url);
    if (!response.ok) return;
    const features = await response.json() as CollectibleFeature[];
    if (!pool.length) pool = collectiblePool(features);
  } catch { /* progress() reports total 0 until a pool arrives */ }
})();

(window as unknown as { CanalCollection: CanalCollectionApi }).CanalCollection = api;
