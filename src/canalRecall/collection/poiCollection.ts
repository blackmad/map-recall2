// POI stamps: the collectible side of route destinations.
//
// A stamp is earned when a ride ENDS at a landmark ('arrived') or when the
// player correctly names that landmark ('named'). Completing a themed tour
// earns a tour stamp ('completed'). Modelled on the neighbourhood postcards in
// src/mapRecall/progress.ts: pure functions over plain records, with storage
// and cloud sync as thin, failure-tolerant edges.
//
// The collectible set is the Amsterdam route-destination pool, i.e. landmark
// features that pass isTeachableRouteDestination, ranked by notabilityScore
// and split into the curated A-list and everything else.

import { normaliseAnswer } from '../answerPath';
import { isAList, notabilityScore, type PoiNotability } from '../game/poiNotability';
import { isTeachableRouteDestination, type RouteDestinationFeature } from '../game/routeDestinationContent';

export const POI_STAMPS_STORAGE_KEY = 'canalRecall.poiStamps.v1';
export const POI_STAMP_SCHEMA_VERSION = 1;
/** Same radius game.js uses for extract destinations (ROUTE_POI_MAX_KM_FROM_CENTRE). */
export const COLLECTIBLE_MAX_KM_FROM_CENTRE = 4;
export const AMSTERDAM_CENTRE = { lat: 52.372851, lng: 4.8936 } as const;

export type StampKind = 'poi' | 'tour';
export type StampHow = 'arrived' | 'named' | 'completed';

/** One earned stamp. `id` is the landmark id for a POI and `tour:<id>` for a tour. */
export interface StampRecord {
  id: string;
  kind: StampKind;
  name: string;
  firstEarnedAt: number;
  /** Latest time it was earned again; merge resolves by this. */
  lastEarnedAt: number;
  /** How it was first earned. */
  how: StampHow;
  count: number;
}

export type StampMap = Record<string, StampRecord>;

/** What the ride reports. `id` may be a route-POI id (`lm-<landmarkId>`) or a landmark id. */
export type StampEvent =
  | { kind?: 'poi'; id: string; name?: string; how: 'arrived' | 'named'; at?: number }
  | { kind: 'tour'; id: string; name?: string; how?: 'completed'; at?: number };

export interface CollectiblePoi {
  id: string;
  name: string;
  lat: number;
  lng: number;
  score: number;
  tier: 'alist' | 'other';
}

export interface StampProgress {
  earned: number;
  total: number;
  byTier: { alist: { earned: number; total: number }; other: { earned: number; total: number } };
}

/** The landmark-extract fields the pool reads. */
export interface CollectibleFeature extends RouteDestinationFeature {
  id: string;
  name: string;
  center?: number[];
  routeCenter?: number[];
  type?: string;
  wikidata?: string;
  wikidataSitelinks?: number;
  wikipediaPageviews60d?: number;
  heritage?: string[];
  wikidataInstanceOf?: string[];
  manualPoi?: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const kmBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const dLat = (b.lat - a.lat) * 111.32;
  const dLng = (b.lng - a.lng) * 111.32 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLng);
};

/** The stamp id for a ride event: strips the route-POI `lm-` prefix; tours are namespaced. */
export function stampId(event: Pick<StampEvent, 'kind' | 'id'>): string {
  if (event.kind === 'tour') return event.id.startsWith('tour:') ? event.id : `tour:${event.id}`;
  return event.id.startsWith('lm-') ? event.id.slice(3) : event.id;
}

/** Same notability inputs the route picker attaches (game-route.js _attachNotability). */
function notabilityOf(feature: CollectibleFeature): PoiNotability {
  return {
    name: feature.name,
    wikidata: feature.wikidata,
    sitelinks: feature.wikidataSitelinks,
    pageviews60d: feature.wikipediaPageviews60d,
    heritage: feature.heritage,
    wikidataInstanceOf: feature.wikidataInstanceOf,
    type: feature.type,
    manualPoi: feature.manualPoi,
  };
}

/**
 * The collectible set: teachable extract destinations within the destination
 * radius, deduplicated by normalised name and by Wikidata id (the extract
 * carries "Ons' Lieve Heer op Solder" and "Our Lord in the Attic" as two
 * features of one Q-id; the best-scored one wins), most notable first.
 */
