// Today's ride (G2, #272): one route per calendar day, the same for everyone.
//
// The surprise picker draws a start at random from the destination pool and
// then a destination near it (`pickDestinationNear`). Today's ride is the same
// draw with the randomness replaced by a unit seeded from the date, over the
// city's curated landmarks: a static list (cities.ts) that every browser has
// without fetching anything, so the landing page can name the route from
// localStorage alone and two browsers on the same date get the same pair.
//
// The date is Amsterdam's calendar date, so the ride turns over at midnight in
// the city it is about, for every player at the same instant.
//
// A player's own board of past days is read back from the ride history the
// ride already keeps (routeHistory.ts): a finished ride whose start and finish
// are that day's pair, started on that day. Nothing new is stored.

import { kmBetween, pickDestinationNear, type ChooseUnit, type RoutePoi } from './surprisePick';
import type { RideRecord } from '../routeHistory';
import { DAILY_RIDE_POOL, type DailyPoolPlace } from './dailyRidePool';

export const DAILY_RIDE_TIME_ZONE = 'Europe/Amsterdam';
/** Straight line to street distance. The canal belt's grid is not a grid: a
 *  ride is about a third longer than the crow flies. The label says "km" as
 *  an estimate; the board records the real time. */
export const DAILY_RIDE_ROAD_FACTOR = 1.3;
/** Past days the landing's board lists. */
export const DAILY_RIDE_BOARD_DAYS = 5;
/** A ride counts as today's when it starts this close to today's start (names
 *  can differ: a shared endpoint is renamed from the extract). */
export const DAILY_RIDE_MATCH_KM = 0.15;
const SEED_PREFIX = 'canal-recall-daily:';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Test-only: `?dailyDate=YYYY-MM-DD` on the page fixes "today" for a call made without a clock. */
function dailyDateOverride(): string | null {
  try {
    const search = (globalThis as { location?: { search?: string } }).location?.search;
    const value = search ? new URLSearchParams(search).get('dailyDate') : null;
    return value && DATE_KEY.test(value) ? value : null;
  } catch { return null; }
}

/**
 * `YYYY-MM-DD` in Amsterdam for an instant. Called with no instant (the ride's
 * `?ride=daily` hook), a `?dailyDate=YYYY-MM-DD` in the page URL stands in for
 * today: a test-only override, so a spec can ride any date's pair.
 */
