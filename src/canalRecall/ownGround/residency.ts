// Resident radius of the own ground from the camera (pure).
//
// The ring has to reach what the camera sees. In the chase view (zoom ~17,
// pitch ~60°) that is about 1.5 km from the rider, which the 1.4 km base ring
// covers. From the air (the user's Da Costakade 13 shot, ~300 m up over
// Nieuw-West, looking east) the top of the screen is several km away and the
// ring ended in a hard edge against the flat basemap. The radius follows the
// camera: the distance from the rider to the ground under the screen's top
// edge, from the zoom and pitch, in whole steps (so residency is not re-planned
// on every frame of a zoom ease) and capped, because every ring of cells costs
// worker build time and resident triangles (HISTORY 2026-10-13 has the table).

/** MapLibre's vertical field of view (radians) and the camera's distance to the centre in viewport heights (0.5 / tan(fov / 2)). */
const FOV = 0.6435011087932844;
const CENTRE_DISTANCE_VIEWPORTS = 0.5 / Math.tan(FOV / 2);
/** Assumed viewport height, pixels (desktop). */
export const VIEWPORT_PX = 900;
/** Radius steps, metres. */
export const RADIUS_STEP_M = 400;

/** Metres from the rider to the ground at the top edge of the screen (rider under the screen centre). */
export function viewReachM(zoom: number, pitchDeg: number, latDeg: number): number {
  const mpp = 40075016.686 * Math.cos(latDeg * Math.PI / 180) / (512 * 2 ** zoom);
  const distance = CENTRE_DISTANCE_VIEWPORTS * VIEWPORT_PX * mpp;
  const pitch = Math.min(pitchDeg, 85) * Math.PI / 180;
  const height = distance * Math.cos(pitch);
  const topEdge = Math.min(pitch + FOV / 2, 86 * Math.PI / 180);
  // The camera sits behind the centre by distance·sin(pitch); the top ray lands height·tan(topEdge) ahead of the camera's foot.
  return Math.max(0, height * Math.tan(topEdge) - distance * Math.sin(pitch));
}

/** Resident radius for a view reaching `reachM` ahead of the rider: at least `baseM`, in steps, at most `maxM`. */
export function residentRadius(reachM: number, baseM: number, maxM: number): number {
  if (maxM <= baseM || reachM <= baseM) return baseM;
  return Math.min(maxM, baseM + Math.ceil((reachM - baseM) / RADIUS_STEP_M) * RADIUS_STEP_M);
}
