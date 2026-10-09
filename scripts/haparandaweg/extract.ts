/**
 * 3DBAG LoD2.2 item -> compact local-metre surface set for the block kit.
 *
 *   node --import tsx scripts/haparandaweg/extract.ts --pand=0363100012244558 [--src=artifacts/haparandaweg/3dbag]
 *
 * Local frame matches the landmark catalogue: X east, Z south, Y up above the
 * 3DBAG ground level (b3_h_maaiveld), anchored at the footprint centre
 * (4 decimals). Writes scripts/haparandaweg/data/<pand>.surfaces.json including
 * the neighbouring tile footprints (party-wall detection).
 */
import fs from 'node:fs';
import { rdToLngLat, lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { neighbourhood } from '../pand-reference/core.ts';
import type { SurfaceSet, Ring3 } from '../../src/canalRecall/blockBuilding/types.ts';

const arg = (n: string, d = '') => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const pand = arg('pand');
const src = arg('src', 'artifacts/haparandaweg/3dbag');
const j = JSON.parse(fs.readFileSync(`${src}/${pand}.json`, 'utf8'));
const t = j.metadata.transform;
const V: number[][] = j.feature.vertices.map((v: number[]) => v.map((p, i) => p * t.scale[i] + t.translate[i]));
const parent = j.feature.CityObjects[`NL.IMBAG.Pand.${pand}`], child = j.feature.CityObjects[`NL.IMBAG.Pand.${pand}-0`];
const groundNap: number = parent.attributes.b3_h_maaiveld;
const geo = child.geometry.find((g: any) => g.lod === '2.2');
const r3 = (v: number) => Math.round(v * 1000) / 1000;

// anchor = mean of ground-surface vertices
const gv: number[][] = [];
geo.boundaries[0].forEach((s: number[][], i: number) => { if (geo.semantics.surfaces[geo.semantics.values[0][i]].type === 'GroundSurface') for (const r of s) for (const k of r) gv.push(V[k]); });
const cxRd = gv.reduce((s, p) => s + p[0], 0) / gv.length, cyRd = gv.reduce((s, p) => s + p[1], 0) / gv.length;
const [alng, alat] = rdToLngLat({ x: cxRd, y: cyRd });
const anchor: [number, number] = [Math.round(alng * 1e4) / 1e4, Math.round(alat * 1e4) / 1e4];
const toLocal = (lng: number, lat: number): [number, number] => [(lng - anchor[0]) * 111320 * Math.cos(anchor[1] * Math.PI / 180), (anchor[1] - lat) * 111320];
const loc = (p: number[]): [number, number, number] => { const [lng, lat] = rdToLngLat({ x: p[0], y: p[1] }); const [x, z] = toLocal(lng, lat); return [r3(x), r3(p[2] - groundNap), r3(z)]; };

const out: SurfaceSet = { pandId: pand, anchor, groundNap, heightMax: parent.attributes.b3_h_dak_max - groundNap, constructionYear: parent.attributes.oorspronkelijkbouwjaar ?? null, walls: [], roofs: [], ground: [], neighbours: [] };
geo.boundaries[0].forEach((s: number[][], i: number) => {
  const sem = geo.semantics.surfaces[geo.semantics.values[0][i]];
  const rings: Ring3[] = s.map(r => r.map(k => loc(V[k])));
  if (sem.type === 'WallSurface') out.walls.push({ rings, onFootprintEdge: !!sem.on_footprint_edge });
  else if (sem.type === 'RoofSurface') out.roofs.push({ rings, slopeDeg: sem.b3_hellingshoek ?? 0 });
  else out.ground.push({ rings });
});
// neighbours: other tile footprints within 90 m of the anchor
const centre = lngLatToRd([alng, alat]);
for (const f of await neighbourhood(centre)) {
  if (f.id.endsWith(pand)) continue;
  const c = { x: f.ring.reduce((s, p) => s + p.x, 0) / f.ring.length, y: f.ring.reduce((s, p) => s + p.y, 0) / f.ring.length };
  if (Math.hypot(c.x - centre.x, c.y - centre.y) > 90) continue;
  out.neighbours.push({ id: f.id, height: f.height, ring: f.ring.map(p => { const [lng, lat] = rdToLngLat(p); const [x, z] = toLocal(lng, lat); return [r3(x), r3(z)] as [number, number]; }) });
}
fs.writeFileSync(`scripts/haparandaweg/data/${pand}.surfaces.json`, JSON.stringify(out));
console.log(pand, 'walls', out.walls.length, 'roofs', out.roofs.length, 'ground', out.ground.length, 'neigh', out.neighbours.length, 'H', out.heightMax.toFixed(2), 'anchor', anchor);
