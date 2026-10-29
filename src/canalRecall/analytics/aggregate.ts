/**
 * Server side of consent-free analytics, without the Firebase wiring
 * (functions/src/index.ts adds that). A beacon body becomes counter
 * increments on one shard of the day's aggregate document; nothing about the
 * request itself (address, user agent, session id) is kept.
 */
import { counterKey, parseBatch } from './schema';

export const ANALYTICS_COLLECTION = 'analytics_daily';
export const SHARD_COLLECTION = 'analytics_shards';
/** Shards per day: Firestore sustains about one write a second per document. */
export const SHARD_COUNT = 8;
/** Counters for the endpoint itself. */
export const META_BATCHES = '_meta|batches';
export const META_DROPPED = '_meta|dropped';
export const META_REPLAYED = '_meta|replayed';

/** Calendar day in Amsterdam (the game's audience), as yyyy-mm-dd. */
export function dayKey(at: Date, timeZone = 'Europe/Amsterdam'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export interface CounterWrite {
  day: string;
  shard: number;
  /** Counter key → increment. */
  increments: Record<string, number>;
}

/**
 * Remembers recently seen (session, batch) pairs in memory so a beacon the
 * browser sent twice counts once. Bounded, per function instance, never
 * persisted or logged.
 */
export class ReplayGuard {
  private seen = new Set<string>();
  constructor(private readonly capacity = 5000) {}
  firstTime(sid: string, n: number): boolean {
    const key = `${sid}:${n}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > this.capacity) {
      const oldest = this.seen.values().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return true;
  }
}

/** The counter write for one beacon body, or null when the body is not a batch at all. */
export function countersForBody(
  body: unknown,
  options: { now: Date; random?: () => number; replay?: ReplayGuard },
): CounterWrite | null {
  const parsed = parseBatch(body);
  if (!parsed) return null;
  const increments: Record<string, number> = { [META_BATCHES]: 1 };
  if (options.replay && !options.replay.firstTime(parsed.batch.sid, parsed.batch.n)) {
    return { day: dayKey(options.now), shard: 0, increments: { [META_REPLAYED]: 1 } };
  }
  if (parsed.dropped) increments[META_DROPPED] = parsed.dropped;
  for (const event of parsed.batch.events) {
    const key = counterKey(event);
    increments[key] = (increments[key] ?? 0) + 1;
  }
  const random = options.random ?? Math.random;
  return { day: dayKey(options.now), shard: Math.floor(random() * SHARD_COUNT) % SHARD_COUNT, increments };
}

/** Sum shard counter maps (the report's view of one day). */
export function sumShards(shards: ReadonlyArray<Record<string, number> | undefined>): Record<string, number> {
  const total: Record<string, number> = {};
  for (const shard of shards) for (const [key, n] of Object.entries(shard ?? {})) {
    if (typeof n === 'number' && Number.isFinite(n)) total[key] = (total[key] ?? 0) + n;
  }
  return total;
}
