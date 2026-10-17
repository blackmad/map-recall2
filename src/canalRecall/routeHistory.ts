/**
 * Ride history: one record per finished Canal Recall ride.
 *
 * The ride writes a record on arrival (`routeHistoryBrowser.ts`), keeps the
 * last {@link ROUTE_HISTORY_CAP} on the device, and, when the rider is signed
 * in, mirrors each to Firestore `users/{uid}/gameSessions/{id}` (validated in
 * firestore.rules). The My progress page reads the same store, merges the
 * cloud copy in, and links each ride back to the ride through the share-link
 * hash the ride already understands (`#race=centre,start,finish`).
 *
 * Everything here is pure or takes its storage as an argument, so it runs in
 * Node tests, the legacy ride page and the React progress page alike.
 */

export const ROUTE_HISTORY_KEY = 'canalRecall.routeHistory.v1';
export const ROUTE_HISTORY_CAP = 200;
/** Bound on the per-ride name list, matched by firestore.rules. */
export const STREETS_LEARNED_CAP = 100;
const NAME_MAX = 200;

export type RideMode = 'boat' | 'bike' | 'transit';

export interface RideRecord {
  id: string;
  schemaVersion: 1;
  startedAt: number;
  endedAt: number;
  mode: RideMode;
  cityId: string;
  start: { name: string; lngLat: [number, number] };
  finish: { name: string; landmarkId: string | null; lngLat: [number, number] };
  namedCount: number;
  askedCount: number;
  points: number;
  /** Names answered correctly on this ride, in order, without repeats. */
  streetsLearned: string[];
  /** `#race=…` share hash that replays this start and finish; '' when unknown. */
  raceHash: string;
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

/** The ride's internal travel modes: the street mode is presented as cycling. */
export function rideModeFor(travelMode: string | undefined | null): RideMode {
  if (travelMode === 'boat') return 'boat';
  if (travelMode === 'transit') return 'transit';
  return 'bike';
}

/** `?travel=` value the ride's share-link reader accepts for this mode. */
export function travelParamFor(mode: RideMode): 'boat' | 'car' | 'transit' {
  return mode === 'bike' ? 'car' : mode;
}

const RACE_HASH = /^#race=(-?\d+(?:\.\d+)?,){5}-?\d+(?:\.\d+)?$/;

/** Pulls the `#race=` hash out of the ride's share URL; '' if it has none. */
export function raceHashFromShareUrl(shareUrl: string | null | undefined): string {
  if (!shareUrl) return '';
  const at = shareUrl.indexOf('#');
  const hash = at < 0 ? '' : shareUrl.slice(at);
  return RACE_HASH.test(hash) ? hash : '';
}

const text = (value: unknown, fallback = ''): string =>
  (typeof value === 'string' && value.trim() ? value.trim() : fallback).slice(0, NAME_MAX);
const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
const lngLat = (lat: unknown, lng: unknown): [number, number] =>
  [typeof lng === 'number' && Number.isFinite(lng) ? lng : 0, typeof lat === 'number' && Number.isFinite(lat) ? lat : 0];

function uniqueNames(names: Iterable<unknown>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = text(raw);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= STREETS_LEARNED_CAP) break;
  }
  return out;
}

/** What the ride knows at arrival. Loose on purpose: it comes from untyped game.js. */
export interface FinishedRideInput {
  startedAt?: number;
  endedAt: number;
  travelMode?: string;
  cityId?: string;
  from?: { id?: string; name?: string; lat?: number; lng?: number } | null;
  to?: { id?: string; name?: string; lat?: number; lng?: number } | null;
  namedCount?: number;
  askedCount?: number;
  points?: number;
  streetsLearned?: Iterable<unknown>;
  shareUrl?: string | null;
  /** Defaults to a time-plus-random id; tests pass their own. */
  id?: string;
}

export function newRideId(now: number, random: () => number = Math.random): string {
  return `ride-${now.toString(36)}-${Math.floor(random() * 0x100000000).toString(36).padStart(7, '0')}`;
}

export function createRideRecord(input: FinishedRideInput): RideRecord {
  const endedAt = count(input.endedAt) || Date.now();
  const startedAt = Math.min(count(input.startedAt) || endedAt, endedAt);
  const askedCount = count(input.askedCount);
  return {
    id: input.id ?? newRideId(endedAt),
    schemaVersion: 1,
    startedAt,
    endedAt,
    mode: rideModeFor(input.travelMode),
    cityId: text(input.cityId, 'amsterdam'),
    start: { name: text(input.from?.name, 'Start'), lngLat: lngLat(input.from?.lat, input.from?.lng) },
    finish: {
      name: text(input.to?.name, 'Finish'),
      landmarkId: input.to?.id ? text(input.to.id) : null,
      lngLat: lngLat(input.to?.lat, input.to?.lng),
    },
    namedCount: Math.min(count(input.namedCount), askedCount || count(input.namedCount)),
    askedCount,
    points: count(input.points),
    streetsLearned: uniqueNames(input.streetsLearned ?? []),
    raceHash: raceHashFromShareUrl(input.shareUrl),
  };
}

