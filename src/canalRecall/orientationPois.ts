/**
 * Amsterdam's extract carries 1944 named local food venues. They earn their
 * place as block-level orientation cues — "the corner with the pancake house"
 * is how a rider actually navigates — but drawn all at once they bury the
 * driving corridor under a restaurant directory, and a label the rider cannot
 * connect to anything is worse than no label.
 *
 * MapLibre already drops labels that collide, so the map never showed all of
 * them; it showed an arbitrary subset, dense wherever the data happened to be
 * dense. Thinning to the best cue per patch of ground makes the survivors
 * deliberate instead, and keeps them spread out enough to orient by.
 */

export interface OrientationPoi {
  id: string;
  name: string;
  kind: string;
  /** [latitude, longitude], as stored in the extract. */
  center: [number, number];
  orientationScore?: number;
}

/**
 * Roughly one cue per couple of blocks. Measured against the Grimburgwal
 * viewport that prompted this: 78 named venues compete for that screen, of
 * which MapLibre drew a dozen or so at random. At 260 m, eight candidates
 * remain and every one of them is the best cue on its patch of ground.
 */
export const DEFAULT_CELL_METRES = 260;

const METRES_PER_DEGREE_LAT = 111320;

export interface ThinOptions {
  /** Only these kinds are thinned; anything else passes through untouched. */
  kinds?: string[];
  cellMetres?: number;
}

/**
 * Keep the strongest cue in each cell of ground, dropping the rest.
 *
 * Ties break on id rather than input order so the same extract always yields
 * the same map — a label that moved between sessions would read as a bug.
 */
export function thinOrientationPois<T extends OrientationPoi>(
  pois: readonly T[],
  options: ThinOptions = {},
): T[] {
  const kinds = new Set(options.kinds ?? ['local-food']);
  const cellMetres = options.cellMetres ?? DEFAULT_CELL_METRES;
  if (!(cellMetres > 0)) return pois.slice();

  const passthrough: T[] = [];
  const contested: T[] = [];
  for (const poi of pois) {
    if (poi && kinds.has(poi.kind) && Array.isArray(poi.center)) contested.push(poi);
    else if (poi) passthrough.push(poi);
  }
  if (!contested.length) return passthrough;

  // A degree of longitude shortens towards the poles, so the cell grid is
  // squared up against the latitude the venues actually sit at. Amsterdam is
  // small enough that one reference latitude covers the whole extract.
  const referenceLat = contested.reduce((sum, poi) => sum + poi.center[0], 0) / contested.length;
  const metresPerDegreeLng = METRES_PER_DEGREE_LAT * Math.cos(referenceLat * Math.PI / 180);

  const best = new Map<string, T>();
  for (const poi of contested) {
    const row = Math.floor((poi.center[0] * METRES_PER_DEGREE_LAT) / cellMetres);
    const column = Math.floor((poi.center[1] * metresPerDegreeLng) / cellMetres);
    const key = `${row},${column}`;
    const held = best.get(key);
    if (!held) { best.set(key, poi); continue; }
    const heldScore = held.orientationScore ?? 0;
    const score = poi.orientationScore ?? 0;
    if (score > heldScore || (score === heldScore && poi.id < held.id)) best.set(key, poi);
  }

  return passthrough.concat([...best.values()]);
}
