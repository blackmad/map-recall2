/**
 * When Google's photorealistic mesh may replace the 3DBAG buildings.
 *
 * The spike measured this as eye height in metres. The game's MapLibre camera
 * never gets that low: altitude is a function of zoom and viewport, and across
 * every view mode it sits roughly 95–520 m up. So the thing the player actually
 * varies — `camera.zoom` — is what the gate reads. Smaller zoom is more city;
 * the default play zoom stays on 3DBAG so buildings still have identity.
 *
 * Asymmetric on purpose: a near-constant camera parks on a single threshold
 * and would otherwise flip the whole city every few frames.
 */

/** Game `camera.zoom` at or below which the mesh becomes worth showing. */
export const ACTIVATION_ZOOM = 0.32;

/**
 * Zooming back in past this (larger number) hands the city to 3DBAG.
 * Must sit above activation: the player zooms out to overview, in to street.
 */
export const RELEASE_ZOOM = 0.38;

export interface PhotorealGateInput {
  /** Whether the player has the option switched on at all. */
  enabled: boolean;
  /**
   * The game camera's zoom multiplier (`CAMERA_ZOOM_INITIAL` is 0.50).
   * Null when it has not been synced yet.
   */
  cameraZoom: number | null;
  /** Whether the mesh is showing right now, which sets which threshold applies. */
  active: boolean;
}

export function shouldShowPhotoreal({ enabled, cameraZoom, active }: PhotorealGateInput): boolean {
  if (!enabled) return false;
  // An unreadable camera is not evidence either way. Holding the current state
  // beats flipping the whole city on a transient failure to measure.
  if (cameraZoom == null || !Number.isFinite(cameraZoom)) return active;
  return active ? cameraZoom <= RELEASE_ZOOM : cameraZoom <= ACTIVATION_ZOOM;
}
