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

// ---- What the ride may show before and after a stop ----

/**
 * Words that make a stop's name a street, water, square, market or bridge
 * name, i.e. the answer to a question the ride may ask on the way there.
 */
const STREET_LIKE = /(straat|gracht|plein|markt|brug|dijk|kade|weg|laan|sluis|steeg|singel|bend|bocht)/i;

/**
 * Whether naming this stop before arrival could answer a street question.
 * Landmark stops keep their name (the HUD already masks the one street being
 * asked, see _destinationLabel); a stop with no landmark is hidden when it has
 * no mapped element of its own (Golden Bend, Jodenbreestraat) or its name is
 * street-like (Albert Cuypmarkt, Waterlooplein).
 */
export function stopNameSpoils(stop: Pick<TourStop, 'name' | 'landmarkId' | 'osm'>): boolean {
  if (stop.landmarkId) return false;
  return !stop.osm || STREET_LIKE.test(stop.name);
}

/** "Jewish Amsterdam, stop 2 of 7": what the HUD calls a hidden stop. */
export function hiddenStopLabel(tour: Tour, index: number): string {
  return `${tour.title}, stop ${index + 1} of ${tour.stops.length}`;
}

export interface TourDestination {
  id: string;
  name: string;
  lat: number;
  lng: number;
  landmarkId?: string;
  /** Marks a tour leg's end: the finish card uses the stop's own card, never a nearby landmark's. */
  tourStop: true;
  /** The real name, shown only on arrival, when `name` is a hidden label. */
  tourRevealName?: string;
}

/** A stop as the leg's destination, with a spoiling name held back until arrival. */
export function tourDestination(tour: Tour, index: number): TourDestination | null {
  const poi = stopAsRoutePoi(tour, index);
  const stop = tour.stops[index];
  if (!poi || !stop) return null;
  if (!stopNameSpoils(stop)) return { ...poi, tourStop: true };
  return { ...poi, name: hiddenStopLabel(tour, index), tourStop: true, tourRevealName: stop.name };
}

/** "checked 2026-10-17" for tours of shops and cafés, which change; null otherwise. */
export function tourCheckedLabel(tour: Pick<Tour, 'volatile' | 'checkedAt'>): string | null {
  return tour.volatile && tour.checkedAt ? `checked ${tour.checkedAt}` : null;
}

/** The host of a stop's source, for the card's attribution ("iamsterdam.com"). */
export function sourceHost(source: string): string {
  try { return new URL(source).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export interface TourArrival {
  tourId: string;
  title: string;
  stopIndex: number;
  stopCount: number;
  name: string;
  why: string;
  sourceHost: string;
  checked: string | null;
  completed: boolean;
}

/** What the finish card shows for a tour stop: its sourced "why" line and where it is in the tour. */
export function tourArrival(tour: Tour, stopIndex: number, completed: boolean): TourArrival | null {
  const stop = tour.stops[stopIndex];
  if (!stop) return null;
  return {
    tourId: tour.id, title: tour.title, stopIndex, stopCount: tour.stops.length,
    name: stop.name, why: stop.why, sourceHost: sourceHost(stop.source),
    checked: tourCheckedLabel(tour), completed,
  };
}

/** The tour a `?tour=<id>` link asks for, if it exists. */
export function tourFromSearch(search: string, tours: readonly Tour[]): Tour | null {
  let id: string | null = null;
  try { id = new URLSearchParams(search).get('tour'); } catch { return null; }
  return (id && tours.find(tour => tour.id === id)) || null;
}

/** The settings a tour rides with: tours are bike rides in Amsterdam, and a
 *  tour starts at its first stop rather than at Home or Here. */
export const TOUR_RIDE_PREFS = { travelMode: 'car', cityId: 'amsterdam', routePattern: 'surprise' } as const;
export type TourPrefKey = keyof typeof TOUR_RIDE_PREFS;
type TourPrefs = Record<TourPrefKey, string>;

/**
 * What a tour changes and how to undo it. `patch` is applied for the tour;
 * `restore` holds the player's own values of exactly those keys. A tour
 * started while one is already held keeps the first `held` values, so a
 * second tour never snapshots the first one's overrides as the player's.
 */
export function tourPrefsOverride<P extends TourPrefs>(prefs: P, held?: Partial<P> | null): { patch: Partial<P>; restore: Partial<P> } {
  const patch: Partial<P> = {};
  const restore = { ...(held || {}) } as Partial<P>;
  for (const key of Object.keys(TOUR_RIDE_PREFS) as TourPrefKey[]) {
    const want = TOUR_RIDE_PREFS[key];
    if (prefs[key] === want) continue;
    (patch as Record<string, string>)[key] = want;
    if (!(key in restore)) (restore as Record<string, string>)[key] = prefs[key];
  }
  return { patch, restore };
}

/** The preferences to write to storage: during a tour, the player's own
 *  values stand in for the tour's overrides, which are never saved. */
export function persistablePrefs<P extends object>(prefs: P, restore?: Partial<P> | null): P {
  return restore ? { ...prefs, ...restore } : prefs;
}
