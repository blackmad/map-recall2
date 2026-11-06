/**
 * The aerial view (lane R2-B, #229): how high the eye is and how far the view reaches, from the camera's zoom, pitch
 * and latitude alone (the MapLibre camera model: a 0.6435 rad vertical field of view over a ~900 px viewport). One
 * predicate for the layers that change from the air: the own ground's horizon reach (ownGround/farRing.ts), and with
 * it the far tier (engine/farShells.ts), and the label cap (engine/overlays/labelLayer.ts `?labelAerialCap=0`).
 *
 * Measured poses (desktop, lat 52.37): cockpit z19 p84 eye 13 m; chase z18 p60 eye 123 m but its top edge at 78°
 * reaches ~390 m; the user's S1 shot z17.6 p70 eye 111 m reaching ~12 km; S4 z16.9 p74 eye 145 m. A ride view never
 * has both a 60 m eye and a horizon-deep top edge, so AERIAL_EYE_MIN_M and AERIAL_REACH_MIN_M together pick the air.
 */
export const FAR_HORIZON_DEG = 89.5;
/** The eye height below which the horizon reach never applies (cockpit sits at ~13 m and must not fetch the city). */
export const AERIAL_EYE_MIN_M = 60;
/** The reach beyond which a view is horizon-deep (the desktop resident building ring is 1,400 m). */
export const AERIAL_REACH_MIN_M = 1500;
const FOV_RAD = 0.6435011087932844;

function camera(zoom: number, pitchDeg: number, latDeg: number, fovRad: number, viewportPx: number) {
  const mpp = 40075016.686 * Math.cos(latDeg * Math.PI / 180) / (512 * 2 ** zoom);
  const distance = 0.5 / Math.tan(fovRad / 2) * viewportPx * mpp;
  const pitch = Math.min(pitchDeg, 85) * Math.PI / 180;
  return { distance, pitch, height: distance * Math.cos(pitch) };
}
/** Eye height above the ground plane, metres. */
export function eyeHeightM(zoom: number, pitchDeg: number, latDeg: number, fovRad = FOV_RAD, viewportPx = 900): number {
  return camera(zoom, pitchDeg, latDeg, fovRad, viewportPx).height;
}
/** Ground distance from the view centre to where the top edge's ray (capped at FAR_HORIZON_DEG) lands, metres. */
export function farReachM(zoom: number, pitchDeg: number, latDeg: number, fovRad = FOV_RAD, viewportPx = 900): number {
  const { distance, pitch, height } = camera(zoom, pitchDeg, latDeg, fovRad, viewportPx);
  const topEdge = Math.min(pitch + fovRad / 2, FAR_HORIZON_DEG * Math.PI / 180);
  return Math.max(0, height * Math.tan(topEdge) - distance * Math.sin(pitch));
}
/** From the air: an eye above AERIAL_EYE_MIN_M looking out past AERIAL_REACH_MIN_M. */
export function isAerialView(zoom: number, pitchDeg: number, latDeg: number): boolean {
  return eyeHeightM(zoom, pitchDeg, latDeg) >= AERIAL_EYE_MIN_M && farReachM(zoom, pitchDeg, latDeg) >= AERIAL_REACH_MIN_M;
}
