/**
 * Havengebouw shell source: BAG outlines and 3DBAG LoD2.2 surfaces of the Havengebouw (De Ruijterkade 7, BAG pand
 * 0363100012179689, 1960; W.M. Dudok with R.M.H. Magnee, municipal monument 216001) and its two low 1960 pands on the
 * quay side (0363100012179691, 0363100012170978), in the native landmark frame.
 *
 *   node --import tsx scripts/landmarks/havengebouw-prepare.ts
 *
 * Items from the 3DBAG API (CC BY 4.0), cached under .cache/3dbag/. Frame: x east, z south, y up, metres; origin = vertex
 * average of the tower's BAG LoD0 outline (RD), y = 0 at the tower's 3DBAG ground (b3_h_maaiveld).
 */
import fs from 'node:fs';
import path from 'node:path';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const PANDS = ['0363100012179689', '0363100012179691', '0363100012170978'];
type Item = {feature: {CityObjects: Record<string, {type: string; attributes?: Record<string, unknown>; geometry?: {lod: string | number; boundaries: unknown; semantics?: {surfaces: {type: string}[]; values: number[][]}}[]}>; vertices: number[][]}; metadata: {transform: {scale: number[]; translate: number[]}}};
async function item(pand: string): Promise<Item> {
  const file = path.join('.cache', '3dbag', `${pand}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const r = await fetch(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${pand}`);
  if (!r.ok) throw Error(`3DBAG ${pand}: ${r.status}`);
  const j = await r.json();
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(j));
  return j as Item;
}
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const decoded = [];
for (const pand of PANDS) {
  const it = await item(pand);
  const t = it.metadata.transform, verts = it.feature.vertices.map(v => v.map((x, i) => x * t.scale[i] + t.translate[i]));
  let attributes: Record<string, unknown> = {};
  const footprint: number[][] = [], surfaces: {type: string; rings: number[][][]}[] = [];
  for (const o of Object.values(it.feature.CityObjects)) {
    if (o.type === 'Building') attributes = o.attributes ?? {};
    for (const g of o.geometry ?? []) {
      if (String(g.lod) === '0' && !footprint.length) for (const k of ((g.boundaries as number[][][])[0][0])) footprint.push(verts[k].slice(0, 2));
      if (String(g.lod) !== '2.2' || !g.semantics) continue;
      (g.boundaries as number[][][][]).forEach((shell, si) => shell.forEach((surface, j) => {
        surfaces.push({type: g.semantics!.surfaces[g.semantics!.values[si][j]]?.type ?? 'WallSurface', rings: surface.map(r => r.map(i => verts[i]))});
      }));
    }
  }
  decoded.push({pand, attributes, footprint, surfaces});
}
const main = decoded[0];
const ax = main.footprint.reduce((s, p) => s + p[0], 0) / main.footprint.length, ay = main.footprint.reduce((s, p) => s + p[1], 0) / main.footprint.length;
const ground = Number(main.attributes.b3_h_maaiveld);
const L3 = (p: number[]) => [r3(p[0] - ax), r3(Math.max(0, p[2] - ground)), r3(-(p[1] - ay))];
const anchor = rdToLngLat(ax, ay).map(v => +v.toFixed(8));
const json = {
  id: 'havengebouw', anchorRD: [r3(ax), r3(ay)], anchor, groundNAP: ground,
  coordinateConvention: 'native east/south metres from anchor (RD axes); y above the tower\'s 3DBAG ground',
  source: 'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.<id> (3DBAG, CC BY 4.0; BAG CC0)',
  pands: decoded.map(d => ({
    pand: d.pand, builtYear: d.attributes.oorspronkelijkbouwjaar, groundNAP: r3(Number(d.attributes.b3_h_maaiveld)), roofMaxNAP: r3(Number(d.attributes.b3_h_dak_max)), roof70NAP: r3(Number(d.attributes.b3_h_dak_70p)),
    ring: d.footprint.map(p => [r3(p[0] - ax), r3(-(p[1] - ay))]),
    surfaces: d.surfaces.filter(s => s.type !== 'GroundSurface').map(s => ({type: s.type, rings: s.rings.map(r => r.map(L3))})),
  })),
};
fs.writeFileSync('scripts/landmarks/havengebouw-footprints.json', JSON.stringify(json));
console.log('anchor', anchor, json.pands.map(p => `${p.pand.slice(-6)} ring ${p.ring.length} surf ${p.surfaces.length} ground ${p.groundNAP} max ${p.roofMaxNAP}`).join('\n'));
