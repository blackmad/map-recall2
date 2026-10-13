// The start-of-ride orientation flight.
//
// A ride used to open at street scale: a few buildings, a road, no idea which
// part of Amsterdam you were in or which way the destination lay. The flight
// opens on an overview framing the start and the destination together, holds
// long enough to read where both are, then eases down to the driving camera.
//
// Pure camera arithmetic, so it is testable without a canvas. The runtime
// applies a frame to the game camera; MapLibre follows the camera as usual.
//
// It draws no names. The overview shows the two pins and the city around them,
// and street labels on this map are only ever ones already earned, so the
// first question cannot be answered from the flight.

export type Point = { x: number; y: number };

export type IntroCamera = { x: number; y: number; zoom: number };

export type IntroPlan = {
  from: IntroCamera;
  /** Seconds on the overview before moving. */
  hold: number;
  /** Seconds of the flight down to the driving camera. */
  flight: number;
};

export type IntroFrame = IntroCamera & {
  /** 1 on the overview, easing to 0 at the driving camera; overlays fade on it. */
  overview: number;
  done: boolean;
};

export const INTRO_HOLD_S = 1.6;
export const INTRO_FLIGHT_S = 1.9;
/** Never zoom in less than this far from the driving zoom: even a short route
 *  should open wide enough to show the neighbourhood around it. */
export const INTRO_MAX_ZOOM_FRACTION = 0.2;
/** Frame the pins with city around them, not edge to edge. */
export const INTRO_CONTEXT = 0.7;
/** Preferred floor, provided both route endpoints still fit on screen. */
export const INTRO_MIN_ZOOM = 0.012;

/** Screen room the overview may use, after the HUD's top band and a margin. */
export type IntroFrameBox = { width: number; height: number; top: number; bottom: number };

/**
 * The overview camera: centred on the start–destination box, zoomed so both
 * fit inside the free part of the screen with room for the pins.
 *
 * `screenScale` is screen px per flat-camera px as actually drawn. The
 * runtime flattens the map's tilt and chase zoom offset during the overview
 * (`camera.introOverview`), which makes it 1; a tilted overview drew the city
 * ~2× larger than the flat maths and the pins fell off a phone screen.
 */
export function introOverview(
  start: Point, finish: Point, box: IntroFrameBox, playZoom: number, screenScale = 1,
): IntroCamera {
  const pad = 56; // pin art is ~40 px tall; keep a finger of map beyond it
  const usableW = Math.max(80, box.width - pad * 2);
  const usableH = Math.max(80, box.height - box.top - box.bottom - pad * 2);
  const spanX = Math.max(1, Math.abs(finish.x - start.x));
  const spanY = Math.max(1, Math.abs(finish.y - start.y));
  const fit = Math.min(usableW / spanX, usableH / spanY) * INTRO_CONTEXT / screenScale;
  const zoom = Math.min(fit, Math.max(INTRO_MIN_ZOOM, Math.min(fit, playZoom * INTRO_MAX_ZOOM_FRACTION)));
  // Centre the box in the usable band, not the whole screen: the band is
  // shifted down by the top HUD, so the world centre moves up by half the
  // difference, in world units at the drawn scale.
  const bandShift = (box.top - box.bottom) / 2 / (zoom * screenScale);
  return {
    x: (start.x + finish.x) / 2,
    y: (start.y + finish.y) / 2 - bandShift,
    zoom,
  };
}

export function introPlan(from: IntroCamera, reducedMotion = false): IntroPlan {
  // Reduced motion still gets the orientation, as a still, then a cut.
  return { from, hold: reducedMotion ? INTRO_HOLD_S + 0.6 : INTRO_HOLD_S, flight: reducedMotion ? 0 : INTRO_FLIGHT_S };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * The camera at `elapsed` seconds. `to` is the live driving camera target, so
 * the flight lands exactly where normal following takes over.
 *
 * Zoom interpolates in log space: linear zoom spends most of the flight at the
 * wide end and then plunges. The centre follows the zoom's progress rather than
 * time, so the ground under the destination drifts off screen evenly instead
 * of the view sliding sideways at altitude.
 */
export function introFrame(plan: IntroPlan, to: IntroCamera, elapsed: number): IntroFrame {
  if (elapsed < plan.hold) return { ...plan.from, overview: 1, done: false };
  if (plan.flight <= 0 || elapsed >= plan.hold + plan.flight) return { ...to, overview: 0, done: true };
  const t = easeInOutCubic((elapsed - plan.hold) / plan.flight);
  const logFrom = Math.log(plan.from.zoom);
  const logTo = Math.log(to.zoom);
  const zoom = Math.exp(logFrom + (logTo - logFrom) * t);
  // Fraction of the way through the zoom in screen scale, 0..1.
  const scale = logTo === logFrom ? t : (Math.log(zoom) - logFrom) / (logTo - logFrom);
  return {
    x: plan.from.x + (to.x - plan.from.x) * scale,
    y: plan.from.y + (to.y - plan.from.y) * scale,
    zoom,
    overview: 1 - t,
    done: false,
  };
}

/** A lng/lat box, west/south/east/north in degrees. */
export type LngLatBounds = { west: number; south: number; east: number; north: number };

/** Fallback landing box when the map has not shown the driving view yet. */
export const INTRO_LANDING_RADIUS_M = 600;
/** A view wider than this is not a street-scale driving view. */
export const INTRO_LANDING_MAX_SPAN_M = 4000;

/**
 * The only buildings the start flight may stream: where it lands.
 *
 * The overview is flat and city-scale; it shows no buildings, so nothing is
 * loaded for it. Before the flight the map has normally just settled on the
 * driving view at the rider (the loading screen's spawn wait), and that view's
 * bounds are exactly what the landing needs. A fixed 600 m box around the
 * rider, used before, straddled z14 tile corners and doubled the resident
 * set (6.7k → 13.3k buildings on the measured route), all of it rebuilt in
 * the second before the flight. The box remains the fallback when the last
 * view is elsewhere (riding on, replay) or not street scale.
 */
export function introLandingArea(view: LngLatBounds | null | undefined, rider: [number, number], radiusM = INTRO_LANDING_RADIUS_M): LngLatBounds {
  const [lng, lat] = rider;
  const metresPerDegLat = 111320;
  const metresPerDegLng = metresPerDegLat * Math.cos(lat * Math.PI / 180);
  if (view && [view.west, view.south, view.east, view.north].every(Number.isFinite)) {
    const contains = lng >= view.west && lng <= view.east && lat >= view.south && lat <= view.north;
    const span = Math.max((view.east - view.west) * metresPerDegLng, (view.north - view.south) * metresPerDegLat);
    if (contains && span > 0 && span <= INTRO_LANDING_MAX_SPAN_M) return { ...view };
  }
  const dy = radiusM / metresPerDegLat, dx = radiusM / metresPerDegLng;
  return { west: lng - dx, east: lng + dx, south: lat - dy, north: lat + dy };
}
