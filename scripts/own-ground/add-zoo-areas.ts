// Add tourism=zoo polygons to the published own-ground OSM cells (kind 'park': the green ground class).
// Ride review 2026-10-14 (Plantage): the city fetch queried no zoos, so Artis — 14 ha of trees, lawns and enclosures —
// fell through to the bare `land` colour and read from the Entrepotdok and the Plantage Middenlaan as a sand plaza
// with a few trees. The petting farms (zoo=petting_zoo) take the same class. Source: the Amsterdam OSM extract already
// in .cache (osm-source/Amsterdam.osm.pbf, 2026-09), filtered with osmium:
//
//   osmium tags-filter .cache/osm-source/Amsterdam.osm.pbf wr/tourism=zoo -o artifacts/own-ground/raw/zoos.osm.pbf
//   osmium export artifacts/own-ground/raw/zoos.osm.pbf -f geojsonseq --add-unique-id=type_id -o artifacts/own-ground/raw/zoos.geojsonseq
//   npx tsx scripts/own-ground/add-zoo-areas.ts            # dry run: report only
//   npx tsx scripts/own-ground/add-zoo-areas.ts --write    # patch public/data/extracts/amsterdam/own-ground-osm-v1/cells/*.json.gz
//
// Idempotent (areas are keyed by OSM id). An area belongs to the cell of its bbox centre, as in fetch-osm-ground.ts;
// outer rings only (each ring is filled on its own, as the allotments are). Coordinates to 1e-6 deg. The next full
// fetch keeps them by itself (fetch-osm-ground.ts queries tourism=zoo, osmGround.ts areaKind maps it to 'park').
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { cellKey, lngLatToLocal, type ElevationIndex } from '../../src/canalRecall/elevation/elevationData.ts';
import { areaKind, type OsmGroundExtract } from '../../src/canalRecall/ownGround/osmGround.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const CELLS = join(EXTRACT, 'own-ground-osm-v1/cells');
const SOURCE = 'artifacts/own-ground/raw/zoos.geojsonseq';
const write = process.argv.includes('--write');
const manifest = JSON.parse(readFileSync(join(EXTRACT, 'own-ground-osm-v1/cells.json'), 'utf8')) as { cells: string[] };
const index = JSON.parse(readFileSync(join(EXTRACT, 'elevation-v1/index.json'), 'utf8')) as ElevationIndex;
const round = (v: number) => Math.round(v * 1e6) / 1e6;
const cellOf = (lng: number, lat: number) => { const [x, y] = lngLatToLocal(index, lng, lat); return cellKey(Math.floor(x / index.cellSizeM), Math.floor(y / index.cellSizeM)); };

type Feature = { id?: string; geometry: { type: string; coordinates: any }; properties: Record<string, string> };
const features = readFileSync(SOURCE, 'utf8').split('\n').map(l => l.replace(/\x1e/g, '').trim()).filter(Boolean).map(l => JSON.parse(l) as Feature);
const adds = new Map<string, OsmGroundExtract['areas']>();
let polygons = 0, outside = 0, areaM2 = 0;
for (const f of features) {
  const kind = areaKind(f.properties);
  if (f.properties.tourism !== 'zoo' || kind !== 'park' || !f.id) continue;
  const polys: [number, number][][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
  const rings = polys.map(p => p[0].map(([x, y]) => [round(x), round(y)] as [number, number])).filter(r => r.length >= 4);
  if (!rings.length) continue;
  const pts = rings.flat(), lngs = pts.map(p => p[0]), lats = pts.map(p => p[1]);
  const key = cellOf((Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2);
  polygons++;
  if (!manifest.cells.includes(key)) { outside++; continue; }
  for (const r of rings) { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; areaM2 += Math.abs(a / 2) * 111320 * 111320 * Math.cos(52.37 * Math.PI / 180); }
  adds.set(key, [...(adds.get(key) ?? []), { id: f.id, kind, name: f.properties.name, rings }]);
}
let patched = 0, added = 0;
for (const [key, list] of adds) {
  const file = join(CELLS, `${key}.json.gz`);
  const cell = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as OsmGroundExtract;
  const have = new Set(cell.areas.map(a => a.id));
  const fresh = list.filter(a => !have.has(a.id));
  if (!fresh.length) continue;
  cell.areas.push(...fresh);
  added += fresh.length; patched++;
  console.log(`  ${key}: +${fresh.length} (${fresh.map(a => a.id + (a.name ? ` ${a.name}` : '')).join(', ')})`);
  if (write) writeFileSync(file, gzipSync(JSON.stringify(cell), { level: 9 }));
}
console.log(`${polygons} zoo polygons (${outside} outside the game cells, ${(areaM2 / 1e4).toFixed(1)} ha inside), ${added} areas added to ${patched} cells${write ? '' : ' (dry run)'}`);
