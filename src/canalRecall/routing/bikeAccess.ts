/**
 * Which OSM highways belong in Amsterdam street-mode routing.
 *
 * Street mode presents as cycling but historically reused a car-only highway
 * list. That dropped every `highway=pedestrian` / `cycleway` corridor the
 * basemap still draws — Zeedijk, Nieuwendijk, and most of the separated cycle
 * network — so the router refused streets a bike can legally use.
 *
 * Pedestrian streets that OSM marks `bicycle=no` / `dismount` are still
 * *playable* here: the game teaches the corridor, and the extract stores
 * `bicycleRestricted` so we can later tell the player bikes are banned in
 * real life. Sidewalks stay out unless OSM explicitly tags bicycle access —
 * pulling in every `footway` would double the graph with kerb-parallel clones.
 */

/** Car-oriented highways the extract has always treated as drivable. */
export const CAR_ROUTING_HIGHWAYS = new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link',
  'residential', 'living_street', 'unclassified', 'service', 'busway',
]);

const BICYCLE_ALLOWED = new Set(['yes', 'designated', 'permissive', 'official']);
const BICYCLE_DENIED = new Set(['no', 'dismount', 'private', 'customers']);

/** OSM tags a bike ban / dismount on this way. */
export function isBicycleRestricted(
  tags: Readonly<Record<string, string | undefined>>,
): boolean {
  return BICYCLE_DENIED.has(tags.bicycle || '') || tags.bicycleRestricted === 'yes';
}

/**
 * Short HUD copy for a playable corridor that forbids bikes in real life.
 * Never includes the street name — the plaque must not answer a quiz.
 */
export function bicycleRestrictionNotice(
  tags: Readonly<Record<string, string | undefined>>,
): string | null {
  if (!isBicycleRestricted(tags)) return null;
  const bicycle = tags.bicycle || '';
  if (bicycle === 'dismount') return 'Walk bikes in real life';
  if (bicycle === 'private' || bicycle === 'customers') return 'Private — no public cycling';
  return 'No cycling in real life';
}

/**
 * True when this way should be a centreline in the playable cycling graph.
 *
 * Car highways stay in (including `bicycle=use_sidepath` roads — the parallel
 * cycleway is added separately when present). Pedestrian streets are included
 * even when bikes are denied in real life (see `isBicycleRestricted`). Untagged
 * footways/paths are not.
 */
export function isBikeRoutingHighway(tags: Readonly<Record<string, string | undefined>>): boolean {
  const highway = tags.highway;
  if (!highway) return false;
  if (CAR_ROUTING_HIGHWAYS.has(highway)) return true;

  const bicycle = tags.bicycle || '';
  if (highway === 'cycleway') return !BICYCLE_DENIED.has(bicycle);
  // Playable even when bicycle=no — restriction is recorded separately.
  if (highway === 'pedestrian') return true;
  if (highway === 'path' || highway === 'footway') return BICYCLE_ALLOWED.has(bicycle);
  return false;
}
