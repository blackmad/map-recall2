/**
 * Adapt a GTFS-derived transit network into street-like corridors the existing
 * RoadNetwork / road-constrain path can drive.
 *
 * Stops are quiz triggers along a corridor, not separate edges in v1.
 */
import type { TransitLine, TransitMode, TransitNetwork, TransitStop } from './network.ts';

/** Phase C thin slice — one central tram corridor before unlocking the full GVB set. */
export const TRANSIT_THIN_SLICE_REFS = ['2'] as const;

export interface TransitWay {
  id: string;
  nodes: Array<{ lat: number; lon: number }>;
  tags: { name: string; highway: string };
  highway: string;
}

export interface TransitStopFeature {
  stopId: string;
  /** Quiz / mastery display name (city prefix stripped). */
  name: string;
  /** Raw GTFS stop_name. */
  rawName: string;
  center: [number, number];
  lineRefs: string[];
  modes: TransitMode[];
}

export interface TransitLineFeature {
  routeId: string;
  ref: string;
  /** e.g. "Tram 2" — corridor name on the map and in line quizzes. */
  name: string;
  mode: TransitMode;
  headsign: string;
  color: string | null;
  stopIds: string[];
  center: [number, number];
}

export interface TransitPlayLoad {
  ways: TransitWay[];
  /** Corridor feature meta keyed by display name ("Tram 2"). */
  featureMeta: Map<string, {
    name: string;
    type: 'line';
    cityId: string;
    center: [number, number];
    ref: string;
    mode: TransitMode;
    color: string | null;
  }>;
  stops: TransitStopFeature[];
  lines: TransitLineFeature[];
  /** Distractor pool: all line display names in the extract (not only thin slice). */
  lineDistractors: string[];
  /** Distractor pool: stop display names on other lines. */
  stopDistractors: string[];
}

const MODE_LABEL: Record<TransitMode, string> = {
  tram: 'Tram',
  metro: 'Metro',
  ferry: 'Ferry',
};

/** "Amsterdam, Dam" → "Dam" for friendlier GVB-style quizzes. */
export function displayStopName(rawName: string): string {
  return rawName.replace(/^Amsterdam,\s*/i, '').trim() || rawName;
}

export function lineDisplayName(mode: TransitMode, ref: string): string {
  return `${MODE_LABEL[mode]} ${ref}`;
}

export function lineCentroid(path: [number, number][] | null, stops: readonly TransitStop[]): [number, number] {
  if (path && path.length > 0) {
    const mid = path[Math.floor(path.length / 2)];
    return [mid[0], mid[1]];
  }
  const withCenter = stops.filter((s) => s.center);
  if (withCenter.length === 0) return [52.37, 4.89];
  const lat = withCenter.reduce((sum, s) => sum + (s.center as [number, number])[0], 0) / withCenter.length;
  const lon = withCenter.reduce((sum, s) => sum + (s.center as [number, number])[1], 0) / withCenter.length;
  return [lat, lon];
}

export function highwayForMode(mode: TransitMode): string {
  return mode;
}

export interface AdaptOptions {
  /** Line refs to make driveable. Default: thin-slice tram 2. Empty = all lines. */
  playableRefs?: readonly string[];
  cityId?: string;
}

/**
 * Build driveable ways + quiz sidecar from a transit-network.json payload.
 */
