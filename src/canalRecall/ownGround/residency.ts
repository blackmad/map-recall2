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

// Touch ring (CANAL-RECALL-7). The desktop rule above assumes a 900 px viewport and grows in 400 m steps, so the
// iPad chase view (734 px tall, the top centre ~360 m ahead) stepped from the 400 m touch base to 800 m and kept 6–7
// cells, though nothing past ~470 m is on screen. A touch device fits the ring to its own viewport instead: the
// farthest ground the screen shows (a top corner), plus a margin for the build latency at riding speed, in 100 m
// steps. Desktop keeps the rule above, byte-identical.

/** Touch ring steps, metres. */
export const TOUCH_RADIUS_STEP_M = 100;
/** Metres added to the farthest visible ground point before the step, standing still (that point is exact: the gpu-load script measures 464 m by unprojecting the iPad corners, as viewCornerReachM computes). */
export const TOUCH_RING_MARGIN_M = 25;
/**
 * Seconds of travel a touch ring reaches past the screen in the riding direction: a cell ahead is asked for when the
 * rider will see it in this long. A touch cell builds in ~0.85 s on a desktop CPU (coarse level, HISTORY 2026-10-28);
 * an iPad is slower and the worker queue adds more. Measured clean by scripts/ring-edge-ride.mjs.
 */
export const TOUCH_AHEAD_S = 4;
/** Never more than this ahead margin, metres. */
export const TOUCH_AHEAD_MAX_M = 400;

/** The extra reach ahead of a rider at `speedMps` (TOUCH_AHEAD_S of travel, capped). */
export function touchAheadMarginM(speedMps: number): number {
  return Math.min(TOUCH_AHEAD_MAX_M, Math.max(0, speedMps) * TOUCH_AHEAD_S);
}

/**
 * Whether a cell `d` metres away (to its nearest point, at `cos` of the angle between the riding direction and that
 * point) is in a touch ring of `radiusM` with `aheadM` reach ahead: the whole margin straight ahead, none beside or
 * behind, where the plain disc already covers everything the screen shows.
 */
export function inTouchRing(d: number, cos: number, radiusM: number, aheadM: number): boolean {
  return d <= radiusM + aheadM * Math.max(0, cos);
}

/** Metres from the rider (under the screen centre) to the ground at the screen's top corners, for a `widthPx`×`heightPx` view. */
export function viewCornerReachM(zoom: number, pitchDeg: number, latDeg: number, widthPx: number, heightPx: number): number {
  const mpp = 40075016.686 * Math.cos(latDeg * Math.PI / 180) / (512 * 2 ** zoom);
  const distance = CENTRE_DISTANCE_VIEWPORTS * heightPx * mpp;
  const pitch = Math.min(pitchDeg, 85) * Math.PI / 180;
  const height = distance * Math.cos(pitch);
  const topEdge = Math.min(pitch + FOV / 2, 86 * Math.PI / 180);
  const ahead = Math.max(0, height * Math.tan(topEdge) - distance * Math.sin(pitch));
  // The top ray's depth along the view axis, times the horizontal half-angle's tangent (aspect × tan(fov / 2)).
  const depth = height / Math.cos(topEdge) * Math.cos(FOV / 2);
  const halfWidth = depth * Math.tan(FOV / 2) * widthPx / Math.max(1, heightPx);
  return Math.hypot(ahead, halfWidth);
}

/** Touch resident radius: the visible reach plus the margin, in 100 m steps, at least `baseM`, at most `maxM`. */
export function touchResidentRadius(cornerReachM: number, baseM: number, maxM: number): number {
  const want = Math.ceil((cornerReachM + TOUCH_RING_MARGIN_M) / TOUCH_RADIUS_STEP_M) * TOUCH_RADIUS_STEP_M;
  return Math.max(baseM, Math.min(Math.max(baseM, maxM), want));
}
