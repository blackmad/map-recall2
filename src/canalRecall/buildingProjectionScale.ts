import { mercatorUnitsPerMetre } from './rendererShared/frameMath.js';

/** The building meshes store local north in 110,540 metres per degree and
 * east in 111,320·cos(origin lat) metres per degree: metres on the WGS84
 * equatorial sphere (6,378,137 m). Compensate the north convention at the
 * shared origin; retain the linear local projection and physical height.
 *
 * `mercatorMetres` must be the equatorial metre (frameMath's
 * `mercatorUnitsPerMetre`). MapLibre's `meterInMercatorCoordinateUnits()`
 * (and the own engine's copy of it) is on its mean-radius sphere
 * (6,371,008.8 m), 0.112 % shorter: fed that, every generic building and
 * baked cell was drawn 0.112 % of its distance from the origin too far out,
 * ~1.6 m at Haarlemmerdijk 29 (0363100012167795, lane BA 2026-11-13), off
 * the own ground and the GLBs. Use `buildingMercatorFromLocal`.
 */
export function buildingProjectionScale(mercatorMetres: number): [number, number, number] {
  const northCompensation = (Math.PI * 6_378_137 / 180) / 110_540;
  return [mercatorMetres, -mercatorMetres * northCompensation, mercatorMetres];
}

/** Column-major local metres (origin-relative, z up) → Web Mercator: the facade layer's and the own ground's transform. */
export function buildingMercatorFromLocal(origin: { lng: number; lat: number }): number[] {
  const x = (180 + origin.lng) / 360;
  const y = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (origin.lat * Math.PI) / 360))) / 360;
  const [sx, sy, sz] = buildingProjectionScale(mercatorUnitsPerMetre(y));
  return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, x, y, 0, 1];
}
