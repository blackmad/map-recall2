/**
 * 3DBAG's hosted LoD2.2 tiles, read as a building table rather than as meshes.
 *
 * The game already streams these tiles for their geometry. What was not known
 * until measured is that each building also carries its BAG `pand_id`, its
 * AHN-derived ground and ridge heights, its construction year and a
 * per-building reconstruction quality — all in uncompressed property tables.
 *
 * That matters for two reasons the renderer plan turns on:
 *
 *   - Identity. `identificatie` is the key that lets measured roof colour be
 *     attached to government geometry, instead of two layers guessing at each
 *     other's footprints.
 *   - Height. Today's extrusions fall back to `levels * 3` or a flat 9 m, so a
 *     large part of the skyline is invented. 3DBAG carries a measured height
 *     for the same buildings — see `lod1HeightM` for which one, and why it is
 *     not the obvious one.
 *
 * Everything here is pinned to one published 3DBAG version. The hosted tileset
 * is republished independently of this repository, so an unpinned read would
 * let the city change under the game without a release.
 */

import { parseGlb, readMetadataTable } from './tiles3dMetadata.js';

/** The 3DBAG release this project reads. Bump deliberately, never automatically. */
export const BAG3D_VERSION = 'v20250903';
export const BAG3D_LOD22_BASE = `https://data.3dbag.nl/${BAG3D_VERSION}/cesium3dtiles/lod22/`;

/** One 3DBAG building, named in English and with `noData` already removed. */
export type Bag3dBuilding = {
  /** `NL.IMBAG.Pand.0363100012153328` — the canonical Dutch building identity. */
  bagId: string;
  /** BAG lifecycle status, e.g. "Pand in gebruik". */
  status: string;
  /** BAG original construction year; the free half of an age/material prior. */
  constructionYear: number | null;
  storeys: number | null;
  /** AHN ground level at the building, in metres NAP. */
  groundHeightNap: number | null;
  /** AHN ridge height, in metres NAP. */
  ridgeHeightNap: number | null;
  /** 'slanted' | 'horizontal' | 'multiple horizontal' | 'unknown'. */
  roofType: string;
  groundAreaM2: number | null;
  flatRoofAreaM2: number | null;
  slopedRoofAreaM2: number | null;
  /**
   * Shared-wall area. Non-zero means the building is terraced, which is the
   * signal for promoting a whole row to detailed geometry at once instead of
   * stepping at a party wall.
   */
  partyWallAreaM2: number | null;
  /** Reconstructed solid volumes, per level of detail. */
  volumeLod12M3: number | null;
  volumeLod22M3: number | null;
  /** LoD2.2 reconstruction error; the gate for trusting the detailed mesh. */
  rmseLod22: number | null;
  /** val3dity result for the LoD2.2 solid; "" when valid. */
  validityLod22: string;
  /** 3DBAG's own "the point cloud was insufficient here" flag. */
  pointCloudInsufficient: boolean;
};

/** Where a height came from, so a wrong skyline can be traced to its source. */
export type HeightSource = 'lod12-volume' | 'ridge' | 'none';

/**
 * The height to extrude a building to for the flat-topped LoD1 city.
 *
 * The obvious choice is the ridge, `b3_h_nok - b3_h_maaiveld`, and it is the
 * wrong one twice over. Measured over a central Amsterdam tile (667 buildings
 * at the Rijksmuseum, v20250903):
 *
 *   - It is incomplete. Only 509/667 buildings have a ridge. Flat roofs have
 *     none by definition — `horizontal` and `multiple horizontal` are 0/41 —
 *     and reconstruction fails to produce one for a further 117 slanted roofs.
 *   - It is too tall. A flat-topped box standing at the ridge of a steeply
 *     pitched canal house overstates the whole row.
 *
 * `b3_volume_lod12 / b3_opp_grond` is 3DBAG's own LoD1.2 extrusion height: the
 * height of a box displacing the reconstructed volume over the real footprint.
 * It covers 667/667 of the same tile and sits at a median 0.94x the ridge,
 * which is the shape of the answer — a little below the ridge, above the eave.
 *
 * The ridge is still worth keeping, but as roof geometry for LoD2.2 work, not
 * as an extrusion height. Returns `source: 'none'` rather than a plausible
 * invention when 3DBAG measured neither; the caller decides whether an OSM tag
 * or a storey count is a good enough fallback, and records that it did.
 */
export function lod1HeightM(building: Bag3dBuilding): { heightM: number | null; source: HeightSource } {
  const { volumeLod12M3, groundAreaM2, ridgeHeightNap, groundHeightNap } = building;
  if (volumeLod12M3 !== null && groundAreaM2 !== null && groundAreaM2 > 0) {
    const height = volumeLod12M3 / groundAreaM2;
    if (height > 0) return { heightM: height, source: 'lod12-volume' };
  }
  if (ridgeHeightNap !== null && groundHeightNap !== null) {
    const height = ridgeHeightNap - groundHeightNap;
    if (height > 0) return { heightM: height, source: 'ridge' };
  }
  return { heightM: null, source: 'none' };
}

/**
 * Ridge height above ground, for pitched-roof geometry rather than extrusion.
 * Null for flat roofs, which have no ridge, and where reconstruction found none.
 */
export function ridgeHeightM(building: Bag3dBuilding): number | null {
  const { ridgeHeightNap, groundHeightNap } = building;
  if (ridgeHeightNap === null || groundHeightNap === null) return null;
  const height = ridgeHeightNap - groundHeightNap;
  return height > 0 ? height : null;
}

