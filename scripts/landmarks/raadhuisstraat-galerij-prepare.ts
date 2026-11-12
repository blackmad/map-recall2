/**
 * Winkelgalerij Raadhuisstraat ("Utrecht" shop gallery; Rijksmonument 46505; A.L. van Gendt for the Levensverzekering-
 * Maatschappij "Utrecht", completed 1898): the 13 BAG pands of the register record (Keizersgracht 197-201,
 * Raadhuisstraat 23-55, Herengracht 194), their union outline, the street arc fitted to the curved front, and the 3DBAG
 * heights per pand.
 *
 *   node --import tsx scripts/landmarks/raadhuisstraat-galerij-prepare.ts
 *
 * BAG rings from the PDOK BAG WFS (CC0), 3DBAG items (CC BY 4.0), both cached under .cache/. Native frame: x east,
 * z south, y up from the pavement (mean 3DBAG maaiveld), metres from the anchor (the union ring's vertex average).
 */
import fs from 'node:fs';
import path from 'node:path';
import polygonClipping from 'polygon-clipping';
import zlib from 'node:zlib';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

/** Register 46505 (municipal record; the RCE record lists the ten Raadhuisstraat/Herengracht pands, the municipal one adds
 * Keizersgracht 197, 199, 201). Addresses from BAG verblijfsobjecten (api.data.amsterdam.nl, 2026-11-12). */
