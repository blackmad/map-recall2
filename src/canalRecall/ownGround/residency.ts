// Resident radius of the own ground by map zoom (pure).
//
// At riding zoom the 1.4 km ring is more than the camera sees. From the air
// (zoomed out, the user's Da Costakade shot from ~300 m up over Nieuw-West) the
// horizon is several km away and the ring ended in a hard edge against the flat
// basemap. The radius grows as the zoom falls below `AERIAL_ZOOM`, in whole
// steps (so residency is not re-planned every frame of a zoom ease) and capped:
// every ring of cells costs worker build time and resident triangles (HISTORY
// 2026-10-13: measured per radius).

/** At and above this map zoom the base radius is enough (the chase and rider views). */
export const AERIAL_ZOOM = 16.4;
/** Radius steps, metres. */
export const RADIUS_STEP_M = 400;

export function residentRadius(zoom: number, baseM: number, maxM: number, minZoom: number): number {
  if (!(zoom < AERIAL_ZOOM) || maxM <= baseM) return baseM;
  const t = Math.min(1, (AERIAL_ZOOM - zoom) / Math.max(0.5, AERIAL_ZOOM - minZoom));
  const raw = baseM + t * (maxM - baseM);
  return Math.min(maxM, baseM + Math.round((raw - baseM) / RADIUS_STEP_M) * RADIUS_STEP_M);
}
