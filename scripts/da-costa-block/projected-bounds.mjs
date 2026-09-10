import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';

/** Axis-aligned RD envelope of all four WGS84 corners, not only its diagonal. */
export function projectedBounds(bbox, { legacyDiagonal = false } = {}) {
  const [west, south, east, north] = bbox;
  const corners = [[west, south], [east, south], [east, north], [west, north]].map(lngLatToRd);
  // Only the two frozen demo presets retain their historical request URLs.
  if (legacyDiagonal) return [corners[0].x, corners[0].y, corners[2].x, corners[2].y];
  return [Math.min(...corners.map(point => point.x)), Math.min(...corners.map(point => point.y)), Math.max(...corners.map(point => point.x)), Math.max(...corners.map(point => point.y))];
}
