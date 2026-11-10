// The passport as a stamp album (G5, issue #275): every buurt has a place in
// the album, greyed until earned, with the date it was earned.
//
// Stamps come from two places: the quiz passport (canalRecall.neighborhoodPassport.v1,
// whose `dates` map is new with this lane; older passports have no dates) and
// Free Ride's collection (canalRecall.freeRideCollection.v1, lane G4), whose
// `stamps` carry `{ hood, at }`. Either is enough to earn a stamp; the earliest
// known date wins.

import { PASSPORT_STORAGE_KEY } from './game/neighborhoodPassport.ts';
import { AMSTERDAM_STAMP_BUURTS } from './stampCatalogue.ts';

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
 * unearned buurts alphabetically. Only catalogue buurts are stamps (#283): a
 * stored name outside `buurtNames` (a destination, another city, a renamed
 * boundary, junk) neither earns a page nor moves the total, so the total is
 * the catalogue's size whatever storage holds.
 */
export function buildStampAlbum(buurtNames: readonly string[], sources: StampSources): StampAlbum {
  const names = new Set<string>(buurtNames);
  const earnedSet = new Set(sources.stamped.filter(name => names.has(name)));
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

/**
 * The one stamp list every surface reads (#283): the landing's "Passport · N
 * stamps", the arrival card's stamp line and the album. Quiz passport and Free
 * Ride stamps both count; the total is the buurt catalogue.
 */
export function stampList(store: ReadStore | null | undefined, catalogue: readonly string[] = AMSTERDAM_STAMP_BUURTS): StampAlbum {
  return buildStampAlbum(catalogue, readStampSources(store));
}

/** The one stamp count: `{ earned, total }` from `stampList`. */
export function stampCount(store: ReadStore | null | undefined, catalogue: readonly string[] = AMSTERDAM_STAMP_BUURTS): { earned: number; total: number } {
  const { earned, total } = stampList(store, catalogue);
  return { earned, total };
}

/** "8 Nov 2026" (English) or "8 nov 2026" (Dutch); empty for an undated stamp. */
export function stampDateLabel(date: string | null, language: string = 'en'): string {
  if (!date || !DAY.test(date)) return '';
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat(language === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(Date.UTC(y, m - 1, d))
    .replace('.', '')
    .replace('Sept', 'Sep');
}
