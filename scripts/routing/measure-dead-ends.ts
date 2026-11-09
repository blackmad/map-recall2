/**
 * How many cul-de-sac ends the cycling graph has, and what OSM has beyond them
 * (lane D2, #322). Re-run after any routing extract change.
 *
 *   osmium tags-filter .cache/osm-source/Amsterdam.osm.pbf w/highway -o highways.pbf
 *   osmium export --add-unique-id=type_id highways.pbf -o highways.geojson
 *   node --import tsx scripts/routing/measure-dead-ends.ts \
 *     --osm=highways.geojson [--routing-dir=public/data/extracts/amsterdam] \
 *     [--out=report.json]
 *
 * An OSM way counts as dropped when the routing geometry does not carry it
 * (80 % of its vertices within 3.5 m; the extract keeps no OSM ids). Areas
 * (closed polygons) are measured by their outer ring.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { classifyDeadEnds, isCarried, routingIndex, type DeadEnd, type LatLon, type OsmWay, type RoutingFeatureLike } from '../../src/canalRecall/routing/deadEnds.ts';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const routingDir = path.resolve(args['routing-dir'] || 'public/data/extracts/amsterdam');
const osmFile = args.osm;
if (!osmFile) throw new Error('--osm=<highways.geojson> is required');

const routing = JSON.parse(await readFile(path.join(routingDir, 'streets-routing.json'), 'utf8')) as RoutingFeatureLike[];
const geo = JSON.parse(await readFile(osmFile, 'utf8')) as {
  features: Array<{ id?: string; properties: Record<string, string | undefined>; geometry: { type: string; coordinates: number[][] } | null }>;
};
// Dropped = not carried by the routing geometry (the extract has no OSM ids).
// Presence is measured, not assumed.
const carried = routingIndex(routing);
const dropped: OsmWay[] = [];
for (const feature of geo.features) {
  const g = feature.geometry;
  if (!g) continue;
  const ring = g.type === 'LineString' ? g.coordinates
    : g.type === 'Polygon' ? (g.coordinates as unknown as number[][][])[0]
      : g.type === 'MultiPolygon' ? (g.coordinates as unknown as number[][][][])[0][0] : null;
  if (!ring || ring.length < 2) continue;
  const tags = { ...(feature.properties || {}) };
  if (g.type !== 'LineString' && tags.highway === 'pedestrian') tags.area ??= 'yes';
  if (!tags.highway) continue;
  const line = ring.map(([lon, lat]) => [lat, lon] as LatLon);
  if (isCarried(carried, line)) continue;
  dropped.push({ id: String(feature.id ?? tags['@id'] ?? ''), tags, line });
}

// Buurt names: the finest boundary that contains the point.
type Boundary = { name: string; kind: string; adminLevel: number; geometry: LatLon[][][] };
const boundaries = (JSON.parse(await readFile(path.join('public/data/extracts/amsterdam', 'boundaries.json'), 'utf8')) as Boundary[])
  .filter((b) => b.kind !== 'municipality');
const rank = (kind: string) => (kind === 'neighbourhood' || kind === 'neighborhood' ? 0 : kind === 'quarter' ? 1 : kind === 'suburb' ? 2 : 3);
boundaries.sort((a, b) => rank(a.kind) - rank(b.kind));
const inRing = ([lat, lon]: LatLon, ring: LatLon[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const buurtOf = (point: LatLon) => boundaries.find((b) => b.geometry.some((polygon) => inRing(point, polygon[0])
  && !polygon.slice(1).some((hole) => inRing(point, hole))))?.name ?? '(no buurt)';

const deadEnds = classifyDeadEnds(routing, dropped);
const byClass = new Map<string, number>();
for (const end of deadEnds) byClass.set(end.klass, (byClass.get(end.klass) ?? 0) + 1);
const meetingDropped = deadEnds.filter((end) => end.klass !== 'none');
const clusters = (ends: DeadEnd[]) => {
  const counts = new Map<string, number>();
  for (const end of ends) { const name = buurtOf(end.at); counts.set(name, (counts.get(name) ?? 0) + 1); }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10);
};

// Named probes: the Javaplantsoen promenade east end (S4, #317) and the
// integrator's 2026-11-09 feedback cases.
const PROBES: Record<string, LatLon> = {
  'Javaplantsoen promenade east end': [52.362966, 4.946304],
  'ASC SDW square, Heathrowstraat': [52.38599, 4.83218],
  'Radarweg office courtyard': [52.38745, 4.83378],
  'Oosterpark path by the Tropenmuseum': [52.36227, 4.92220],
};
const metres = (a: LatLon, b: LatLon) => Math.hypot((a[0] - b[0]) * 111_320, (a[1] - b[1]) * 68_000);
const probes = Object.fromEntries(Object.entries(PROBES).map(([label, point]) => {
  const near = deadEnds.filter((end) => metres(end.at, point) <= 25)
    .map((end) => ({ klass: end.klass, ways: end.ways, meters: Math.round(metres(end.at, point)) }));
  const lines = routing.flatMap((feature) => (feature.paths ?? (feature.path ? [feature.path] : [])));
  const nearestWay = Math.round(lines.flat().reduce((best, vertex) => Math.min(best, metres(vertex, point)), Infinity));
  return [label, { nearestRoutingVertexMeters: nearestWay, deadEndsWithin25m: near }];
}));

const report = {
  routingDir, routingFeatures: routing.length, droppedOsmWays: dropped.length,
  deadEnds: deadEnds.length, meetingDroppedWays: meetingDropped.length,
  byClass: Object.fromEntries([...byClass].sort((a, b) => b[1] - a[1])),
  worstClustersMeetingDropped: clusters(meetingDropped),
  worstClustersRideable: clusters(deadEnds.filter((end) => end.klass === 'rideable')),
  worstClustersAll: clusters(deadEnds),
  probes,
};
console.log(JSON.stringify(report, null, 2));
if (args.out) await writeFile(args.out, JSON.stringify({ ...report, ends: deadEnds }, null, 1));