export function adaptTransitNetwork(
  network: TransitNetwork,
  options: AdaptOptions = {},
): TransitPlayLoad {
  const cityId = options.cityId || network.cityId || 'amsterdam';
  const playable = options.playableRefs === undefined
    ? new Set<string>(TRANSIT_THIN_SLICE_REFS)
    : options.playableRefs.length === 0
      ? null
      : new Set(options.playableRefs);

  const allLines: TransitLineFeature[] = [];
  const ways: TransitWay[] = [];
  const featureMeta = new Map<string, TransitPlayLoad['featureMeta'] extends Map<string, infer V> ? V : never>();
  const stopLineRefs = new Map<string, Set<string>>();
  const stopModes = new Map<string, Set<TransitMode>>();

  for (const line of network.lines) {
    const name = lineDisplayName(line.mode, line.ref);
    const stops = line.stopIds
      .map((id) => network.stops[id])
      .filter((s): s is TransitStop => !!s);
    const center = lineCentroid(line.path, stops);
    allLines.push({
      routeId: line.routeId,
      ref: line.ref,
      name,
      mode: line.mode,
      headsign: line.headsign,
      color: line.color,
      stopIds: [...line.stopIds],
      center,
    });

    for (const stopId of line.stopIds) {
      if (!stopLineRefs.has(stopId)) stopLineRefs.set(stopId, new Set());
      stopLineRefs.get(stopId)!.add(line.ref);
      if (!stopModes.has(stopId)) stopModes.set(stopId, new Set());
      stopModes.get(stopId)!.add(line.mode);
    }

    const include = !playable || playable.has(line.ref);
    if (!include || !line.path || line.path.length < 2) continue;

    featureMeta.set(name, {
      name,
      type: 'line',
      cityId,
      center,
      ref: line.ref,
      mode: line.mode,
      color: line.color,
    });

    ways.push({
      id: `transit:${line.routeId}`,
      nodes: line.path.map(([lat, lon]) => ({ lat, lon })),
      tags: { name, highway: highwayForMode(line.mode) },
      highway: highwayForMode(line.mode),
    });
  }

  const playableStopIds = new Set<string>();
  for (const line of network.lines) {
    if (playable && !playable.has(line.ref)) continue;
    for (const id of line.stopIds) playableStopIds.add(id);
  }

  const stops: TransitStopFeature[] = [];
  for (const [stopId, stop] of Object.entries(network.stops)) {
    if (!stop.center) continue;
    if (playable && !playableStopIds.has(stopId)) continue;
    stops.push({
      stopId,
      name: displayStopName(stop.name),
      rawName: stop.name,
      center: stop.center,
      lineRefs: [...(stopLineRefs.get(stopId) || [])],
      modes: [...(stopModes.get(stopId) || [])],
    });
  }

  const lineDistractors = [...new Set(allLines.map((l) => l.name))];
  const stopDistractors = [...new Set(
    Object.values(network.stops)
      .filter((s) => s.center)
      .map((s) => displayStopName(s.name)),
  )];

  return {
    ways,
    featureMeta,
    stops,
    lines: allLines.filter((l) => !playable || playable.has(l.ref)),
    lineDistractors,
    stopDistractors,
  };
}

/** Curated surprise anchors for the thin slice (tram 2). */
export function transitRouteAnchors(load: TransitPlayLoad): Array<{
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'stop';
}> {
  const prefer = ['Centraal Station', 'Dam', 'Leidseplein', 'Museumplein', 'Oudenaardeplantsoen'];
  const byName = new Map(load.stops.map((s) => [s.name, s]));
  const anchors: Array<{ id: string; name: string; lat: number; lng: number; type: 'stop' }> = [];
  for (const label of prefer) {
    const stop = byName.get(label);
    if (!stop) continue;
    anchors.push({
      id: `stop-${stop.stopId}`,
      name: stop.name,
      lat: stop.center[0],
      lng: stop.center[1],
      type: 'stop',
    });
  }
  // Enough mid-line stops to retarget when an end is unreachable.
  if (anchors.length < 4) {
    for (const stop of load.stops) {
      if (anchors.some((a) => a.id === `stop-${stop.stopId}`)) continue;
      anchors.push({
        id: `stop-${stop.stopId}`,
        name: stop.name,
        lat: stop.center[0],
        lng: stop.center[1],
        type: 'stop',
      });
      if (anchors.length >= 8) break;
    }
  }
  return anchors;
}
