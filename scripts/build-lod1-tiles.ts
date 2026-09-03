/**
 * Cut the merged city into map tiles the runtime can load a few at a time.
 *
 * The source that ships today is one 5.5 MB GeoJSON fetched whole, for a tenth
 * of the city. The complete version is 192 MB, so the delivery shape has to
 * change along with the data: features go into z/x/y tiles, and the renderer
 * loads the ring around the camera instead of the country.
 *
 * Two things happen here beyond splitting.
 *
 * **Features are placed by centroid, in exactly one tile.** A building split
 * across the tiles it touches would be drawn twice along every boundary, which
 * is the duplication the merge just spent its effort avoiding. The cost is that
 * a building near an edge has geometry outside its own tile, so the renderer
 * must load a one-tile margin — `tilesCovering(bbox, z, 1)` — or buildings will
 * pop in at the edge of the screen.
 *
 * **Properties are trimmed to what draws.** Measured over the staging table,
 * attributes were 55% of the bytes and footprints only 45%: at 7.8 vertices per
 * building the geometry is already lean, so the compression worth having is
 * dropping construction year, party-wall area, reconstruction error and the
 * rest from the wire. Those stay in the staging table, which is what the mesh
 * compiler and the appearance pipeline read.
 *
 * Usage:
 *   npm run build:lod1-tiles                # amsterdam at z14
 *   npm run build:lod1-tiles -- --zoom=13
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { ringCentroid, type Ring } from '../src/canalRecall/buildingLadder.js';
import { tileFor, tileKey } from '../src/canalRecall/slippyTiles.js';

const flag = (name: string): string | undefined =>
  process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const city = flag('city') ?? 'amsterdam';
const zoom = Number(flag('zoom') ?? 14);
const stagingDir = path.join('public', 'data', 'extracts', city, 'staging');
const sourceFile = path.join(stagingDir, 'lod1-city.geojson');
const tilesDir = path.join(stagingDir, 'building-tiles', String(zoom));
const indexFile = path.join(stagingDir, 'building-tiles', `index-z${zoom}.json`);

if (!(await stat(sourceFile).catch(() => null))) {
  process.stderr.write(`${sourceFile} is missing — run \`npm run build:lod1-city\` first\n`);
  process.exit(1);
}

type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
type Feature = { properties: Record<string, unknown>; geometry: Geometry };

/**
 * What a fill-extrusion actually reads, plus the identity picking needs.
 *
 * Absent values are left out rather than written as null. A paint expression
 * that reads a missing property falls through to its fallback, while one that
 * reads an explicit null fails the whole expression and drops every building in
 * the layer back to the style default — so `['has', 'roofColour']` has to mean
 * "this building has a roof colour", not "this key exists and is empty". It
 * also keeps the tiles smaller, since most panden carry no OSM appearance.
 */
const renderProperties = (properties: Record<string, unknown>): Record<string, unknown> => {
  const rendered: Record<string, unknown> = {
    id: properties.bagId ?? properties.osmId,
    tier: properties.tier,
    minHeight: properties.minHeight ?? 0
  };
  // A height is written only when it was actually measured as positive. Four
  // buildings in 344,436 fail that: two 3DBAG never reconstructed, and two
  // whose reconstructed height rounds to zero. Writing 0 or null for them would
  // put an unmeasured number in a dataset whose whole claim is that its heights
  // are measured, and a zero-height extrusion draws nothing anyway. Leaving the
  // key out lets the layer's documented `coalesce(height, 5)` fallback take
  // them, which is a guess that is visible as a guess.
  const height = properties.height;
  if (typeof height === 'number' && height > 0) rendered.height = height;
  for (const key of ['colour', 'roofColour', 'roofShape'] as const) {
    if (properties[key] !== null && properties[key] !== undefined && properties[key] !== '') rendered[key] = properties[key];
  }
  // Procedural pyramidal roofs need the cone thickness on the wire, or walls
  // extrude to the apex and the mesh has nothing to sit on.
  const roofHeight = properties.roofHeight;
  if (typeof roofHeight === 'number' && roofHeight > 0) rendered.roofHeight = roofHeight;
  return rendered;
};

