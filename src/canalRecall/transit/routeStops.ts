/**
 * Destination-scoped stop lists for a single-line transit hop.
 *
 * Surprise routing picks two stop anchors on one corridor; quizzes should only
 * ask about stops still ahead toward the destination, not every stop that
 * happens to sit near the vehicle on the full thin-slice line.
 */

/** Ordered stop ids from origin to destination (inclusive), in travel direction. */
export function stopIdsInTravelOrder(
  orderedStopIds: readonly string[],
  fromStopId: string,
  toStopId: string,
): string[] {
  const fromIdx = orderedStopIds.indexOf(fromStopId);
  const toIdx = orderedStopIds.indexOf(toStopId);
  if (fromIdx < 0 || toIdx < 0) return [];
  if (fromIdx === toIdx) return [fromStopId];
  if (fromIdx < toIdx) return orderedStopIds.slice(fromIdx, toIdx + 1);
  return orderedStopIds.slice(toIdx, fromIdx + 1).reverse();
}

/**
 * Stops the player should learn on this hop: everything after origin through
 * the destination (intermediate + destination). Origin is skipped — you
 * already boarded there.
 */
export function intermediateStopIds(
  orderedStopIds: readonly string[],
  fromStopId: string,
  toStopId: string,
): string[] {
  const travel = stopIdsInTravelOrder(orderedStopIds, fromStopId, toStopId);
  return travel.slice(1);
}

/**
 * A stop is still ahead toward the finish when it is closer to the finish than
 * the vehicle (within a small slack so approach radius can fire).
 */
export function isStopAheadTowardFinish(
  playerDistToFinish: number,
  stopDistToFinish: number,
  slackPx = 40,
): boolean {
  return stopDistToFinish <= playerDistToFinish + slackPx;
}

/** Resolve a route-anchor POI id (`stop-<gtfsId>`) or fall back to display name. */
export function resolveRouteStopId(
  stops: readonly { stopId: string; name: string }[],
  poi: { id?: string; name?: string } | null | undefined,
): string | null {
  if (!poi) return null;
  if (poi.id && poi.id.startsWith('stop-')) {
    const id = poi.id.slice('stop-'.length);
    if (stops.some((s) => s.stopId === id)) return id;
  }
  if (poi.name) {
    const match = stops.find((s) => s.name === poi.name);
    if (match) return match.stopId;
  }
  return null;
}
