/**
 * Re-admit the OSM ways a bike may ride that the routing extract dropped
 * (lane D2, #322, 2026-11-09).
 *
 * Two classes, both explicit allowlists:
 *  - `rideable`: `highway=footway|path` with bicycle allowed
 *    (`isRideablePathAdmission`, bikeAccess.ts). The refresh pipeline's osmium
 *    filter for these matched nothing, so only bridge footways were ever in.
 *  - `service`: `highway=service` (parking aisles, driveways, courtyards) that
 *    are not private (`isAdmittedServiceWay`, deadEnds.ts) and that the
 *    published extract does not carry (it predates them, or they were cut off
 *    from the largest component until a rideable path joined them).
 *
 * A candidate is added only when it is not already carried (geometric
 * presence) and it connects, directly or through other candidates, to the
 * routing graph. Its geometry is simplified at 3 m, keeping junction vertices,
 * and rounded to the extract's 1e-6 grid. Where a candidate meets a routing
 * way at an OSM junction that the published (simplified) way no longer has as
 * a vertex, the junction is spliced into that way, so the graph joins there
 * instead of relying on the 3.3 m endpoint stitch.
 */
import { isBikeRoutingHighway, isRideablePathAdmission } from './bikeAccess.ts';
import {
  bikeLoadedFeatures, deadEndNodes, featureLines, isAdmittedServiceWay, isCarried, routingIndex, SegmentIndex, STITCH_METERS, toXY,
  type LatLon, type OsmWay, type RoutingFeatureLike,
} from './deadEnds.ts';

/**
 * Which admission rules built the routing graph. 1: the extract up to
 * 2026-11-09 (no footway or path unless a bridge). 2: the D2 allowlist.
 * Written to `manifest.json` as `routing.graphRevision`. The device graph cache
 * cannot mix graphs either way: its key carries the extract's sha256 and each
 * record the fingerprint of every point and way id (roadWorldCache.ts), so
 * `ROAD_WORLD_CACHE_VERSION` (build-algorithm changes only) stays at 1.
 */
export const ROUTING_GRAPH_REVISION = 2;

export type AdmissionClass = 'rideable' | 'service';

export function admissionClass(tags: OsmWay['tags']): AdmissionClass | null {
  if (isRideablePathAdmission(tags)) return 'rideable';
  if (isAdmittedServiceWay(tags) && isBikeRoutingHighway(tags)) return 'service';
  return null;
}

export interface RoutingFeatureOut extends RoutingFeatureLike {
  name: string;
  type: string;
  cityId: string;
  center: LatLon;
  highway: string;
  path: LatLon[];
  paths?: LatLon[][];
  bridge?: boolean;
}

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
const key6 = ([lat, lon]: LatLon) => `${round6(lat)},${round6(lon)}`;
const metres = (a: LatLon, b: LatLon) => {
  const [ax, ay] = toXY(a), [bx, by] = toXY(b);
  return Math.hypot(ax - bx, ay - by);
};

function simplifyKeeping(points: LatLon[], keep: (point: LatLon) => boolean, tolerance = 3): LatLon[] {
  const out: LatLon[] = [points[0]];
  let start = 0;
  const dp = (run: LatLon[]): LatLon[] => {
    if (run.length <= 2) return run;
    const a = toXY(run[0]), b = toXY(run[run.length - 1]);
    let worst = 0, at = 0;
    for (let i = 1; i < run.length - 1; i++) {
      const p = toXY(run[i]);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
      const d = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
      if (d > worst) { worst = d; at = i; }
    }
    if (worst <= tolerance) return [run[0], run[run.length - 1]];
    return [...dp(run.slice(0, at + 1)).slice(0, -1), ...dp(run.slice(at))];
  };
  for (let i = 1; i < points.length; i++) {
    if (i < points.length - 1 && !keep(points[i])) continue;
    out.push(...dp(points.slice(start, i + 1)).slice(1));
    start = i;
  }
  return out;
}

