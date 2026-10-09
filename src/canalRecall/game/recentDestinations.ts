/**
 * Remembers where recent rides from a given start ended, so the next pick can
 * steer away from them. Pure list logic plus a thin Storage adapter; the
 * browser passes localStorage, tests pass a Map-backed fake.
 */

export const RECENT_DESTINATIONS_KEY = 'canalRecall.recentDestinations.v1';
/** Destinations kept per start. Picks down-weight the last `HOME_RECENT_WINDOW`. */
export const RECENT_DESTINATIONS_MAX = 12;
export const HOME_RECENT_WINDOW = 8;

export interface RecentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** One bucket per city and start (home address), so moving house starts fresh. */
export function recentDestinationsKey(cityId: string, startLabel: string): string {
  return `${cityId}|${startLabel.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

/** Most recent first, deduplicated, bounded. */
export function rememberDestination(
  recent: readonly string[],
  id: string,
  max = RECENT_DESTINATIONS_MAX,
): string[] {
  if (!id) return [...recent].slice(0, max);
  return [id, ...recent.filter(entry => entry !== id)].slice(0, max);
}

function readAll(storage: RecentStorage | null | undefined): Record<string, string[]> {
  try {
    const raw = storage?.getItem(RECENT_DESTINATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) out[key] = value.filter((entry): entry is string => typeof entry === 'string');
    }
    return out;
  } catch {
    return {};
  }
}

export function readRecentDestinations(storage: RecentStorage | null | undefined, key: string): string[] {
  return readAll(storage)[key] ?? [];
}

export function recordRecentDestination(
  storage: RecentStorage | null | undefined,
  key: string,
  id: string,
): string[] {
  const all = readAll(storage);
  const next = rememberDestination(all[key] ?? [], id);
  all[key] = next;
  // Keep the store itself bounded: a handful of homes is plenty.
  const keys = Object.keys(all);
  if (keys.length > 12) {
    for (const stale of keys.filter(entry => entry !== key).slice(0, keys.length - 12)) delete all[stale];
  }
  try { storage?.setItem(RECENT_DESTINATIONS_KEY, JSON.stringify(all)); } catch { /* storage unavailable */ }
  return next;
}