await rm(tilesDir, { recursive: true, force: true });
await mkdir(tilesDir, { recursive: true });

const buckets = new Map<string, string[]>();
let features = 0;
const reader = createInterface({ input: createReadStream(sourceFile), crlfDelay: Infinity });
for await (const rawLine of reader) {
  const line = rawLine.replace(/,\s*$/, '');
  if (!line.startsWith('{"type":"Feature"')) continue;
  const feature = JSON.parse(line) as Feature;
  const rings = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates : feature.geometry.coordinates.flat();
  if (rings.length === 0) continue;
  const [lng, lat] = ringCentroid(rings[0]);
  const key = tileKey(tileFor(lng, lat, zoom));
  const encoded = JSON.stringify({ type: 'Feature', properties: renderProperties(feature.properties), geometry: feature.geometry });
  const bucket = buckets.get(key);
  if (bucket) bucket.push(encoded);
  else buckets.set(key, [encoded]);
  features++;
}

const written: { tile: string; features: number; bytes: number; gzipBytes: number }[] = [];
for (const [key, encoded] of buckets) {
  const [, x, y] = key.split('/');
  // Ship gzipped only: ~16 MB in the versioned extract instead of ~113 MB raw.
  // The runtime decompresses with DecompressionStream.
  const file = path.join(tilesDir, x, `${y}.geojson.gz`);
  await mkdir(path.dirname(file), { recursive: true });
  const body = `{"type":"FeatureCollection","features":[\n${encoded.join(',\n')}\n]}\n`;
  const gzipped = gzipSync(body);
  await writeFile(file, gzipped);
  written.push({ tile: key, features: encoded.length, bytes: Buffer.byteLength(body), gzipBytes: gzipped.byteLength });
}

written.sort((a, b) => b.bytes - a.bytes);
const total = written.reduce((sum, tile) => sum + tile.bytes, 0);
const totalGzip = written.reduce((sum, tile) => sum + tile.gzipBytes, 0);
const percentile = (values: number[], q: number): number => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * q))];
const gzipSizes = written.map(tile => tile.gzipBytes);

await writeFile(indexFile, `${JSON.stringify({
  city, zoom, generatedAt: new Date().toISOString(), features, tiles: written.length,
  totalBytes: total, totalGzipBytes: totalGzip,
  tileList: written.map(tile => tile.tile).sort()
}, null, 2)}\n`);

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(0)} KB`;
process.stdout.write(`\nlod1 building tiles -> ${tilesDir}\n`);
process.stdout.write(`  zoom            z${zoom}\n`);
process.stdout.write(`  features        ${features} in ${written.length} tiles\n`);
process.stdout.write(`  total           ${(total / 1e6).toFixed(0)} MB raw, ${(totalGzip / 1e6).toFixed(0)} MB gzipped\n`);
process.stdout.write(`  per tile gzip   median ${kb(percentile(gzipSizes, 0.5))}, p95 ${kb(percentile(gzipSizes, 0.95))}, max ${kb(Math.max(...gzipSizes))}\n`);
// The renderer loads the tile under the camera plus a one-tile margin, so nine
// tiles is the figure that decides whether this is deliverable on a phone.
const worstNine = gzipSizes.sort((a, b) => b - a).slice(0, 9).reduce((sum, size) => sum + size, 0);
process.stdout.write(`  worst 3x3 block ${kb(worstNine)} gzipped — what a camera over the densest part of the city fetches\n`);
process.stdout.write(`  busiest tiles   ${written.slice(0, 3).map(tile => `${tile.tile} (${tile.features}, ${kb(tile.gzipBytes)})`).join(', ')}\n`);
