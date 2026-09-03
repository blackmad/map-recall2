/**
 * Decide whether a footprint can have a photographable façade at all.
 *
 * `buildings-colored.geojson` is filtered by appearance, not by building-ness:
 * its median member covers 18 m² and its 10th percentile covers 6 m². Sheds,
 * kiosks, canopies and dormers therefore dominate any unfiltered sample. A
 * panorama aimed at a 1 m² object still returns a confident façade description,
 * because the model describes whatever building stands behind it — and two
 * models have no reason to choose the same neighbour. Gate the target before
 * spending a request on it, not the label afterwards.
 */
export type FootprintMetrics = { areaSquareMetres: number; longestEdgeMetres: number; vertices: number };
export type FacadeTargetPolicy = { minimumAreaSquareMetres: number; minimumHeightMetres: number; minimumFacadeWidthMetres: number };
export type FacadeTargetVerdict = { usable: boolean; reason: string | null };

/** Amsterdam is small enough that a local equirectangular metre grid is exact enough here. */
export function footprintMetrics(ring: readonly (readonly number[])[]): FootprintMetrics {
  const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring : [...ring, ring[0]];
  const latitude = closed.reduce((sum, point) => sum + point[1], 0) / closed.length;
  const xScale = 111_320 * Math.cos(latitude * Math.PI / 180);
  let twiceArea = 0, longest = 0;
  for (let index = 0; index < closed.length - 1; index += 1) {
    const [ax, ay] = closed[index], [bx, by] = closed[index + 1];
    twiceArea += (ax * xScale) * (by * 111_320) - (bx * xScale) * (ay * 111_320);
    longest = Math.max(longest, Math.hypot((bx - ax) * xScale, (by - ay) * 111_320));
  }
  return { areaSquareMetres: Math.abs(twiceArea / 2), longestEdgeMetres: longest, vertices: closed.length - 1 };
}

export const DEFAULT_FACADE_TARGET_POLICY: FacadeTargetPolicy = {
  minimumAreaSquareMetres: 40, minimumHeightMetres: 4, minimumFacadeWidthMetres: 5,
};

/**
 * Reasons are structured and ordered so a rejection says which measurement failed,
 * and so a later coverage report can count kinds of unusable target rather than a total.
 */
export function judgeFacadeTarget(
  metrics: FootprintMetrics,
  heightMetres: number | null | undefined,
  policy: FacadeTargetPolicy = DEFAULT_FACADE_TARGET_POLICY,
): FacadeTargetVerdict {
  if (!Number.isFinite(metrics.areaSquareMetres) || metrics.areaSquareMetres <= 0) return { usable: false, reason: 'degenerate-footprint' };
  if (metrics.areaSquareMetres < policy.minimumAreaSquareMetres) return { usable: false, reason: 'footprint-too-small-for-a-facade' };
  // A missing height is not a small building; it is an unmeasured one, and it must not pass silently.
  if (!Number.isFinite(Number(heightMetres)) || Number(heightMetres) <= 0) return { usable: false, reason: 'no-measured-height' };
  if (Number(heightMetres) < policy.minimumHeightMetres) return { usable: false, reason: 'too-short-for-a-facade' };
  if (metrics.longestEdgeMetres < policy.minimumFacadeWidthMetres) return { usable: false, reason: 'no-edge-wide-enough-to-photograph' };
  return { usable: true, reason: null };
}

/** Accepts the two GeoJSON shapes the Amsterdam extracts actually contain. */
export function outerRing(geometry: { type: string; coordinates: unknown }): readonly (readonly number[])[] | null {
  if (geometry.type === 'Polygon') return (geometry.coordinates as number[][][])[0] || null;
  if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates as number[][][][];
    // The largest part owns the façade; a courtyard wing should not decide the verdict.
    return polygons.map(polygon => polygon[0]).filter(Boolean)
      .sort((a, b) => footprintMetrics(b).areaSquareMetres - footprintMetrics(a).areaSquareMetres)[0] || null;
  }
  return null;
}

