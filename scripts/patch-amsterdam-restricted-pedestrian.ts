/**
 * Merge named pedestrian streets that OSM marks bicycle=no into the published
 * Amsterdam streets-routing extract, with bicycleRestricted saved on each way.
 *
 * Full extract refresh will pick these up via isBikeRoutingHighway; this patch
 * keeps play current without rebuilding the whole city from the PBF.
 *
 * Usage:
 *   osmium tags-filter .cache/osm-source/Amsterdam.osm.pbf \
 *     w/highway=pedestrian n/highway=pedestrian -o /tmp/ams-ped.osm.pbf -O
 *   # (script filters bicycle-denied + named itself from a geojson export)
 *
 * Or pass a geojson path of pedestrian ways:
 *   npx tsx scripts/patch-amsterdam-restricted-pedestrian.ts /tmp/kalverstraat.geojson
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isBicycleRestricted } from '../src/canalRecall/routing/bikeAccess.ts';

interface LatLng extends Array<number> {
  0: number;
  1: number;
}

interface RoutingWay {
  id: string;
  name: string;
  type: string;
  cityId: string;
  center: [number, number];
  highway?: string;
  path?: LatLng[];
  paths?: LatLng[][];
  bicycleRestricted?: boolean;
  bicycle?: string;
  bridge?: boolean;
}

interface GeoJsonFeature {
  geometry: { type: string; coordinates: number[][] | number[][][] } | null;
  properties: Record<string, string | undefined>;
}

const geojsonPath = process.argv[2];
if (!geojsonPath) {
  console.error('Usage: tsx scripts/patch-amsterdam-restricted-pedestrian.ts <pedestrian.geojson>');
  process.exit(1);
}

const root = path.resolve('public/data/extracts/amsterdam');
const routing = JSON.parse(await readFile(path.join(root, 'streets-routing.json'), 'utf8')) as RoutingWay[];
const geo = JSON.parse(await readFile(geojsonPath, 'utf8')) as { features: GeoJsonFeature[] };

function linePaths(geometry: GeoJsonFeature['geometry']): LatLng[][] {
  if (!geometry) return [];
  if (geometry.type === 'LineString') {
    const coords = geometry.coordinates as number[][];
    // GeoJSON is [lng, lat]; extract stores [lat, lng].
    return [coords.map(([lng, lat]) => [lat, lng] as LatLng)];
  }
  if (geometry.type === 'MultiLineString') {
    return (geometry.coordinates as number[][][]).map((line) =>
      line.map(([lng, lat]) => [lat, lng] as LatLng));
  }
  return [];
}

function centroid(paths: LatLng[][]): [number, number] {
  let lat = 0;
  let lon = 0;
  let n = 0;
  for (const path of paths) {
    for (const [a, b] of path) {
      lat += a;
      lon += b;
      n += 1;
    }
  }
  return n ? [lat / n, lon / n] : [52.37, 4.89];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash | 0);
}

/** Existing ways keyed by name|approx-center so we do not duplicate. */
const existingKeys = new Set(
  routing.map((way) => {
    const c = way.center || [0, 0];
    return `${way.name}|${c[0].toFixed(4)}|${c[1].toFixed(4)}`;
  }),
);

let added = 0;
const byName = new Map<string, { paths: LatLng[][]; bicycle?: string }>();

for (const feature of geo.features) {
  const tags = feature.properties || {};
  if (tags.highway !== 'pedestrian') continue;
  if (!isBicycleRestricted(tags)) continue;
  const name = (tags.name || '').trim();
  if (!name) continue;
  const paths = linePaths(feature.geometry).filter((p) => p.length >= 2);
  if (!paths.length) continue;
  const bucket = byName.get(name) || { paths: [], bicycle: tags.bicycle };
  bucket.paths.push(...paths);
  bucket.bicycle ||= tags.bicycle;
  byName.set(name, bucket);
}

for (const [name, bucket] of byName) {
  const center = centroid(bucket.paths);
  const key = `${name}|${center[0].toFixed(4)}|${center[1].toFixed(4)}`;
  if (existingKeys.has(key)) continue;

  // Do not blanket-flag every existing way with this name — Leidsestraat has
  // both bikeable and restricted segments. Only insert missing geometry.
  if (routing.some((way) => way.name === name && way.bicycleRestricted)) {
    continue;
  }
  if (routing.some((way) => way.name === name) && name !== 'Kalverstraat') {
    // Name already routed (usually as bikeable pedestrian). Skip unless we
    // specifically need a known missing street like Kalverstraat.
    continue;
  }

  const entry: RoutingWay = {
    id: `routing_restricted_${stableHash(name)}`,
    name,
    type: 'street',
    cityId: 'amsterdam',
    center,
    highway: 'pedestrian',
    path: bucket.paths[0],
    paths: bucket.paths.length > 1 ? bucket.paths : undefined,
    bicycleRestricted: true,
    bicycle: bucket.bicycle || 'no',
  };
  routing.push(entry);
  existingKeys.add(key);
  added += 1;
  process.stdout.write(`+ ${name} (${bucket.paths.length} paths, bicycle=${entry.bicycle})\n`);
}

await writeFile(path.join(root, 'streets-routing.json'), JSON.stringify(routing));
process.stdout.write(`Restricted pedestrian patch: added ${added}, routing ways now ${routing.length}\n`);
