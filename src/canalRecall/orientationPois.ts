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

export interface BasemapStyleLayer {
  id?: string;
  type?: string;
  'source-layer'?: string;
}

/**
 * OpenFreeMap's Liberty style already contains ranked OSM POIs with icons and
 * collision-aware labels. The game used to hide those along with road names.
 * Identify them by their source layer instead of Liberty's current `poi_r*`
 * ids so a harmless upstream style rename does not blank the cues again.
 */
export function basemapOrientationPoiLayerIds(
  layers: readonly BasemapStyleLayer[],
): string[] {
  return layers
    .filter(layer => layer.id
      && layer.type === 'symbol'
      && layer['source-layer'] === 'poi')
    .map(layer => layer.id as string);
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

// ---------------------------------------------------------------------------
// Answer spoilers.
//
// Orientation cues must never name the thing the game is about to ask. A tram
// stop called "Nassaukade" on the corner of Nassaukade, a café called "De
// Prinsengracht", or a memorial labelled "Majoor Bosshardt" beside the
// Majoor Bosshardtbrug each pre-teach the answer (review 2026-09-26). Match on
// word n-grams, so containment costs a few Set lookups per label, and on
// Dutch-suffix stems, so the bare person/place a bridge or street is named
// after counts as its name.
// ---------------------------------------------------------------------------

const SPOILER_MIN_LENGTH = 5;
const SPOILER_MAX_WORDS = 5;
/** Longest first, so "dwarsstraat" strips before "straat". */
const DUTCH_NAME_SUFFIXES = [
  'dwarsstraat', 'burgwal', 'gracht', 'straat', 'kanaal', 'sloot', 'steeg',
  'plein', 'kade', 'brug', 'laan', 'dijk', 'weg', 'pad', 'hof',
];

export interface SpoilerIndex {
  /** Normalised quiz-eligible names, plus their suffix stems. */
  names: Set<string>;
  /** Lower-cased raw names, for the basemap's exact-match filter, which can
   *  only `downcase` (not strip punctuation or accents). */
  lowerRaw: Set<string>;
}

export function normaliseSpoilerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Every quiz-eligible name, and the stem left when a Dutch street/water/bridge
 *  suffix comes off the end ("majoor bosshardtbrug" → "majoor bosshardt"). */
export function buildSpoilerIndex(names: Iterable<string>): SpoilerIndex {
  const index = new Set<string>();
  const lowerRaw = new Set<string>();
  for (const raw of names) {
    if (!raw) continue;
    const name = normaliseSpoilerName(raw);
    if (name.length >= SPOILER_MIN_LENGTH) lowerRaw.add(raw.trim().toLowerCase());
    if (name.length < SPOILER_MIN_LENGTH) continue;
    index.add(name);
    for (const suffix of DUTCH_NAME_SUFFIXES) {
      if (!name.endsWith(suffix)) continue;
      const stem = name.slice(0, -suffix.length).trim();
      if (stem.length >= SPOILER_MIN_LENGTH) index.add(stem);
      break;
    }
  }
  return { names: index, lowerRaw };
}

/** True when any run of 1–5 consecutive words in the label is a quiz name or
 *  its stem. */
export function poiNameSpoils(label: string | null | undefined, index: SpoilerIndex | null): boolean {
  if (!label || !index || index.names.size === 0) return false;
  const words = normaliseSpoilerName(label).split(' ').filter(Boolean);
  for (let size = 1; size <= Math.min(SPOILER_MAX_WORDS, words.length); size++) {
    for (let start = 0; start + size <= words.length; start++) {
      if (index.names.has(words.slice(start, start + size).join(' '))) return true;
    }
  }
  return false;
}

/** A MapLibre filter that keeps a basemap POI layer's own filter and drops any
 *  feature whose name is exactly a quiz name. The basemap is vector tiles, so
 *  containment is left to exact match; stops are named exactly after streets. */
export function basemapSpoilerFilter(original: unknown, index: SpoilerIndex): unknown {
  const exclude = [
    '!',
    ['in',
      ['downcase', ['to-string', ['coalesce', ['get', 'name:latin'], ['get', 'name'], '']]],
      ['literal', [...new Set([...index.names, ...index.lowerRaw])]]],
  ];
  return original ? ['all', original, exclude] : exclude;
}
