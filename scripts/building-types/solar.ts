// Sun position for review renders lit like the photo they are compared with.
/** Sun azimuth (degrees from north, clockwise) and elevation at a UTC time and place (NOAA low-precision formulae, < 1 degree). */
export function solarPosition(date: Date, lat: number, lng: number): [number, number] {
  const rad = Math.PI / 180, jd = date.getTime() / 86400000 + 2440587.5, n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, eps = (23.439 - 0.0000004 * n) * rad;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)), dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24, ha = ((gmst * 15 + lng) * rad - ra);
  const phi = lat * rad, el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  return [((az / rad) + 360) % 360, el / rad];
}

