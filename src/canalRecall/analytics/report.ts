/**
 * Summaries of the daily analytics counters (scripts/analytics-report.ts does the IO).
 */
import { parseCounterKey, type AnalyticsEvent, type EventType } from './schema';

export type Counters = Record<string, number>;

export interface DayCounters {
  day: string;
  counters: Counters;
}

/** Last `days` calendar days ending at `today` (yyyy-mm-dd), oldest first. */
export function dayRange(today: string, days: number): string[] {
  const [y, m, d] = today.split('-').map(Number);
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const at = new Date(Date.UTC(y, m - 1, d - i));
    out.push(at.toISOString().slice(0, 10));
  }
  return out;
}

/** Counter rows of one type, parsed back into their fields. Unknown keys are skipped. */
export function rowsOf<T extends EventType>(counters: Counters, type: T): Array<{ event: Extract<AnalyticsEvent, { t: T }>; n: number }> {
  const rows: Array<{ event: Extract<AnalyticsEvent, { t: T }>; n: number }> = [];
  for (const [key, n] of Object.entries(counters)) {
    if (!key.startsWith(`${type}|`)) continue;
    const event = parseCounterKey(key);
    if (event && event.t === type) rows.push({ event: event as Extract<AnalyticsEvent, { t: T }>, n });
  }
  return rows;
}

/** Sum of counts grouped by one or more fields of an event type. */
export function tally<T extends EventType>(counters: Counters, type: T, by: ReadonlyArray<string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { event, n } of rowsOf(counters, type)) {
    const values = event as unknown as Record<string, string>;
    const key = by.map(field => values[field]).join(' ');
    out[key] = (out[key] ?? 0) + n;
  }
  return out;
}

export function mergeDays(days: readonly DayCounters[]): Counters {
  const total: Counters = {};
  for (const { counters } of days) for (const [k, n] of Object.entries(counters)) total[k] = (total[k] ?? 0) + n;
  return total;
}

export interface BuurtRideRow {
  code: string;
  name: string;
  /** Rides that entered the buurt (each ride counts a buurt once). */
  rides: number;
  byMode: Record<string, number>;
}

/**
 * Buurt ride counts, most ridden first: the input for buurt-priority-by-ride
 * rankings (`code` matches coverage-v1/buurten.json `code`).
 */
export function buurtRides(counters: Counters, names: ReadonlyMap<string, string> = new Map()): BuurtRideRow[] {
  const byCode = new Map<string, BuurtRideRow>();
  for (const { event, n } of rowsOf(counters, 'buurt')) {
    const row = byCode.get(event.code) ?? { code: event.code, name: names.get(event.code) ?? '', rides: 0, byMode: {} };
    row.rides += n;
    row.byMode[event.mode] = (row.byMode[event.mode] ?? 0) + n;
    byCode.set(event.code, row);
  }
  return [...byCode.values()].sort((a, b) => b.rides - a.rides || a.code.localeCompare(b.code));
}

export interface DaySummary {
  day: string;
  sessions: number;
  rideStarts: number;
  finished: number;
  abandoned: number;
  /** finished / starts; rides closed without a pagehide are neither finished nor abandoned. */
  completion: number | null;
  answers: number;
  correct: number;
}

export function summariseDay({ day, counters }: DayCounters): DaySummary {
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
  const ends = tally(counters, 'ride_end', ['outcome']);
  const starts = sum(tally(counters, 'ride_start', ['mode']));
  const answers = tally(counters, 'answer', ['outcome']);
  return {
    day,
    sessions: sum(tally(counters, 'session', ['device'])),
    rideStarts: starts,
    finished: ends.finished ?? 0,
    abandoned: ends.abandoned ?? 0,
    completion: starts ? (ends.finished ?? 0) / starts : null,
    answers: sum(answers),
    correct: answers.correct ?? 0,
  };
}
