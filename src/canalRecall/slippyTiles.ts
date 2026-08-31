/**
 * Web Mercator slippy tiles, for splitting a city into loadable pieces.
 *
 * The complete LoD1 city is far too large to hand to MapLibre as one GeoJSON —
 * the source that ships today is 5.5 MB for a tenth of the city and is fetched
 * whole. Cutting it on the standard z/x/y grid means the runtime can load only
 * what is near the camera, and it gives detailed geometry in later phases a
 * tile boundary that already exists rather than one invented for it.
 *
 * This is the ordinary Web Mercator tile scheme: x increases east, y increases
 * *south* from the north edge, and the world is 2^z tiles across.
 */

export type TileId = { z: number; x: number; y: number };

const clampLat = (lat: number): number => Math.max(-85.0511, Math.min(85.0511, lat));

/** The tile containing a position. */
export function tileFor(lng: number, lat: number, z: number): TileId {
  const scale = 2 ** z;
  const radians = (clampLat(lat) * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * scale);
  const y = Math.floor(((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * scale);
  return { z, x: Math.min(scale - 1, Math.max(0, x)), y: Math.min(scale - 1, Math.max(0, y)) };
}

/** `[west, south, east, north]` of a tile, in degrees. */
export function tileBounds({ z, x, y }: TileId): [number, number, number, number] {
  const scale = 2 ** z;
  const lng = (index: number): number => (index / scale) * 360 - 180;
  const lat = (index: number): number => {
    const n = Math.PI - (2 * Math.PI * index) / scale;
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  };
  return [lng(x), lat(y + 1), lng(x + 1), lat(y)];
}

export const tileKey = ({ z, x, y }: TileId): string => `${z}/${x}/${y}`;

/**
 * Every tile covering a bounding box.
 *
 * `margin` is in tiles. A renderer needs it because features are assigned to
 * one tile by their centroid, so a building whose centroid sits just outside
 * the viewport can still have geometry inside it; loading a ring of
 * neighbouring tiles is what stops buildings popping in at the screen edge.
 */
export function tilesCovering(
  bbox: { west: number; south: number; east: number; north: number },
  z: number,
  margin = 0
): TileId[] {
  const topLeft = tileFor(bbox.west, bbox.north, z);
  const bottomRight = tileFor(bbox.east, bbox.south, z);
  const scale = 2 ** z;
  const tiles: TileId[] = [];
  for (let x = topLeft.x - margin; x <= bottomRight.x + margin; x++) {
    for (let y = topLeft.y - margin; y <= bottomRight.y + margin; y++) {
      if (x < 0 || y < 0 || x >= scale || y >= scale) continue;
      tiles.push({ z, x, y });
    }
  }
  return tiles;
}
