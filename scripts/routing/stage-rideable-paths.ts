/**
 * Stage the routing extract with rideable footways/paths and missing service
 * aisles re-admitted (lane D2, #322). Writes to staging only; the integrator
 * publishes.
 *
 *   osmium tags-filter .cache/osm-source/Amsterdam.osm.pbf w/highway -o highways.pbf
 *   osmium export --add-unique-id=type_id highways.pbf -o highways.geojson
 *   node --import tsx scripts/routing/stage-rideable-paths.ts --osm=highways.geojson \
 *     [--from=public/data/extracts/amsterdam] [--out=public/data/extracts/amsterdam/staging/d2-routing]
 *
 * A full refresh (`refresh-city-extract.sh`) now admits the same ways at
 * source; this patch keeps the published extract's ids and names (it carries
 * the #147 name patch and older motor ways the builder no longer emits, so a
 * rebuild is not a like-for-like diff).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { admitRideableWays, ROUTING_GRAPH_REVISION, type RoutingFeatureOut } from '../../src/canalRecall/routing/rideablePaths.ts';
import type { LatLon, OsmWay } from '../../src/canalRecall/routing/deadEnds.ts';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
if (!args.osm) throw new Error('--osm=<highways.geojson> is required');
const from = path.resolve(args.from || 'public/data/extracts/amsterdam');
const out = path.resolve(args.out || 'public/data/extracts/amsterdam/staging/d2-routing');

const routing = JSON.parse(await readFile(path.join(from, 'streets-routing.json'), 'utf8')) as RoutingFeatureOut[];
const geo = JSON.parse(await readFile(args.osm, 'utf8')) as {
  features: Array<{ id?: string; properties: Record<string, string | undefined>; geometry: { type: string; coordinates: number[][] } | null }>;
};
const osm: OsmWay[] = geo.features
  .filter((feature) => feature.geometry?.type === 'LineString' && feature.properties?.highway)
  .map((feature) => ({
    id: String(feature.id ?? ''), tags: feature.properties,
    line: feature.geometry!.coordinates.map(([lon, lat]) => [lat, lon] as LatLon),
  }));

type Boundary = { kind: string; geometry: LatLon[][][] };
const municipality = (JSON.parse(await readFile(path.join(from, 'boundaries.json'), 'utf8')) as Boundary[])
  .find((b) => b.kind === 'municipality')!;
const inRing = ([lat, lon]: LatLon, ring: LatLon[]) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inside = (point: LatLon) => municipality.geometry.some((polygon) => inRing(point, polygon[0])
  && !polygon.slice(1).some((hole) => inRing(point, hole)));

const result = admitRideableWays(routing, osm, { cityId: 'amsterdam', inside });
await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'streets-routing.json'), JSON.stringify(result.features));
const byClass = { rideable: 0, service: 0 } as Record<string, number>;
for (const entry of result.added) byClass[entry.klass]++;
const report = {
  source: path.relative(process.cwd(), from), osm: path.basename(args.osm), generatedAt: new Date().toISOString(),
  routingBefore: routing.length, routingAfter: result.features.length,
  candidates: result.candidates, alreadyCarried: result.alreadyCarried, unconnected: result.unconnected,
  added: byClass, prunedStubs: result.pruned, junctionsSpliced: result.splices,
  addedNamed: result.added.filter((entry) => entry.name).length,
  ways: result.added,
};
await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
// The manifest records which admission rules built the routing graph.
const manifest = JSON.parse(await readFile(path.join(from, 'manifest.json'), 'utf8')) as Record<string, unknown>;
manifest.routing = { file: 'streets-routing.json', count: result.features.length, graphRevision: ROUTING_GRAPH_REVISION };
await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
const { ways, ...summary } = report;
console.log(JSON.stringify(summary, null, 2));
