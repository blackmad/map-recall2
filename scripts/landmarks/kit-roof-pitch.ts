/**
 * Flat or pitched for every generic school, cinema and worship pand, from its LoD2.2 roof planes in the cached PDOK
 * 3D Basisvoorziening blades (scripts/building-recipes/pdok-tiles.ts; the 3DBAG reconstruction, CC BY 4.0).
 *
 *   node --import tsx scripts/landmarks/kit-roof-pitch.ts
 *
 * Writes the staging file tmp/public/kit-roof-pitch.json (per pand: facade/roofPitch.ts roofPitch over its planes);
 * build-public-facts.ts reads it. Why: the BAG tiles' roof code is "slanted" on almost every school and church, flat
 * ones included (GitHub #36, kit review round 3 rows 301, 304, 520).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PUBLIC_BUILDINGS } from '../../src/canalRecall/publicBuildingData.ts';
import { WORSHIP_BUILDINGS } from '../../src/canalRecall/worshipBuildingData.ts';
import { bladeFor } from '../../src/canalRecall/buildingRecipe/pdokLod2.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { roofPitch, type RoofPlane } from '../../src/canalRecall/facade/roofPitch.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SOURCE = process.env.MAP_RECALL_SOURCE_DATA ?? '/Users/blackmad/Code/map-recall2-source-data';
const DIR = path.join(SOURCE, 'datasets/pdok-3d-gebouwen-2025');
const OUT = path.join(ROOT, 'tmp/public/kit-roof-pitch.json');
const ids = new Set([...PUBLIC_BUILDINGS, ...WORSHIP_BUILDINGS].map(e => e[0]).filter(id => id.startsWith('NL.IMBAG.Pand.')));

// Where each pand stands: its first footprint vertex in the BAG tiles.
const where = new Map<string, [number, number]>();
const tiles = path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14');
for (const x of fs.readdirSync(tiles).filter(n => /^\d+$/.test(n))) for (const file of fs.readdirSync(path.join(tiles, x)).filter(n => n.endsWith('.geojson.gz'))) {
  for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tiles, x, file))).toString('utf8')).features) {
    const id = String(f.properties.id), g = f.geometry;
    if (!ids.has(id) || where.has(id)) continue;
    const v = g?.type === 'Polygon' ? g.coordinates[0][0] : g?.coordinates?.[0]?.[0]?.[0];
    if (v) where.set(id, [v[0], v[1]]);
  }
}
const byBlade = new Map<string, string[]>();
for (const [id, ll] of where) { const rd = lngLatToRd(ll); const b = bladeFor(rd.x, rd.y); byBlade.set(b, [...(byBlade.get(b) ?? []), id]); }

type Tile = { transform: { scale: number[]; translate: number[] }; vertices: number[][]; CityObjects: Record<string, any> };
const out: Record<string, (ReturnType<typeof roofPitch> & { planes: number }) | { missing: string }> = {};
const neighbours = (b: string) => { const [x, y] = b.split('_').map(Number); return [b, ...[[-2000, 0], [2000, 0], [0, -2000], [0, 2000]].map(([dx, dy]) => `${x + dx}_${y + dy}`)]; };
const cache = new Map<string, Tile | null>();
const load = (b: string): Tile | null => {
  if (!cache.has(b)) { const f = path.join(DIR, `buildings_2025_${b}.city.json`); cache.set(b, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null); }
  return cache.get(b)!;
};
for (const [blade, list] of [...byBlade].sort()) {
  for (const id of list) {
    let tile: Tile | null = null;
    for (const b of neighbours(blade)) { const t = load(b); if (t?.CityObjects[id]) { tile = t; break; } }
    if (!tile) { out[id] = { missing: 'not in cached blades' }; continue; }
    const building = tile.CityObjects[id], ground = Number(building.attributes?.rf_h_ground ?? 0), { scale, translate } = tile.transform;
    const vx = (k: number) => tile!.vertices[k].map((v, i) => v * scale[i] + translate[i]);
    const planes: RoofPlane[] = [];
    for (const child of building.children ?? []) for (const g of tile.CityObjects[child]?.geometry ?? []) {
      if (String(g.lod) !== '2.2' || !g.semantics) continue;
      (g.boundaries[0] as number[][][]).forEach((surface, i) => {
        const s = g.semantics.surfaces[g.semantics.values[0][i]];
        if (s?.type !== 'RoofSurface') return;
        const ring = surface[0].map(vx);
        let a2 = 0; for (let k = 0; k < ring.length; k++) { const p = ring[k], q = ring[(k + 1) % ring.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
        const zs = ring.map(p => p[2] - ground);
        planes.push({ planM2: Math.abs(a2) / 2, slopeDeg: Number(s.rf_slope ?? 0), azimuthDeg: Number(s.rf_azimuth ?? 0), zMin: Math.min(...zs), zMax: Math.max(...zs) });
      });
    }
    const pitch = roofPitch(planes);
    out[id] = pitch ? { ...pitch, planes: planes.length } : { missing: 'no LoD2.2 roof planes' };
  }
  cache.clear();
}
for (const id of ids) if (!out[id]) out[id] = { missing: 'no footprint in the BAG tiles' };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), source: DIR, pands: out }, null, 1) + '\n');
const vals = Object.values(out);
console.log(`pands ${vals.length}: pitched ${vals.filter(v => 'form' in v && v?.form === 'pitched').length}, flat ${vals.filter(v => 'form' in v && v?.form === 'flat').length}, mixed ${vals.filter(v => 'form' in v && v?.form === 'mixed').length}, mono ${vals.filter(v => 'mono' in v && v?.mono).length}, missing ${vals.filter(v => 'missing' in v).length}`);
