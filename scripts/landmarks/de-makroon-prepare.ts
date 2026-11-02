/**
 * De Makroon shell source: the BAG outline and the 3DBAG LoD2.2 roof surfaces of pand 0363100012242951 (Nieuwe
 * Passeerdersstraat / Marnixstraat / Singelgracht, BAG bouwjaar 2015; Architekten Cie. with Pi de Bruijn, on the site of
 * Huize Sint Bernardus), in the native landmark frame.
 *
 *   node --import tsx scripts/landmarks/de-makroon-prepare.ts
 *
 * Item from the 3DBAG API (CC BY 4.0), cached under .cache/3dbag/. Frame: x east, z south, y up, metres; origin = vertex
 * average of the BAG LoD0 outline (RD), y = 0 at the pand's 3DBAG ground (b3_h_maaiveld). The spec's anchor is the origin.
 */
import fs from 'node:fs';
import path from 'node:path';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const PAND = '0363100012242951';
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

const it = await item(PAND);
const t = it.metadata.transform, verts = it.feature.vertices.map(v => v.map((x, i) => x * t.scale[i] + t.translate[i]));
let attributes: Record<string, unknown> = {};
const footprint: number[][] = [], surfaces: {type: string; rings: number[][][]}[] = [];
for (const o of Object.values(it.feature.CityObjects)) {
  if (o.type === 'Building') attributes = o.attributes ?? {};
  for (const g of o.geometry ?? []) {
    if (String(g.lod) === '0' && !footprint.length) for (const k of ((g.boundaries as number[][][])[0][0])) footprint.push(verts[k].slice(0, 2));
    if (String(g.lod) !== '2.2' || !g.semantics) continue;
    (g.boundaries as number[][][][]).forEach((shell, si) => shell.forEach((surface, j) => {
      const type = g.semantics!.surfaces[g.semantics!.values[si][j]]?.type ?? 'WallSurface';
      surfaces.push({type, rings: surface.map(r => r.map(i => verts[i]))});
    }));
  }
}
const ax = footprint.reduce((s, p) => s + p[0], 0) / footprint.length, ay = footprint.reduce((s, p) => s + p[1], 0) / footprint.length;
const ground = Number(attributes.b3_h_maaiveld);
const L3 = (p: number[]) => [r3(p[0] - ax), r3(Math.max(0, p[2] - ground)), r3(-(p[1] - ay))];
const anchor = rdToLngLat(ax, ay).map(v => +v.toFixed(8));
const json = {
  id: 'de-makroon', bagId: PAND, anchorRD: [r3(ax), r3(ay)], anchor, groundNAP: ground,
  coordinateConvention: 'native east/south metres from anchor; y above local ground',
  source: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND} (3DBAG, CC BY 4.0; BAG CC0)`,
  attributes: {roofMaxNAP: attributes.b3_h_dak_max, ridgeNAP: attributes.b3_h_nok, roof70NAP: attributes.b3_h_dak_70p, builtYear: attributes.oorspronkelijkbouwjaar},
  nativeRing: footprint.map(p => [r3(p[0] - ax), r3(-(p[1] - ay))]),
  lngLatRing: footprint.map(p => rdToLngLat(p[0], p[1]).map(v => +v.toFixed(7))),
  roofs: surfaces.filter(s => s.type === "RoofSurface").map(s => ({rings: s.rings.map(r => r.map(L3))})),
  surfaces: surfaces.filter(s => s.type !== "GroundSurface").map(s => ({type: s.type, rings: s.rings.map(r => r.map(L3))})),
};
fs.writeFileSync('scripts/landmarks/de-makroon-footprints.json', JSON.stringify(json));
console.log('anchor', anchor, 'ring', json.nativeRing.length, 'roofs', json.roofs.length, 'ground', ground, json.attributes);
