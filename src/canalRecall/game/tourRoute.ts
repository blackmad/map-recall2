// Themed tours as a sequence of route legs.
//
// A tour is an ordered list of stops (public/data/extracts/amsterdam/tours.json,
// built by scripts/tours/build-tours.ts). The ride starts at the first stop and
// each leg is an ordinary route from one stop to the next; arriving at the leg's
// end advances the tour, and arriving at the last stop completes it (a tour
// stamp, see collection/poiCollection.ts). Pure: no DOM, no Game instance.

export type LngLat = [number, number];

export interface TourStop {
  name: string;
  /** landmarks.json feature id, when the stop is a landmark destination. */
  landmarkId?: string;
  /** OSM element, 'node/123' | 'way/123' | 'relation/123'. */
  osm?: string;
  lngLat: LngLat;
  /** One sentence taken from `source`. */
  why: string;
  source: string;
}

export interface Tour {
  id: string;
  title: string;
  theme: string;
  blurb: string;
  /** Shops and cafés change; the launcher should say when it was checked. */
  volatile?: boolean;
  checkedAt?: string;
  stops: TourStop[];
}

export interface TourState {
  tourId: string;
  /** The leg being ridden: from stops[legIndex] to stops[legIndex + 1]. */
  legIndex: number;
  /** Indices of the stops reached, in order (the first stop is the start). */
  completedStops: number[];
}

export interface TourLeg {
  index: number;
  from: TourStop;
  to: TourStop;
  fromIndex: number;
  toIndex: number;
  km: number;
}

/** No leg may be longer than this; scripts/check-tours.ts enforces it on the data. */
export const MAX_TOUR_LEG_KM = 2.5;
export const MIN_TOUR_STOPS = 4;
export const MAX_TOUR_STOPS = 7;

/** Straight-line km between two [lng, lat] points (equirectangular; fine at city scale). */
export function legKm(a: LngLat, b: LngLat): number {
  const meanLat = ((a[1] + b[1]) / 2) * Math.PI / 180;
  const dx = (b[0] - a[0]) * 111.32 * Math.cos(meanLat);
  const dy = (b[1] - a[1]) * 111.32;
  return Math.hypot(dx, dy);
}

/** Start a tour at its first stop. */
export function startTour(tour: Tour): TourState {
  return { tourId: tour.id, legIndex: 0, completedStops: tour.stops.length ? [0] : [] };
}

export function isComplete(state: TourState, tour: Tour): boolean {
  return tour.stops.length > 0 && state.completedStops.length >= tour.stops.length
    && state.completedStops.includes(tour.stops.length - 1);
}

/** The leg to ride now, or null when the tour is complete (or a mismatched state). */
export function nextLeg(state: TourState, tour: Tour): TourLeg | null {
  if (state.tourId !== tour.id || isComplete(state, tour)) return null;
  const from = tour.stops[state.legIndex];
  const to = tour.stops[state.legIndex + 1];
  if (!from || !to) return null;
  return { index: state.legIndex, from, to, fromIndex: state.legIndex, toIndex: state.legIndex + 1, km: legKm(from.lngLat, to.lngLat) };
}

/**
 * The ride reached the current leg's destination. Returns the next state and
 * whether that arrival completed the tour. Arriving after completion, or with
 * a state for another tour, changes nothing.
 */
export function advanceOnArrival(state: TourState, tour: Tour): { state: TourState; completed: boolean; reached: TourStop | null } {
  const leg = nextLeg(state, tour);
  if (!leg) return { state, completed: false, reached: null };
  const next: TourState = {
    tourId: state.tourId,
    legIndex: Math.min(leg.toIndex, tour.stops.length - 1),
    completedStops: [...state.completedStops, leg.toIndex],
  };
  return { state: next, completed: isComplete(next, tour), reached: leg.to };
}

/** Whether a leg respects the detour cap. */
export const withinLegCap = (leg: Pick<TourLeg, 'km'>, capKm = MAX_TOUR_LEG_KM): boolean => leg.km <= capKm;

/** Every consecutive leg of a tour, for checks and an overview map. */
export function tourLegs(tour: Tour): TourLeg[] {
  const legs: TourLeg[] = [];
  for (let i = 0; i + 1 < tour.stops.length; i++) {
    legs.push({ index: i, from: tour.stops[i], to: tour.stops[i + 1], fromIndex: i, toIndex: i + 1, km: legKm(tour.stops[i].lngLat, tour.stops[i + 1].lngLat) });
  }
  return legs;
}

/** Legs longer than the cap (empty for a valid tour). */
export const legsOverCap = (tour: Tour, capKm = MAX_TOUR_LEG_KM): TourLeg[] => tourLegs(tour).filter(leg => !withinLegCap(leg, capKm));

/**
 * A stop as a route-POI the game's routeFrom/routeTo accepts. Landmark stops
 * reuse the extract POI id (`lm-<id>`) so arrival cards and stamps line up.
 */
export function stopAsRoutePoi(tour: Tour, index: number): { id: string; name: string; lat: number; lng: number; landmarkId?: string } | null {
  const stop = tour.stops[index];
  if (!stop) return null;
  return {
    id: stop.landmarkId ? `lm-${stop.landmarkId}` : `tour-${tour.id}-${index}`,
    name: stop.name,
    lat: stop.lngLat[1],
    lng: stop.lngLat[0],
    ...(stop.landmarkId ? { landmarkId: stop.landmarkId } : {}),
  };
}

/** "Stop 3 of 7" style progress for the HUD. */
export function tourProgressLabel(state: TourState, tour: Tour): string {
  if (isComplete(state, tour)) return `${tour.title}: complete`;
  return `${tour.title}: stop ${Math.min(state.legIndex + 2, tour.stops.length)} of ${tour.stops.length}`;
}
