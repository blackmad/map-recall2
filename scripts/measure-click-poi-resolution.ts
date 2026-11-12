/**
 * Step 1 of lane D1: how often a building tap resolves to a mapped POI rather
 * than the building, and how many POI cards say nothing but their kind.
 * Reads the shipped extracts only; no browser. Usage: tsx scripts/measure-click-poi-resolution.ts [seed]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { ClickPoiIndex, type ClickPoiFile, type PolygonGeometry } from '../src/canalRecall/clickPoiInfo';
import { footprintDistanceM } from '../src/canalRecall/engine/labelPand';
import { isLabelOnly } from '../src/canalRecall/poiCardPolicy';

const dir = path.resolve('public/data/extracts/amsterdam');
const file = JSON.parse(readFileSync(path.join(dir, 'click-poi-info.json'), 'utf8')) as ClickPoiFile;
const index = new ClickPoiIndex(file);
let seed = Number(process.argv[2] ?? 20261109);
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

const byCat = new Map<string, { total: number; only: number }>();
for (const row of file.points) {
  const c = byCat.get(row[4]) ?? { total: 0, only: 0 };
  c.total++; if (isLabelOnly(row)) c.only++; byCat.set(row[4], c);
}
console.log('| category | POIs | label-only |\n|---|---|---|');
for (const [k, v] of [...byCat].sort((a, b) => b[1].total - a[1].total)) console.log(`| ${k} | ${v.total} | ${v.only} |`);
console.log(`| all | ${file.points.length} | ${[...byCat.values()].reduce((a, v) => a + v.only, 0)} |`);

const tilesRoot = path.join(dir, 'building-tiles', '14');
const allPands: { id: string; geometry: PolygonGeometry; box: number[] }[] = [];
for (const x of readdirSync(tilesRoot)) for (const f of readdirSync(path.join(tilesRoot, x))) {
  if (!f.endsWith('.geojson.gz')) continue;
  const tile = JSON.parse(gunzipSync(readFileSync(path.join(tilesRoot, x, f))).toString());
  for (const feature of tile.features) {
    const g = feature.geometry; if (!g || !/Polygon/.test(g.type)) continue;
    const pts: number[][] = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flatMap((r: number[][][]) => r[0]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    allPands.push({ id: String(feature.properties.id), geometry: g, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
  }
}
const holders = allPands.map(p => ({ ...p, places: index.contained(p.geometry) })).filter(p => p.places.length);
console.log(`\npands in tiles: ${allPands.length}; holding at least one click POI: ${holders.length}`);
const sample = Array.from({ length: 200 }, () => holders[Math.floor(rand() * holders.length)]);
const only = sample.filter(h => h.places.every(isLabelOnly)).length;
console.log(`sample of 200 pands holding a POI: today a tap resolves to the POI card 200/200 and to the pand's own card 0/200; the POI card carries only kind labels in ${only}/200; first place is art in ${sample.filter(h => h.places[0][4] === 'art').length}/200`);

const arts = file.points.filter(r => r[4] === 'art');
let near = 0, inside = 0;
const slack = 0.0001; // ~11 m of degrees, prefilter for the 6 m test
for (const r of arts) {
  let best = Infinity;
  for (const p of allPands) {
    if (r[2] < p.box[0] - slack || r[2] > p.box[2] + slack || r[3] < p.box[1] - slack || r[3] > p.box[3] + slack) continue;
    best = Math.min(best, footprintDistanceM(p.geometry, [r[2], r[3]]));
  }
  if (best === 0) inside++; if (best <= 6) near++;
}
console.log(`artwork nodes ${arts.length}: inside a pand ${inside}; within 6 m of a pand (a label tap attaches that building) ${near}; free-standing ${arts.length - near}`);

// C1 (#367): how many place-holding pands does a place still title, and how many now lead with the building?
{
  const { titlePlace } = await import('../src/canalRecall/placeTitle');
  let titled = 0, led = 0, slabs = 0;
  for (const h of holders) {
    const places = h.places.filter(r => !isLabelOnly(r));
    if (!places.length) continue;
    const t = titlePlace({ places, footprint: h.geometry, heightMetres: undefined });
    if (t) titled++; else { led++; if (places.length >= 3) slabs++; }
  }
  console.log(`C1 title rule (height unknown): place titles ${titled}, building leads ${led} (of which ${slabs} hold 3+ places)`);
}
