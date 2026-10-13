// Add landuse=allotments polygons to the published own-ground OSM cells (kind 'park': the green ground class).
// The 2026-10-10 city fetch queried no allotments, so Westerpark / Sloterdijkermeer / Chasse-area allotment parks fell through to the dark
// `land` layer ("paved"). Source: the Amsterdam OSM extract already in .cache (osm-source/Amsterdam.osm.pbf, 2026-09), filtered with osmium:
//
//   osmium tags-filter .cache/osm-source/Amsterdam.osm.pbf wr/landuse=allotments -o artifacts/own-ground/raw/allotments.osm.pbf
//   osmium export artifacts/own-ground/raw/allotments.osm.pbf -f geojsonseq --add-unique-id=type_id -o artifacts/own-ground/raw/allotments.geojsonseq
//   npx tsx scripts/own-ground/add-allotment-areas.ts            # dry run: report only
//   npx tsx scripts/own-ground/add-allotment-areas.ts --write    # patch public/data/extracts/amsterdam/own-ground-osm-v1/cells/*.json.gz
//
// Idempotent (areas are keyed by OSM id). An area belongs to the cell of its bbox centre, as in fetch-osm-ground.ts. Coordinates to 1e-6 deg.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { cellKey, lngLatToLocal, type ElevationIndex } from '../../src/canalRecall/elevation/elevationData.ts';
import type { OsmGroundExtract } from '../../src/canalRecall/ownGround/osmGround.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const CELLS = join(EXTRACT, 'own-ground-osm-v1/cells');
const SOURCE = 'artifacts/own-ground/raw/allotments.geojsonseq';
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
  if (f.properties.landuse !== 'allotments' || !f.id) continue;
  const polys: [number, number][][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
  const rings = polys.map(p => p[0].map(([x, y]) => [round(x), round(y)] as [number, number])).filter(r => r.length >= 4);
  if (!rings.length) continue;
  const pts = rings.flat(), lngs = pts.map(p => p[0]), lats = pts.map(p => p[1]);
  const key = cellOf((Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2);
  polygons++;
  if (!manifest.cells.includes(key)) { outside++; continue; }
  for (const r of rings) { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; areaM2 += Math.abs(a / 2) * 111320 * 111320 * Math.cos(52.37 * Math.PI / 180); }
  adds.set(key, [...(adds.get(key) ?? []), { id: f.id, kind: 'park', name: f.properties.name, rings }]);
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
console.log(`${polygons} allotment polygons (${outside} outside the game cells, ${(areaM2 / 1e4).toFixed(0)} ha inside), ${added} areas added to ${patched} cells${write ? '' : ' (dry run)'}`);
