/**
 * Rijksdriehoek (RD New, EPSG:28992) to and from WGS84.
 *
 * Every Dutch government dataset this project touches is published in RD, and
 * the 3DBAG API only accepts a bounding box in it — a WGS84 box is silently
 * answered with zero features rather than an error, which is a good way to
 * conclude a service is empty when it is merely being addressed in the wrong
 * units.
 *
 * These are the standard Schreutelkamp & van Hees polynomial approximations,
 * accurate to roughly 0.25 m across the Netherlands. That is far inside the
 * error of everything it is used for here — building footprints drawn at
 * street zoom — and avoids a projection dependency for two functions.
 *
 * Note the argument order: RD is (x east, y north) while this project's
 * geographic pairs are (lng, lat), so both are "east first" and neither is
 * the (lat, lng) order used in some Dutch documentation.
 */

/** Origin of the RD system's polynomial expansion, in degrees. */
const RD_ORIGIN_LAT = 52.1551744;
const RD_ORIGIN_LNG = 5.38720621;
const RD_ORIGIN_X = 155000;
const RD_ORIGIN_Y = 463000;

/** [powerOfX, powerOfY, coefficient] for latitude, in arcseconds. */
const LAT_TERMS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 3235.65389], [2, 0, -32.58297], [0, 2, -0.2475], [2, 1, -0.84978],
  [0, 3, -0.0655], [2, 2, -0.01709], [1, 0, -0.00738], [4, 0, 0.0053],
  [2, 3, -0.00039], [4, 1, 0.00033], [1, 1, -0.00012]
];

/** [powerOfX, powerOfY, coefficient] for longitude, in arcseconds. */
const LNG_TERMS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 5260.52916], [1, 1, 105.94684], [1, 2, 2.45656], [3, 0, -0.81885],
  [1, 3, 0.05594], [3, 1, -0.05607], [0, 1, 0.01199], [3, 2, -0.00256],
  [1, 4, 0.00128], [0, 2, 0.00022], [2, 0, -0.00022], [3, 4, 0.00026]
];

/** [powerOfLat, powerOfLng, coefficient] for RD x, in metres. */
const X_TERMS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 190094.945], [1, 1, -11832.228], [2, 1, -114.221], [0, 3, -32.391],
  [1, 0, -0.705], [3, 1, -2.34], [1, 3, -0.608], [0, 2, -0.008], [2, 3, 0.148]
];

/** [powerOfLat, powerOfLng, coefficient] for RD y, in metres. */
const Y_TERMS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 309056.544], [0, 2, 3638.893], [2, 0, 73.077], [1, 2, -157.984],
  [3, 0, 59.788], [0, 1, 0.433], [2, 2, -6.439], [1, 1, -0.032],
  [0, 4, 0.092], [1, 4, -0.054]
];

const polynomial = (terms: ReadonlyArray<readonly [number, number, number]>, first: number, second: number): number =>
  terms.reduce((total, [firstPower, secondPower, coefficient]) => total + coefficient * first ** firstPower * second ** secondPower, 0);

/** RD New metres to WGS84 degrees, as `[lng, lat]`. */
export function rdToLngLat(x: number, y: number): [number, number] {
  const dx = (x - RD_ORIGIN_X) / 1e5;
  const dy = (y - RD_ORIGIN_Y) / 1e5;
  return [
    RD_ORIGIN_LNG + polynomial(LNG_TERMS, dx, dy) / 3600,
    RD_ORIGIN_LAT + polynomial(LAT_TERMS, dx, dy) / 3600
  ];
}

/** WGS84 degrees to RD New metres, as `[x, y]`. */
export function lngLatToRd(lng: number, lat: number): [number, number] {
  const dLat = 0.36 * (lat - RD_ORIGIN_LAT);
  const dLng = 0.36 * (lng - RD_ORIGIN_LNG);
  return [
    RD_ORIGIN_X + polynomial(X_TERMS, dLat, dLng),
    RD_ORIGIN_Y + polynomial(Y_TERMS, dLat, dLng)
  ];
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
    lngLatToRd(west, north), lngLatToRd(east, north)
  ];
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
