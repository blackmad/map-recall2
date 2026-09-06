/**
 * Adapt a GTFS-derived transit network into street-like corridors the existing
 * RoadNetwork / road-constrain path can drive.
 *
 * Stops are quiz triggers along a corridor, not separate edges in v1.
 */
import type { TransitLine, TransitMode, TransitNetwork, TransitStop } from './network.ts';

/** Phase C thin slice — one central tram corridor before unlocking the full GVB set. */
export const TRANSIT_THIN_SLICE_REFS = ['2'] as const;

/**
 * Phase D driveable surface: tram + metro. Ferries stay out until their short
 * water hops get a dedicated playtest. Combine with `playableRefs: []` so every
 * matching line is driveable.
 */
export const TRANSIT_DRIVEABLE_MODES: readonly TransitMode[] = ['tram', 'metro'];

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
  /** Line refs to make driveable. Default: thin-slice tram 2. Empty = all refs. */
  playableRefs?: readonly string[];
  /** When set, only these modes become driveable ways (refs still apply). */
  playableModes?: readonly TransitMode[];
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
  const modes = options.playableModes?.length
    ? new Set<TransitMode>(options.playableModes)
    : null;

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

    const includeRef = !playable || playable.has(line.ref);
    const includeMode = !modes || modes.has(line.mode);
    if (!includeRef || !includeMode || !line.path || line.path.length < 2) continue;

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
    const includeRef = !playable || playable.has(line.ref);
    const includeMode = !modes || modes.has(line.mode);
    if (!includeRef || !includeMode) continue;
    for (const id of line.stopIds) playableStopIds.add(id);
  }

  const stops: TransitStopFeature[] = [];
  for (const [stopId, stop] of Object.entries(network.stops)) {
    if (!stop.center) continue;
    if ((playable || modes) && !playableStopIds.has(stopId)) continue;
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

  const driveableLines = allLines.filter((l) => {
    const includeRef = !playable || playable.has(l.ref);
    const includeMode = !modes || modes.has(l.mode);
    return includeRef && includeMode;
  });

  return {
    ways,
    featureMeta,
    stops,
    lines: driveableLines,
    lineDistractors,
    stopDistractors,
  };
}

export type TransitRouteAnchor = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'stop';
};

const PREFERRED_TRANSIT_ANCHORS = [
  'Centraal Station',
  'Dam',
  'Leidseplein',
  'Museumplein',
  'Oudenaardeplantsoen',
  'Station Zuid',
  'Station Sloterdijk',
  'Noord',
  'Amstelstation',
  'Waterlooplein',
  'Isolatorweg',
  'Gein',
  'Gaasperplas',
] as const;

function pushAnchor(
  anchors: TransitRouteAnchor[],
  seen: Set<string>,
  stop: TransitStopFeature,
): void {
  const id = `stop-${stop.stopId}`;
  if (seen.has(id) || seen.has(stop.name)) return;
  seen.add(id);
  seen.add(stop.name);
  anchors.push({
    id,
    name: stop.name,
    lat: stop.center[0],
    lng: stop.center[1],
    type: 'stop',
  });
}

/**
 * Surprise destinations for Phase D: curated hubs plus every driveable line's
 * termini so metro/tram ends are reachable without a hand list per corridor.
 */
export function transitRouteAnchors(load: TransitPlayLoad): TransitRouteAnchor[] {
  const byId = new Map(load.stops.map((stop) => [stop.stopId, stop]));
  const byName = new Map(load.stops.map((stop) => [stop.name, stop]));
  const anchors: TransitRouteAnchor[] = [];
  const seen = new Set<string>();

  for (const label of PREFERRED_TRANSIT_ANCHORS) {
    const stop = byName.get(label);
    if (stop) pushAnchor(anchors, seen, stop);
  }

  for (const line of load.lines) {
    if (line.stopIds.length < 2) continue;
    const first = byId.get(line.stopIds[0]!);
    const last = byId.get(line.stopIds[line.stopIds.length - 1]!);
    if (first) pushAnchor(anchors, seen, first);
    if (last) pushAnchor(anchors, seen, last);
  }

  // Fill so retarget still has mid-line options when termini snap poorly.
  if (anchors.length < 10) {
    for (const stop of load.stops) {
      pushAnchor(anchors, seen, stop);
      if (anchors.length >= 24) break;
    }
  }
  return anchors;
}
