// The box a point layer (street furniture) streams and draws for: the view's bounds clipped to a radius round the
// rider, not round the view centre (feedback 4d7706de, 2026-11-13, "trash bins were here when I first rode here").
// The view centre leads the rider in chase (the follow offset plus the landmark sightline lead, up to ~70 m) and sits
// wherever a detached camera points; a radius round it drops pieces beside and behind the rider first. Pure.

export interface LngLatBox { west: number; south: number; east: number; north: number }
export type LngLat = readonly [number, number];

const M_LAT = 110_540;
const mLng = (lat: number) => 111_320 * Math.cos(lat * Math.PI / 180);

/** A square of `radiusM` round `centre`, clipped to `bounds` when given; null when the two do not meet. */
export function riderViewBox(bounds: LngLatBox | null, centre: LngLat, radiusM: number): LngLatBox | null {
  const dy = radiusM / M_LAT, dx = radiusM / mLng(centre[1]);
  const box = { west: centre[0] - dx, east: centre[0] + dx, south: centre[1] - dy, north: centre[1] + dy };
  if (!bounds) return box;
  const out = { west: Math.max(bounds.west, box.west), east: Math.min(bounds.east, box.east), south: Math.max(bounds.south, box.south), north: Math.min(bounds.north, box.north) };
  return out.west < out.east && out.south < out.north ? out : null;
}

/** The point the radius is drawn round: the rider when known and finite, else the view centre. */
export function radiusCentre(rider: LngLat | null | undefined, viewCentre: { lng: number; lat: number }): [number, number] {
  return rider && Number.isFinite(rider[0]) && Number.isFinite(rider[1]) ? [rider[0], rider[1]] : [viewCentre.lng, viewCentre.lat];
}

/** Metres between two lng/lat points (local flat approximation). */
export function metresBetween(a: LngLat, b: LngLat): number {
  return Math.hypot((a[0] - b[0]) * mLng((a[1] + b[1]) / 2), (a[1] - b[1]) * M_LAT);
}