export function collectiblePool(
  features: readonly CollectibleFeature[],
  centre: { lat: number; lng: number } = AMSTERDAM_CENTRE,
  maxKm = COLLECTIBLE_MAX_KM_FROM_CENTRE,
): CollectiblePoi[] {
  const byKey = new Map<string, CollectiblePoi>();
  for (const feature of features) {
    const at = feature.routeCenter || feature.center;
    if (!at || at.length < 2 || !feature.name || !feature.id) continue;
    if (!isTeachableRouteDestination(feature)) continue;
    const point = { lat: at[0], lng: at[1] };
    if (!feature.manualPoi && kmBetween(point, centre) > maxKm) continue;
    const poi: CollectiblePoi = {
      id: feature.id, name: feature.name, ...point,
      score: notabilityScore(notabilityOf(feature)),
      tier: isAList(feature) ? 'alist' : 'other',
    };
    const keys = [`name:${normaliseAnswer(feature.name)}`, ...(feature.wikidata ? [`wd:${feature.wikidata}`] : [])];
    const existing = keys.map(key => byKey.get(key)).find(Boolean);
    if (existing && existing.score >= poi.score) {
      for (const key of keys) byKey.set(key, existing);
      continue;
    }
    for (const [key, value] of byKey) if (value === existing) byKey.set(key, poi);
    for (const key of keys) byKey.set(key, poi);
  }
  return [...new Set(byKey.values())].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** Record one event. Pure: returns a new map and whether it was a first stamp. */
export function recordStamp(stamps: StampMap, event: StampEvent, now = Date.now()): { stamps: StampMap; isNew: boolean; record: StampRecord } {
  const id = stampId(event);
  const at = event.at ?? now;
  const kind: StampKind = event.kind === 'tour' ? 'tour' : 'poi';
  const how: StampHow = kind === 'tour' ? 'completed' : (event.how as StampHow);
  const existing = stamps[id];
  const record: StampRecord = existing
    ? {
      ...existing,
      name: event.name || existing.name,
      firstEarnedAt: Math.min(existing.firstEarnedAt, at),
      lastEarnedAt: Math.max(existing.lastEarnedAt, at),
      count: existing.count + 1,
    }
    : { id, kind, name: event.name || id, firstEarnedAt: at, lastEarnedAt: at, how, count: 1 };
  return { stamps: { ...stamps, [id]: record }, isNew: !existing, record };
}

/** Earned out of the pool, overall and per tier. Tour stamps are not in the pool. */
export function stampProgress<P extends Pick<CollectiblePoi, 'id' | 'tier'>>(stamps: StampMap, pool: readonly P[]): StampProgress {
  const progress: StampProgress = {
    earned: 0, total: pool.length,
    byTier: { alist: { earned: 0, total: 0 }, other: { earned: 0, total: 0 } },
  };
  for (const poi of pool) {
    const tier = progress.byTier[poi.tier];
    tier.total++;
    if (stamps[poi.id]?.kind === 'poi') { tier.earned++; progress.earned++; }
  }
  return progress;
}

/** Newest first, as the postcard rack orders earned areas. */
export function allStamps(stamps: StampMap): StampRecord[] {
  return Object.values(stamps).sort((a, b) => b.lastEarnedAt - a.lastEarnedAt || a.id.localeCompare(b.id));
}

const HOWS: readonly StampHow[] = ['arrived', 'named', 'completed'];

/** Validates one record from storage or the cloud; anything malformed is dropped. */
export function sanitiseStamp(value: unknown): StampRecord | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || !v.id || v.id.length > 128 || v.id.includes('/')) return null;
  const kind = v.kind === 'tour' ? 'tour' : v.kind === 'poi' || v.kind == null ? 'poi' : null;
  if (!kind) return null;
  if (typeof v.firstEarnedAt !== 'number' || !Number.isFinite(v.firstEarnedAt)) return null;
  const last = typeof v.lastEarnedAt === 'number' && Number.isFinite(v.lastEarnedAt) ? v.lastEarnedAt : v.firstEarnedAt;
  if (!HOWS.includes(v.how as StampHow)) return null;
  const count = typeof v.count === 'number' && Number.isFinite(v.count) ? Math.max(1, Math.floor(v.count)) : 1;
  return {
    id: v.id, kind, name: typeof v.name === 'string' ? v.name.slice(0, 200) : v.id,
    firstEarnedAt: v.firstEarnedAt, lastEarnedAt: Math.max(last, v.firstEarnedAt),
    how: v.how as StampHow, count,
  };
}

