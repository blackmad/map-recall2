/**
 * Patch new-build holes in the published building tiles with OSM footprints.
 *
 *   npx tsx scripts/fill-new-build-gaps.ts            # fetch (cached), stage, report
 *   npx tsx scripts/fill-new-build-gaps.ts --publish  # also write the fills into the tiles
 *
 * See src/canalRecall/newBuildGaps.ts for why the holes exist and how a gap is
 * decided. Candidates are OSM buildings with a `start_date` from 2015 on: the
 * BAG import gives every new pand one, and older panden are already in 3DBAG.
 * The Overpass answer is kept in the scrape store, so reruns are offline.
 *
 * Publishing is idempotent: a fill is drawn under its OSM id (`w…`), which the
 * next run finds in the tiles and skips. A full `build:lod1-city` rebuild picks
 * the same footprints up as tier 4 on its own, as long as its OSM extract is
 * newer than the building.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { cachedJson } from './lib/cachedFetch.ts';
import { ExistingIndex, findGapFills, type ExistingBuilding, type GapCandidate, type GapFill } from '../src/canalRecall/newBuildGaps.ts';
import { ringCentroid, type Ring } from '../src/canalRecall/buildingGeometry.ts';
import { tileFor, tileKey } from '../src/canalRecall/slippyTiles.ts';

const BBOX = '52.28,4.72,52.43,5.08';
const QUERY = `[out:json][timeout:240];way["building"]["start_date"~"^(201[5-9]|202[0-9])"](${BBOX});out tags geom;`;
const OVERPASS = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
const ZOOM = 14;
const tilesRoot = 'public/data/extracts/amsterdam/building-tiles';
const indexFile = path.join(tilesRoot, `index-z${ZOOM}.json`);
const STAGING = 'public/data/extracts/amsterdam/staging/new-build-gaps.json';

type TileFeature = { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: string; coordinates: any } };
const readTile = (file: string): { features: TileFeature[] } => {
  const bytes = fs.readFileSync(file);
  return JSON.parse((bytes[0] === 0x1f ? zlib.gunzipSync(bytes) : bytes).toString());
};
const tileFile = (key: string) => { const [, x, y] = key.split('/'); return path.join(tilesRoot, String(ZOOM), x, `${y}.geojson.gz`); };

const index = JSON.parse(fs.readFileSync(indexFile, 'utf8')) as { tileList: string[]; features: number; totalBytes: number; totalGzipBytes: number; tiles: number };
const existing: ExistingBuilding[] = [];
for (const key of index.tileList) {
  for (const f of readTile(tileFile(key)).features) {
    const g = f.geometry, rings: Ring[] = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p: Ring[]) => p[0]) : [];
    existing.push({ id: String(f.properties.id), rings, height: f.properties.height as number | undefined, minHeight: Number(f.properties.minHeight ?? 0), tier: Number(f.properties.tier) });
  }
}
const existingIndex = new ExistingIndex(existing);

const answer = await cachedJson<{ elements: Array<{ type: string; id: number; tags?: Record<string, string>; geometry?: Array<{ lat: number; lon: number }> }> }>(
  OVERPASS, { method: 'POST', body: new URLSearchParams({ data: QUERY }).toString(), contentType: 'application/x-www-form-urlencoded' });
const candidates: GapCandidate[] = answer.elements
  .filter(e => e.type === 'way' && e.geometry && e.geometry.length >= 4)
  .map(e => ({ osmId: e.id, tags: e.tags ?? {}, ring: e.geometry!.map(p => [Math.round(p.lon * 1e6) / 1e6, Math.round(p.lat * 1e6) / 1e6] as [number, number]) }))
  .filter(c => c.ring[0][0] === c.ring[c.ring.length - 1][0] && c.ring[0][1] === c.ring[c.ring.length - 1][1]);

// Only inside the city the tiles already cover: a lone warehouse past the edge is not a hole.
const covered = new Set(index.tileList);
const fills = findGapFills(candidates, existingIndex).filter(fill => { const [lng, lat] = ringCentroid(fill.ring); return covered.has(tileKey(tileFor(lng, lat, ZOOM))); });
fs.mkdirSync(path.dirname(STAGING), { recursive: true });
fs.writeFileSync(STAGING, JSON.stringify({ query: QUERY, candidates: candidates.length, fills }, null, 1));
const bySource = fills.reduce<Record<string, number>>((acc, f) => ((acc[f.heightSource] = (acc[f.heightSource] ?? 0) + 1), acc), {});
const byYear = fills.reduce<Record<string, number>>((acc, f) => ((acc[f.startDate?.slice(0, 4) ?? '?'] = (acc[f.startDate?.slice(0, 4) ?? '?'] ?? 0) + 1), acc), {});
console.log(`${existing.length} tile buildings; ${candidates.length} OSM buildings started 2015+; ${fills.length} stand where the tiles draw nothing -> ${STAGING}`);
console.log('height from', bySource);
console.log('start year', byYear);

if (process.argv.includes('--publish')) {
  const byTile = new Map<string, GapFill[]>();
  for (const fill of fills) {
    const [lng, lat] = ringCentroid(fill.ring);
    const key = tileKey(tileFor(lng, lat, ZOOM));
    const list = byTile.get(key); if (list) list.push(fill); else byTile.set(key, [fill]);
  }
  for (const [key, list] of byTile) {
    const file = tileFile(key);
    const before = fs.readFileSync(file);
    const tile = readTile(file);
    for (const fill of list) {
      tile.features.push({ type: 'Feature', properties: { id: fill.id, tier: 4, minHeight: 0, height: fill.height, building: 'yes' }, geometry: { type: 'Polygon', coordinates: [fill.ring] } });
    }
    const body = `{"type":"FeatureCollection","features":[\n${tile.features.map(f => JSON.stringify(f)).join(',\n')}\n]}\n`;
    const gz = zlib.gzipSync(body);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, gz);
    index.features += list.length;
    index.totalGzipBytes += gz.byteLength - before.byteLength;
    index.totalBytes += Buffer.byteLength(body) - zlib.gunzipSync(before).byteLength;
  }
  fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`published ${fills.length} fills into ${byTile.size} tiles`);
}
