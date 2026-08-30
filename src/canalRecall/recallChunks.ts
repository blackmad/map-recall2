/**
 * Location-scoped recall identity.
 *
 * A long street is not one fact. Overtoom at the Vondelpark end and Overtoom
 * where it meets the Kinkerbuurt are the same name in two parts of the city a
 * rider can know quite separately, and recording one correct answer as "you
 * know Overtoom" retires the whole street on the strength of a single junction.
 * The same applies to a canal that runs for kilometres.
 *
 * So recall is keyed by *name and place*, not by name. The place is the point
 * where the question was asked, snapped to a fixed lat/lon grid so the key is
 * stable across sessions: the game's world pixels are not, because the network
 * offset is recomputed per route from the loaded bounds.
 *
 * Reading it back is a radius query rather than a grid lookup. Grid cells have
 * arbitrary edges, and a rider who answers a metre inside one cell should not
 * be asked again a metre into the next; "do I know this name around here"
 * answers that correctly whichever side of an edge either point fell.
 */

export type LatLon = [number, number];

const METERS_PER_DEGREE_LAT = 111_320;

/** Grid pitch for recall identity. One answer stands for this much street. */
export const RECALL_CHUNK_METERS = 300;

/**
 * How far a recorded answer reaches when deciding whether to ask again. Wider
 * than the grid pitch so a cell edge never causes a second question a few
 * metres later, and still short enough that the far end of a long street is a
 * separate piece of knowledge.
 */
export const RECALL_LOCAL_RADIUS_METERS = 600;

/** Correct answers a name needs before the game treats it as genuinely known. */
export const KNOWN_REPETITIONS = 1;

/** Equirectangular distance. Amsterdam-sized spans, so the error is negligible. */
export function metersBetween(a: LatLon, b: LatLon): number {
  const meanLat = (a[0] + b[0]) / 2 * Math.PI / 180;
  const dLat = (a[0] - b[0]) * METERS_PER_DEGREE_LAT;
  const dLon = (a[1] - b[1]) * METERS_PER_DEGREE_LAT * Math.cos(meanLat);
  return Math.hypot(dLat, dLon);
}

/**
 * The centre of the grid cell containing `point`.
 *
 * The longitude pitch is derived from the *band's* centre latitude rather than
 * the point's own, so every point in a band agrees on where the column edges
 * are. Without that, two points either side of a band edge could round into
 * cells whose centres differ by centimetres and hash to different keys.
 */
export function chunkCenter(point: LatLon, chunkMeters: number = RECALL_CHUNK_METERS): LatLon {
  const latPitch = chunkMeters / METERS_PER_DEGREE_LAT;
  const bandLat = (Math.floor(point[0] / latPitch) + 0.5) * latPitch;
  const lonPitch = chunkMeters / (METERS_PER_DEGREE_LAT * Math.cos(bandLat * Math.PI / 180));
  const bandLon = (Math.floor(point[1] / lonPitch) + 0.5) * lonPitch;
  // The review key rounds centres to four decimals; round here too so the
  // stored snapshot and the key agree on the same point.
  return [Number(bandLat.toFixed(5)), Number(bandLon.toFixed(5))];
}

/** The subset of a stored review state this module needs to answer a query. */
export interface LocalReviewState {
  dueAt: number;
  repetitions: number;
  mode: string;
  featureSnapshot: { name: string; cityId: string; center: LatLon };
}

interface NearQuery {
  states: Iterable<LocalReviewState>;
  name: string;
  cityId: string;
  point: LatLon;
  now: number;
  radiusMeters?: number;
  minRepetitions?: number;
}

function anyStateNear({
  states, name, cityId, point, now,
  radiusMeters = RECALL_LOCAL_RADIUS_METERS,
  minRepetitions = 0,
}: NearQuery): boolean {
  for (const state of states) {
    if (state.mode !== 'guess_name') continue;
    const snapshot = state.featureSnapshot;
    if (!snapshot || snapshot.name !== name || snapshot.cityId !== cityId) continue;
    if (state.dueAt <= now) continue;
    if (state.repetitions < minRepetitions) continue;
    if (metersBetween(snapshot.center, point) > radiusMeters) continue;
    return true;
  }
  return false;
}

/**
 * True when this name has been answered near here recently enough that asking
 * again would be noise — including a wrong answer, which the scheduler parks
 * for ten minutes so the rider is not immediately re-tested on a correction.
 */
export function isSuppressedNear(query: Omit<NearQuery, 'minRepetitions'>): boolean {
  return anyStateNear(query);
}

/**
 * True when the rider has actually demonstrated this name near here: at least
 * one correct answer, still inside its review interval. This is the stricter
 * bar, used where a wrong answer must not count as knowledge.
 */
export function isKnownNear(query: Omit<NearQuery, 'minRepetitions'>): boolean {
  return anyStateNear({ ...query, minRepetitions: KNOWN_REPETITIONS });
}
