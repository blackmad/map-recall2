/**
 * "Share this route": a link that boots the same start, finish and mode for
 * someone else, without leaking where the rider lives or stands.
 *
 * The ride's own replay hash (`#race=centre,start,finish`, game-route.js) is
 * personal: a Home ride starts on the geocoded home address and a Here ride on
 * the device's GPS fix, and My progress's "Ride again" keeps those exact points
 * on purpose. A *shared* link never does. A private endpoint (a Home or Here
 * POI, or any point within {@link PRIVATE_RADIUS_M} of a saved home geocode or
 * GPS fix) is replaced by the nearest public route destination, a named
 * landmark, and the centre is recomputed so it cannot be solved back to the
 * private point. With no public stand-in nearby the route is not shareable.
 * Tours share as `?tour=<id>`, which the ride already starts from.
 *
 * Pure apart from {@link shareOrCopy}, which takes its navigator as an argument.
 */

export interface LatLng { lat: number; lng: number }
export interface SharePoi extends LatLng { id?: string; name?: string }

/** POI ids the ride gives private origins (game-route.js, gpsOrigin.ts). */
export const PRIVATE_POI_IDS: ReadonlySet<string> = new Set(['home', 'here']);
/** The names those POIs carry into ride history (routeHistory.ts). */
export const PRIVATE_PLACE_NAMES: ReadonlySet<string> = new Set(['home', 'here']);
/** Any endpoint this close to a saved home or GPS fix counts as private. */
export const PRIVATE_RADIUS_M = 400;
/** A stand-in further than this from the private point is a different ride: not shareable. */
export const NEUTRAL_MAX_M = 3000;
/** Stand-ins this close to the other endpoint would make a zero-length ride. */
const MIN_ENDPOINT_GAP_M = 60;

export type TravelParam = 'car' | 'boat' | 'transit';

/** `?travel=` value the ride's share-link reader accepts (`bike` is the street mode, `car` internally). */
export function travelParam(travelMode: string | null | undefined): TravelParam {
  if (travelMode === 'boat') return 'boat';
  if (travelMode === 'transit') return 'transit';
  return 'car';
}

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isLatLng = (p: unknown): p is LatLng => !!p && finite((p as LatLng).lat) && finite((p as LatLng).lng);

export function metresBetween(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isPrivatePoi(poi: Partial<SharePoi> | null | undefined): boolean {
  if (!poi) return false;
  if (typeof poi.id === 'string' && PRIVATE_POI_IDS.has(poi.id)) return true;
  return typeof poi.name === 'string' && PRIVATE_PLACE_NAMES.has(poi.name.trim().toLowerCase());
}

export function nearPrivatePlace(point: LatLng, privatePlaces: readonly unknown[], radiusM = PRIVATE_RADIUS_M): boolean {
  return privatePlaces.some(place => isLatLng(place) && metresBetween(point, place) <= radiusM);
}

/** Saved home geocodes (`canalRecall.homeGeocodes.v2`: `{ [address]: { lat, lng, … } }`) as points. */
export function privatePlacesFromHomeCache(raw: string | null | undefined): LatLng[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return [];
    return Object.values(parsed as Record<string, unknown>)
      .filter(isLatLng)
      .map(p => ({ lat: p.lat, lng: p.lng }));
  } catch {
    return [];
  }
}

/** The nearest public destination to `point`, or null when none is within {@link NEUTRAL_MAX_M}. */
export function neutralStandIn(
  point: LatLng,
  pois: readonly SharePoi[],
  { avoid = null, maxM = NEUTRAL_MAX_M }: { avoid?: LatLng | null; maxM?: number } = {},
): SharePoi | null {
  let best: SharePoi | null = null;
  let bestM = Infinity;
  for (const poi of pois) {
    if (!isLatLng(poi) || isPrivatePoi(poi) || !poi.name) continue;
    if (avoid && metresBetween(poi, avoid) < MIN_ENDPOINT_GAP_M) continue;
    const m = metresBetween(point, poi);
    if (m < bestM) { best = poi; bestM = m; }
  }
  return best && bestM <= maxM ? best : null;
}

