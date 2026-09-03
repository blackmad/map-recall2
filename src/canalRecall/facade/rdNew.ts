/**
 * RD New (EPSG:28992) ↔ WGS84 for the Amsterdam façade twin.
 *
 * BAG, 3DBAG, AHN and PDOK are all natively RD New with NAP heights, so the
 * façade pipeline measures in RD and reprojects once, at its edge, into the
 * WGS84 the MapLibre camera expects. Doing it the other way round accumulates
 * float error in degrees across a kilometre of canal.
 *
 * These are the Schreutelkamp & Strang van Hees polynomial approximations of
 * RDNAPTRANS, plus a measured alignment constant.
 *
 * Measured, not assumed: comparing the raw polynomials against 24 authoritative
 * RD/WGS84 pairs published by PDOK's own Locatieserver — sixteen inside the
 * pilot boundary, eight spread from Groningen to Kerkrade — leaves a residual
 * that is *constant to within a centimetre nationally*, not a drift. That is a
 * datum offset rather than an approximation error, so it is subtracted as a
 * constant rather than tolerated. See `fixtures/rd-control-points.json` for the
 * evidence and `scripts/check-facade-coordinates.ts` for the pinned residual.
 *
 * After the correction the transform agrees with PDOK to about a centimetre,
 * which is well inside the 12.5 cm orthophoto pixel the façade pipeline
 * measures from.
 */

export interface RdPoint {
  /** RD New easting in metres. */
  x: number;
  /** RD New northing in metres. */
  y: number;
}

export type LngLat = [longitude: number, latitude: number];

/** RD New false origin, the Onze Lieve Vrouwetoren in Amersfoort. */
export const RD_ORIGIN: RdPoint = { x: 155_000, y: 463_000 };
const ORIGIN_LATITUDE = 52.155_174_40;
const ORIGIN_LONGITUDE = 5.387_206_21;

type Term = readonly [power: number, order: number, coefficient: number];

const LATITUDE_TERMS: readonly Term[] = [
  [0, 1, 3235.65389], [2, 0, -32.58297], [0, 2, -0.24750], [2, 1, -0.84978],
  [0, 3, -0.06550], [2, 2, -0.01709], [1, 0, -0.00738], [4, 0, 0.00530],
  [2, 3, -0.00039], [4, 1, 0.00033], [1, 1, -0.00012],
];

const LONGITUDE_TERMS: readonly Term[] = [
  [1, 0, 5260.52916], [1, 1, 105.94684], [1, 2, 2.45656], [3, 0, -0.81885],
  [1, 3, 0.05594], [3, 1, -0.05607], [0, 1, 0.01199], [3, 2, -0.00256],
  [1, 4, 0.00128], [0, 2, 0.00022], [2, 0, -0.00022], [3, 4, 0.00026],
];

const EASTING_TERMS: readonly Term[] = [
  [0, 1, 190094.945], [1, 1, -11832.228], [2, 1, -114.221], [0, 3, -32.391],
  [1, 0, -0.705], [3, 1, -2.340], [1, 3, -0.608], [0, 2, -0.008], [2, 3, 0.148],
];

const NORTHING_TERMS: readonly Term[] = [
  [1, 0, 309056.544], [0, 2, 3638.893], [2, 0, 73.077], [1, 2, -157.984],
  [3, 0, 59.788], [0, 1, 0.433], [2, 2, -6.439], [1, 1, -0.032],
  [0, 4, 0.092], [1, 4, -0.054],
];

/**
 * Constant offset between the raw polynomial output and PDOK's published
 * WGS84, in metres east and north. Derived as the mean residual over
 * `fixtures/rd-control-points.json`; the spread across those 24 points is
 * about a centimetre, which is why a constant is the right shape of correction.
 */
export const NSGI_ALIGNMENT_M = { east: 0.183, north: 0.234 } as const;

const METRES_PER_DEGREE_LATITUDE = 111_320;
const metresPerDegreeLongitude = (latitude: number) =>
  METRES_PER_DEGREE_LATITUDE * Math.cos((latitude * Math.PI) / 180);

const evaluate = (terms: readonly Term[], u: number, v: number) =>
  terms.reduce((total, [power, order, coefficient]) => total + coefficient * u ** power * v ** order, 0);

/** RD New metres → WGS84 degrees. */
export function rdToLngLat({ x, y }: RdPoint): LngLat {
  const dx = (x - RD_ORIGIN.x) * 1e-5;
  const dy = (y - RD_ORIGIN.y) * 1e-5;
  const latitude = ORIGIN_LATITUDE + evaluate(LATITUDE_TERMS, dx, dy) / 3600 - NSGI_ALIGNMENT_M.north / METRES_PER_DEGREE_LATITUDE;
  const longitude = ORIGIN_LONGITUDE + evaluate(LONGITUDE_TERMS, dx, dy) / 3600 - NSGI_ALIGNMENT_M.east / metresPerDegreeLongitude(latitude);
  return [longitude, latitude];
}

/** WGS84 degrees → RD New metres. */
export function lngLatToRd([longitude, latitude]: LngLat): RdPoint {
  const alignedLatitude = latitude + NSGI_ALIGNMENT_M.north / METRES_PER_DEGREE_LATITUDE;
  const alignedLongitude = longitude + NSGI_ALIGNMENT_M.east / metresPerDegreeLongitude(alignedLatitude);
  const dLatitude = 0.36 * (alignedLatitude - ORIGIN_LATITUDE);
  const dLongitude = 0.36 * (alignedLongitude - ORIGIN_LONGITUDE);
  return {
    x: RD_ORIGIN.x + evaluate(EASTING_TERMS, dLatitude, dLongitude),
    y: RD_ORIGIN.y + evaluate(NORTHING_TERMS, dLatitude, dLongitude),
  };
}

/**
 * The pilot's fixed local origin, on the Westermarkt beside the Westerkerk.
 * Documented here once and never changed: every façade parameter record, every
 * generated mesh and every reference viewpoint is expressed against it.
 */
export const PILOT_LOCAL_ORIGIN: RdPoint = { x: 120_700, y: 487_500 };

/** RD metres relative to {@link PILOT_LOCAL_ORIGIN}. */
export const toLocalMetres = ({ x, y }: RdPoint): RdPoint =>
  ({ x: x - PILOT_LOCAL_ORIGIN.x, y: y - PILOT_LOCAL_ORIGIN.y });

export const fromLocalMetres = ({ x, y }: RdPoint): RdPoint =>
  ({ x: x + PILOT_LOCAL_ORIGIN.x, y: y + PILOT_LOCAL_ORIGIN.y });

/**
 * Amsterdam is flat but not level, so these are explicit constants with a
 * source rather than eyeballed offsets.
 *
 * `NAP` is by definition Amsterdam Ordnance Datum zero. Rijkswaterstaat holds
 * the Amsterdam city canals (boezem Amsterdam-Rijnkanaal / Noordzeekanaal
 * system) at a target level of 0.40 m below NAP, which is the level the canal
 * water surface renders at. Quay heights vary along a canal and are measured
 * per quay segment from AHN rather than assumed from this constant.
 */
export const CANAL_WATER_LEVEL_NAP_M = -0.40;

/** Typical Grachtengordel quay crown above NAP; a starting value, always superseded by an AHN measurement. */
export const NOMINAL_QUAY_CROWN_NAP_M = 1.05;
