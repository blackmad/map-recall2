// Resolve hand-written tour stops to coordinates from the cached Amsterdam
// extracts. Shared by build-tours.ts (writes tours.json) and check-tours.ts.
//
// Resolution order, by what the stop names:
//   landmarkId  -> landmarks.json feature centre (must exist)
//   osm         -> click-poi-info.json point by OSM id (an OSM-derived extract)
//   orientation -> orientation-pois.json by exact name (nearest to `near` if several)
//   street      -> streets-routing.json way of that name, nearest point to `near`
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { LngLat, Tour, TourStop } from '../../src/canalRecall/game/tourRoute.ts';
import { legKm } from '../../src/canalRecall/game/tourRoute.ts';

export interface SourceStop extends Omit<TourStop, 'lngLat'> {
  lngLat?: LngLat;
  orientation?: string;
  street?: string;
  near?: LngLat;
}
export interface SourceTour extends Omit<Tour, 'stops'> { stops: SourceStop[] }
export interface SourceFile { version: number; city: string; note?: string; tours: SourceTour[] }

export interface Resolution { stop: TourStop; via: string; detail: string }

const EXTRACT = path.resolve('public/data/extracts/amsterdam');
const readJson = <T>(name: string): T => JSON.parse(readFileSync(path.join(EXTRACT, name), 'utf8')) as T;

type Landmark = { id: string; name: string; center: [number, number] };
type ClickPoint = [string, string, number, number, ...unknown[]];
type OrientationPoi = [string, number, number, ...unknown[]];
type RoutingWay = { name?: string; path?: [number, number][]; paths?: [number, number][][] };

let cache: {
  landmarks: Map<string, Landmark>;
  clicks: Map<string, ClickPoint>;
  orientation: OrientationPoi[];
  routing: RoutingWay[] | null;
} | null = null;

function data() {
  if (!cache) {
    const landmarks = readJson<Landmark[]>('landmarks.json');
    const clicks = readJson<{ points: ClickPoint[] }>('click-poi-info.json').points;
    cache = {
      landmarks: new Map(landmarks.map(l => [l.id, l])),
      clicks: new Map(clicks.map(p => [p[0], p])),
      orientation: readJson<{ pois: OrientationPoi[] }>('orientation-pois.json').pois,
      routing: null,
    };
  }
  return cache;
}

export function routingWays(): RoutingWay[] {
  const d = data();
  if (!d.routing) d.routing = readJson<RoutingWay[]>('streets-routing.json');
  return d.routing;
}

/** 'node/123' -> 'n123' (the click-poi-info id form). */
const clickId = (osm: string): string => {
  const [kind, id] = osm.split('/');
  return `${({ node: 'n', way: 'w', relation: 'r' } as Record<string, string>)[kind] ?? '?'}${id}`;
};

const round = (v: number) => Math.round(v * 1e6) / 1e6;

export function resolveStop(stop: SourceStop): Resolution {
  const { orientation, street, near, ...rest } = stop;
  const d = data();
  let lngLat: LngLat | null = null;
  let via = '';
  let detail = '';
  if (stop.landmarkId) {
    const landmark = d.landmarks.get(stop.landmarkId);
    if (!landmark) throw new Error(`${stop.name}: landmark ${stop.landmarkId} not in landmarks.json`);
    lngLat = [landmark.center[1], landmark.center[0]];
    via = 'landmark';
    detail = landmark.name;
  } else if (stop.osm) {
    const point = d.clicks.get(clickId(stop.osm));
    if (!point) throw new Error(`${stop.name}: ${stop.osm} not in click-poi-info.json`);
    lngLat = [point[2], point[3]];
    via = 'osm';
    detail = `${point[1]}${point[6] ? `, ${point[6]}` : ''}`;
  } else if (orientation) {
    const matches = d.orientation.filter(p => p[0] === orientation);
    if (!matches.length) throw new Error(`${stop.name}: no orientation POI named ${orientation}`);
    const best = near ? matches.sort((a, b) => legKm([a[1], a[2]], near) - legKm([b[1], b[2]], near))[0] : matches[0];
    if (matches.length > 1 && !near) throw new Error(`${stop.name}: ${matches.length} orientation POIs named ${orientation}; give near`);
    lngLat = [best[1], best[2]];
    via = 'orientation';
    detail = best[0];
  } else if (street) {
    if (!near) throw new Error(`${stop.name}: a street stop needs near`);
    let best: { at: LngLat; km: number } | null = null;
    for (const way of routingWays()) {
      if (way.name !== street) continue;
      for (const line of way.paths || (way.path ? [way.path] : [])) {
        for (const [lat, lng] of line) {
          const km = legKm([lng, lat], near);
          if (!best || km < best.km) best = { at: [lng, lat], km };
        }
      }
    }
    if (!best || best.km > 0.15) throw new Error(`${stop.name}: no ${street} vertex within 150 m of near`);
    lngLat = best.at;
    via = 'street';
    detail = `${street} (${Math.round(best.km * 1000)} m from hint)`;
  }
  if (!lngLat) throw new Error(`${stop.name}: no resolver (landmarkId, osm, orientation or street)`);
  return { stop: { ...rest, lngLat: [round(lngLat[0]), round(lngLat[1])] }, via, detail };
}

export function readSource(): SourceFile {
  return JSON.parse(readFileSync(path.resolve('scripts/tours/amsterdam-tours.json'), 'utf8')) as SourceFile;
}

export function resolveTours(source: SourceFile): { tours: Tour[]; resolutions: Resolution[][] } {
  const resolutions = source.tours.map(tour => tour.stops.map(resolveStop));
  const tours = source.tours.map((tour, i): Tour => ({ ...tour, stops: resolutions[i].map(r => r.stop) }));
  return { tours, resolutions };
}
