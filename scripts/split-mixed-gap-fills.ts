/**
 * Gap fills whose AHN ridge stands MIXED_RIDGE_M over their box (bagGaps.ts):
 * a tower on a low base, or a tree or a neighbour's wall at the edge. The tall
 * block inside the outline (`mixedFillTower`, mixedFillTowers.ts) becomes a
 * `tower:<pand>` feature from the box top up, unless another tile feature
 * already draws it: Gelderlandplein's towers and the Roeterseiland tower are
 * OSM parts over their boxes (reviewed 2026-10-30, all 13 mixed fills).
 *
 *   node --import tsx scripts/split-mixed-gap-fills.ts          # measure (AHN cache), stage, report
 *   node --import tsx scripts/split-mixed-gap-fills.ts --write  # also put the towers in building-tiles and bag-tiles
 *   node --import tsx scripts/split-mixed-gap-fills.ts --check  # exit 1 if a staged tower is missing or a named site is off
 *
 * The decisions are kept in scripts/data/bag-gaps/mixed-fill-towers.json, so
 * --write and --check run without the caches.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import polygonClipping, { type MultiPolygon } from 'polygon-clipping';
import { MIXED_RIDGE_M, type SupplementFeature } from '../src/canalRecall/bagGaps';
import { fullPandId } from '../src/canalRecall/bagTiles';
import { multiPolygonAreaM2 } from '../src/canalRecall/buildingPassages';
import { mixedFillTower } from '../src/canalRecall/mixedFillTowers';
import { rdToLngLat } from '../src/canalRecall/rdCoordinates';
import { tileFor, tileKey } from '../src/canalRecall/slippyTiles';
import { towerTileFeature } from '../src/canalRecall/towerPodium';
import type { Ring } from '../src/canalRecall/landmarks/osmUnderModels';
import { ahnCellsForRings } from './lib/ahnFootprint';

const write = process.argv.includes('--write'), check = process.argv.includes('--check');
const ROOT = path.join('public', 'data', 'extracts', 'amsterdam');
const STORE = path.join('scripts', 'data', 'bag-gaps', 'mixed-fill-towers.json');
/** A tower another feature covers this much of is already drawn. */
const DRAWN_SHARE = 0.5;
// Named: the Overtoom 1874 house, 17.6 m on the street over a garden AHN sees at ground.
const NAMED = [{ id: 'NL.IMBAG.Pand.0363100012159138', place: 'Overtoom', minHeight: 15, maxHeight: 20 }];

type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
type Decision = { decision: 'tower' | 'drawn' | 'edge'; note: string; tower?: ReturnType<typeof towerTileFeature> };
const mp = (g: Feature['geometry']): MultiPolygon => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as MultiPolygon;
const centre = (f: Feature) => { const r = mp(f.geometry)[0][0]; return r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length], [0, 0]) as [number, number]; };
const tileFile = (dir: string, key: string) => path.join(ROOT, dir, `${key}.geojson.gz`);
const readTile = (file: string): { features: Feature[] } => JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString());
const writeTile = (file: string, features: Feature[]) => fs.writeFileSync(file, zlib.gzipSync(`{"type":"FeatureCollection","features":[\n${features.map(f => JSON.stringify(f)).join(',\n')}\n]}\n`));
const towerId = (pand: string) => `tower:${pand}`;

