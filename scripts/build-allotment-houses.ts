/** Restore only mapped small houses in the two recorded allotment park polygons.
 * node --import tsx scripts/build-allotment-houses.ts [--write] [--tiles=...] [--source=...]
 * Dry run is default. Existing installed geometry/properties are never rewritten.
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { polygonsOf, ringCentroid } from '../src/canalRecall/buildingGeometry.js';
import { tileFor, tileKey } from '../src/canalRecall/slippyTiles.js';
import { allotmentPark, allotmentParks, allotmentProperties, contains, footprintArea, footprintsOverlap, type SourceFeature } from './allotment-house-source.js';

const flag = (name: string): string | undefined => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const source = flag('source') ?? '.cache/osm-source/derived/amsterdam-buildings.geojsonseq';
const tiles = flag('tiles') ?? 'public/data/extracts/amsterdam/building-tiles';
const evidence = flag('evidence') ?? 'artifacts/sloterdijkermeer-review';
const write = process.argv.includes('--write');
const candidates: SourceFeature[] = [];
const sourceInventory: unknown[] = [];
const reader = createInterface({ input: createReadStream(source), crlfDelay: Infinity });
for await (const line of reader) {
  const clean = line.replace(/^\x1e/, '').trim();
  if (!clean) continue;
  const f = JSON.parse(clean) as SourceFeature;
  const point = ringCentroid(polygonsOf(f.geometry)[0][0]);
  const park = allotmentParks.find(p => contains(p.geometry, point));
  if (!park) continue;
  const eligible = allotmentPark(f);
  sourceInventory.push({ id: `${String(f.properties['@type'])[0]}${f.properties['@id']}`, park: park.properties.name, areaM2: Number(footprintArea(f.geometry).toFixed(2)), tags: f.properties, eligible: !!eligible });
  if (eligible) {
    const osmId = `${String(f.properties['@type'])[0]}${f.properties['@id']}`;
    candidates.push({ type: 'Feature', geometry: f.geometry, properties: { id: osmId, tier: 4, building: f.properties.building, ...allotmentProperties(osmId, eligible) } });
  }
}
const required = new Set<string>();
for (const f of candidates) {
  const [lng, lat] = ringCentroid(polygonsOf(f.geometry)[0][0]);
  const t = tileFor(lng, lat, 14);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) required.add(tileKey({ ...t, x: t.x + dx, y: t.y + dy }));
}
const collections = new Map<string, { type: string; features: SourceFeature[] }>();
const installed: SourceFeature[] = [];
const originalHashes: Record<string, string> = {};
for (const key of required) {
  const file = path.join(tiles, `${key}.geojson.gz`);
  const raw = await readFile(file).catch(() => null);
  if (!raw) continue;
  const fc = JSON.parse(gunzipSync(raw).toString());
  collections.set(key, fc); installed.push(...fc.features);
  originalHashes[key] = createHash('sha256').update(raw).digest('hex');
}
const skipped: unknown[] = []; const added: SourceFeature[] = [];
const changed = new Set<string>();
for (const f of candidates) {
  const duplicate = installed.find(e => e.properties.id === f.properties.id || e.properties.osmId === f.properties.osmId || footprintsOverlap(f.geometry, e.geometry));
  if (duplicate) { skipped.push({ id: f.properties.id, overlaps: duplicate.properties.id }); continue; }
  const [lng, lat] = ringCentroid(polygonsOf(f.geometry)[0][0]);
  const key = tileKey(tileFor(lng, lat, 14));
  const fc = collections.get(key) ?? { type: 'FeatureCollection', features: [] };
  fc.features.push(f); collections.set(key, fc); changed.add(key); added.push(f); installed.push(f);
}
const changes: unknown[] = [];
for (const key of changed) {
  const file = path.join(tiles, `${key}.geojson.gz`);
  const body = `${JSON.stringify(collections.get(key))}\n`;
  const gzip = gzipSync(body);
  if (write) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, gzip); }
  changes.push({ tile: key, beforeHash: originalHashes[key] ?? null, afterHash: createHash('sha256').update(gzip).digest('hex'), features: collections.get(key)!.features.length });
}
if (write && added.length) {
  const indexFile = path.join(tiles, 'index-z14.json');
  const index = JSON.parse(await readFile(indexFile, 'utf8'));
  index.features += added.length;
  for (const key of changed) if (!index.tileList.includes(key)) index.tileList.push(key);
  index.tileList.sort(); index.tiles = index.tileList.length;
  // Compute exact byte statistics while retaining all unrelated index fields.
  let totalBytes = 0, totalGzipBytes = 0;
  for (const key of index.tileList) { const raw = await readFile(path.join(tiles, `${key}.geojson.gz`)); totalGzipBytes += raw.length; totalBytes += gunzipSync(raw).length; }
  index.totalBytes = totalBytes; index.totalGzipBytes = totalGzipBytes;
  index.allotmentSupplement = { version: 'garden-house-v1', parks: allotmentParks.map(p => p.properties.name), source, approximateHeightM: 3.4 };
  await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`);
}
await mkdir(evidence, { recursive: true });
const report = { mode: write ? 'write' : 'dry-run', source, scope: allotmentParks.map(p => p.properties), sourceBuildings: sourceInventory.length, eligible: candidates.length, added: added.length, skipped, changes, approximate: ['height', 'eaves', 'roof form', 'material colours'], preserved: 'All existing installed features retained verbatim; only disjoint mapped source footprints appended.', sourceInventory };
await writeFile(path.join(evidence, write ? 'source-report.json' : 'source-dry-run.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(evidence, 'mapped-houses.geojson'), `${JSON.stringify({ type: 'FeatureCollection', features: candidates }, null, 2)}\n`);
console.log(JSON.stringify({ mode: report.mode, sourceBuildings: sourceInventory.length, eligible: candidates.length, added: added.length, skipped: skipped.length, tiles: [...changed] }));
