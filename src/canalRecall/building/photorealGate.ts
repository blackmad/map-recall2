/**
 * When Google's photorealistic mesh may replace the 3DBAG buildings.
 *
 * Measured before this was written (see HISTORY.md): Google's mesh reads
 * cleanly from about 25 m up, is already smearing at 10 m, and is unusable at
 * cycling height, where it also carries no building identity to highlight an
 * answer with. So the player's preference alone does not decide it — altitude
 * does, and the swap reverses on the way back down.
 */

/** Camera altitude, in metres, at which the mesh becomes worth showing. */
export const ACTIVATION_METERS = 25;

/**
 * The band is asymmetric on purpose. Riding a canal holds the camera at a
 * near-constant height, which parks it exactly on a single threshold and flips
 * the entire city between two renderers every few frames. Releasing lower than
 * it activates costs nothing and removes the flicker outright.
 */
export const RELEASE_METERS = 22;

export interface PhotorealGateInput {
  /** Whether the player has the option switched on at all. */
  enabled: boolean;
  /** Camera altitude above the ellipsoid, or null when it cannot be measured. */
  altitudeMeters: number | null;
  /** Whether the mesh is showing right now, which sets which threshold applies. */
  active: boolean;
}

export function shouldShowPhotoreal({ enabled, altitudeMeters, active }: PhotorealGateInput): boolean {
  if (!enabled) return false;
  // An unreadable camera is not evidence either way. Holding the current state
  // beats flipping the whole city on a transient failure to measure.
  if (altitudeMeters == null || !Number.isFinite(altitudeMeters)) return active;
  return active ? altitudeMeters >= RELEASE_METERS : altitudeMeters >= ACTIVATION_METERS;
}
