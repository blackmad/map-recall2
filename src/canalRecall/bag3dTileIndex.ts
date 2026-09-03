/**
 * 3DBAG's tile index, as a list of downloads for an area.
 *
 * `tile_index.fgb` is the only published list of the per-tile CityJSON files,
 * and it is worth understanding what kind of list it is before selecting from
 * it. The tiling is an *adaptive* quadtree: 3DBAG subdivides where buildings
 * are dense, so a tile is 500 m across the centre of Amsterdam and 64 km over
 * open water, and the index contains only leaves. Measured over the whole
 * v20250903 index (8,941 tiles, levels 3 to 10, 64 km down to 500 m): no two
 * tiles overlap by more than a metre.
 *
 * That is the property selection depends on. If the index listed a full
 * quadtree instead, taking every tile intersecting a bounding box would fetch
 * each building once per level and silently triple-count a city.
 *
 * Bounds are in RD New, like everything else the Dutch government publishes.
 */

import { readFlatGeobuf, type FgbFeature } from './flatGeobuf.js';
import { lngLatBboxToRd } from './rdCoordinates.js';

/** One tile's downloads and the checksums that let a cache be trusted. */
export type Bag3dTile = {
  /** `9/1058/954` — level, then the quadtree cell. Not a Cesium tile id. */
  tileId: string;
  /** Quadtree level; higher means smaller. Level n is 512 km / 2^n across. */
  level: number;
  /** `[minX, minY, maxX, maxY]` in RD New metres. */
  bbox: [number, number, number, number];
  /** Gzipped CityJSON: the footprints and every attribute, per pand. */
  cityJsonUrl: string;
  /** SHA-256 of the gzipped file, as published. */
  cityJsonSha256: string;
};

/** Edge length of a level's tiles, in metres. The root covers 512 km. */
export const tileSizeM = (level: number): number => 512000 / 2 ** level;

const asTile = (feature: FgbFeature): Bag3dTile | null => {
  const tileId = String(feature.properties.tile_id ?? '');
  const cityJsonUrl = String(feature.properties.cj_download ?? '');
  if (!tileId || !cityJsonUrl) return null;
  return {
    tileId,
    level: Number(tileId.split('/')[0]),
    bbox: feature.bbox,
    cityJsonUrl,
    cityJsonSha256: String(feature.properties.cj_sha256 ?? '')
  };
};

/** Read `tile_index.fgb` into tiles, dropping any row without a download. */
export function readTileIndex(bytes: Uint8Array): Bag3dTile[] {
  return readFlatGeobuf(bytes).features.map(asTile).filter((tile): tile is Bag3dTile => tile !== null);
}

/**
 * The tiles covering a WGS84 bounding box.
 *
 * `marginM` widens the box in RD before selecting. A city needs it: a building
 * just outside the drivable area is still on screen from the last road, and a
 * hole at the edge of the world is more noticeable than one in the middle.
 */
export function tilesForBbox(
  tiles: Bag3dTile[],
  bbox: { west: number; south: number; east: number; north: number },
  marginM = 500
): Bag3dTile[] {
  const [minX, minY, maxX, maxY] = lngLatBboxToRd(bbox.west, bbox.south, bbox.east, bbox.north);
  const want = [minX - marginM, minY - marginM, maxX + marginM, maxY + marginM];
  return tiles
    .filter(tile => tile.bbox[0] <= want[2] && tile.bbox[2] >= want[0] && tile.bbox[1] <= want[3] && tile.bbox[3] >= want[1])
    .sort((a, b) => a.tileId.localeCompare(b.tileId));
}

/**
 * Do these tiles tile their area exactly once?
 *
 * Returns the overlapping pairs, which must be empty for a leaf-only
 * selection. Worth asserting rather than assuming: 3DBAG could publish a full
 * tree in a later vintage, and the failure mode is duplicated buildings rather
 * than an error.
 */
export function overlappingPairs(tiles: Bag3dTile[], toleranceM = 1): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i].bbox;
      const b = tiles[j].bbox;
      const overlapX = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
      const overlapY = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
      if (overlapX > toleranceM && overlapY > toleranceM) pairs.push([tiles[i].tileId, tiles[j].tileId]);
    }
  }
  return pairs;
}
