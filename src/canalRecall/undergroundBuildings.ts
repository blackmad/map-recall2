/**
 * Underground structures that BAG and OSM both register as buildings: metro
 * stations and their halls (the Oostlijn under Weesperstraat/Wibautstraat),
 * underground car parks, road-tunnel shells. Extruded from street level they
 * stand in the middle of the road, so neither the OSM fill nor the BAG pand
 * that OSM says is underground may be drawn.
 *
 * The OSM tags decide. BAG has no underground flag, and a 3DBAG "height" for
 * such a pand is whatever was measured above its footprint (street furniture,
 * the tower over a garage). A pand is therefore dropped only when OSM ties it
 * to an underground way AND it is low: a tall pand sharing a footprint with an
 * underground car park (Amstel Tower) is the building above it.
 */

export type OsmTags = Readonly<Record<string, unknown>>;

const num = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** `level=-1`, `level=-2;-1`: every listed level below ground. */
const allLevelsBelowGround = (value: unknown): boolean => {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const levels = value.split(/[;,]/).map(num);
  return levels.every(level => level !== null && level < 0);
};

/** True when the OSM way/relation describes a structure below street level. */
export function isUndergroundOsm(tags: OsmTags): boolean {
  const location = tags.location;
  // An explicit location wins either way (`location=surface` on P6 Uitgaansdriehoek).
  if (location === 'underground' || location === 'underwater') return true;
  if (typeof location === 'string' && location !== '') return false;
  if ((num(tags.min_height) ?? 0) > 0 || (num(tags['building:min_level']) ?? 0) > 0) return false;
  if (tags.parking === 'underground' || tags.building === 'tunnel' || tags.tunnel === 'yes') return true;
  // A bare `layer=-1` is not enough: mappers use it for houses in a dike
  // (De Spreeuwen), sheds under a deck and offices below a viaduct.
  return (num(tags.layer) ?? 0) < 0 && allLevelsBelowGround(tags.level);
}

/**
 * A pand taller than this is not an underground shell even when OSM ties it to
 * one: Wibautstraat's hall is 3.2 m of street-level 3DBAG, the Amstel Tower over
 * its car park is 90 m.
 */
export const UNDERGROUND_PAND_MAX_HEIGHT_M = 8;

export type PandUndergroundInput = {
  /** BAG id, either `NL.IMBAG.Pand.<16 digits>` or the bare 16 digits. */
  id: string;
  heightM: number | null;
  /** OSM ids the pand's footprint was matched to (the tile `osm` property). */
  matchedOsm: readonly string[];
};

export type UndergroundIndex = {
  /** OSM ids (`w…`/`r…`) whose tags say underground. */
  osm: ReadonlySet<string>;
  /** Bare 16-digit BAG ids named by `ref:bag` on an underground OSM way. */
  refBag: ReadonlySet<string>;
};

const bareBagId = (id: string): string => id.replace(/^NL\.IMBAG\.Pand\./, '');

/**
 * A BAG pand is an underground shell when it is low, OSM ties it to an
 * underground way (by `ref:bag` or a footprint match), and no footprint match
 * is an ordinary building: a row of houses over a shared garage keeps its pand.
 */
export function isUndergroundPand(pand: PandUndergroundInput, index: UndergroundIndex): boolean {
  if (pand.heightM !== null && pand.heightM > UNDERGROUND_PAND_MAX_HEIGHT_M) return false;
  if (!pand.matchedOsm.every(osmId => index.osm.has(osmId))) return false;
  return pand.matchedOsm.length > 0 || index.refBag.has(bareBagId(pand.id));
}
