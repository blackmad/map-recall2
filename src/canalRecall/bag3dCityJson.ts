/**
 * 3DBAG CityJSON, read as footprints and heights.
 *
 * This is the source the hosted 3D Tiles cannot replace: their geometry is
 * meshopt-compressed mesh with no ground polygon, and a flat-topped LoD1 city
 * is built by extruding a footprint. In CityJSON the footprint is the LoD0
 * MultiSurface on the `Building` object; the `BuildingPart` children carry the
 * LoD1.2/1.3/2.2 solids this stage does not need.
 *
 * Coordinates are quantised integers in RD New. Real position is
 * `vertex * transform.scale + transform.translate`, so nothing here can be
 * read without the transform.
 */

import { rdToLngLat } from './rdCoordinates.js';

type Transform = { scale: [number, number, number]; translate: [number, number, number] };
type Geometry = { type: string; lod?: string; boundaries: unknown };
type CityObject = { type: string; attributes?: Record<string, unknown>; geometry?: Geometry[] };
export type CityJson = { transform: Transform; vertices: number[][]; CityObjects: Record<string, CityObject> };

/** A ring of `[lng, lat]`, closed. */
export type Ring = [number, number][];

/** One BAG pand, reduced to what a flat-topped extrusion needs. */
export type BagBuilding = {
  /** `NL.IMBAG.Pand.…`, the join key for appearance and for OSM aliases. */
  bagId: string;
  /** Outer ring first, then holes — GeoJSON Polygon ring order. */
  rings: Ring[];
  /** Extrusion height above local ground, in metres. */
  heightM: number | null;
  heightSource: BagHeightSource;
  /** Ground level in metres NAP, so a building can sit on real terrain later. */
  groundNapM: number | null;
  /** Ridge above ground: roof geometry for later phases, never the extrusion. */
  ridgeM: number | null;
  roofType: string | null;
  constructionYear: number | null;
  storeys: number | null;
  /** Non-zero means terraced, which is how rows get promoted together. */
  partyWallAreaM2: number | null;
  groundAreaM2: number | null;
  /** LoD2.2 reconstruction error; the gate for trusting a detailed mesh. */
  rmseLod22: number | null;
  /** BAG lifecycle status — demolished pands are still published. */
  status: string | null;
};

export type BagHeightSource = 'roof-70p' | 'lod12-volume' | 'ridge' | 'none';

const number = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * The height to extrude a pand to.
 *
 * 3DBAG builds its own LoD1.2 by extruding to the 70th percentile of the roof
 * points, so `b3_h_dak_70p - b3_h_maaiveld` is not an approximation of the
 * official geometry — it is the official geometry's height. It sits below the
 * ridge and above the eave, which is what a flat top should do for a pitched
 * roof.
 *
 * The two fallbacks exist because the same decision has to be made from the
 * hosted 3D Tiles, whose metadata publishes neither percentile. There,
 * `b3_volume_lod12 / b3_opp_grond` recovers the same number: measured over a
 * central Amsterdam tile it differs from the percentile by a median of 4 mm
 * (p05 −0.10 m, p95 +0.04 m). Agreement that close between an area-weighted
 * volume and a point-cloud percentile is the two sources describing one
 * extrusion, and it is why the tiles-only path is trustworthy.
 *
 * The ridge is last and reluctant. It is missing for every flat roof by
 * definition, and standing a flat top at the ridge of a steep canal house
 * overstates the whole row.
 */
export function bagHeightM(attributes: Record<string, unknown>): { heightM: number | null; source: BagHeightSource } {
  const ground = number(attributes.b3_h_maaiveld);
  const roof70 = number(attributes.b3_h_dak_70p);
  if (roof70 !== null && ground !== null && roof70 - ground > 0) return { heightM: roof70 - ground, source: 'roof-70p' };

  const volume = number(attributes.b3_volume_lod12);
  const area = number(attributes.b3_opp_grond);
  if (volume !== null && area !== null && area > 0 && volume / area > 0) return { heightM: volume / area, source: 'lod12-volume' };

  const ridge = number(attributes.b3_h_nok);
  if (ridge !== null && ground !== null && ridge - ground > 0) return { heightM: ridge - ground, source: 'ridge' };

  return { heightM: null, source: 'none' };
}

/** Decode a LoD0 MultiSurface into closed WGS84 rings, outer ring first. */
function footprintRings(geometry: Geometry[] | undefined, vertices: [number, number][]): Ring[] {
  const lod0 = geometry?.find(part => part.lod === '0' && part.type === 'MultiSurface');
  if (!lod0) return [];
  const surfaces = lod0.boundaries as number[][][];
  const rings: Ring[] = [];
  for (const surface of surfaces ?? []) {
    for (const ring of surface ?? []) {
      const points = ring.map(index => vertices[index]).filter(Boolean);
      if (points.length < 3) continue;
      const closed: Ring = [...points];
      const [firstLng, firstLat] = closed[0];
      const [lastLng, lastLat] = closed[closed.length - 1];
      if (firstLng !== lastLng || firstLat !== lastLat) closed.push([firstLng, firstLat]);
      rings.push(closed);
    }
  }
  return rings;
}

/** Every `Building` in one CityJSON tile, with its footprint already in WGS84. */
export function readBagBuildings(city: CityJson): BagBuilding[] {
  const { scale, translate } = city.transform;
  // Project once per vertex rather than once per ring reference: vertices are
  // shared between a footprint and its solids, and the polynomial is the
  // expensive part of this loop.
  const vertices: [number, number][] = city.vertices.map(([x, y]) =>
    rdToLngLat(x * scale[0] + translate[0], y * scale[1] + translate[1])
  );

  const buildings: BagBuilding[] = [];
  for (const object of Object.values(city.CityObjects)) {
    if (object.type !== 'Building') continue;
    const attributes = object.attributes ?? {};
    const bagId = text(attributes.identificatie);
    if (!bagId) continue;
    const rings = footprintRings(object.geometry, vertices);
    if (rings.length === 0) continue;

    const ground = number(attributes.b3_h_maaiveld);
    const ridge = number(attributes.b3_h_nok);
    const { heightM, source } = bagHeightM(attributes);
    buildings.push({
      bagId,
      rings,
      heightM,
      heightSource: source,
      groundNapM: ground,
      ridgeM: ridge !== null && ground !== null && ridge - ground > 0 ? ridge - ground : null,
      roofType: text(attributes.b3_dak_type),
      constructionYear: number(attributes.oorspronkelijkbouwjaar),
      storeys: number(attributes.b3_bouwlagen),
      partyWallAreaM2: number(attributes.b3_opp_scheidingsmuur),
      groundAreaM2: number(attributes.b3_opp_grond),
      rmseLod22: number(attributes.b3_rmse_lod22),
      status: text(attributes.status)
    });
  }
  return buildings;
}
