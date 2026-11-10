/**
 * Cul-de-sac ends of the cycling graph, and what OSM has beyond them.
 *
 * Lane D2 (#322, 2026-11-09). The graph is built the way the game builds its
 * routing graph (`RoadNetwork._routingGraph`): every path vertex snaps to an
 * 18 px (6 m) grid cell and consecutive vertices become edges. A dead end is a
 * node with exactly one distinct neighbour. Motor-only ways are dropped first,
 * as the loader does.
 *
 * Each dead end is then classed by the OSM ways the extract left out that pass
 * within `reachMeters` of it: rideable footway/path, steps, foot-only
 * footway/path, other highway, or nothing at all.
 */
import { isMotorOnlyHighway, isRideablePathAdmission, motorOnlyNames } from './bikeAccess.ts';

export type LatLon = [number, number];
export type Tags = Readonly<Record<string, string | undefined>>;

export interface RoutingFeatureLike {
  id: string;
  name?: string;
  highway?: string;
  path?: LatLon[];
  paths?: LatLon[][];
}

export interface OsmWay {
  id: string;
  tags: Tags;
  line: LatLon[];
}

export type DeadEndClass = 'rideable' | 'service-aisle' | 'pedestrian-area' | 'steps' | 'foot-only' | 'other-highway' | 'none';

export interface DeadEnd {
  at: LatLon;
  featureId: string;
  klass: DeadEndClass;
  /** OSM ids of the dropped ways that decided the class. */
  ways: string[];
}

const CENTRE: LatLon = [52.372851, 4.8936];
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos(CENTRE[0] * Math.PI / 180);
/** `RoadNetwork._routingGraph` merges at 18 px; the game draws 3 px per metre. */
export const MERGE_METERS = 6;
/** `JUNCTION_STITCH_RADIUS` (10 px): an end this close to another way is joined to it. */
export const STITCH_METERS = 10 / 3;

export const toXY = ([lat, lon]: LatLon): [number, number] => [
  (lon - CENTRE[1]) * M_PER_DEG_LON,
  (lat - CENTRE[0]) * M_PER_DEG_LAT,
];

export function featureLines(feature: RoutingFeatureLike): LatLon[][] {
  return (feature.paths ?? (feature.path ? [feature.path] : [])).filter((line) => line && line.length >= 2);
}

/** The ways the game loads for a bike: motorways, trunk roads and mostly-motor names removed. */
export function bikeLoadedFeatures<T extends RoutingFeatureLike>(features: readonly T[]): T[] {
  const motorNames = motorOnlyNames(features as Parameters<typeof motorOnlyNames>[0]);
  return features.filter((feature) => !isMotorOnlyHighway(feature.highway)
    && !(feature.name !== undefined && motorNames.has(feature.name)));
}

interface GraphNode { key: string; at: LatLon; neighbours: Set<string>; endpointOf: string[] }

export function graphNodes(features: readonly RoutingFeatureLike[], mergeMeters = MERGE_METERS): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>();
  const nodeAt = (point: LatLon): GraphNode => {
    const [x, y] = toXY(point);
    const key = `${Math.round(x / mergeMeters)},${Math.round(y / mergeMeters)}`;
    let node = nodes.get(key);
    if (!node) { node = { key, at: point, neighbours: new Set(), endpointOf: [] }; nodes.set(key, node); }
    return node;
  };
  for (const feature of features) {
    for (const line of featureLines(feature)) {
      const first = line[0], last = line[line.length - 1];
      // Closed rings are skipped by the loader (osm-loader / reachability).
      if (line.length > 3 && first[0] === last[0] && first[1] === last[1]) continue;
      let previous = nodeAt(line[0]);
      previous.endpointOf.push(feature.id);
      for (let i = 1; i < line.length; i++) {
        const node = nodeAt(line[i]);
        if (node !== previous) { previous.neighbours.add(node.key); node.neighbours.add(previous.key); }
        previous = node;
      }
      previous.endpointOf.push(feature.id);
    }
  }
  return nodes;
}

/**
 * Nodes with exactly one neighbour that are a path's end and that no other
 * way passes within the stitch radius of (the game joins those).
 */
export function deadEndNodes(features: readonly RoutingFeatureLike[]): Array<{ at: LatLon; featureId: string }> {
  const lines: OsmWay[] = features.flatMap((feature) => featureLines(feature).map((line) => ({ id: feature.id, tags: {}, line })));
  const index = new SegmentIndex(lines);
  const out: Array<{ at: LatLon; featureId: string }> = [];
  for (const node of graphNodes(features).values()) {
    if (node.neighbours.size !== 1 || !node.endpointOf.length) continue;
    const owner = node.endpointOf[0];
    if (index.near(node.at, STITCH_METERS).some((way) => way.id !== owner)) continue;
    out.push({ at: node.at, featureId: owner });
  }
  return out;
}