let store: Record<string, Decision> = fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, 'utf8')) : {};
if (!write && !check) {
  const fills = (JSON.parse(fs.readFileSync(path.join('scripts', 'data', 'bag-gaps', 'bag-gaps-supplement.geojson'), 'utf8')) as { features: SupplementFeature[] }).features
    .filter(f => Number(f.properties.ridge) - f.properties.height >= MIXED_RIDGE_M) as unknown as Feature[];
  const covers = JSON.parse(fs.readFileSync(path.join('public', 'canal-drive', 'models', 'covers.json'), 'utf8')) as { models: Record<string, { p: string[] }> };
  const hidden = new Set(Object.values(covers.models).flatMap(m => m.p.map(fullPandId)));
  store = {};
  for (const f of fills) {
    const id = String(f.properties.id), top = Number(f.properties.height);
    if (hidden.has(id)) continue;
    const { roof, ground } = await ahnCellsForRings(mp(f.geometry).map(p => p[0]) as Ring[]);
    const g = ground.filter(Number.isFinite).sort((a, b) => a - b), groundNap = g[g.length >> 1];
    const t = mixedFillTower(roof.filter(c => Number.isFinite(c[2])).map(([x, y, z]) => [x, y, z - groundNap]), top);
    if (!t) { store[id] = { decision: 'edge', note: `ridge ${f.properties.ridge} m over a ${top} m box: no block of tall cells, a tree or a neighbour's wall at the edge` }; continue; }
    const hull = [[...t.hull, t.hull[0]].map(([x, y]) => rdToLngLat(x, y))] as MultiPolygon[number];
    const polygons = polygonClipping.intersection(mp(f.geometry), [hull]);
    const area = multiPolygonAreaM2(polygons);
    // Already drawn: another feature in the tiles around covers most of the tower.
    const { x, y } = tileFor(...centre(f), 14);
    let drawnM2 = 0; const by: string[] = [];
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
      const file = tileFile('building-tiles', tileKey({ z: 14, x: x + dx, y: y + dy }));
      if (!fs.existsSync(file)) continue;
      for (const o of readTile(file).features) {
        if (o.properties.id === id || o.properties.id === towerId(id) || !o.geometry || Number(o.properties.height) < top + 2) continue;
        const a = multiPolygonAreaM2(polygonClipping.intersection(polygons, mp(o.geometry)));
        if (a > 1) { drawnM2 += a; by.push(String(o.properties.id)); }
      }
    }
    if (drawnM2 >= DRAWN_SHARE * area) { store[id] = { decision: 'drawn', note: `${Math.round(area)} m2 at ${t.heightM.toFixed(1)} m drawn by ${[...new Set(by)].join(', ')}` }; continue; }
    store[id] = {
      decision: 'tower', note: `${Math.round(area)} m2 at ${t.heightM.toFixed(1)} m over a ${top} m box (fill ${t.fill})`,
      tower: towerTileFeature(id, { polygons: polygons as never, minHeightM: top, heightM: t.heightM }),
    };
  }
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, `${JSON.stringify(store, null, 1)}\n`);
  for (const [id, d] of Object.entries(store)) console.log(`${d.decision.padEnd(5)} ${id}  ${d.note}`);
}

// ---- write / check ---------------------------------------------------------------------------------------------
const towers = Object.values(store).flatMap(d => d.tower ? [d.tower] : []);
const problems: string[] = [];
for (const n of NAMED) {
  const t = store[n.id]?.tower;
  if (!t) problems.push(`${n.place}: ${n.id} has no tower`);
  else if (t.properties.height < n.minHeight || t.properties.height > n.maxHeight) problems.push(`${n.place}: tower ${t.properties.height} m outside ${n.minHeight}-${n.maxHeight} m`);
}
const byTile = new Map<string, Feature[]>();
for (const t of towers) { const k = tileKey(tileFor(...centre(t as Feature), 14)); byTile.set(k, [...(byTile.get(k) ?? []), t as Feature]); }
const ids = new Set(Object.keys(store).map(towerId));
let added = 0;
for (const dir of ['building-tiles', 'bag-tiles']) {
  let delta = 0;
  for (const [key, want] of byTile) {
    const file = tileFile(dir, key);
    const tile = readTile(file);
    if (write) {
      const kept = tile.features.filter(f => !ids.has(String(f.properties.id)));
      writeTile(file, [...kept, ...want]);
      delta += want.length - (tile.features.length - kept.length);
      added += want.length;
    } else for (const t of want) if (!tile.features.some(f => f.properties.id === t.properties.id)) problems.push(`${t.properties.id} missing from ${dir} ${key} (run --write)`);
  }
  const indexFile = path.join(ROOT, dir, 'index-z14.json');
  if (delta) fs.writeFileSync(indexFile, fs.readFileSync(indexFile, 'utf8').replace(/"features": (\d+),/, (_, n) => `"features": ${Number(n) + delta},`));
}
const count = (d: Decision['decision']) => Object.values(store).filter(s => s.decision === d).length;
console.log(`mixed gap fills: ${Object.keys(store).length}; ${count('tower')} towers, ${count('drawn')} drawn by others, ${count('edge')} edge${write ? `; wrote ${added} features` : ''}; ${problems.length} problems`);
for (const p of problems) console.log(`  FAIL ${p}`);
if (problems.length) process.exit(1);
