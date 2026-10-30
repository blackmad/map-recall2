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

export function installAliases(pand: string, linkedOsm: readonly string[], tileIds: Iterable<string>): string[] {
  const tower = towerFeatureId(pand);
  let hasTower = false;
  for (const id of tileIds) if (id === tower) { hasTower = true; break; }
  return [...linkedOsm, ...(hasTower && !linkedOsm.includes(tower) ? [tower] : [])];
}