/** Decode every building in a 3DBAG tile. Geometry is left compressed and untouched. */
export function readBag3dBuildings(tile: Uint8Array): Bag3dBuilding[] {
  const table = readMetadataTable(parseGlb(tile));
  const bagId = table.strings('identificatie');
  const status = table.strings('status');
  const roofType = table.strings('b3_dak_type');
  const validityLod22 = table.strings('b3_val3dity_lod22');
  const constructionYear = table.numbers('oorspronkelijkbouwjaar');
  const storeys = table.numbers('b3_bouwlagen');
  const groundHeightNap = table.numbers('b3_h_maaiveld');
  const ridgeHeightNap = table.numbers('b3_h_nok');
  const groundAreaM2 = table.numbers('b3_opp_grond');
  const flatRoofAreaM2 = table.numbers('b3_opp_dak_plat');
  const slopedRoofAreaM2 = table.numbers('b3_opp_dak_schuin');
  const partyWallAreaM2 = table.numbers('b3_opp_scheidingsmuur');
  const volumeLod12M3 = table.numbers('b3_volume_lod12');
  const volumeLod22M3 = table.numbers('b3_volume_lod22');
  const rmseLod22 = table.numbers('b3_rmse_lod22');
  const insufficient = table.numbers('b3_pw_onvoldoende');

  return Array.from({ length: table.count }, (_, row) => ({
    bagId: bagId[row],
    status: status[row],
    constructionYear: constructionYear[row],
    storeys: storeys[row],
    groundHeightNap: groundHeightNap[row],
    ridgeHeightNap: ridgeHeightNap[row],
    roofType: roofType[row],
    groundAreaM2: groundAreaM2[row],
    flatRoofAreaM2: flatRoofAreaM2[row],
    slopedRoofAreaM2: slopedRoofAreaM2[row],
    partyWallAreaM2: partyWallAreaM2[row],
    volumeLod12M3: volumeLod12M3[row],
    volumeLod22M3: volumeLod22M3[row],
    rmseLod22: rmseLod22[row],
    validityLod22: validityLod22[row],
    pointCloudInsufficient: insufficient[row] === 1
  }));
}

// ---------------------------------------------------------------------------
// Tileset traversal
//
// 3DBAG's tileset is an explicit tree whose bounding volumes are oriented
// boxes in ECEF, with external `.json` tilesets nested inside it. Finding the
// tile over a street corner therefore means doing the geometry the runtime
// tile renderer normally hides.
// ---------------------------------------------------------------------------

type BoundingBox = number[];
type Tile = {
  boundingVolume?: { box?: BoundingBox };
  content?: { uri?: string };
  children?: Tile[];
};

const WGS84_A = 6378137.0;
const WGS84_E2 = 6.69437999014e-3;

/** Geodetic lng/lat/height to earth-centred, earth-fixed metres. */
export function lngLatToEcef(lng: number, lat: number, height = 0): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  const primeVertical = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(phi) ** 2);
  return [
    (primeVertical + height) * Math.cos(phi) * Math.cos(lambda),
    (primeVertical + height) * Math.cos(phi) * Math.sin(lambda),
    (primeVertical * (1 - WGS84_E2) + height) * Math.sin(phi)
  ];
}

/**
 * Is an ECEF point inside a 3D Tiles oriented bounding box?
 *
 * The box is a centre followed by three half-axis vectors, so containment is
 * the point's projection onto each axis compared against that axis's length.
 * The slack absorbs the tileset's two-decimal rounding; without it a point on
 * a tile edge can fall through every child.
 */
export function ecefInBox(point: readonly [number, number, number], box: BoundingBox, slackM = 1): boolean {
  const delta = [point[0] - box[0], point[1] - box[1], point[2] - box[2]];
  for (let axis = 0; axis < 3; axis++) {
    const half = [box[3 + axis * 3], box[4 + axis * 3], box[5 + axis * 3]];
    const length = Math.hypot(half[0], half[1], half[2]);
    if (length === 0) continue;
    const projection = (delta[0] * half[0] + delta[1] * half[1] + delta[2] * half[2]) / length;
    if (Math.abs(projection) > length + slackM) return false;
  }
  return true;
}

/**
 * Walk the tileset from its root to the GLB tiles covering one position.
 *
 * `fetchJson` is injected so the traversal stays testable and so callers can
 * put their own caching in front of it.
 */
export async function findTilesAt(
  lng: number,
  lat: number,
  fetchJson: (url: string) => Promise<unknown>,
  base = BAG3D_LOD22_BASE,
  maxHops = 8
): Promise<string[]> {
  const point = lngLatToEcef(lng, lat);
  let url = new URL('tileset.json', base).href;

  for (let hop = 0; hop < maxHops; hop++) {
    const tileset = (await fetchJson(url)) as { root: Tile };
    const hits: string[] = [];
    const walk = (tile: Tile): void => {
      if (!tile.boundingVolume?.box || !ecefInBox(point, tile.boundingVolume.box)) return;
      if (tile.content?.uri) hits.push(new URL(tile.content.uri, url).href);
      for (const child of tile.children ?? []) walk(child);
    };
    walk(tileset.root);

    const nested = hits.find(hit => hit.endsWith('.json'));
    if (!nested) return hits.filter(hit => hit.endsWith('.glb'));
    url = nested;
  }
  throw new Error(`tileset nesting exceeded ${maxHops} hops at ${lng},${lat}`);
}
