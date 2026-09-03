/**
 * OSM tags that mean a fully separated cycle track beside the carriageway.
 *
 * Amsterdam street mode is cycling in presentation. Rewarding `cycleway=track`
 * (and kerb-segregated variants) reinforces real infrastructure knowledge.
 * Painted `cycleway=lane` is deliberately excluded — that is not separation.
 */

const TRACK = /^(track|separate)$/;

export type OsmCycleTags = Readonly<Record<string, string | undefined>>;

/** True when the way carries a physically separated cycle facility. */
export function hasSeparatedCycleTrack(tags: OsmCycleTags): boolean {
  if (TRACK.test(tags.cycleway || '')) return true;
  if (TRACK.test(tags['cycleway:both'] || '')) return true;
  if (TRACK.test(tags['cycleway:left'] || '')) return true;
  if (TRACK.test(tags['cycleway:right'] || '')) return true;
  // A painted lane with a kerb / separator still counts as separated.
  if (tags['cycleway:both:segregated'] === 'yes') return true;
  if (tags['cycleway:left:segregated'] === 'yes') return true;
  if (tags['cycleway:right:segregated'] === 'yes') return true;
  return false;
}

/**
 * Bounded answer bonus for naming a street that has a separated cycle track.
 * Kept below the novelty bonus so it never outweighs learning something new,
 * and never applied as a routing weight (that would invite detours).
 */
export const CYCLE_TRACK_ANSWER_MULTIPLIER = 1.1;
