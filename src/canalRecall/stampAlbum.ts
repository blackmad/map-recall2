// The passport as a stamp album (G5, issue #275): every buurt has a place in
// the album, greyed until earned, with the date it was earned.
//
// Stamps come from two places: the quiz passport (canalRecall.neighborhoodPassport.v1,
// whose `dates` map is new with this lane; older passports have no dates) and
// Free Ride's collection (canalRecall.freeRideCollection.v1, lane G4), whose
// `stamps` carry `{ hood, at }`. Either is enough to earn a stamp; the earliest
// known date wins.

import { PASSPORT_STORAGE_KEY } from './game/neighborhoodPassport.ts';

export const FREE_RIDE_COLLECTION_KEY = 'canalRecall.freeRideCollection.v1';

export interface StampSources {
  /** Names stamped in the quiz passport. */
  stamped: readonly string[];
  /** hood -> YYYY-MM-DD, from either source. */
  dates: Readonly<Record<string, string>>;
}

export interface AlbumStamp {
  name: string;
  earned: boolean;
  /** YYYY-MM-DD, or null for a stamp earned before dates were kept. */
  date: string | null;
}

export interface StampAlbum {
  stamps: AlbumStamp[];
  earned: number;
  total: number;
}

type ReadStore = { getItem(key: string): string | null };

const DAY = /^\d{4}-\d{2}-\d{2}/;

function earlier(a: string | undefined, b: string): string {
  return !a || b < a ? b : a;
}

/** Read every stamp the player holds, tolerant of absent or corrupt JSON. */
export function readStampSources(store: ReadStore | null | undefined): StampSources {
  const stamped = new Set<string>();
  const dates: Record<string, string> = {};
  const parse = (key: string): unknown => {
    try {
      const raw = store?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const passport = parse(PASSPORT_STORAGE_KEY) as { stamped?: unknown; dates?: unknown } | null;
  if (passport && Array.isArray(passport.stamped)) {
    for (const name of passport.stamped) if (typeof name === 'string' && name) stamped.add(name);
  }
  if (passport && passport.dates && typeof passport.dates === 'object') {
    for (const [name, at] of Object.entries(passport.dates as Record<string, unknown>)) {
      if (typeof at === 'string' && DAY.test(at)) dates[name] = earlier(dates[name], at.slice(0, 10));
    }
  }
  const collection = parse(FREE_RIDE_COLLECTION_KEY) as { stamps?: unknown } | null;
  if (collection && Array.isArray(collection.stamps)) {
    for (const stamp of collection.stamps as Array<{ hood?: unknown; at?: unknown }>) {
      if (!stamp || typeof stamp.hood !== 'string' || !stamp.hood) continue;
      stamped.add(stamp.hood);
      if (typeof stamp.at === 'string' && DAY.test(stamp.at)) dates[stamp.hood] = earlier(dates[stamp.hood], stamp.at.slice(0, 10));
    }
  }
  return { stamped: [...stamped].sort(), dates };
}

/**
 * The album: earned stamps first, newest first (undated after dated), then the
 * unearned buurts alphabetically. A stamped name that is not in `buurtNames`
 * (another city, a renamed boundary) still gets its page.
 */
export function buildStampAlbum(buurtNames: readonly string[], sources: StampSources): StampAlbum {
  const earnedSet = new Set(sources.stamped);
  const names = new Set<string>(buurtNames);
  for (const name of earnedSet) names.add(name);
  const stamps = [...names].map((name): AlbumStamp => ({
    name,
    earned: earnedSet.has(name),
    date: earnedSet.has(name) ? sources.dates[name] || null : null,
  }));
  stamps.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned && a.date !== b.date) {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date < b.date ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });
  const earned = stamps.filter(stamp => stamp.earned).length;
  return { stamps, earned, total: stamps.length };
}

/** "8 Nov 2026" in the plaque voice; empty for an undated stamp. */
export function stampDateLabel(date: string | null): string {
  if (!date || !DAY.test(date)) return '';
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] || '';
  return `${d} ${month} ${y}`;
}
