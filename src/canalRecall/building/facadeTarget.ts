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
