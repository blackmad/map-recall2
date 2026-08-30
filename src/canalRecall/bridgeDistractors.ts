// Every bridge in the extract offered the same four options.
//
// `build-amsterdam-extract.ts` filled `distractors` with
// `alternatives.slice(0, 12).sort(random).slice(0, 4)`, and `alternatives` is
// sorted by prominence — so the twelve highest-scoring bridges in Amsterdam
// were the distractor pool for all 300 of them. Measured on the published
// extract: 300 bridges, 13 distinct names ever offered. Crossing the
// Prinsengracht, the four choices were Zeeburgerbrug, Nesciobrug, IJburglaan
// and the Berlagebrug — none of them anywhere near the canal ring, so the
// right answer was the only plausible one on the list. That is not a test of
// where you are; it is a test of which name sounds central.
//
// A distractor has to be a place you could believably be standing. The best
// signal available offline is the water: a bridge over the Amstel should be
// confused with the other Amstel bridges, because telling the Magere Brug from
// the Blauwbrug is the actual piece of local knowledge. Where the crossing
// builder could not identify the water — 37% of crossings — proximity is the
// honest fallback.

export interface BridgeDistractorCandidate {
  id: string;
  name: string;
  /** [lat, lon] */
  center: [number, number];
  /** Waterways this bridge is known to cross, from the crossings extract. */
  waterways?: string[];
}

export interface BridgeDistractorOptions {
  /** How many distractors to store per bridge. */
  count?: number;
  /** At most this many of the slots come from the same-water pool. */
  maxSameWater?: number;
  /** Names that must never be offered (numbered bridges and the like). */
  exclude?: (name: string) => boolean;
}

const DEFAULT_COUNT = 4;
/**
 * Leave one slot for a neighbour off the water. Four same-water options make
 * the question a coin flip between near-identical spans; three plus a nearby
 * bridge keeps it answerable by someone who knows the area.
 */
const DEFAULT_MAX_SAME_WATER = 3;

/** Metres between two [lat, lon] points, good enough at city scale. */
export function metresBetween(a: [number, number], b: [number, number]): number {
  const latMetres = 111_320;
  const lonMetres = latMetres * Math.cos(((a[0] + b[0]) / 2) * (Math.PI / 180));
  const dy = (a[0] - b[0]) * latMetres;
  const dx = (a[1] - b[1]) * lonMetres;
  return Math.hypot(dx, dy);
}

/**
 * The nearest other features, by name. Every category in the extract had the
 * same global-top-12 bug, so this is the generic repair the builder uses; the
 * bridge pass below refines it with what the crossings extract knows about
 * water. Deterministic — the caller shuffles at question time, so a rebuilt
 * extract diffs cleanly.
 */
export function pickNearestDistractors(
  target: BridgeDistractorCandidate,
  candidates: readonly BridgeDistractorCandidate[],
  options: Omit<BridgeDistractorOptions, 'maxSameWater'> = {},
): string[] {
  return pickBridgeDistractors(target, candidates, { ...options, maxSameWater: 0 });
}

/**
 * Distractors for one bridge: the nearest bridges over the same water first,
 * then the nearest bridges of any kind.
 */
export function pickBridgeDistractors(
  target: BridgeDistractorCandidate,
  candidates: readonly BridgeDistractorCandidate[],
  options: BridgeDistractorOptions = {},
): string[] {
  const count = options.count ?? DEFAULT_COUNT;
  const maxSameWater = options.maxSameWater ?? DEFAULT_MAX_SAME_WATER;
  const exclude = options.exclude ?? (() => false);
  const targetWaters = new Set(target.waterways ?? []);

  const pool = candidates
    .filter(candidate => candidate.id !== target.id && candidate.name !== target.name)
    .filter(candidate => candidate.name && !exclude(candidate.name))
    .map(candidate => ({
      candidate,
      metres: metresBetween(target.center, candidate.center),
      sharesWater: (candidate.waterways ?? []).some(water => targetWaters.has(water)),
    }))
    .sort((a, b) => a.metres - b.metres);

  const chosen: string[] = [];
  const taken = new Set<string>([target.name]);
  const take = (name: string) => {
    if (taken.has(name)) return;
    taken.add(name);
    chosen.push(name);
  };

  for (const entry of pool) {
    if (chosen.length >= Math.min(maxSameWater, count)) break;
    if (entry.sharesWater) take(entry.candidate.name);
  }
  for (const entry of pool) {
    if (chosen.length >= count) break;
    take(entry.candidate.name);
  }

  return chosen;
}

export interface BridgeDistractorReport {
  bridges: number;
  /** Bridges that got the full complement of distractors. */
  complete: number;
  /** Bridges with at least one same-water option. */
  withSameWater: number;
  /** How many distinct names appear anywhere in the extract's distractors. */
  distinctNames: number;
  /** Median distance from a bridge to the distractors offered against it. */
  medianDistractorMetres: number;
}

export function reportBridgeDistractors(
  assigned: ReadonlyMap<string, string[]>,
  candidates: readonly BridgeDistractorCandidate[],
  options: { count?: number } = {},
): BridgeDistractorReport {
  const count = options.count ?? DEFAULT_COUNT;
  const byName = new Map(candidates.map(candidate => [candidate.name, candidate]));
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const distinct = new Set<string>();
  const distances: number[] = [];
  let complete = 0;
  let withSameWater = 0;

  for (const [id, names] of assigned) {
    const target = byId.get(id);
    if (!target) continue;
    if (names.length >= count) complete++;
    const waters = new Set(target.waterways ?? []);
    let shares = false;
    for (const name of names) {
      distinct.add(name);
      const other = byName.get(name);
      if (!other) continue;
      distances.push(metresBetween(target.center, other.center));
      if ((other.waterways ?? []).some(water => waters.has(water))) shares = true;
    }
    if (shares) withSameWater++;
  }

  distances.sort((a, b) => a - b);
  const median = distances.length
    ? distances[Math.floor(distances.length / 2)]
    : 0;

  return {
    bridges: assigned.size,
    complete,
    withSameWater,
    distinctNames: distinct.size,
    medianDistractorMetres: Math.round(median),
  };
}
