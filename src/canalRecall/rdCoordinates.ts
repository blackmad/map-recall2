/**
 * Rijksdriehoek (RD New, EPSG:28992) ↔ WGS84 — tuple API for 3DBAG / BAG callers.
 *
 * The measured NSGI-aligned polynomials live in `facade/rdNew.ts`. This module
 * keeps the older `(x, y)` / `[lng, lat]` call shape so tile and CityJSON code
 * do not grow a second transform that drifts from the façade one.
 */

import {
  lngLatToRd as lngLatToRdPoint,
  rdToLngLat as rdPointToLngLat,
} from './facade/rdNew.ts';

/** RD New metres to WGS84 degrees, as `[lng, lat]`. */
export function rdToLngLat(x: number, y: number): [number, number] {
  return rdPointToLngLat({ x, y });
}

/** WGS84 degrees to RD New metres, as `[x, y]`. */
export function lngLatToRd(lng: number, lat: number): [number, number] {
  const { x, y } = lngLatToRdPoint([lng, lat]);
  return [x, y];
}

/**
 * A WGS84 bounding box as the RD box the 3DBAG API expects.
 *
 * The four corners are all converted rather than just two, because RD is a
 * rotated projection: converting only the south-west and north-east corners
 * loses area at the edges of the box, and the buildings that go missing are
 * the ones at its margins.
 */
export function lngLatBboxToRd(west: number, south: number, east: number, north: number): [number, number, number, number] {
  const corners = [
    lngLatToRd(west, south), lngLatToRd(east, south),
    lngLatToRd(west, north), lngLatToRd(east, north),
  ];
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
