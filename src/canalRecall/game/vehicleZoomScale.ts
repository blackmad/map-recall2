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
