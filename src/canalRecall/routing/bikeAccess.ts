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

/**
 * Roads closed to bikes by law: Dutch motorways and the trunk autowegen.
 * Street mode is cycling, and the IJ-tunnel (trunk) routed a ride under the IJ
 * and into its portal building (user report 2026-09-28). The Piet Hein and
 * Spaarndammer tunnels, the A10 and the Coen Tunnel are the same case.
 * Where a trunk road has a parallel named cycle track (IJburglaan, Gooiseweg),
 * the track is a separate way and stays.
 */
export const MOTOR_ONLY_HIGHWAYS = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link']);

export function isMotorOnlyHighway(highway: string | undefined | null): boolean {
  return MOTOR_ONLY_HIGHWAYS.has(highway || '');
}

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
  if (!highway || isMotorOnlyHighway(highway)) return false;
  if (CAR_ROUTING_HIGHWAYS.has(highway)) return true;

  const bicycle = tags.bicycle || '';
  if (highway === 'cycleway') return !BICYCLE_DENIED.has(bicycle);
  // Playable even when bicycle=no — restriction is recorded separately.
  if (highway === 'pedestrian') return true;
  if (highway === 'path' || highway === 'footway') return BICYCLE_ALLOWED.has(bicycle);
  return false;
}

type NamedRoutingFeature = {
  name?: string;
  highway?: string;
  path?: Array<[number, number]>;
  paths?: Array<Array<[number, number]>>;
};

/**
 * Names that are mostly motor road: the IJ-tunnel's approach ramps are tagged
 * `primary`, so dropping trunk alone leaves 200 m dead-end stubs still called
 * "IJ-tunnel" that lead into the portal and still get asked about. A name
 * whose length is mostly motorway/trunk goes as a whole.
 */
export function motorOnlyNames(features: readonly NamedRoutingFeature[], share = 0.5): Set<string> {
  const motor = new Map<string, number>(), total = new Map<string, number>();
  for (const feature of features) {
    if (!feature.name) continue;
    let length = 0;
    for (const path of feature.paths ?? (feature.path ? [feature.path] : [])) {
      for (let i = 1; i < path.length; i++) {
        const dLat = path[i][0] - path[i - 1][0];
        const dLon = (path[i][1] - path[i - 1][1]) * Math.cos(path[i][0] * Math.PI / 180);
        length += Math.hypot(dLat, dLon);
      }
    }
    total.set(feature.name, (total.get(feature.name) ?? 0) + length);
    if (isMotorOnlyHighway(feature.highway)) motor.set(feature.name, (motor.get(feature.name) ?? 0) + length);
  }
  const names = new Set<string>();
  for (const [name, length] of motor) if (length > share * (total.get(name) ?? 0)) names.add(name);
  return names;
}
