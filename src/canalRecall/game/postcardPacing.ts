// When the "welcome to" neighbourhood postcard comes up.
//
// It used to open on every neighbourhood change, and only if nothing owned the
// bottom band at that instant: entering a neighbourhood with a quiz open spent
// the entry, so on a typical ride the postcards were rarely seen. David asked
// (2026-10-03) for them "occasionally, when we don't have trivia, the first
// few times in a new hood". So an entry now leaves the postcard pending until
// the band is free, and whether it is worth showing depends on how well the
// rider knows the place and how much else they have been told lately:
//
//   - the first few entries to a neighbourhood (counted across rides) always
//     get it — that is when "where am I" is worth saying;
//   - after that, an entry gets it only when no trivia card opened recently
//     and no postcard was shown recently;
//   - a long stretch inside one neighbourhood with no trivia at all brings
//     the current neighbourhood's postcard back, so a quiet ride still says
//     where it is.

// The numbers and the two decisions live in `teachingPacer`, beside every
// other pacing rule; they are re-exported so imports and checks keep working.
export {
  POSTCARD_FIRST_VISITS, POSTCARD_QUIET_SECONDS, POSTCARD_MIN_GAP_SECONDS,
  POSTCARD_LULL_SECONDS, POSTCARD_LULL_GAP_SECONDS,
  postcardOnEntry, postcardForLull,
} from './teachingPacer';
export type { PostcardPacingInput } from './teachingPacer';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const storageKey = (cityId: string) => `canalRecall.neighborhoodEntries.${cityId}`;

/** Entries per neighbourhood for a city, as remembered by this browser. */
export function loadEntryCounts(storage: StorageLike | null, cityId: string): Map<string, number> {
  try {
    const raw = storage?.getItem(storageKey(cityId));
    const parsed = raw ? JSON.parse(raw) : {};
    return new Map(Object.entries(parsed).filter((e): e is [string, number] => typeof e[1] === 'number'));
  } catch {
    return new Map();
  }
}

/** Count one more entry and remember it; returns the entries before this one. */
export function recordEntry(storage: StorageLike | null, cityId: string, counts: Map<string, number>, name: string): number {
  const prior = counts.get(name) ?? 0;
  counts.set(name, prior + 1);
  try { storage?.setItem(storageKey(cityId), JSON.stringify(Object.fromEntries(counts))); } catch { /* private window */ }
  return prior;
}
