/**
 * Catalogue `aliases` for a large-recipe install (scripts/building-recipes/install-large.ts): every other tile feature the
 * runtime must hide with the pand, besides `buildingId`. Two kinds:
 *
 * - the pand's linked hand-mapped OSM outlines (bag-tiles `osm` alias, a separate tier-4 feature; Rietveld Academie
 *   w57860150), passed in by the caller;
 * - the building tiles' separate `tower:NL.IMBAG.Pand.<pand>` feature of a tower-podium pand (the tiles draw the tower
 *   part over the podium as its own feature; GitHub #119: 094874 needed it by hand, `check:osm-under-models` caught it).
 *
 * Order: OSM outlines first, then the tower id, so an entry without a tower feature is byte-identical to before. Pure.
 */
export const towerFeatureId = (pand: string) => `tower:NL.IMBAG.Pand.${pand}`;

export function installAliases(pand: string, linkedOsm: readonly string[], tileIds: Iterable<string>, declared: readonly string[] = []): string[] {
  const tower = towerFeatureId(pand), seen = new Set<string>();
  let hasTower = false;
  for (const id of tileIds) { seen.add(id); if (id === tower) hasTower = true; }
  const out = [...linkedOsm, ...(hasTower && !linkedOsm.includes(tower) ? [tower] : [])];
  // A third kind, last (absent: unchanged): the intent's `osmAliases`, for a pand the building tiles lack, drawn there as
  // OSM outlines the BAG index does not link to it (Narva-eiland 252366, 2021: w725476475 and w936343679). Each must be
  // a tile feature over the pand's footprint, so a typo or a stale id fails the install instead of hiding nothing.
  for (const id of declared) {
    if (!seen.has(id)) throw Error(`osmAliases: ${id} is not a building-tile feature over pand ${pand}'s footprint`);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}