export function dailyRideDateKey(now?: number, timeZone: string = DAILY_RIDE_TIME_ZONE): string {
  if (now === undefined) {
    const override = dailyDateOverride();
    if (override) return override;
    now = Date.now();
  }
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(now));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** FNV-1a, 32 bit. */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A deterministic unit in [0, 1) from a string seed (mulberry32). */
export function seededUnit(seed: string): ChooseUnit {
  let state = hash32(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DailyRidePair {
  /** The Amsterdam date this pair belongs to. */
  date: string;
  /** `date:from>to`; identical for every browser on that date. */
  id: string;
  from: RoutePoi;
  to: RoutePoi;
  /** Estimated ride length, 0.1 km. */
  km: number;
}

/** No pair (either direction) repeats within this many days before it. */
export const DAILY_RIDE_NO_REPEAT_DAYS = 7;
/** The no-repeat window runs forward from this day; earlier dates take the plain draw. */
export const DAILY_RIDE_EPOCH = '2026-11-01';
/** Redraws from the same seed stream before a repeat is accepted (a tiny pool). */
const DAILY_RIDE_MAX_DRAWS = 64;

const pairKey = (a: RoutePoi, b: RoutePoi) => (a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`);

function shiftDate(date: string, days: number): string {
  const at = new Date(`${date}T12:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

function sortedPool(candidates: readonly RoutePoi[]): RoutePoi[] {
  return [...candidates].filter(poi => poi && poi.id && Number.isFinite(poi.lat) && Number.isFinite(poi.lng))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The date's draw: the surprise picker's start then destination, from the date's
 *  seeded stream, drawing again while the pair is in `recent`. */
function drawPair(date: string, pool: readonly RoutePoi[], recent: ReadonlySet<string>): [RoutePoi, RoutePoi] | null {
  const unit = seededUnit(SEED_PREFIX + date);
  let first: [RoutePoi, RoutePoi] | null = null;
  for (let attempt = 0; attempt < DAILY_RIDE_MAX_DRAWS; attempt++) {
    const from = pool[Math.min(pool.length - 1, Math.floor(unit() * pool.length))]!;
    const to = pickDestinationNear(pool, from, unit);
    if (!to) continue;
    first ??= [from, to];
    if (!recent.has(pairKey(from, to))) return [from, to];
  }
  return first;
}

const historyCache = new Map<string, Map<string, [RoutePoi, RoutePoi] | null>>();

/** Forget the memoised days (tests: a fresh machine). */
export function clearDailyRideCache(): void {
  historyCache.clear();
  poolCache.clear();
}

/** Pairs by date from the epoch up to `date`, each avoiding the 7 before it. Memoised per pool. */
function pairFor(date: string, pool: readonly RoutePoi[]): [RoutePoi, RoutePoi] | null {
  if (date < DAILY_RIDE_EPOCH) return drawPair(date, pool, new Set());
  const poolKey = pool.map(poi => `${poi.id}@${poi.lat},${poi.lng}`).join(';');
  let byDate = historyCache.get(poolKey);
  if (!byDate) { byDate = new Map(); historyCache.set(poolKey, byDate); }
  if (byDate.has(date)) return byDate.get(date)!;
  // Walk forward from the latest known day (or the epoch) so each day sees its finished predecessors.
  let cursor = DAILY_RIDE_EPOCH;
  for (let back = 1; back <= 4000; back++) {
    const prior = shiftDate(date, -back);
    if (prior < DAILY_RIDE_EPOCH) break;
    if (byDate.has(prior)) { cursor = shiftDate(prior, 1); break; }
  }
  for (let day = cursor; day <= date; day = shiftDate(day, 1)) {
    const recent = new Set<string>();
    for (let back = 1; back <= DAILY_RIDE_NO_REPEAT_DAYS; back++) {
      const prior = shiftDate(day, -back);
      const pair = prior < DAILY_RIDE_EPOCH ? null : byDate.get(prior);
      if (pair) recent.add(pairKey(pair[0], pair[1]));
    }
    byDate.set(day, drawPair(day, pool, recent));
  }
  return byDate.get(date) ?? null;
}

/**
 * Today's start and finish: the surprise picker's two draws (a start from the
 * pool, then `pickDestinationNear`) with the date's seeded unit, drawn again
 * from the same stream while the pair (either way round) was ridden in the 7
 * days before. Every day from the epoch is worked out in order, so the answer
 * is the same on every machine. The pool is sorted by id first, so the order a
 * caller lists it in does not matter. Null with fewer than two candidates.
 */
export function dailyRidePair(date: string, candidates: readonly RoutePoi[]): DailyRidePair | null {
  if (date >= DAILY_POOL_CUTOVER) return dailyPoolPair(date);
  const pool = sortedPool(candidates);
  if (pool.length < 2) return null;
  const pair = pairFor(date, pool);
  if (!pair) return null;
  const [from, to] = pair;
  const km = Math.round(kmBetween(from, to) * DAILY_RIDE_ROAD_FACTOR * 10) / 10;
  return { date, id: `${date}:${from.id}>${to.id}`, from, to, km };
}

// ---- The buurt pool (#279), from DAILY_POOL_CUTOVER ----
//
// From the cutover the pair is drawn from DAILY_RIDE_POOL (dailyRidePool.ts,
// generated by scripts/daily-ride/build-pool.ts): buurt centroids and tour
// stops, each already snapped to an unnamed, routable street, named on the card
// by its buurt. `dailyRidePair` ignores its candidates from that date on, so the
// ride's `?ride=daily` hook (game-route.js, which passes the curated landmarks)
// and the landing draw the same pair. Days before the cutover keep the curated
// landmark draw above, so a board of rides from before it still matches; the
// pairs of days already seen do not change.

/** First day drawn from the buurt pool. */
export const DAILY_POOL_CUTOVER = '2026-11-10';
/** Estimated ride length (straight line × DAILY_RIDE_ROAD_FACTOR), km. */
export const DAILY_RIDE_MIN_KM = 1.5;
export const DAILY_RIDE_MAX_KM = 5;

export interface DailyPoolPoi extends RoutePoi {
  /** The repeat key: no buurt starts or ends two rides in the same 7 days. */
  buurt: string;
  /** Marks a buurt place, so the arrival card tells the neighbourhood (finishBlurb.buurtFinishBlurb). */
  buurtPlace: true;
  /** May start a ride (an unnamed street clear of named ones: the start street would be the first question). */
  startOk: boolean;
  /** May end a ride (any routable street: the cards name the buurt, questions stop at arrival). */
  finishOk: boolean;
}

/** Estimated ride km, 0.1 km: what the card prints and the bounds test. */
export function dailyRideKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return Math.round(kmBetween(a, b) * DAILY_RIDE_ROAD_FACTOR * 10) / 10;
}

const inBounds = (a: DailyPoolPoi, b: DailyPoolPoi) => {
  const km = dailyRideKm(a, b);
  return a.buurt !== b.buurt && km >= DAILY_RIDE_MIN_KM && km <= DAILY_RIDE_MAX_KM;
};

/** Pick uniformly by buurt first, then by place within it, so a buurt with many tour stops is not favoured. */
function pickByBuurt(places: readonly DailyPoolPoi[], unit: ChooseUnit): DailyPoolPoi | null {
  if (!places.length) return null;
  const buurten = [...new Set(places.map(place => place.buurt))].sort();
  const buurt = buurten[Math.min(buurten.length - 1, Math.floor(unit() * buurten.length))];
  const inBuurt = places.filter(place => place.buurt === buurt);
  return inBuurt[Math.min(inBuurt.length - 1, Math.floor(unit() * inBuurt.length))] ?? null;
}

function drawPoolPair(
  date: string,
  pool: readonly DailyPoolPoi[],
  recentPairs: ReadonlySet<string>,
  recentBuurten: ReadonlySet<string>,
): [DailyPoolPoi, DailyPoolPoi] | null {
  const unit = seededUnit(SEED_PREFIX + date);
  // The buurt rule first; if it ever leaves nothing (it does not over the shipped pool), only the pair rule.
  for (const blocked of [recentBuurten, new Set<string>()]) {
    const open = pool.filter(place => !blocked.has(place.buurt));
    const partnersOf = (from: DailyPoolPoi) => open.filter(to => to.finishOk && inBounds(from, to) && !recentPairs.has(pairKey(from, to)));
    const from = pickByBuurt(open.filter(place => place.startOk && partnersOf(place).length > 0), unit);
    if (!from) continue;
    const to = pickByBuurt(partnersOf(from), unit);
    if (to) return [from, to];
  }
  return null;
}

const poolCache = new Map<string, Map<string, [DailyPoolPoi, DailyPoolPoi] | null>>();

function toPoolPoi(place: DailyPoolPlace): DailyPoolPoi {
  return { id: place.id, name: place.name, lat: place.lat, lng: place.lng, buurt: place.buurt, buurtPlace: true, startOk: place.startOk, finishOk: place.finishOk };
}

/** Pool pairs by date from the cutover up to `date`, each clear of the 7 days before it. Memoised per pool. */
function poolPairFor(date: string, pool: readonly DailyPoolPoi[]): [DailyPoolPoi, DailyPoolPoi] | null {
  const poolKey = pool.map(poi => `${poi.id}@${poi.lat},${poi.lng}/${poi.buurt}`).join(';');
  let byDate = poolCache.get(poolKey);
  if (!byDate) { byDate = new Map(); poolCache.set(poolKey, byDate); }
  if (byDate.has(date)) return byDate.get(date)!;
  let cursor = DAILY_POOL_CUTOVER;
  for (let back = 1; back <= 4000; back++) {
    const prior = shiftDate(date, -back);
    if (prior < DAILY_POOL_CUTOVER) break;
    if (byDate.has(prior)) { cursor = shiftDate(prior, 1); break; }
  }
  for (let day = cursor; day <= date; day = shiftDate(day, 1)) {
    const pairs = new Set<string>(), buurten = new Set<string>();
    for (let back = 1; back <= DAILY_RIDE_NO_REPEAT_DAYS; back++) {
      const prior = shiftDate(day, -back);
      const pair = prior < DAILY_POOL_CUTOVER ? null : byDate.get(prior);
      if (!pair) continue;
      pairs.add(pairKey(pair[0], pair[1]));
      buurten.add(pair[0].buurt).add(pair[1].buurt);
    }
    byDate.set(day, drawPoolPair(day, pool, pairs, buurten));
  }
  return byDate.get(date) ?? null;
}

/**
 * The buurt pool's pair for a date (on or after DAILY_POOL_CUTOVER): a start
 * buurt, then a finish buurt DAILY_RIDE_MIN_KM–DAILY_RIDE_MAX_KM away by the
 * estimate, neither buurt at either end of the 7 days before, the pair not
 * ridden in them. Every day from the cutover is worked out in order and the
 * pool is sorted by id first, so every machine gets the same pair. Null
 * before the cutover.
 */
export function dailyPoolPair(date: string, places: readonly DailyPoolPlace[] = DAILY_RIDE_POOL): DailyRidePair | null {
  const pool = [...places].map(toPoolPoi).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (pool.length < 2 || !DATE_KEY.test(date) || date < DAILY_POOL_CUTOVER) return null;
  const pair = poolPairFor(date, pool);
  if (!pair) return null;
  const [from, to] = pair;
  return { date, id: `${date}:${from.id}>${to.id}`, from, to, km: dailyRideKm(from, to) };
}

/** The route id alone, for comparing browsers. */
export function dailyRideRouteId(date: string, candidates: readonly RoutePoi[]): string | null {
  return dailyRidePair(date, candidates)?.id ?? null;
}

/** "Jordaan → Oosterparkbuurt · about 3.1 km" (the distance is an estimate). */
export function dailyRideLabel(pair: Pick<DailyRidePair, 'from' | 'to' | 'km'>): string {
  return `${pair.from.name} → ${pair.to.name} · about ${pair.km.toFixed(1)} km`;
}

export interface DailyRideDay {
  date: string;
  /** Ride time, whole seconds. */
  seconds: number;
  named: number;
  asked: number;
  /** Named of asked, 0–100; null when nothing was asked. */
  recall: number | null;
  /** Fastest of the days listed (tagged "fastest", not "best": speed is not recall). */
  fastest: boolean;
}

function samePlace(a: { name: string; lngLat: [number, number] }, b: RoutePoi, id?: string | null): boolean {
  if (id && id === b.id) return true;
  if (a.name && a.name === b.name) return true;
  const [lng, lat] = a.lngLat;
  return (lat !== 0 || lng !== 0) && kmBetween({ lat, lng }, b) <= DAILY_RIDE_MATCH_KM;
}

/** Whether a finished ride rode `pair`'s start and finish. */
export function rideMatchesDaily(record: RideRecord, pair: DailyRidePair): boolean {
  return samePlace(record.finish, pair.to, record.finish.landmarkId)
    && samePlace(record.start, pair.from);
}

/**
 * The player's own past days of today's ride, newest first: the fastest
 * matching ride per day, at most `limit` days. `fastest` marks the quickest day.
 */
export function dailyRideBoard(
  history: readonly RideRecord[],
  candidates: readonly RoutePoi[],
  { limit = DAILY_RIDE_BOARD_DAYS, timeZone = DAILY_RIDE_TIME_ZONE }: { limit?: number; timeZone?: string } = {},
): DailyRideDay[] {
  const pairs = new Map<string, DailyRidePair | null>();
  const byDay = new Map<string, DailyRideDay>();
  for (const record of history) {
    const date = dailyRideDateKey(record.startedAt, timeZone);
    if (!pairs.has(date)) pairs.set(date, dailyRidePair(date, candidates));
    const pair = pairs.get(date);
    if (!pair || !rideMatchesDaily(record, pair)) continue;
    const seconds = Math.max(0, Math.round((record.endedAt - record.startedAt) / 1000));
    const asked = record.askedCount;
    const named = Math.min(record.namedCount, asked || record.namedCount);
    const day: DailyRideDay = { date, seconds, named, asked, recall: asked > 0 ? Math.round((named / asked) * 100) : null, fastest: false };
    const prior = byDay.get(date);
    if (!prior || day.seconds < prior.seconds) byDay.set(date, day);
  }
  const days = [...byDay.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
  if (days.length > 1) {
    const fastest = days.reduce((min, day) => (day.seconds < min.seconds ? day : min), days[0]!);
    fastest.fastest = true;
  }
  return days;
}

/** "9:05", or "1:02:03" past the hour. */
export function formatRideTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}
