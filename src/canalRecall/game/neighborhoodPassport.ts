/**
 * Neighborhood passport: stamp a hood when the player has both visited it and
 * proved enough corridor names inside the city collection to count as "known".
 *
 * Lightweight rule (no polygon sampling yet): a visited neighborhood becomes a
 * stamp once the player's exploration has at least `minNames` learned names
 * overall *and* this ride (or prior visits) marked the hood. Deeper mastery
 * from routeMastery-in-polygon can replace this later.
 */

import type { Exploration } from './progressStore';

export const PASSPORT_STORAGE_KEY = 'canalRecall.neighborhoodPassport.v1';
export const PASSPORT_MIN_NAMES = 8;

export interface NeighborhoodPassport {
  stamped: string[];
  /** hood -> YYYY-MM-DD when it was stamped (G5 stamp album). Absent on
   *  passports saved before dates were kept. */
  dates?: Record<string, string>;
}

/** Local calendar day, YYYY-MM-DD. */
export function localDay(time = Date.now()): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function emptyPassport(): NeighborhoodPassport {
  return { stamped: [] };
}

export function readPassport(store: { getItem(key: string): string | null }): NeighborhoodPassport {
  try {
    const raw = store.getItem(PASSPORT_STORAGE_KEY);
    if (!raw) return emptyPassport();
    const parsed = JSON.parse(raw) as Partial<NeighborhoodPassport>;
    const dates: Record<string, string> = {};
    if (parsed.dates && typeof parsed.dates === 'object') {
      for (const [hood, at] of Object.entries(parsed.dates)) if (typeof at === 'string') dates[hood] = at;
    }
    return {
      stamped: Array.isArray(parsed.stamped) ? parsed.stamped.map(String) : [],
      ...(Object.keys(dates).length ? { dates } : {}),
    };
  } catch {
    return emptyPassport();
  }
}

export function savePassport(
  store: { setItem(key: string, value: string): void },
  passport: NeighborhoodPassport,
): void {
  try {
    store.setItem(PASSPORT_STORAGE_KEY, JSON.stringify(passport));
  } catch {
    /* private mode */
  }
}

export function clearPassport(store: { removeItem?(key: string): void; setItem(key: string, value: string): void }): void {
  try {
    if (store.removeItem) store.removeItem(PASSPORT_STORAGE_KEY);
    else store.setItem(PASSPORT_STORAGE_KEY, '');
  } catch {
    /* ignore */
  }
}

/**
 * Stamp newly visited neighborhoods once the player has enough city knowledge
 * that a passport mark is earned, not a drive-through souvenir.
 */
export function stampNewNeighborhoods(
  exploration: Exploration,
  visitedThisRoute: Iterable<string>,
  prior: NeighborhoodPassport,
  minNames = PASSPORT_MIN_NAMES,
  today = localDay(),
): { passport: NeighborhoodPassport; fresh: string[] } {
  const known = exploration.learnedWaterways.length + exploration.learnedStreets.length
    + exploration.learnedTransitLines.length + exploration.learnedTransitStops.length;
  if (known < minNames) return { passport: prior, fresh: [] };

  const stamped = new Set(prior.stamped);
  const fresh: string[] = [];
  for (const hood of visitedThisRoute) {
    if (!hood || stamped.has(hood)) continue;
    // Must also appear in the durable visited list (this merge already ran).
    if (!exploration.visitedNeighborhoods.includes(hood)) continue;
    stamped.add(hood);
    fresh.push(hood);
  }
  if (!fresh.length) return { passport: prior, fresh };
  const dates = { ...(prior.dates || {}) };
  for (const hood of fresh) dates[hood] = today;
  return { passport: { stamped: [...stamped].sort(), dates }, fresh };
}
