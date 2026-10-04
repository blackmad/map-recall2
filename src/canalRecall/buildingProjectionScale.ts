/** The building meshes store local north in 110,540 metres per degree.
 * MapLibre's spherical Mercator metre uses the equatorial circumference.
 * Compensate that convention at the shared origin; retain the existing
 * linear local projection, horizontal east scale, and physical height.
 */
export function buildingProjectionScale(mercatorMetres: number): [number, number, number] {
  const northCompensation = (Math.PI * 6_378_137 / 180) / 110_540;
  return [mercatorMetres, -mercatorMetres * northCompensation, mercatorMetres];
}