export const PANDS: Record<string, string> = {
  '0363100012177549': 'Herengracht 194 (corner, nr 21)',
  '0363100012177548': 'Raadhuisstraat 23, 25, 27',
  '0363100012176351': 'Raadhuisstraat 29',
  '0363100012176350': 'Raadhuisstraat 31',
  '0363100012176349': 'Raadhuisstraat 33',
  '0363100012176348': 'Raadhuisstraat 35, 37A, 37B',
  '0363100012176347': 'Raadhuisstraat 39',
  '0363100012176346': 'Raadhuisstraat 41',
  '0363100012169576': 'Raadhuisstraat 43, 45',
  '0363100012169304': 'Raadhuisstraat 47, 49, 51, 55 (corner tower)',
  '0363100012172351': 'Keizersgracht 197',
  '0363100012172350': 'Keizersgracht 199',
  '0363100012172312': 'Keizersgracht 201',
};
const r3 = (v: number) => Math.round(v * 1000) / 1000;
async function cached(file: string, url: string) {
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const r = await fetch(url);
  if (!r.ok) throw Error(`${url}: ${r.status}`);
  const j = await r.json();
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify(j));
  return j;
}
const bagUrl = (p: string) => `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=EPSG:28992&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${p}</Literal></PropertyIsEqualTo></Filter>`)}`;
const bboxUrl = (x0: number, y0: number, x1: number, y1: number) => `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=EPSG:28992&count=200&bbox=${x0},${y0},${x1},${y1},EPSG:28992`;

type Pand = {id: string; label: string; year: number; ring: number[][]; ground: number; eaves: number; r50: number; r70: number; max: number; item: any};
const pands: Pand[] = [];
for (const [p, label] of Object.entries(PANDS)) {
  const g = await cached(path.join('.cache', 'bag-wfs', `${p}.json`), bagUrl(p));
  const item = await cached(path.join('.cache', '3dbag', `${p}.json`), `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${p}`);
  const b = Object.values(item.feature.CityObjects as Record<string, {type: string; attributes: Record<string, number>}>).find(o => o.type === 'Building')!.attributes;
  pands.push({id: p, label, year: Number(g.features[0].properties.bouwjaar), ring: g.features[0].geometry.coordinates[0].slice(0, -1), ground: b.b3_h_maaiveld, eaves: b.b3_h_dak_min, r50: b.b3_h_dak_50p, r70: b.b3_h_dak_70p, max: b.b3_h_dak_max, item});
}
const union = polygonClipping.union(...pands.map(p => [[...p.ring, p.ring[0]]] as [number, number][][]));
console.log('union polygons', union.length, union.map(u => u.length));
let ring = union[0][0].slice(0, -1);
for (let changed = true; changed;) {
  changed = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[(i + ring.length - 1) % ring.length], b = ring[i], c = ring[(i + 1) % ring.length];
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]), off = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / L;
    if (off < 0.02) { ring.splice(i, 1); changed = true; break; }
  }
}
const ax = ring.reduce((s, q) => s + q[0], 0) / ring.length, ay = ring.reduce((s, q) => s + q[1], 0) / ring.length;
const anchor = rdToLngLat(ax, ay).map(v => +v.toFixed(8));
const N = (q: number[]) => [r3(q[0] - ax), r3(-(q[1] - ay))];
const ground = pands.reduce((s, p) => s + p.ground, 0) / pands.length;

// 3DBAG LoD2.2 roof surfaces per pand, native (x, y above the mean ground, z)
const roofsOf = (p: Pand) => {
  const d = p.item, tr = d.metadata.transform;
  const verts = (d.feature.vertices as number[][]).map(v => { const q = v.map((n, i) => n * tr.scale[i] + tr.translate[i]); return [r3(q[0] - ax), r3(q[2] - ground), r3(-(q[1] - ay))]; });
  const parts = Object.keys(d.feature.CityObjects).filter(k => k.startsWith(`NL.IMBAG.Pand.${p.id}-`)).sort();
  return parts.flatMap(k => {
    const g = d.feature.CityObjects[k].geometry.find((x: {lod: string}) => x.lod === '2.2');
    return (g.boundaries[0] as number[][][]).flatMap((sf, i) => g.semantics.surfaces[g.semantics.values[0][i]].type === 'RoofSurface' ? [sf[0].map(kk => verts[kk])] : []);
  });
};
// neighbours: committed z14 bag tiles (tier 3) within 3 m of the union ring, either direction
const nativeUnion = ring.map(N);
const near = (r: number[][], ours: number[][]) => r.some(p => ours.some((q, i) => { const c = ours[(i + 1) % ours.length], dx = c[0] - q[0], dz = c[1] - q[1], L2 = dx * dx + dz * dz || 1e-9; const u = Math.max(0, Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dz) / L2)); return Math.hypot(p[0] - q[0] - u * dx, p[1] - q[1] - u * dz) < 3; }));
const neighbours: {id: string; height: number; ring: number[][]}[] = [];
{
  const n = 2 ** 14, tx = Math.floor((anchor[0] + 180) / 360 * n);
  const ty = Math.floor((1 - Math.log(Math.tan(anchor[1] * Math.PI / 180) + 1 / Math.cos(anchor[1] * Math.PI / 180)) / Math.PI) / 2 * n);
  const seen = new Set<string>();
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const f = `public/data/extracts/amsterdam/bag-tiles/14/${tx + dx}/${ty + dy}.geojson.gz`;
    if (!fs.existsSync(f)) continue;
    for (const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString()).features) {
      const pid = String(ft.properties.id);
      if (seen.has(pid) || Object.keys(PANDS).some(k => pid.endsWith(k)) || ft.properties.tier !== 3) continue;
      seen.add(pid);
      const gg = ft.geometry, rr = (gg.type === 'Polygon' ? gg.coordinates[0] : gg.coordinates[0][0]).map((p: number[]) => N(lngLatToRd(p[0], p[1]) as number[]));
      if (near(rr, nativeUnion) || near(nativeUnion, rr)) neighbours.push({id: pid, height: ft.properties.height, ring: rr});
    }
  }
}

const json = {
  id: 'raadhuisstraat-galerij',
  pands: Object.keys(PANDS),
  pandLabels: PANDS,
  address: 'Raadhuisstraat 23-55, Keizersgracht 197-201 and Herengracht 194, Amsterdam (Rijksmonument 46505)',
  sources: [
    {what: 'BAG pand rings (13 pands)', url: 'https://service.pdok.nl/lv/bag/wfs/v2_0 (typeName bag:pand, srsName EPSG:28992)', retrieved: '2026-11-12', licence: 'CC0'},
    {what: '3DBAG LoD2.2 attributes (maaiveld, roof heights)', url: 'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.<id>', retrieved: '2026-11-12', licence: 'CC BY 4.0'},
    {what: 'Monument register (RCE)', url: 'https://monumentenregister.cultureelerfgoed.nl/monumenten/46505', retrieved: '2026-11-12', licence: 'CC0'},
    {what: 'Monument register (municipal record, 13 pands)', url: 'https://api.data.amsterdam.nl/v1/monumenten/monumenten/8826ae26-2e46-48d7-9d78-5806e0884f87?_format=json', retrieved: '2026-11-12', licence: 'CC0'},
  ],
  anchorRD: [r3(ax), r3(ay)], anchor,
  groundNAP: r3(ground),
  pandHeights: pands.map(p => ({id: p.id, label: p.label, year: p.year, groundNAP: r3(p.ground), eavesM: r3(p.eaves - ground), roof50M: r3(p.r50 - ground), roof70M: r3(p.r70 - ground), roofMaxM: r3(p.max - ground)})),
  pandNative: Object.fromEntries(pands.map(p => [p.id, p.ring.map(N)])),
  roofs: Object.fromEntries(pands.map(p => [p.id, roofsOf(p)])),
  ringRD: ring.map(q => q.map(r3)),
  nativeRing: ring.map(N),
  buildingFootprint: {type: 'Polygon', coordinates: [[...ring, ring[0]].map(q => rdToLngLat(q[0], q[1]).map(v => +v.toFixed(8)))]},
  neighbours,
};
fs.writeFileSync('scripts/landmarks/raadhuisstraat-galerij-footprints.json', JSON.stringify(json, null, 1));
console.log('anchor', anchor, 'ground', r3(ground), 'verts', ring.length, 'neighbours', neighbours.length);
for (const p of json.pandHeights) console.log(p.id, p.label, p.year, 'eaves', p.eavesM, 'r70', p.roof70M, 'max', p.roofMaxM);
