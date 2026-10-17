// node --import tsx --test src/canalRecall/collection/poiCollection.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  POI_STAMPS_STORAGE_KEY,
  allStamps,
  collectiblePool,
  fromStampDocs,
  loadStamps,
  mergeStamps,
  recordStamp,
  sanitiseStamp,
  saveStamps,
  stampDocPath,
  stampId,
  stampProgress,
  stampsToUpload,
  toStampDoc,
  loadPoolSnapshot,
  savePoolSnapshot,
  type CollectibleFeature,
  type StampMap,
} from './poiCollection.ts';
import { mergeIntoStorage, saveStamp, syncStamps, type StampFirestoreApi } from './stampSync.ts';

function memoryStorage() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, map };
}

const feature = (id: string, name: string, extra: Partial<CollectibleFeature> = {}): CollectibleFeature => ({
  id, name, center: [52.3729, 4.8936], wikipediaUrl: `https://en.wikipedia.org/wiki/${name}`, wikipediaExtract: 'Text.', ...extra,
});

test('the pool keeps teachable destinations inside the radius, A-list first, one per name', () => {
  const pool = collectiblePool([
    feature('a', 'Rijksmuseum', { wikidata: 'Q190804', wikidataSitelinks: 100 }),
    feature('b', 'Small Chapel', { wikidataSitelinks: 3 }),
    feature('c', 'Bare Name', { wikipediaUrl: undefined, wikipediaExtract: undefined }),
    feature('d', 'Far Fort', { center: [52.2, 5.2] }),
    feature('e', 'Far Manual', { center: [52.2, 5.2], manualPoi: true }),
    feature('f', 'small chapel', { wikidataSitelinks: 40 }),
    feature('g', 'Thin', { wikipediaExtractSource: 'wikidata-description', wikipediaUrl: 'x' }),
    feature('h', 'Rijks alias', { wikidata: 'Q190804', wikidataSitelinks: 1 }),
  ]);
  assert.deepEqual(pool.map(p => p.id), ['a', 'f', 'e']);
  assert.equal(pool[0].tier, 'alist');
  assert.equal(pool[1].tier, 'other');
});

test('the real extract gives a pool with an A-list core', () => {
  const features = JSON.parse(readFileSync('public/data/extracts/amsterdam/landmarks.json', 'utf8')) as CollectibleFeature[];
  const pool = collectiblePool(features);
  assert.ok(pool.length > 150, `pool ${pool.length}`);
  const alist = pool.filter(p => p.tier === 'alist');
  assert.ok(alist.length >= 25, `A-list ${alist.length}`);
  assert.ok(pool.slice(0, 20).every(p => p.tier === 'alist'), 'the A-list leads the ranking');
  assert.equal(pool.filter(p => /Lieve Heer op Solder|Lord in the Attic/.test(p.name)).length, 1, 'one stamp per Wikidata item');
  assert.ok(pool.some(p => p.name === 'Rijksmuseum'));
});

test('a first arrival is new, a repeat counts, and route-POI ids map to landmark ids', () => {
  let stamps: StampMap = {};
  const first = recordStamp(stamps, { id: 'lm-x1', name: 'Westerkerk', how: 'arrived' }, 1000);
  assert.equal(first.isNew, true);
  assert.deepEqual(first.record, { id: 'x1', kind: 'poi', name: 'Westerkerk', firstEarnedAt: 1000, lastEarnedAt: 1000, how: 'arrived', count: 1 });
  stamps = first.stamps;
  const again = recordStamp(stamps, { id: 'x1', how: 'named' }, 2000);
  assert.equal(again.isNew, false);
  assert.equal(again.record.count, 2);
  assert.equal(again.record.how, 'arrived', 'how records the first earning');
  assert.equal(again.record.lastEarnedAt, 2000);
  assert.equal(again.record.name, 'Westerkerk');
  assert.equal(stamps.x1.count, 1, 'recordStamp is pure');
});

test('tours are stamps of their own kind', () => {
  assert.equal(stampId({ kind: 'tour', id: 'jewish-amsterdam' }), 'tour:jewish-amsterdam');
  const { stamps, record } = recordStamp({}, { kind: 'tour', id: 'jewish-amsterdam', name: 'Jewish Amsterdam' }, 5);
  assert.equal(record.kind, 'tour');
  assert.equal(record.how, 'completed');
  const progress = stampProgress(stamps, [{ id: 'tour:jewish-amsterdam', name: 'x', lat: 0, lng: 0, score: 0, tier: 'other' }]);
  assert.equal(progress.earned, 0, 'a tour stamp never counts as a POI');
});

