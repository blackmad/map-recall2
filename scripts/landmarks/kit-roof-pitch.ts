/**
 * Flat or pitched for every generic school, cinema and worship pand, from its LoD2.2 roof planes in the cached PDOK
 * 3D Basisvoorziening blades (scripts/building-recipes/pdok-tiles.ts; the 3DBAG reconstruction, CC BY 4.0).
 *
 *   node --import tsx scripts/landmarks/kit-roof-pitch.ts
 *
 * Writes the staging file tmp/public/kit-roof-pitch.json (per pand: facade/roofPitch.ts roofPitch over its planes);
 * build-public-facts.ts reads it. Why: the BAG tiles' roof code is "slanted" on almost every school and church, flat
 * ones included (GitHub #36, kit review round 3 rows 301, 304, 520).
 *
 * An OSM-keyed kit (w..., r...) reads the pand kit-pands.json joins it to (kitPands.ts measuredPandFor, GitHub #41):
 * that pand is placed by its kit-pands.json outline (it is not a tile feature), and the part's form is read from the
 * pand's planes whose centroid lies inside the part's own outline (kitPands.ts planesOverPart), keyed by the part id.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PUBLIC_BUILDINGS } from '../../src/canalRecall/publicBuildingData.ts';
import { WORSHIP_BUILDINGS } from '../../src/canalRecall/worshipBuildingData.ts';
import { bladeFor } from '../../src/canalRecall/buildingRecipe/pdokLod2.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { roofPitch, type RoofPlane } from '../../src/canalRecall/facade/roofPitch.ts';
import { measuredPandFor, planesOverPart, towerPart } from '../../src/canalRecall/kitPands.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SOURCE = process.env.MAP_RECALL_SOURCE_DATA ?? '/Users/blackmad/Code/map-recall2-source-data';
const DIR = path.join(SOURCE, 'datasets/pdok-3d-gebouwen-2025');
const OUT = path.join(ROOT, 'tmp/public/kit-roof-pitch.json');
/** An OSM part this far above the top of its pand's planes over it is not described by them. */
const PART_ABOVE_PLANES_M = 3;
const kitPands = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/extracts/amsterdam/kit-pands.json'), 'utf8'));
const kitIdsAll = [...PUBLIC_BUILDINGS, ...WORSHIP_BUILDINGS].map(e => e[0]);
// OSM part -> its joined pand; the part's roof form is read from that pand's planes over the part's own outline.
const partPand = new Map(kitIdsAll.filter(id => !id.startsWith('NL.IMBAG.Pand.')).map(id => [id, measuredPandFor(id, kitPands.ids)] as const).filter((e): e is readonly [string, string] => !!e[1]));
const ids = new Set([...kitIdsAll.filter(id => id.startsWith('NL.IMBAG.Pand.')), ...partPand.values()]);

// Where each pand stands: its first footprint vertex in the BAG tiles. Each OSM part's outline, in RD.
const where = new Map<string, [number, number]>();
const partRing = new Map<string, [number, number][]>(), partHeight = new Map<string, number>();
const tiles = path.join(ROOT, 'public/data/extracts/amsterdam/bag-tiles/14');
for (const x of fs.readdirSync(tiles).filter(n => /^\d+$/.test(n))) for (const file of fs.readdirSync(path.join(tiles, x)).filter(n => n.endsWith('.geojson.gz'))) {
  for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(tiles, x, file))).toString('utf8')).features) {
    const id = String(f.properties.id), g = f.geometry;
    const outer: number[][] | undefined = g?.type === 'Polygon' ? g.coordinates[0] : g?.coordinates?.[0]?.[0];
    if (partPand.has(id) && !partRing.has(id) && outer) {
      partRing.set(id, outer.map(v => { const rd = lngLatToRd([v[0], v[1]]); return [rd.x, rd.y] as [number, number]; }));
      if (typeof f.properties.height === 'number') partHeight.set(id, f.properties.height);
    }
    if (!ids.has(id) || where.has(id)) continue;
    const v = g?.type === 'Polygon' ? g.coordinates[0][0] : g?.coordinates?.[0]?.[0]?.[0];
    if (v) where.set(id, [v[0], v[1]]);
  }
}
// A joined pand the tiles draw only as OSM parts: its first outline vertex in kit-pands.json.
for (const id of ids) {
  const v = kitPands.pands?.[id.replace('NL.IMBAG.Pand.', '')]?.ring?.[0];
  if (!where.has(id) && v) where.set(id, [v[0], v[1]]);
}
const byBlade = new Map<string, string[]>();
for (const [id, ll] of where) { const rd = lngLatToRd(ll); const b = bladeFor(rd.x, rd.y); byBlade.set(b, [...(byBlade.get(b) ?? []), id]); }