export interface RaceHash { centre: LatLng; start: LatLng; finish: LatLng }

/** Reads `#race=lat,lng,startLat,startLng,finishLat,finishLng` out of a URL or hash. */
export function parseRaceHash(urlOrHash: string | null | undefined): RaceHash | null {
  if (!urlOrHash) return null;
  const at = urlOrHash.indexOf('#race=');
  if (at < 0) return null;
  const parts = urlOrHash.slice(at + 6).split(',').map(Number);
  if (parts.length !== 6 || parts.some(n => !Number.isFinite(n))) return null;
  const [lat, lng, startLat, startLng, finishLat, finishLng] = parts;
  return { centre: { lat, lng }, start: { lat: startLat, lng: startLng }, finish: { lat: finishLat, lng: finishLng } };
}

const f4 = (n: number) => n.toFixed(4);
export function formatRaceHash({ centre, start, finish }: RaceHash): string {
  return `#race=${f4(centre.lat)},${f4(centre.lng)},${f4(start.lat)},${f4(start.lng)},${f4(finish.lat)},${f4(finish.lng)}`;
}

const midpoint = (a: LatLng, b: LatLng): LatLng => ({ lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 });

export interface ShareRouteInput {
  /** `location.origin` + the ride's path (`/ride` on the site, `/canal-drive/` in dev). */
  origin: string;
  pathname: string;
  travelMode?: string | null;
  /** A tour in progress shares as `?tour=<id>`. */
  tourId?: string | null;
  /** The ride's replay hash (its `_shareUrl`), holding the centre, start and finish it booted with. */
  race: RaceHash | null;
  /** The ride's routeFrom / routeTo; only their ids and names are trusted (they go stale on a share-link boot). */
  from?: Partial<SharePoi> | null;
  to?: Partial<SharePoi> | null;
  /** Public route destinations to draw a neutral stand-in from. */
  publicPois?: readonly SharePoi[];
  /** Saved home geocodes and GPS fixes. */
  privatePlaces?: readonly unknown[];
}

export interface RouteShare {
  url: string;
  title: string;
  text: string;
  /** True when a private start or finish was replaced by a public stand-in. */
  neutralised: boolean;
}

const MODE_WORDS: Record<TravelParam, string> = { car: 'by bike', boat: 'by boat', transit: 'by tram and metro' };
const NAME_TRUST_M = 60;

/** The link that boots this ride for someone else, or null when it cannot be shared safely. */
export function buildRouteShare(input: ShareRouteInput): RouteShare | null {
  const base = `${input.origin}${input.pathname}`;
  const mode = travelParam(input.travelMode);
  if (input.tourId) {
    return {
      url: `${base}?tour=${encodeURIComponent(input.tourId)}`,
      title: 'Ride Amsterdam tour',
      text: 'Ride this Amsterdam tour with me in Ride Amsterdam.',
      neutralised: false,
    };
  }
  const race = input.race;
  if (!race || !isLatLng(race.start) || !isLatLng(race.finish)) return null;
  const privatePlaces = input.privatePlaces ?? [];
  const pois = input.publicPois ?? [];

  const resolve = (point: LatLng, poi: Partial<SharePoi> | null | undefined, other: LatLng) => {
    const isPrivate = isPrivatePoi(poi) || nearPrivatePlace(point, privatePlaces);
    if (!isPrivate) {
      const name = poi?.name;
      const trusted = isLatLng(poi) && metresBetween(poi, point) <= NAME_TRUST_M ? name : undefined;
      return { point, name: trusted, swapped: false };
    }
    const standIn = neutralStandIn(point, pois, { avoid: other });
    // The stand-in itself must not sit on a private point either.
    if (!standIn || nearPrivatePlace(standIn, privatePlaces, MIN_ENDPOINT_GAP_M)) return null;
    return { point: { lat: standIn.lat, lng: standIn.lng }, name: standIn.name, swapped: true };
  };

  const finish = resolve(race.finish, input.to, race.start);
  if (!finish) return null;
  const start = resolve(race.start, input.from, finish.point);
  if (!start) return null;
  const neutralised = start.swapped || finish.swapped;
  // The ride's centre is the midpoint of what it booted with, so a kept centre would
  // point back at a private endpoint; a neutralised route gets its own.
  const centre = neutralised || !isLatLng(race.centre) ? midpoint(start.point, finish.point) : race.centre;
  const hash = formatRaceHash({ centre, start: start.point, finish: finish.point });
  const route = start.name && finish.name ? ` from ${start.name} to ${finish.name}` : '';
  return {
    url: `${base}?travel=${mode}${hash}`,
    title: 'Ride Amsterdam route',
    text: `Ride${route} ${MODE_WORDS[mode]} in Ride Amsterdam and learn the streets and canals on the way.`,
    neutralised,
  };
}