test('progress counts earned stamps per tier, ignoring ids outside the pool', () => {
  const pool = [
    { id: 'a', name: 'A', lat: 0, lng: 0, score: 9, tier: 'alist' as const },
    { id: 'b', name: 'B', lat: 0, lng: 0, score: 8, tier: 'alist' as const },
    { id: 'c', name: 'C', lat: 0, lng: 0, score: 1, tier: 'other' as const },
  ];
  let stamps: StampMap = {};
  for (const id of ['a', 'c', 'zzz']) stamps = recordStamp(stamps, { id, how: 'arrived' }, 1).stamps;
  assert.deepEqual(stampProgress(stamps, pool), {
    earned: 2, total: 3, byTier: { alist: { earned: 1, total: 2 }, other: { earned: 1, total: 1 } },
  });
});

test('storage round-trips, and broken or hostile storage never throws', () => {
  const storage = memoryStorage();
  const { stamps } = recordStamp({}, { id: 'a', name: 'A', how: 'named' }, 7);
  assert.equal(saveStamps(storage, stamps), true);
  assert.ok(storage.map.has(POI_STAMPS_STORAGE_KEY));
  assert.deepEqual(loadStamps(storage), stamps);
  const broken = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); } };
  assert.deepEqual(loadStamps(broken), {});
  assert.equal(saveStamps(broken, stamps), false);
  assert.deepEqual(loadStamps(null), {});
  storage.setItem(POI_STAMPS_STORAGE_KEY, '{not json');
  assert.deepEqual(loadStamps(storage), {});
  storage.setItem(POI_STAMPS_STORAGE_KEY, JSON.stringify({ ok: { id: 'ok', firstEarnedAt: 1, how: 'arrived', count: 2 }, bad: { id: 'a/b', firstEarnedAt: 1, how: 'arrived' }, worse: { id: 'w', how: 'teleported', firstEarnedAt: 1 } }));
  assert.deepEqual(Object.keys(loadStamps(storage)), ['ok']);
});

test('merge: newest wins per id, counts are maxed, first earning is the earliest', () => {
  const local: StampMap = {
    a: { id: 'a', kind: 'poi', name: 'Old', firstEarnedAt: 10, lastEarnedAt: 50, how: 'arrived', count: 3 },
    b: { id: 'b', kind: 'poi', name: 'B', firstEarnedAt: 5, lastEarnedAt: 5, how: 'named', count: 1 },
  };
  const remote: StampMap = {
    a: { id: 'a', kind: 'poi', name: 'New', firstEarnedAt: 20, lastEarnedAt: 90, how: 'named', count: 2 },
    c: { id: 'c', kind: 'tour', name: 'C', firstEarnedAt: 1, lastEarnedAt: 1, how: 'completed', count: 1 },
  };
  const merged = mergeStamps(local, remote);
  assert.deepEqual(merged.a, { id: 'a', kind: 'poi', name: 'New', firstEarnedAt: 10, lastEarnedAt: 90, how: 'named', count: 3 });
  assert.deepEqual(Object.keys(merged).sort(), ['a', 'b', 'c']);
  assert.deepEqual(mergeStamps(remote, local), merged, 'merge is symmetric');
  assert.deepEqual(stampsToUpload(merged, remote).map(r => r.id).sort(), ['a', 'b']);
  assert.deepEqual(allStamps(merged).map(r => r.id), ['a', 'b', 'c']);
});

test('cloud docs carry the schema version and come back sanitised', () => {
  const record = { id: 'x', kind: 'poi' as const, name: 'X', firstEarnedAt: 1, lastEarnedAt: 2, how: 'arrived' as const, count: 4 };
  assert.equal(stampDocPath('u1', 'x'), 'users/u1/poiStamps/x');
  const doc = toStampDoc(record);
  assert.equal(doc.schemaVersion, 1);
  assert.deepEqual(fromStampDocs([doc, { nope: true }, null]), { x: record });
  assert.equal(sanitiseStamp({ ...record, count: -3 })?.count, 1);
});

