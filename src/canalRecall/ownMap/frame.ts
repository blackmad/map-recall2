// The one local frame the own map draws in: metres east (x) / north (y) of the
// game's single origin. Same constants as `galleryPipeline.toLocal`, which the
// building chunks and the own-ground prototype already use, so overview,
// near-field ground and buildings share coordinates without a transform.
// (Kept here, not imported, because galleryPipeline pulls in the whole
// decoration chain; `ownMap.test.ts` checks the two agree.)

export type Vec2 = [number, number];

export const ORIGIN = { lng: 4.9, lat: 52.37 } as const;
export const KX = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180);
export const KY = 110_540;

export const toLocal = (lng: number, lat: number): Vec2 => [(lng - ORIGIN.lng) * KX, (lat - ORIGIN.lat) * KY];
export const fromLocal = (x: number, y: number): Vec2 => [ORIGIN.lng + x / KX, ORIGIN.lat + y / KY];

/** The game's world frame (vector-map.js `worldToLngLat`, 3 px per metre, y south)
 *  to lng/lat, for tests and adapters that speak game world units. */
export interface GameLoaderFrame { _lastCenterLng: number; _lastCenterLat: number; _lastOffsetX: number; _lastOffsetY: number }
export function gameWorldToLngLat(worldX: number, worldY: number, loader: GameLoaderFrame, pixelsPerMetre = 3): Vec2 {
  const mLat = 111_320, mLng = 111_320 * Math.cos(loader._lastCenterLat * Math.PI / 180);
  return [
    loader._lastCenterLng + (worldX - loader._lastOffsetX) / (mLng * pixelsPerMetre),
    loader._lastCenterLat - (worldY - loader._lastOffsetY) / (mLat * pixelsPerMetre),
  ];
}
