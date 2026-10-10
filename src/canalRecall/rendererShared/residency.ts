// Draw residency: which loaded models take part in this frame.
//
// Loading residency (what is decoded and in memory) stays with each layer.
// This is the cheaper per-frame question — is a model near enough to the view
// to be worth a draw call — answered the same way for every participant, so a
// landmark, a zoo animal and a roof cap appear and disappear at the same edge.

export type LngLatBounds = { west: number; east: number; south: number; north: number };

/** Degrees added around the view: about 280 m east-west and 220 m north-south in Amsterdam. */
export const DEFAULT_RESIDENCY_PAD = { lng: 0.004, lat: 0.002 } as const;

const METRES_PER_DEGREE_LAT = 111320;

/**
 * True when a model anchored at `anchor` with a horizontal radius of
 * `radiusM` metres can touch the padded view bounds. Large footprints (the
 * Rijksmuseum, Centraal) widen their own margin so they never pop at an edge.
 */
export function withinView(
  bounds: LngLatBounds,
  anchor: readonly [number, number] | null | undefined,
  radiusM = 0,
  pad: { lng: number; lat: number } = DEFAULT_RESIDENCY_PAD,
): boolean {
  if (!anchor) return false;
  const dy = radiusM / METRES_PER_DEGREE_LAT;
  const dx = dy / Math.max(0.1, Math.cos((anchor[1] * Math.PI) / 180));
  return anchor[0] >= bounds.west - pad.lng - dx && anchor[0] <= bounds.east + pad.lng + dx
    && anchor[1] >= bounds.south - pad.lat - dy && anchor[1] <= bounds.north + pad.lat + dy;
}

/** MapLibre LngLatBounds → plain bounds. */
export function plainBounds(b: { getWest(): number; getEast(): number; getSouth(): number; getNorth(): number }): LngLatBounds {
  return { west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() };
}
