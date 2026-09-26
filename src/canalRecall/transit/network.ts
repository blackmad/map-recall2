/**
 * Amsterdam transit network derived from OVapi GTFS (GVB tram / metro / ferry).
 * Built by `scripts/build-amsterdam-transit-gtfs.ts`.
 */

export const TRANSIT_MODES = ['tram', 'metro', 'ferry'] as const;
export type TransitMode = (typeof TRANSIT_MODES)[number];

/** GTFS route_type → game mode. Bus (3) is deferred. */
export const GTFS_ROUTE_TYPE_TO_MODE: Readonly<Record<string, TransitMode>> = {
  '0': 'tram',
  '1': 'metro',
  '4': 'ferry',
};

export interface TransitStop {
  stopId: string;
  name: string;
  /** `[lat, lng]` — same order as canal / street extracts. */
  center: [number, number] | null;
  parentStation: string | null;
  inAmsterdamBbox: boolean;
}

export interface TransitLine {
  routeId: string;
  ref: string;
  name: string;
  mode: TransitMode;
  color: string | null;
  textColor: string | null;
  tripId: string;
  headsign: string;
  directionId: string;
  stopIds: string[];
  /** Shape polyline as `[lat, lng][]`, or null if the trip had no shape. */
  path: [number, number][] | null;
}

export interface TransitNetworkCounts {
  lines: number;
  byMode: Record<TransitMode, number>;
  stops: number;
  stopsInAmsterdamBbox: number;
  linesWithPath: number;
  linesWithStops: number;
}

export interface TransitNetwork {
  cityId: 'amsterdam';
  source: string;
  feed: string;
  generatedNote: string;
  counts: TransitNetworkCounts;
  lines: TransitLine[];
  stops: Record<string, TransitStop>;
}

export const OVAPI_GTFS_NL_URL = 'https://gtfs.ovapi.nl/nl/gtfs-nl.zip';
export const GVB_AGENCY_ID = 'GVB';

/** Loose Amsterdam play bbox (lng west/east, lat south/north). */
export const AMSTERDAM_BBOX = {
  west: 4.72,
  south: 52.27,
  east: 5.08,
  north: 52.43,
} as const;

export function inAmsterdamBbox(lat: number, lon: number): boolean {
  return (
    lat >= AMSTERDAM_BBOX.south
    && lat <= AMSTERDAM_BBOX.north
    && lon >= AMSTERDAM_BBOX.west
    && lon <= AMSTERDAM_BBOX.east
  );
}

export function emptyModeCounts(): Record<TransitMode, number> {
  return { tram: 0, metro: 0, ferry: 0 };
}

export function summarizeTransitNetwork(
  lines: readonly TransitLine[],
  stops: Readonly<Record<string, TransitStop>>,
): TransitNetworkCounts {
  const byMode = emptyModeCounts();
  for (const line of lines) byMode[line.mode] += 1;
  return {
    lines: lines.length,
    byMode,
    stops: Object.keys(stops).length,
    stopsInAmsterdamBbox: Object.values(stops).filter((s) => s.inAmsterdamBbox).length,
    linesWithPath: lines.filter((l) => l.path && l.path.length > 0).length,
    linesWithStops: lines.filter((l) => l.stopIds.length > 0).length,
  };
}