type Tile = { transform: { scale: number[]; translate: number[] }; vertices: number[][]; CityObjects: Record<string, any> };
/** notCropped: an OSM part the pand's wall crops do not show (a tower, a spire), so it takes no window rows from them. */
type Pitch = ((ReturnType<typeof roofPitch> & { planes: number }) | { missing: string }) & { notCropped?: true };
/** The pand's main roof height: the plan-area-weighted median top of its roof planes. */
const medianTop = (planes: readonly RoofPlane[]): number | null => {
  const by = planes.slice().sort((a, b) => a.zMax - b.zMax), total = by.reduce((t, p) => t + p.planM2, 0);
  let acc = 0; for (const p of by) { acc += p.planM2; if (acc >= total / 2) return p.zMax; }
  return null;
};
const out: Record<string, Pitch> = {};
const pandPlanes = new Map<string, (RoofPlane & { centroid: [number, number] })[]>();
const neighbours = (b: string) => { const [x, y] = b.split('_').map(Number); return [b, ...[[-2000, 0], [2000, 0], [0, -2000], [0, 2000]].map(([dx, dy]) => `${x + dx}_${y + dy}`)]; };
const cache = new Map<string, Tile | null>();
const load = (b: string): Tile | null => {
  if (!cache.has(b)) { const f = path.join(DIR, `buildings_2025_${b}.city.json`); cache.set(b, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null); }
  return cache.get(b)!;
};
const pitchOver = (planes: RoofPlane[]): Pitch => { const pitch = roofPitch(planes); return pitch ? { ...pitch, planes: planes.length } : { missing: 'no LoD2.2 roof planes' }; };
for (const [blade, list] of [...byBlade].sort()) {
  for (const id of list) {
    let tile: Tile | null = null;
    for (const b of neighbours(blade)) { const t = load(b); if (t?.CityObjects[id]) { tile = t; break; } }
    if (!tile) { out[id] = { missing: 'not in cached blades' }; continue; }
    const building = tile.CityObjects[id], ground = Number(building.attributes?.rf_h_ground ?? 0), { scale, translate } = tile.transform;
    const vx = (k: number) => tile!.vertices[k].map((v, i) => v * scale[i] + translate[i]);
    const planes: (RoofPlane & { centroid: [number, number] })[] = [];
    for (const child of building.children ?? []) for (const g of tile.CityObjects[child]?.geometry ?? []) {
      if (String(g.lod) !== '2.2' || !g.semantics) continue;
      (g.boundaries[0] as number[][][]).forEach((surface, i) => {
        const s = g.semantics.surfaces[g.semantics.values[0][i]];
        if (s?.type !== 'RoofSurface') return;
        const ring = surface[0].map(vx);
        let a2 = 0; for (let k = 0; k < ring.length; k++) { const p = ring[k], q = ring[(k + 1) % ring.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
        const zs = ring.map(p => p[2] - ground);
        const centroid: [number, number] = [ring.reduce((t, p) => t + p[0], 0) / ring.length, ring.reduce((t, p) => t + p[1], 0) / ring.length];
        planes.push({ planM2: Math.abs(a2) / 2, slopeDeg: Number(s.rf_slope ?? 0), azimuthDeg: Number(s.rf_azimuth ?? 0), zMin: Math.min(...zs), zMax: Math.max(...zs), centroid });
      });
    }
    pandPlanes.set(id, planes);
    out[id] = pitchOver(planes.map(({ centroid: _c, ...p }) => p));
  }
  cache.clear();
}
// Each OSM part: its joined pand's planes over the part's own outline.
for (const [part, pand] of partPand) {
  const planes = pandPlanes.get(pand), ring = partRing.get(part);
  if (!planes) { out[part] = { missing: `pand ${pand.slice(-10)} not in cached blades` }; continue; }
  if (!ring) { out[part] = { missing: 'no part outline in the BAG tiles' }; continue; }
  const over = planesOverPart(planes, ring), pitch = over.length ? pitchOver(over.map(({ centroid: _c, ...p }) => p)) : null;
  const top = pitch && 'form' in pitch ? Math.max(...over.map(p => p.zMax)) : null, height = partHeight.get(part);
  // A part that rises well above its pand's planes (a spire the 3DBAG cuts off: Vredeskerk's 49 m tower reads a 41 m
  // ridge) keeps its own height: the planes do not describe its top, nor the pand's wall crops its walls
  // (build-public-facts.ts gives it the pand's wall colour but not its window rows).
  if (top !== null && height !== undefined && height - top > PART_ABOVE_PLANES_M) { out[part] = { missing: `part ${height} m over its planes' ${top.toFixed(1)} m`, notCropped: true }; continue; }
  out[part] = pitch ?? { missing: 'no roof plane of its pand over the part' };
  // A tower on its pand (kitPands.ts towerPart: tall over the main roof, a small and slender share of the pand) is not
  // the walls the pand's crops show either.
  const main = medianTop(planes);
  if (height !== undefined && main !== null && towerPart(height, main, kitPands.ids[part].pandShare, kitPands.ids[part].areaM2)) out[part] = { ...out[part], notCropped: true };
}
for (const id of ids) if (!out[id]) out[id] = { missing: 'no footprint in the BAG tiles' };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), source: DIR, pands: out }, null, 1) + '\n');
const vals = Object.values(out);
console.log(`pands ${vals.length}: pitched ${vals.filter(v => 'form' in v && v?.form === 'pitched').length}, flat ${vals.filter(v => 'form' in v && v?.form === 'flat').length}, mixed ${vals.filter(v => 'form' in v && v?.form === 'mixed').length}, mono ${vals.filter(v => 'mono' in v && v?.mono).length}, missing ${vals.filter(v => 'missing' in v).length}`);