test('the ride keeps its pool for My progress, which counts against the same total', () => {
  const storage = memoryStorage();
  assert.equal(loadPoolSnapshot(storage), null);
  const pool = [{ id: 'a', tier: 'alist' as const }, { id: 'b', tier: 'other' as const }];
  assert.equal(savePoolSnapshot(storage, pool), true);
  assert.deepEqual(loadPoolSnapshot(storage), pool);
  const stamps: StampMap = { a: { id: 'a', kind: 'poi', name: 'A', firstEarnedAt: 1, lastEarnedAt: 1, how: 'arrived', count: 1 } };
  assert.deepEqual(stampProgress(stamps, loadPoolSnapshot(storage)!), {
    earned: 1, total: 2, byTier: { alist: { earned: 1, total: 1 }, other: { earned: 0, total: 1 } },
  });
  storage.setItem('canalRecall.poiStampPool.v1', '{"broken"');
  assert.equal(loadPoolSnapshot(storage), null);
  assert.equal(savePoolSnapshot(null, pool), false);
});

/** An in-memory stand-in for the four Firestore calls stampSync uses. */
function fakeFirestore(initial: Record<string, unknown> = {}) {
  const docs = new Map<string, unknown>(Object.entries(initial).map(([id, data]) => [`users/u1/poiStamps/${id}`, data]));
  let commits = 0;
  const api: StampFirestoreApi<string> = {
    collection: (_db, ...path) => path.join('/'),
    doc: (_db, ...path) => path.join('/'),
    getDocs: (async (path: string) => ({
      docs: [...docs].filter(([key]) => key.startsWith(`${path}/`)).map(([, data]) => ({ data: () => data })),
    })) as never,
    writeBatch: () => {
      const pending: [string, unknown][] = [];
      return {
        set: ((ref: string, data: unknown) => { pending.push([ref, data]); }) as never,
        commit: async () => { commits++; for (const [ref, data] of pending) docs.set(ref, data); },
      };
    },
  };
  return { api, docs, commits: () => commits };
}

test('sign-in merges cloud and device stamps and uploads only what the cloud lacks', async () => {
  const storage = memoryStorage();
  const local: StampMap = {
    a: { id: 'a', kind: 'poi', name: 'A', firstEarnedAt: 10, lastEarnedAt: 50, how: 'arrived', count: 2 },
    same: { id: 'same', kind: 'poi', name: 'Same', firstEarnedAt: 5, lastEarnedAt: 5, how: 'arrived', count: 1 },
  };
  saveStamps(storage, local);
  const cloud = fakeFirestore({
    a: toStampDoc({ id: 'a', kind: 'poi', name: 'A', firstEarnedAt: 5, lastEarnedAt: 20, how: 'named', count: 1 }),
    same: toStampDoc(local.same),
    'tour:t': toStampDoc({ id: 'tour:t', kind: 'tour', name: 'T', firstEarnedAt: 7, lastEarnedAt: 7, how: 'completed', count: 1 }),
  });
  const { merged, uploaded } = await syncStamps({ db: 'db', api: cloud.api, uid: 'u1' }, mergeIntoStorage(storage));
  assert.deepEqual(merged.map(r => r.id).sort(), ['a', 'same', 'tour:t']);
  assert.equal(uploaded, 1, 'only a changed; same is identical and tour:t came from the cloud');
  assert.deepEqual(cloud.docs.get('users/u1/poiStamps/a'), toStampDoc({ id: 'a', kind: 'poi', name: 'A', firstEarnedAt: 5, lastEarnedAt: 50, how: 'arrived', count: 2 }));
  assert.ok(loadStamps(storage)['tour:t'], 'cloud stamps land on the device');

  await saveStamp({ db: 'db', api: cloud.api, uid: 'u1' }, { id: 'b', kind: 'poi', name: 'B', firstEarnedAt: 60, lastEarnedAt: 60, how: 'arrived', count: 1 });
  assert.deepEqual(Object.keys(cloud.docs.get('users/u1/poiStamps/b') as object).sort(),
    ['count', 'firstEarnedAt', 'how', 'id', 'kind', 'lastEarnedAt', 'name', 'schemaVersion'], 'exactly the fields the rules allow');
});