/**
 * Aim a panorama crop at a façade instead of at the road in front of it.
 *
 * Two measured facts drive this. `horizon` is the horizon line's height in the
 * frame as a fraction from the bottom, so it aims *down* as it grows: at
 * `horizon=0` the API returns pure sky. And the distance that decides framing is
 * the distance to the nearest façade, not to the footprint centroid — a 670 m²
 * block's centroid sits 22 m away while its wall is 6 m away, which is why the
 * pilot's fixed `fov=70, horizon=0.34` returned a doorway and one row of windows
 * for an 18 m building and `roofline` abstained with the roof out of frame.
 *
 * A building that fills the frame also spends its pixels on the façade rather
 * than on tarmac, so short buildings get a tighter crop and more detail.
 */
export type CropFraming = {
  fov: number; horizon: number; aspect: number;
  visibleTopMetres: number; fullFacadeVisible: boolean; cameraDistanceMetres: number;
};
export const PANORAMA_CAMERA_HEIGHT_METRES = 2;
/** Headroom above the ridge so a gable reads as a shape, and a little ground for entrance context. */
const TOP_MARGIN_METRES = 1.5, BOTTOM_MARGIN_METRES = 0.5;
const MINIMUM_FOV = 20, MAXIMUM_FOV = 100;

const degrees = (radians: number) => radians * 180 / Math.PI;
const radians = (value: number) => value * Math.PI / 180;

export function planFacadeCrop(
  buildingHeightMetres: number,
  cameraDistanceMetres: number,
  aspect = 1.6,
  cameraHeightMetres = PANORAMA_CAMERA_HEIGHT_METRES,
): CropFraming {
  const distance = Math.max(1, cameraDistanceMetres);
  const upDegrees = degrees(Math.atan((buildingHeightMetres + TOP_MARGIN_METRES - cameraHeightMetres) / distance));
  const downDegrees = degrees(Math.atan((cameraHeightMetres + BOTTOM_MARGIN_METRES) / distance));
  const verticalFov = Math.max(1, upDegrees + downDegrees);
  const wantedFov = degrees(2 * Math.atan(Math.tan(radians(verticalFov / 2)) * aspect));
  const fov = Math.min(MAXIMUM_FOV, Math.max(MINIMUM_FOV, wantedFov));
  // Clamping the lens changes what fits, so recompute the achievable field before aiming.
  const actualVertical = degrees(2 * Math.atan(Math.tan(radians(fov / 2)) / aspect));
  // `horizon` is measured from the bottom of the frame and therefore aims down as it
  // grows, so the share below the horizon line is what to ask for. Keep the ground edge
  // fixed and spend everything the lens has left going up.
  const horizon = Math.min(0.95, Math.max(0.05, downDegrees / actualVertical));
  const visibleTopMetres = cameraHeightMetres + distance * Math.tan(radians(actualVertical * (1 - horizon)));
  return {
    fov: Number(fov.toFixed(1)), horizon: Number(horizon.toFixed(3)), aspect,
    visibleTopMetres: Number(visibleTopMetres.toFixed(1)),
    fullFacadeVisible: visibleTopMetres >= buildingHeightMetres,
    cameraDistanceMetres: Number(distance.toFixed(1)),
  };
}

/** Metres between two WGS84 points, good enough at Amsterdam's latitude. */
export function metresBetween(a: readonly number[], b: readonly number[]): number {
  const latitude = (a[1] + b[1]) / 2;
  return Math.hypot((b[0] - a[0]) * 111_320 * Math.cos(latitude * Math.PI / 180), (b[1] - a[1]) * 111_320);
}

/** Framing follows the wall, not the centroid: a deep block's centroid is far behind its façade. */
export function metresToNearestFootprintPoint(camera: readonly number[], ring: readonly (readonly number[])[]): number {
  return Math.min(...ring.map(point => metresBetween(camera, point)));
}
