/**
 * Which OSM highways belong in Amsterdam street-mode routing.
 *
 * Street mode presents as cycling but historically reused a car-only highway
 * list. That dropped every `highway=pedestrian` / `cycleway` corridor the
 * basemap still draws — Zeedijk, Nieuwendijk, and most of the separated cycle
 * network — so the router refused streets a bike can legally use.
 *
 * Sidewalks stay out unless OSM explicitly tags bicycle access: pulling in
 * every `footway` would double the graph with kerb-parallel clones.
 */

/** Car-oriented highways the extract has always treated as drivable. */
export const CAR_ROUTING_HIGHWAYS = new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link',
  'residential', 'living_street', 'unclassified', 'service', 'busway',
]);

const BICYCLE_ALLOWED = new Set(['yes', 'designated', 'permissive', 'official']);
const BICYCLE_DENIED = new Set(['no', 'dismount', 'private', 'customers']);

/**
 * True when this way should be a centreline in the cycling routing graph.
 *
 * Car highways stay in (including `bicycle=use_sidepath` roads — the parallel
 * cycleway is added separately when present). Pedestrian streets are included
 * unless bikes are denied. Untagged footways/paths are not.
 */
export function isBikeRoutingHighway(tags: Readonly<Record<string, string | undefined>>): boolean {
  const highway = tags.highway;
  if (!highway) return false;
  if (CAR_ROUTING_HIGHWAYS.has(highway)) return true;

  const bicycle = tags.bicycle || '';
  if (highway === 'cycleway') return !BICYCLE_DENIED.has(bicycle);
  if (highway === 'pedestrian') return !BICYCLE_DENIED.has(bicycle);
  if (highway === 'path' || highway === 'footway') return BICYCLE_ALLOWED.has(bicycle);
  return false;
}
