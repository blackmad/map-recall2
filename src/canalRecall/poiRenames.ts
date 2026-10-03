/**
 * Businesses renamed on the ground before OSM caught up.
 *
 * The POI builders take names from OSM. When a player reports a rename OSM
 * does not carry yet, it goes here with the OSM name it replaces, and every
 * builder passes names through `renamedPoi`. A rename applies only while OSM
 * still says `from` at that spot: once someone fixes OSM the entry stops
 * matching, and the builder's run prints it as unused so it can be removed.
 * The user chose this together with fixing OSM upstream (2026-10-03).
 */

export type PoiRename = {
  /** The OSM element, for whoever fixes it upstream. */
  osm: string;
  from: string;
  to: string;
  lng: number;
  lat: number;
  reported: string;
};

export const POI_RENAMES: readonly PoiRename[] = [
  { osm: 'node/12876814546', from: 'Br020', to: 'Vinyl Rocks', lng: 4.8761707, lat: 52.3729415, reported: 'user, 2026-10-03' },
];

/** How far a builder's point may sit from the recorded one: a centroid or a nudged node. */
const MATCH_METRES = 40;
const KX = 111_320 * Math.cos((52.37 * Math.PI) / 180);
const KY = 110_540;

/** The rename for this OSM name at this spot, if one is recorded. */
export function poiRenameFor(name: string, lng: number, lat: number, renames: readonly PoiRename[] = POI_RENAMES): PoiRename | undefined {
  const key = name.normalize('NFC').trim().toLowerCase();
  const rename = renames.find(r => r.from.toLowerCase() === key && Math.hypot((r.lng - lng) * KX, (r.lat - lat) * KY) <= MATCH_METRES);
  if (rename) used.add(rename);
  return rename;
}

const used = new Set<PoiRename>();
/** Renames nothing in this run matched: OSM has caught up (or the place closed), so the entry can go. */
export const unusedPoiRenames = (): PoiRename[] => POI_RENAMES.filter(r => !used.has(r));

/** The name to show: the recorded rename while OSM still has the old one, otherwise OSM's. */
export const renamedPoi = (name: string, lng: number, lat: number): string => poiRenameFor(name, lng, lat)?.to ?? name;