export interface AdmissionResult {
  features: RoutingFeatureOut[];
  added: Array<{ id: string; osm: string; klass: AdmissionClass; name: string }>;
  splices: number;
  /** Admitted ways dropped again because they only led to a new dead end. */
  pruned: number;
  candidates: Record<AdmissionClass, number>;
  alreadyCarried: Record<AdmissionClass, number>;
  unconnected: Record<AdmissionClass, number>;
}

/**
 * `routing` is the published extract (left untouched apart from spliced
 * junction vertices); `osm` is every OSM highway way in the city, used both
 * for candidates and to find junction vertices (a coordinate two OSM ways
 * share).
 */
export function admitRideableWays(
  routing: readonly RoutingFeatureOut[],
  osm: readonly OsmWay[],
  options: { cityId?: string; inside?: (point: LatLon) => boolean } = {},
): AdmissionResult {
  const cityId = options.cityId ?? 'amsterdam';
  const zero = (): Record<AdmissionClass, number> => ({ rideable: 0, service: 0 });
  const candidates = zero(), alreadyCarried = zero(), unconnected = zero();

  const shared = new Map<string, number>();
  for (const way of osm) for (const key of new Set(way.line.map(key6))) shared.set(key, (shared.get(key) ?? 0) + 1);
  const isJunction = (point: LatLon) => (shared.get(key6(point)) ?? 0) >= 2;

  const carried = routingIndex(routing);
  const pending: Array<OsmWay & { klass: AdmissionClass }> = [];
  for (const way of osm) {
    const klass = admissionClass(way.tags);
    if (!klass || way.line.length < 2) continue;
    if (options.inside && !way.line.some(options.inside)) continue;
    candidates[klass]++;
    if (isCarried(carried, way.line)) { alreadyCarried[klass]++; continue; }
    pending.push({ ...way, klass });
  }

  // Connectivity: a candidate touching routing geometry (stitch radius) is
  // attached; others attach through shared vertices with attached candidates.
  const byVertex = new Map<string, number[]>();
  pending.forEach((way, index) => {
    for (const key of new Set(way.line.map(key6))) (byVertex.get(key) ?? byVertex.set(key, []).get(key)!).push(index);
  });
  const attached = new Set<number>();
  const queue: number[] = [];
  pending.forEach((way, index) => {
    const ends = [way.line[0], way.line[way.line.length - 1]];
    if (ends.some((point) => carried.near(point, STITCH_METERS).length)
      || way.line.some((point) => isJunction(point) && carried.near(point, STITCH_METERS).length)) {
      attached.add(index); queue.push(index);
    }
  });
  while (queue.length) {
    const index = queue.pop()!;
    for (const key of pending[index].line.map(key6)) {
      for (const next of byVertex.get(key) ?? []) if (!attached.has(next)) { attached.add(next); queue.push(next); }
    }
  }

  // New features. Ids continue the compact `routing_<n>` numbering after the
  // highest published one, in OSM id order, so a re-run is stable.
  const highest = routing.reduce((max, feature) => {
    const match = /^routing_(\d+)$/.exec(feature.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, -1);
  const keep = [...attached].map((index) => pending[index])
    .sort((a, b) => Number(a.id.replace(/\D/g, '')) - Number(b.id.replace(/\D/g, '')));
  for (const [index, way] of pending.entries()) if (!attached.has(index)) unconnected[way.klass]++;

  const features: RoutingFeatureOut[] = routing.map((feature) => ({ ...feature }));
  const added: AdmissionResult['added'] = [];
  keep.forEach((way, n) => {
    const line = simplifyKeeping(way.line, isJunction).map(([lat, lon]) => [round6(lat), round6(lon)] as LatLon)
      .filter((point, i, all) => i === 0 || point[0] !== all[i - 1][0] || point[1] !== all[i - 1][1]);
    if (line.length < 2) return;
    const name = (way.tags.name || way.tags['name:nl'] || '').trim();
    const feature: RoutingFeatureOut = {
      id: `routing_${highest + 1 + n}`, name, type: 'street', cityId,
      center: line[Math.floor(line.length / 2)], highway: way.tags.highway!, path: line,
    };
    if (way.tags.bridge === 'yes') feature.bridge = true;
    features.push(feature);
    added.push({ id: feature.id, osm: way.id, klass: way.klass, name });
  });

  // Leaf pruning: an admitted way whose end goes nowhere (it continues only as
  // a foot-only path or steps) would trade one cul-de-sac for another. Drop
  // such stubs until none is left; ways that join two parts of the graph stay.
  let pruned = 0;
  for (let round = 0; round < 20; round++) {
    const firstAdded = routing.length;
    const deadOwners = new Set(deadEndNodes(bikeLoadedFeatures(features)).map((end) => end.featureId));
    const before = features.length;
    for (let i = features.length - 1; i >= firstAdded; i--) {
      if (deadOwners.has(features[i].id)) features.splice(i, 1);
    }
    if (features.length === before) break;
    pruned += before - features.length;
  }
  const kept = new Set(features.slice(routing.length).map((feature) => feature.id));
  for (let i = added.length - 1; i >= 0; i--) if (!kept.has(added[i].id)) added.splice(i, 1);

  // Splice junctions into published ways that lost the vertex to simplification.
  type Seg = { feature: number; line: number; seg: number };
  const segIndex = new Map<string, Seg[]>();
  const CELL = 25;
  routing.forEach((feature, fi) => featureLines(feature).forEach((line, li) => {
    for (let s = 1; s < line.length; s++) {
      const a = toXY(line[s - 1]), b = toXY(line[s]);
      for (let gx = Math.floor(Math.min(a[0], b[0]) / CELL); gx <= Math.floor(Math.max(a[0], b[0]) / CELL); gx++) {
        for (let gy = Math.floor(Math.min(a[1], b[1]) / CELL); gy <= Math.floor(Math.max(a[1], b[1]) / CELL); gy++) {
          (segIndex.get(`${gx},${gy}`) ?? segIndex.set(`${gx},${gy}`, []).get(`${gx},${gy}`)!).push({ feature: fi, line: li, seg: s });
        }
      }
    }
  }));
  const inserts = new Map<string, Array<{ seg: number; t: number; point: LatLon }>>();
  const junctionPoints = new Set<string>();
  for (const feature of features.slice(routing.length)) {
    const line = feature.path;
    for (let i = 0; i < line.length; i++) {
      const point = line[i];
      if (i !== 0 && i !== line.length - 1 && !isJunction(point)) continue;
      const p = toXY(point);
      let best: { seg: Seg; d: number; t: number } | null = null;
      for (const seg of segIndex.get(`${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`) ?? []) {
        const coords = featureLines(routing[seg.feature])[seg.line];
        const a = toXY(coords[seg.seg - 1]), b = toXY(coords[seg.seg]);
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const l2 = dx * dx + dy * dy;
        const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
        const d = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
        if (d <= STITCH_METERS && (!best || d < best.d)) best = { seg, d, t };
      }
      if (!best) continue;
      const coords = featureLines(routing[best.seg.feature])[best.seg.line];
      // Already a vertex of the routing way (within a metre): nothing to splice.
      if (metres(coords[best.seg.seg - 1], point) < 1 || metres(coords[best.seg.seg], point) < 1) continue;
      const lineKey = `${best.seg.feature}:${best.seg.line}`;
      if (junctionPoints.has(`${lineKey}|${key6(point)}`)) continue;
      junctionPoints.add(`${lineKey}|${key6(point)}`);
      (inserts.get(lineKey) ?? inserts.set(lineKey, []).get(lineKey)!).push({ seg: best.seg.seg, t: best.t, point });
    }
  }
  let splices = 0;
  for (const [lineKey, list] of inserts) {
    const [fi, li] = lineKey.split(':').map(Number);
    const target = features[fi];
    const lines = featureLines(target).map((line) => [...line]);
    list.sort((a, b) => b.seg - a.seg || b.t - a.t);
    for (const { seg, point } of list) { lines[li].splice(seg, 0, point); splices++; }
    target.path = lines[0];
    if (target.paths) target.paths = lines;
  }
  return { features, added, splices, pruned, candidates, alreadyCarried, unconnected };
}
