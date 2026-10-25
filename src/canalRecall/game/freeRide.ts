// Free Ride: ride anywhere, no route and no questions, with the notable
// things nearby marked on the map and a card for whatever the rider taps.
//
// This file is the decision half: which places get a marker, where the
// markers may sit on screen, which one a tap hit, and what the plaque says.
// It has no canvas, DOM or Game instance, so it is tested on its own
// (`freeRide.test.ts`). The browser half is `freeRideRuntime.ts`.
//
// The quiz modes' rule that nothing on screen may name the street under
// question does not apply here: Free Ride asks nothing, so street and canal
// names are shown freely. The runtime switches the quiz's spoiler screening
// off only while a free ride is running and restores it when the ride ends.

import type { WorldPoint } from './worldTypes';

/** The route pattern that means Free Ride (see `modes.ts` ROUTE_PATTERNS). */
export const FREE_RIDE_PATTERN = 'free';

export function isFreeRidePattern(pattern: string | null | undefined): boolean {
  return pattern === FREE_RIDE_PATTERN;
}

/** Free Ride rides the bike or the boat; transit has no free roaming, so a
 *  rider who had transit picked gets the bike. */
export function freeRideTravelMode<T extends string>(mode: T): T | 'car' {
  return mode === 'transit' ? 'car' : mode;
}

/** How far from the rider a place may be and still get a marker. About two
 *  canal-belt blocks: far enough to see what is coming, near enough that a
 *  marker belongs to what is on screen. */
export const FREE_RIDE_MARKER_RADIUS_M = 320;
/** Bridges are dense in the centre (four or five per canal block), so they
 *  are marked only close by. */
export const FREE_RIDE_BRIDGE_RADIUS_M = 140;
/** Markers on screen at once. More turned the corridor into a label cloud. */
export const FREE_RIDE_MAX_MARKERS = 6;
/** At most this many of the markers are bridges, so landmarks are not
 *  crowded out on a stretch of canal. */
export const FREE_RIDE_MAX_BRIDGE_MARKERS = 2;
/** Seconds between nearby-place searches; the markers themselves are
 *  re-projected every frame. */
export const FREE_RIDE_REFRESH_SECONDS = 0.4;
/** Street and canal names are drawn this far from the camera at most. A
 *  pitched camera's own reach is four screens; projecting every anchor in it
 *  each frame would cost what the quiz modes saved (streetLabelCandidates.ts). */
export const FREE_RIDE_LABEL_REACH_M = 450;
/** Marker labels are cut to this many characters. */
export const FREE_RIDE_LABEL_MAX_CHARS = 26;

export type FreeRideKind = 'landmark' | 'bridge';

export interface FreeRidePlace extends WorldPoint {
  /** Stable per ride: a landmark id, or `bridge:<id>`. */
  key: string;
  kind: FreeRideKind;
  name: string;
}

export interface FreeRideNearby extends FreeRidePlace {
  distance: number;
}

/**
 * The places to mark around the rider: nearest first, one per name (a
 * landmark listed twice, or a bridge with several crossings, gets one
 * marker), bridges capped so they do not crowd landmarks out.
 */
export function nearbyPlaces(
  rider: WorldPoint,
  places: readonly FreeRidePlace[],
  {
    radiusPx,
    bridgeRadiusPx = radiusPx,
    max = FREE_RIDE_MAX_MARKERS,
    maxBridges = FREE_RIDE_MAX_BRIDGE_MARKERS,
  }: { radiusPx: number; bridgeRadiusPx?: number; max?: number; maxBridges?: number },
): FreeRideNearby[] {
  const within: FreeRideNearby[] = [];
  for (const place of places) {
    if (!place.name || !Number.isFinite(place.x) || !Number.isFinite(place.y)) continue;
    const distance = Math.hypot(place.x - rider.x, place.y - rider.y);
    const limit = place.kind === 'bridge' ? bridgeRadiusPx : radiusPx;
    if (distance > limit) continue;
    within.push({ ...place, distance });
  }
  within.sort((a, b) => a.distance - b.distance || a.key.localeCompare(b.key));
  const names = new Set<string>();
  const picked: FreeRideNearby[] = [];
  let bridges = 0;
  for (const place of within) {
    if (picked.length >= max) break;
    const name = place.name.trim().toLowerCase();
    if (names.has(name)) continue;
    if (place.kind === 'bridge') {
      if (bridges >= maxBridges) continue;
      bridges++;
    }
    names.add(name);
    picked.push(place);
  }
  return picked;
}