/** A ride-history record, as far as sharing needs it (routeHistory.ts). */
export interface ShareableRecord {
  mode: 'boat' | 'bike' | 'transit';
  raceHash: string;
  start: { name: string; lngLat: [number, number] };
  finish: { name: string; lngLat: [number, number] };
}

/**
 * The shared link for a ride on My progress, or null. The page has no route
 * catalogue to draw a stand-in from, so a ride that started or ended at Home or
 * Here (by name, or near a saved home) is simply not offered for sharing.
 */
export function shareRecordUrl(record: ShareableRecord, origin: string, rideHref: string, privatePlaces: readonly unknown[] = []): string | null {
  const race = parseRaceHash(record.raceHash);
  if (!race) return null;
  if (isPrivatePoi({ name: record.start.name }) || isPrivatePoi({ name: record.finish.name })) return null;
  const ends = [race.start, race.finish,
    { lat: record.start.lngLat[1], lng: record.start.lngLat[0] },
    { lat: record.finish.lngLat[1], lng: record.finish.lngLat[0] }];
  if (ends.some(point => nearPrivatePlace(point, privatePlaces))) return null;
  const mode = record.mode === 'bike' ? 'car' : record.mode;
  return `${origin}${rideHref}?travel=${mode}${formatRaceHash(race)}`;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface ShareEnv {
  share?: (data: { title?: string; text?: string; url: string }) => Promise<void>;
  canShare?: (data: { url: string }) => boolean;
  clipboard?: { writeText(text: string): Promise<void> } | null;
}

/** The system share sheet where there is one, otherwise the clipboard. */
export async function shareOrCopy(payload: { url: string; title?: string; text?: string }, env: ShareEnv): Promise<ShareOutcome> {
  const canShare = typeof env.share === 'function' && (typeof env.canShare !== 'function' || env.canShare({ url: payload.url }));
  if (canShare) {
    try {
      await env.share!({ title: payload.title, text: payload.text, url: payload.url });
      return 'shared';
    } catch (error) {
      // The rider closed the sheet: do not also copy behind their back.
      if (error && (error as { name?: string }).name === 'AbortError') return 'cancelled';
      // NotAllowedError (no user activation) and the like fall through to copying.
    }
  }
  if (env.clipboard && typeof env.clipboard.writeText === 'function') {
    try {
      await env.clipboard.writeText(payload.url);
      return 'copied';
    } catch { /* blocked clipboard */ }
  }
  return 'failed';
}

/** The toast line for each outcome; '' for a share sheet the rider has already seen. */
export function shareToastText(outcome: ShareOutcome): string {
  if (outcome === 'copied') return 'Link copied';
  if (outcome === 'failed') return 'Could not copy the link';
  return '';
}
