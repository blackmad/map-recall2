/**
 * Consent-free gameplay analytics: the allow-list (issue #101, lane #115).
 *
 * The client and the Firebase function share this file, so an event either
 * matches it exactly or is dropped on both sides. Every field is a closed set
 * of short tokens (or, for the buurt, a CBS-style four-character code), so no
 * free text, coordinates, identifiers or timestamps can travel in an event.
 *
 * Privacy rules this schema exists to enforce:
 * - no cookie, no storage identifier, no fingerprint;
 * - the batch carries a random per-tab session id held in memory only; the
 *   server uses it to drop a replayed batch and never stores it;
 * - device is a coarse class (phone, tablet, desktop), performance a tier;
 * - places are rounded to a buurt code, never coordinates or a route trace;
 * - the server keeps counters per day, no per-event rows.
 *
 * Self-contained on purpose (the function bundle imports it); the game's own
 * value lists are checked against these in `schema.test.ts`.
 */

export const ANALYTICS_SCHEMA_VERSION = 1;

/** Presentation names: the internal `car` mode is cycling (routeHistory.ts does the same). */
export const MODES = ['boat', 'bike', 'transit'] as const;
export const CITIES = ['amsterdam', 'utrecht', 'rotterdam', 'den-haag'] as const;
export const DEVICES = ['phone', 'tablet', 'desktop'] as const;
/** How the ride was chosen: the route pattern, or a tour / review ride / Free Ride. */
export const ENTRIES = ['surprise', 'home', 'here', 'free', 'tour', 'review'] as const;
/** The ride's ordinal in this tab (first ride vs riding on). */
export const SEQS = ['1', '2', '3', '4+'] as const;
export const OUTCOMES = ['finished', 'abandoned'] as const;
/** Where an unfinished ride was left; `finished` for a completed one. */
export const STEPS = ['loading', 'intro', 'riding', 'paused', 'finished'] as const;
/** Furthest straight-line progress toward the destination; `none` for Free Ride. */
export const PROGRESS = ['0-25', '25-50', '50-75', '75-100', 'none'] as const;
export const ANSWERED = ['0', '1-2', '3-5', '6-10', '11+'] as const;
export const MINUTES = ['lt1min', '1-3min', '3-5min', '5-10min', '10-20min', '20min+'] as const;
export const DISTANCES = ['lt500m', '500m-1km', '1-2km', '2-4km', '4-8km', '8km+'] as const;
/** The game's QUIZ_SUBJECT_NAMES. */
export const QUESTION_KINDS = ['street', 'waterway', 'water', 'bridge', 'line', 'stop'] as const;
/** The game's QUIZ_PROMPT_KINDS. */
export const PROMPTS = ['route', 'crossing-water', 'bridge'] as const;
export const ANSWER_INPUTS = ['multiple', 'typing'] as const;
export const ANSWER_OUTCOMES = ['correct', 'wrong', 'no-idea'] as const;
/** From the render governor: no step taken, stepped down, or at the pixel-ratio floor. */
export const PERF_TIERS = ['smooth', 'reduced', 'floor', 'unknown'] as const;
/** mapGuard's GraphicsFailure events. */
export const GRAPHICS_FAILURES = ['dead-gpu-shader', 'webgl-context-lost', 'webgl-context-restored', 'webgl-unavailable'] as const;
/** Amsterdam gebieden buurt code (coverage-v1/buurten.json `code`, e.g. AA01). */
export const BUURT_CODE = /^[A-Z][A-Z0-9][0-9]{2}$/;

type FieldRule = readonly string[] | RegExp;

/**
 * Event type → its fields, in counter-key order. Every field is required and
 * nothing else is allowed.
 */
export const EVENT_FIELDS = {
  /** Once per tab, when the first batch leaves. */
  session: { device: DEVICES },
  ride_start: { mode: MODES, entry: ENTRIES, city: CITIES, seq: SEQS },
  ride_end: { mode: MODES, outcome: OUTCOMES, step: STEPS, progress: PROGRESS, answered: ANSWERED },
  ride_length: { mode: MODES, outcome: OUTCOMES, minutes: MINUTES, distance: DISTANCES },
  answer: { mode: MODES, kind: QUESTION_KINDS, prompt: PROMPTS, input: ANSWER_INPUTS, outcome: ANSWER_OUTCOMES },
  /** One per buurt per ride, when the rider first enters it. */
  buurt: { mode: MODES, code: BUURT_CODE },
  /** Once per finished or abandoned ride that reached the road. */
  perf: { device: DEVICES, tier: PERF_TIERS },
  graphics_failure: { device: DEVICES, kind: GRAPHICS_FAILURES },
} as const satisfies Record<string, Record<string, FieldRule>>;

export type EventType = keyof typeof EVENT_FIELDS;
export const EVENT_TYPES = Object.keys(EVENT_FIELDS) as EventType[];

type FieldValue<R> = R extends readonly (infer V)[] ? V : string;
export type AnalyticsEventOf<T extends EventType> =
  { t: T } & { -readonly [K in keyof (typeof EVENT_FIELDS)[T]]: FieldValue<(typeof EVENT_FIELDS)[T][K]> };
export type AnalyticsEvent = { [T in EventType]: AnalyticsEventOf<T> }[EventType];