/** A bridge's marker sits at its crossing nearest the rider. */
export function nearestPoint(rider: WorldPoint, points: readonly WorldPoint[]): WorldPoint | null {
  let best: WorldPoint | null = null;
  let bestDistance = Infinity;
  for (const point of points) {
    const distance = Math.hypot(point.x - rider.x, point.y - rider.y);
    if (distance < bestDistance) { best = point; bestDistance = distance; }
  }
  return best;
}

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MarkerRequest {
  key: string;
  /** The marker's anchor on screen: the place itself. */
  anchorX: number;
  anchorY: number;
  /** The label's measured size. */
  width: number;
  height: number;
}

export interface PlacedMarker extends MarkerRequest {
  /** The label box, above the anchor; also the tap target with the stem. */
  box: ScreenRect;
}

/** Gap between the anchor dot and the bottom of the label. */
export const MARKER_STEM = 14;

function overlaps(a: ScreenRect, b: ScreenRect, pad = 0): boolean {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

/**
 * Lay the markers out in the order given (nearest first), dropping any whose
 * label would leave the screen, cover a HUD card (`blocked`) or overlap a
 * nearer marker. Nothing is nudged sideways: a label that moves away from its
 * place stops saying which building it means.
 */
export function layoutMarkers(
  requests: readonly MarkerRequest[],
  screen: { width: number; height: number },
  blocked: readonly ScreenRect[] = [],
): PlacedMarker[] {
  const placed: PlacedMarker[] = [];
  for (const request of requests) {
    if (!Number.isFinite(request.anchorX) || !Number.isFinite(request.anchorY)) continue;
    const box: ScreenRect = {
      x: request.anchorX - request.width / 2,
      y: request.anchorY - MARKER_STEM - request.height,
      w: request.width,
      h: request.height,
    };
    if (box.x < 4 || box.y < 4 || box.x + box.w > screen.width - 4 || request.anchorY > screen.height - 4) continue;
    if (blocked.some(rect => overlaps(box, rect, 4))) continue;
    if (placed.some(other => overlaps(box, other.box, 3))) continue;
    placed.push({ ...request, box });
  }
  return placed;
}

/** The marker under a tap, generous by a few pixels and including the stem
 *  down to the anchor dot. Topmost (last drawn) wins. */
export function markerAt(placed: readonly PlacedMarker[], x: number, y: number, slop = 6): PlacedMarker | null {
  for (let i = placed.length - 1; i >= 0; i--) {
    const { box, anchorY } = placed[i];
    if (x >= box.x - slop && x <= box.x + box.w + slop && y >= box.y - slop && y <= Math.max(box.y + box.h, anchorY) + slop) {
      return placed[i];
    }
  }
  return null;
}

/** Cut a long name for a marker label, on a word where one is near. */
export function markerLabel(name: string, maxChars = FREE_RIDE_LABEL_MAX_CHARS): string {
  const text = name.trim().replace(/\s+/g, ' ');
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > maxChars * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, '')}…`;
}

/** The plaque's tally line in Free Ride, in place of the quiz score. */
export function freeRideTallyKey(opened: number): { key: 'freeRide.tallyNone' | 'freeRide.tallyOne' | 'freeRide.tallyMany'; count: number } {
  if (opened <= 0) return { key: 'freeRide.tallyNone', count: 0 };
  if (opened === 1) return { key: 'freeRide.tallyOne', count: 1 };
  return { key: 'freeRide.tallyMany', count: opened };
}

/** How near a tap must be to a street or canal centreline to name it: the
 *  way's own half width plus a finger's slop, in world px. */
export function tapNamesWay(contact: { dist?: number; width?: number } | null, slopPx: number): boolean {
  if (!contact || !Number.isFinite(contact.dist)) return false;
  const halfWidth = Number.isFinite(contact.width) ? (contact.width as number) : 0;
  return (contact.dist as number) <= halfWidth + slopPx;
}
