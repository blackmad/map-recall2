/**
 * How much bigger the chase bike is drawn in world space at a camera zoom.
 *
 * The bike is a world-space piece, so on screen it grew and shrank one-for-one
 * with zoom: zoomed in it filled the street it was riding (user report
 * 2026-10-03, "the size of the bike model needs to scale a bit with zoom").
 * Taking back 65% of the zoom keeps it growing gently as you zoom in:
 * at the camera's 2.3x zoom-in it reads 1.34x. At the
 * default zoom for the window it is exactly 1, so the tuned chase size holds.
 */
export const VEHICLE_ZOOM_EXPONENT = 0.65;
export const VEHICLE_ZOOM_MIN_SCALE = 0.5;
export const VEHICLE_ZOOM_MAX_SCALE = 2.2;

export function vehicleZoomScale(zoom: number, defaultZoom: number): number {
  if (!(zoom > 0) || !(defaultZoom > 0)) return 1;
  const scale = (defaultZoom / zoom) ** VEHICLE_ZOOM_EXPONENT;
  return Math.max(VEHICLE_ZOOM_MIN_SCALE, Math.min(VEHICLE_ZOOM_MAX_SCALE, scale));
}

/** The ride's default camera zoom (`CAMERA_ZOOM_INITIAL`, constants.js), at which the boat's game scale was tuned. */
export const BOAT_REFERENCE_ZOOM = 0.65;

/**
 * The chase boat's zoom compensation: it grows as the camera zooms out, as the
 * bike does, but never shrinks below its tuned size.
 *
 * Without it the boat was a literal world-space hull: at the slider's 0.1
 * minimum it was ~9 px long, while the START tag beside it is screen-sized,
 * so the ride read as having no boat at all (user report 2026-10-21, Amstel
 * at Carré). It is measured against the default zoom rather than the bike's
 * per-window `_defaultZoom`: on a phone that is ~0.2, and the bike's formula
 * would halve a boat that already reads there.
 */
export function boatZoomScale(zoom: number, referenceZoom = BOAT_REFERENCE_ZOOM): number {
  return Math.max(1, vehicleZoomScale(zoom, referenceZoom));
}

/**
 * The IJ ferry and the transit car take the boat's rule (2026-10-22): they are
 * world-space pieces tuned at the default zoom too, and vanished the same way
 * when the camera was zoomed out.
 */
export const ferryZoomScale = boatZoomScale;
export const transitZoomScale = boatZoomScale;