/**
 * Whether the routing graph already carries an OSM way: at least 80 % of its
 * vertices lie within `meters` of routing geometry (the extract simplifies at
 * 3 m, and carries no OSM ids, so presence is geometric).
 */
export function isCarried(index: SegmentIndex, line: readonly LatLon[], meters = 3.5): boolean {
  let hits = 0;
  for (const point of line) if (index.near(point, meters).length) hits++;
  return hits >= 0.8 * line.length;
}

export function routingIndex(features: readonly RoutingFeatureLike[]): SegmentIndex {
  return new SegmentIndex(features.flatMap((feature) => featureLines(feature).map((line) => ({ id: feature.id, tags: {}, line }))));
}

const PRIVATE_ACCESS = new Set(['no', 'private']);
/** Service ways (parking aisles, driveways, courtyards) the bike graph admits: any not marked private. */
export function isAdmittedServiceWay(tags: Tags): boolean {
  return tags.highway === 'service' && !PRIVATE_ACCESS.has(tags.access || '') && !PRIVATE_ACCESS.has(tags.bicycle || '')
    && tags.area !== 'yes';
}
/** A pedestrian square drawn as an area (`highway=pedestrian` + `area=yes`, or a closed polygon). */
export function isPedestrianArea(tags: Tags, closed: boolean): boolean {
  return tags.highway === 'pedestrian' && (tags.area === 'yes' || closed);
}

function pointSegmentMeters(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** A coarse grid over way segments for near-point queries. */
export class SegmentIndex {
  private cells = new Map<string, Array<{ way: number; a: [number, number]; b: [number, number] }>>();
  constructor(readonly ways: readonly OsmWay[], private cell = 25) {
    ways.forEach((way, index) => {
      const xy = way.line.map(toXY);
      for (let i = 1; i < xy.length; i++) {
        const a = xy[i - 1], b = xy[i];
        for (let gx = Math.floor(Math.min(a[0], b[0]) / cell); gx <= Math.floor(Math.max(a[0], b[0]) / cell); gx++) {
          for (let gy = Math.floor(Math.min(a[1], b[1]) / cell); gy <= Math.floor(Math.max(a[1], b[1]) / cell); gy++) {
            const key = `${gx},${gy}`;
            (this.cells.get(key) ?? this.cells.set(key, []).get(key)!).push({ way: index, a, b });
          }
        }
      }
    });
  }
  near(point: LatLon, meters: number): OsmWay[] {
    const p = toXY(point);
    const found = new Set<number>();
    for (let gx = Math.floor((p[0] - meters) / this.cell); gx <= Math.floor((p[0] + meters) / this.cell); gx++) {
      for (let gy = Math.floor((p[1] - meters) / this.cell); gy <= Math.floor((p[1] + meters) / this.cell); gy++) {
        for (const entry of this.cells.get(`${gx},${gy}`) ?? []) {
          if (!found.has(entry.way) && pointSegmentMeters(p, entry.a, entry.b) <= meters) found.add(entry.way);
        }
      }
    }
    return [...found].map((index) => this.ways[index]);
  }
}

const FOOT_HIGHWAYS = new Set(['footway', 'path']);

/** The class of a dead end, from the dropped ways that meet it. Rideable wins over steps over foot-only. */
export function classifyDeadEnd(dropped: readonly OsmWay[]): { klass: DeadEndClass; ways: string[] } {
  const pick = (test: (way: OsmWay) => boolean, klass: DeadEndClass) => {
    const ways = dropped.filter(test).map((way) => way.id);
    return ways.length ? { klass, ways } : null;
  };
  const closed = (way: OsmWay) => way.line.length > 3 && way.line[0][0] === way.line[way.line.length - 1][0]
    && way.line[0][1] === way.line[way.line.length - 1][1];
  return pick((way) => isRideablePathAdmission(way.tags), 'rideable')
    ?? pick((way) => isAdmittedServiceWay(way.tags), 'service-aisle')
    ?? pick((way) => isPedestrianArea(way.tags, closed(way)), 'pedestrian-area')
    ?? pick((way) => way.tags.highway === 'steps', 'steps')
    ?? pick((way) => FOOT_HIGHWAYS.has(way.tags.highway || ''), 'foot-only')
    ?? pick(() => true, 'other-highway')
    ?? { klass: 'none', ways: [] };
}

export function classifyDeadEnds(
  features: readonly RoutingFeatureLike[],
  dropped: readonly OsmWay[],
  reachMeters = 2,
): DeadEnd[] {
  const index = new SegmentIndex(dropped);
  return deadEndNodes(bikeLoadedFeatures(features)).map(({ at, featureId }) => ({
    at, featureId, ...classifyDeadEnd(index.near(at, reachMeters)),
  }));
}
