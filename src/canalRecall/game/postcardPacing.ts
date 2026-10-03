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

/** Entries to a neighbourhood that always get the postcard. */
export const POSTCARD_FIRST_VISITS = 3;
/** Seconds without a new trivia card for a familiar neighbourhood's entry to
 *  get the postcard anyway. */
export const POSTCARD_QUIET_SECONDS = 45;
/** Seconds between postcards that are not first visits. */
export const POSTCARD_MIN_GAP_SECONDS = 120;
/** Seconds of riding inside one neighbourhood with no trivia card before its
 *  postcard comes back. */
export const POSTCARD_LULL_SECONDS = 90;
/** Seconds between lull postcards. */
export const POSTCARD_LULL_GAP_SECONDS = 180;

export interface PostcardPacingInput {
  /** `raceTime`. */
  now: number;
  /** Entries to this neighbourhood before the current one, across rides. */
  priorEntries: number;
  /** `raceTime` when a trivia (landmark/street) card last opened. */
  lastTriviaAt: number | null;
  /** `raceTime` when a postcard last opened. */
  lastPostcardAt: number | null;
}

// A time later than now is from an earlier ride (`raceTime` restarts at 0).
const since = (now: number, at: number | null) => (at == null || at > now ? Infinity : now - at);

/** Whether an entry to a neighbourhood is worth its postcard. */
export function postcardOnEntry(input: PostcardPacingInput): boolean {
  if (input.priorEntries < POSTCARD_FIRST_VISITS) return true;
  return since(input.now, input.lastTriviaAt) >= POSTCARD_QUIET_SECONDS
    && since(input.now, input.lastPostcardAt) >= POSTCARD_MIN_GAP_SECONDS;
}

/** Whether a quiet stretch inside the current neighbourhood brings its postcard back. */
export function postcardForLull(input: Omit<PostcardPacingInput, 'priorEntries'> & { enteredAt: number }): boolean {
  const trivia = input.lastTriviaAt != null && input.lastTriviaAt <= input.now ? input.lastTriviaAt : -Infinity;
  return since(input.now, Math.max(input.enteredAt, trivia)) >= POSTCARD_LULL_SECONDS
    && since(input.now, input.lastPostcardAt) >= POSTCARD_LULL_GAP_SECONDS;
}

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