/** Shape check for anything read back from storage or the cloud. */
export function isRideRecord(value: unknown): value is RideRecord {
  const r = value as RideRecord;
  return !!r && typeof r === 'object'
    && typeof r.id === 'string' && !!r.id
    && typeof r.startedAt === 'number' && typeof r.endedAt === 'number'
    && (r.mode === 'boat' || r.mode === 'bike' || r.mode === 'transit')
    && !!r.start && typeof r.start.name === 'string'
    && !!r.finish && typeof r.finish.name === 'string'
    && typeof r.namedCount === 'number' && typeof r.askedCount === 'number'
    && Array.isArray(r.streetsLearned);
}

/** Newest first, one per id, at most `cap`. */
export function normalizeHistory(records: readonly RideRecord[], cap = ROUTE_HISTORY_CAP): RideRecord[] {
  const byId = new Map<string, RideRecord>();
  for (const record of records) {
    if (!isRideRecord(record)) continue;
    const existing = byId.get(record.id);
    if (!existing || record.endedAt > existing.endedAt) byId.set(record.id, record);
  }
  return [...byId.values()].sort((a, b) => b.endedAt - a.endedAt).slice(0, cap);
}

export function loadRouteHistory(storage: Storage | undefined | null): RideRecord[] {
  try {
    const parsed = JSON.parse(storage?.getItem(ROUTE_HISTORY_KEY) || '[]') as unknown;
    return Array.isArray(parsed) ? normalizeHistory(parsed as RideRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveRouteHistory(storage: Storage | undefined | null, records: readonly RideRecord[]): boolean {
  try {
    if (!storage) return false;
    storage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(normalizeHistory(records)));
    return true;
  } catch {
    return false; // private mode or quota: the ride still finishes
  }
}

/** Adds one ride to the device's history and returns the new list. */
export function appendRide(storage: Storage | undefined | null, record: RideRecord): RideRecord[] {
  const next = normalizeHistory([record, ...loadRouteHistory(storage)]);
  saveRouteHistory(storage, next);
  return next;
}

export function clearRouteHistory(storage: Pick<globalThis.Storage, 'removeItem'> | undefined | null): void {
  try { storage?.removeItem(ROUTE_HISTORY_KEY); } catch { /* blocked storage */ }
}

/**
 * Local and cloud copies, merged. `upload` lists the local rides the cloud is
 * missing (rides finished as a guest, or while offline).
 */
export function mergeHistories(local: readonly RideRecord[], cloud: readonly unknown[]): { merged: RideRecord[]; upload: RideRecord[] } {
  const cloudRides = cloud.filter(isRideRecord);
  const cloudIds = new Set(cloudRides.map(r => r.id));
  return {
    merged: normalizeHistory([...local, ...cloudRides]),
    upload: normalizeHistory(local).filter(r => !cloudIds.has(r.id)),
  };
}

/** The Firestore document: the record itself, without undefined fields. */
export function toCloudDoc(record: RideRecord): Record<string, unknown> {
  return JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
}

/**
 * Link that replays a ride's start and finish. `rideHref` is the ride's own
 * URL in the current layout (`/ride` on the site, `/canal-drive/` in dev).
 * Null when the ride had no share hash (an old record, or a route without
 * fixed endpoints).
 */
export function rideAgainHref(record: Pick<RideRecord, 'raceHash' | 'mode'> & { start?: { name: string } }, rideHref: string): string | null {
  if (!record.raceHash || !RACE_HASH.test(record.raceHash)) return null;
  // A Home or Here ride replays from that private point; `start=` tells the ride so, which
  // keeps the replay's own record private and its share link neutral (shareRoute.ts).
  const origin = privateStartParam(record.start?.name);
  return `${rideHref}?travel=${travelParamFor(record.mode)}${origin ? `&start=${origin}` : ''}${record.raceHash}`;
}

/** `home` / `here` for a ride that started at that private origin, else ''. */
export function privateStartParam(startName: string | undefined | null): 'home' | 'here' | '' {
  const name = (startName || '').trim().toLowerCase();
  return name === 'home' || name === 'here' ? name : '';
}

const dayKey = (time: number): string => {
  const d = new Date(time);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/**
 * Consecutive local calendar days with any activity, counting back from today
 * (or from yesterday, so a streak is not lost before today's ride).
 */
export function dayStreak(activityTimes: Iterable<number>, now = Date.now()): number {
  const days = new Set<string>();
  for (const time of activityTimes) if (Number.isFinite(time) && time > 0 && time <= now + 60_000) days.add(dayKey(time));
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface RideSummary {
  rides: number;
  named: number;
  asked: number;
  /** Distinct names answered right across all rides. */
  namesOnRides: number;
}

export function summarizeRides(records: readonly RideRecord[]): RideSummary {
  const names = new Set<string>();
  let named = 0;
  let asked = 0;
  for (const r of records) {
    named += r.namedCount;
    asked += r.askedCount;
    for (const name of r.streetsLearned) names.add(name.toLowerCase());
  }
  return { rides: records.length, named, asked, namesOnRides: names.size };
}

/** Minutes, rounded, at least 1; null for a record without a usable start. */
export function rideMinutes(record: Pick<RideRecord, 'startedAt' | 'endedAt'>): number | null {
  const ms = record.endedAt - record.startedAt;
  if (!(ms > 0)) return null;
  return Math.max(1, Math.round(ms / 60_000));
}
