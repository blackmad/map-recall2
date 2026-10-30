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
  if ((num(tags.layer) ?? 0) >= 0) return false;
  // A car park below layer 0 is under the street or the water (Albert Cuypgarage under the Boerenwetering).
  if (tags.amenity === 'parking' || tags.building === 'parking' || tags['building:part'] === 'parking') return true;
  return allLevelsBelowGround(tags.level);
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

/**
 * A BAG pand that is mostly underground with no OSM tag saying so: it lies
 * across a car road and 3DBAG found roofs over little of it. The Albert
 * Cuypgarage pand (0363100012240435) spans 520 m of de Pijp streets at 12%
 * roof cover; the Museumplein garage (…242075) is 15%. A tower over a podium
 * keeps most of its outline (75% for a 55 m Zuidas tower). Pands newer than the
 * lidar are left alone: a building site has no roof yet either.
 */
export const VOID_MAX_ROOF_COVER = 0.15;
export const VOID_MIN_ROAD_M = 20;
export const VOID_LIDAR_YEAR = 2022;

export function isVoidOverRoad(pand: { roofCover: number | null; roadInsideM: number; year: number | null }): boolean {
  if (pand.roofCover === null || pand.roofCover >= VOID_MAX_ROOF_COVER) return false;
  if (pand.year !== null && pand.year > VOID_LIDAR_YEAR) return false;
  return pand.roadInsideM >= VOID_MIN_ROAD_M;
}

type LngLat = readonly [number, number];
type Polygon = readonly (readonly LngLat[])[];

const insideRing = (x: number, y: number, ring: readonly LngLat[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const insidePolygon = (x: number, y: number, polygon: Polygon): boolean =>
  insideRing(x, y, polygon[0]) && !polygon.slice(1).some(hole => insideRing(x, y, hole));

/** Metres from a point to the nearest edge of a polygon (local equirectangular). */
const edgeDistanceM = (x: number, y: number, polygon: Polygon): number => {
  const kx = 111_320 * Math.cos((y * Math.PI) / 180), ky = 111_320;
  let best = Infinity;
  for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
    const ax = (ring[i - 1][0] - x) * kx, ay = (ring[i - 1][1] - y) * ky, bx = (ring[i][0] - x) * kx, by = (ring[i][1] - y) * ky;
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
};

/**
 * Metres of the given `[lng, lat]` segments inside the polygons, sampled every
 * metre. `insetM` counts only samples at least that far inside an edge: OSM
 * roads hug building outlines that BAG digitised a metre or two wider
 * (Julianaplein along Amstel station's hall).
 */
export function centrelineInsideM(polygons: readonly Polygon[], segments: readonly (readonly [LngLat, LngLat])[], insetM = 0): number {
  let metres = 0;
  for (const [a, b] of segments) {
    const kx = 111_320 * Math.cos((a[1] * Math.PI) / 180), length = Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * 111_320);
    const steps = Math.max(1, Math.round(length));
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      if (polygons.some(polygon => insidePolygon(x, y, polygon) && (insetM <= 0 || edgeDistanceM(x, y, polygon) >= insetM))) metres += length / steps;
    }
  }
  return metres;
}