/** Upper bounds for one beacon; anything larger is not ours. */
export const MAX_EVENTS_PER_BATCH = 100;
export const MAX_BATCH_BYTES = 16 * 1024;
export const SESSION_ID = /^[0-9a-f]{16}$/;

export interface AnalyticsBatch {
  v: typeof ANALYTICS_SCHEMA_VERSION;
  /** Random per tab, memory only. Used to drop replays; never stored. */
  sid: string;
  /** This tab's batch counter, for replay detection. */
  n: number;
  events: AnalyticsEvent[];
}

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function matches(rule: FieldRule, value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return rule instanceof RegExp ? rule.test(value) : rule.includes(value);
}

/** The event when it is exactly an allow-listed shape, else null. Returns a fresh object. */
export function validateEvent(raw: unknown): AnalyticsEvent | null {
  if (!isPlainObject(raw)) return null;
  const t = raw.t;
  if (typeof t !== 'string' || !own(EVENT_FIELDS, t)) return null;
  const fields = EVENT_FIELDS[t as EventType] as Record<string, FieldRule>;
  const keys = Object.keys(raw);
  if (keys.length !== Object.keys(fields).length + 1) return null;
  const out: Record<string, string> = { t };
  for (const key of keys) {
    if (key === 't') continue;
    if (!own(fields, key) || !matches(fields[key], raw[key])) return null;
    out[key] = raw[key] as string;
  }
  return out as unknown as AnalyticsEvent;
}

export interface ParsedBatch {
  batch: AnalyticsBatch;
  /** Events that failed the allow-list and were dropped. */
  dropped: number;
}

/**
 * Parse a beacon body. The envelope must be exact (unknown top-level keys
 * reject the whole batch); events that fail the allow-list are dropped one
 * by one and counted.
 */
export function parseBatch(body: unknown): ParsedBatch | null {
  let raw = body;
  if (typeof raw === 'string') {
    if (raw.length > MAX_BATCH_BYTES) return null;
    try { raw = JSON.parse(raw); } catch { return null; }
  }
  if (!isPlainObject(raw)) return null;
  const keys = Object.keys(raw).sort().join(',');
  if (keys !== 'events,n,sid,v') return null;
  if (raw.v !== ANALYTICS_SCHEMA_VERSION) return null;
  if (typeof raw.sid !== 'string' || !SESSION_ID.test(raw.sid)) return null;
  if (typeof raw.n !== 'number' || !Number.isInteger(raw.n) || raw.n < 0 || raw.n > 100000) return null;
  if (!Array.isArray(raw.events) || raw.events.length > MAX_EVENTS_PER_BATCH) return null;
  const events: AnalyticsEvent[] = [];
  let dropped = 0;
  for (const event of raw.events) {
    const valid = validateEvent(event);
    if (valid) events.push(valid); else dropped += 1;
  }
  return { batch: { v: ANALYTICS_SCHEMA_VERSION, sid: raw.sid, n: raw.n, events }, dropped };
}

/** `ride_start|mode=bike|entry=surprise|city=amsterdam|seq=1`: one daily counter per distinct event. */
export function counterKey(event: AnalyticsEvent): string {
  const fields = EVENT_FIELDS[event.t] as Record<string, FieldRule>;
  const values = event as unknown as Record<string, string>;
  return [event.t, ...Object.keys(fields).map(key => `${key}=${values[key]}`)].join('|');
}

/** Inverse of `counterKey`, for the report; null for anything that is not a valid key. */
export function parseCounterKey(key: string): AnalyticsEvent | null {
  const [t, ...parts] = key.split('|');
  const raw: Record<string, string> = { t };
  for (const part of parts) {
    const at = part.indexOf('=');
    if (at <= 0) return null;
    raw[part.slice(0, at)] = part.slice(at + 1);
  }
  return validateEvent(raw);
}

// ---------------------------------------------------------------------------
// Buckets (pure, shared by the client and its tests)
// ---------------------------------------------------------------------------

export function minutesBucket(seconds: number): (typeof MINUTES)[number] {
  const m = Math.max(0, seconds) / 60;
  if (m < 1) return 'lt1min';
  if (m < 3) return '1-3min';
  if (m < 5) return '3-5min';
  if (m < 10) return '5-10min';
  if (m < 20) return '10-20min';
  return '20min+';
}

export function distanceBucket(metres: number): (typeof DISTANCES)[number] {
  const m = Math.max(0, metres);
  if (m < 500) return 'lt500m';
  if (m < 1000) return '500m-1km';
  if (m < 2000) return '1-2km';
  if (m < 4000) return '2-4km';
  if (m < 8000) return '4-8km';
  return '8km+';
}

export function progressBucket(fraction: number | null): (typeof PROGRESS)[number] {
  if (fraction === null || !Number.isFinite(fraction)) return 'none';
  const f = Math.min(1, Math.max(0, fraction));
  if (f < 0.25) return '0-25';
  if (f < 0.5) return '25-50';
  if (f < 0.75) return '50-75';
  return '75-100';
}

export function answeredBucket(count: number): (typeof ANSWERED)[number] {
  if (!(count > 0)) return '0';
  if (count <= 2) return '1-2';
  if (count <= 5) return '3-5';
  if (count <= 10) return '6-10';
  return '11+';
}

export function seqBucket(ordinal: number): (typeof SEQS)[number] {
  if (ordinal <= 1) return '1';
  if (ordinal === 2) return '2';
  if (ordinal === 3) return '3';
  return '4+';
}
