/** HUD north compass: geometry and the screen angle of true north.
 *
 *  World −Y is north (latitude grows that way; canvas +Y grows south when the
 *  camera is north-up). The needle tip is drawn along local +X, so the rotate
 *  angle that points it north is −π/2 when the camera is north-up, then tracks
 *  `camera.rotation` as the map turns under heading-up / chase views.
 */

export const COMPASS_SIZE_DESKTOP = 44;
export const COMPASS_SIZE_COMPACT = 40;

/** Canvas rotate angle that points a +X needle toward true north. */
export function northScreenAngle(cameraRotation: number): number {
  return -Math.PI / 2 - cameraRotation;
}