/**
 * Merge local and cloud stamps: per id the newest (by lastEarnedAt) supplies
 * name/how, counts are max'd (never summed: both sides may hold the same
 * earnings), and the earliest firstEarnedAt is kept.
 */
export function mergeStamps(a: StampMap, b: StampMap): StampMap {
  const out: StampMap = { ...a };
  for (const [id, theirs] of Object.entries(b)) {
    const ours = out[id];
    if (!ours) { out[id] = theirs; continue; }
    const newest = theirs.lastEarnedAt > ours.lastEarnedAt ? theirs : ours;
    out[id] = {
      ...newest,
      firstEarnedAt: Math.min(ours.firstEarnedAt, theirs.firstEarnedAt),
      lastEarnedAt: Math.max(ours.lastEarnedAt, theirs.lastEarnedAt),
      count: Math.max(ours.count, theirs.count),
    };
  }
  return out;
}

export function loadStamps(storage: StorageLike | null | undefined): StampMap {
  try {
    const raw = storage?.getItem(POI_STAMPS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? Object.values(parsed) : [];
    const out: StampMap = {};
    for (const item of list) {
      const record = sanitiseStamp(item);
      if (record) out[record.id] = record;
    }
    return out;
  } catch {
    return {};
  }
}

/** Never throws; a full or blocked storage just loses persistence. */
export function saveStamps(storage: StorageLike | null | undefined, stamps: StampMap): boolean {
  try {
    if (!storage) return false;
    storage.setItem(POI_STAMPS_STORAGE_KEY, JSON.stringify(stamps));
    return true;
  } catch {
    return false;
  }
}

// ---- The pool the ride used, for pages that cannot rebuild it ----

/**
 * The ride counts stamps against its manual-POI-merged destination pool
 * (setPool); rebuilding that pool needs the ~850 kB manual catalogue. The ride
 * keeps the pool's ids and tiers here so My progress shows the same "n of N".
 */
export const POI_STAMP_POOL_STORAGE_KEY = 'canalRecall.poiStampPool.v1';

export type PoolEntry = Pick<CollectiblePoi, 'id' | 'tier'>;

export function savePoolSnapshot(storage: StorageLike | null | undefined, pool: readonly PoolEntry[]): boolean {
  try {
    if (!storage || !pool.length) return false;
    storage.setItem(POI_STAMP_POOL_STORAGE_KEY, JSON.stringify(pool.map(poi => [poi.id, poi.tier === 'alist' ? 1 : 0])));
    return true;
  } catch {
    return false;
  }
}

export function loadPoolSnapshot(storage: StorageLike | null | undefined): PoolEntry[] | null {
  try {
    const raw = storage?.getItem(POI_STAMP_POOL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as unknown : null;
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const out: PoolEntry[] = [];
    for (const entry of parsed) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string') return null;
      out.push({ id: entry[0], tier: entry[1] === 1 ? 'alist' : 'other' });
    }
    return out;
  } catch {
    return null;
  }
}

/** Firestore path for one stamp: users/{uid}/poiStamps/{id}. */
export const stampDocPath = (uid: string, id: string): string => `users/${uid}/poiStamps/${id}`;

/** The document written for one stamp; matches the firestore.rules validation. */
export interface StampDoc extends StampRecord { schemaVersion: typeof POI_STAMP_SCHEMA_VERSION }

export const toStampDoc = (record: StampRecord): StampDoc => ({ ...record, schemaVersion: POI_STAMP_SCHEMA_VERSION });

/** Cloud documents into a map, dropping anything malformed. */
export function fromStampDocs(docs: readonly unknown[]): StampMap {
  const out: StampMap = {};
  for (const doc of docs) {
    const record = sanitiseStamp(doc);
    if (record) out[record.id] = record;
  }
  return out;
}

/** Records that must be (re)written after a merge: missing remotely or changed. */
export function stampsToUpload(merged: StampMap, remote: StampMap): StampRecord[] {
  return Object.values(merged).filter(record => {
    const theirs = remote[record.id];
    return !theirs || theirs.lastEarnedAt !== record.lastEarnedAt || theirs.count !== record.count
      || theirs.firstEarnedAt !== record.firstEarnedAt;
  });
}
