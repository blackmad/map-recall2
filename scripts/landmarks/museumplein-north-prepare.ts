/**
 * Plan source for the Stedelijk Museum (Weissman 1895 + Benthem Crouwel 2012) and the Albert Heijn on the Museumplein.
 *
 *   node --import tsx scripts/landmarks/museumplein-north-prepare.ts --id=stedelijk-museum --pands=0363100012077791,0363100012251804,0363100012251805
 *   node --import tsx scripts/landmarks/museumplein-north-prepare.ts --id=albert-heijn-museumplein --pands=0363100012082824,0363100012225637
 *
 * Like sarphati-plaza-prepare.ts, but for several BAG pands in ONE native frame (x east, z south, y up, metres, origin = vertex
 * average of the first pand's outer BAG ring in RD). Reads the BAG rings from PDOK BAG WFS in RD (CC0) and each pand's 3DBAG LoD2.2
 * RoofSurfaces (CC BY 4.0; both cached by pand-reference/core.ts); y is above the first pand's 3DBAG ground. Also writes the OSM
 * building:part ways of the committed z14 tile that fall inside the pands (heights, roof shapes, ODbL) in the same frame.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import {cachedJson} from '../pand-reference/core.ts';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ID = arg('id') ?? 'stedelijk-museum';
const PANDS = (arg('pands') ?? '0363100012077791,0363100012251804,0363100012251805').split(',');
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const open = (r: number[][]) => (r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);
const wfs = (p: string) => `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${p}</Literal></PropertyIsEqualTo></Filter>`)}`;

const first = (await cachedJson(wfs(PANDS[0]))).features[0];
const o0 = open(first.geometry.coordinates[0]);
const ax = o0.reduce((s: number, p: number[]) => s + p[0], 0) / o0.length, ay = o0.reduce((s: number, p: number[]) => s + p[1], 0) / o0.length;
const toNative = (p: number[]) => [r3(p[0] - ax), r3(-(p[1] - ay))];
let ground = NaN;
const pands: Record<string, unknown>[] = [];
for (const P of PANDS) {
  const f = (await cachedJson(wfs(P))).features[0];
  const rings: number[][][] = f.geometry.coordinates.map(open);
  let attrs: Record<string, number> = {}, roofs: number[][][][] = [];
  try {
    const d = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${P}`);
    const a = d.feature.CityObjects[`NL.IMBAG.Pand.${P}`].attributes;
    if (Number.isNaN(ground)) ground = a.b3_h_maaiveld;
    attrs = {groundNAP: a.b3_h_maaiveld, roofMinNAP: a.b3_h_dak_min, roof50pNAP: a.b3_h_dak_50p, roof70pNAP: a.b3_h_dak_70p, roofMaxNAP: a.b3_h_dak_max};
    const tr = d.metadata.transform;
    const verts = (d.feature.vertices as number[][]).map(v => { const q = v.map((n, i) => n * tr.scale[i] + tr.translate[i]); return [r3(q[0] - ax), r3(q[2] - ground), r3(-(q[1] - ay))]; });
    const g = d.feature.CityObjects[`NL.IMBAG.Pand.${P}-0`].geometry.find((x: {lod: string}) => x.lod === '2.2');
    roofs = (g.boundaries[0] as number[][][]).flatMap((s, i) => g.semantics.surfaces[g.semantics.values[0][i]].type === 'RoofSurface' ? [s.map(r => r.map(kk => verts[kk]))] : []);
  } catch (e) { console.log(P, '3DBAG:', String(e).split('\n')[0]); }
  pands.push({bagId: P, bouwjaar: f.properties.bouwjaar, status: f.properties.status, rings: rings.map(r => r.map(toNative)), attributes: attrs, roofs});
  console.log(P, f.properties.bouwjaar, 'ring', rings[0].length, 'holes', rings.length - 1, 'roofs', roofs.length, JSON.stringify(attrs));
}
// OSM parts and BAG/OSM features of the committed tile whose centre lies inside the first ring's bbox grown by 30 m.
const anchor = rdToLngLat(ax, ay).map(v => +v.toFixed(8));
const parts: {id: string; props: Record<string, unknown>; ring: number[][]}[] = [];
{
  const [lng, lat] = anchor, n = 2 ** 14, tx = Math.floor((lng + 180) / 360 * n);
  const ty = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  const all = pands.flatMap(p => (p.rings as number[][][])[0]);
  const [x0, x1, z0, z1] = [Math.min(...all.map(p => p[0])) - 30, Math.max(...all.map(p => p[0])) + 30, Math.min(...all.map(p => p[1])) - 30, Math.max(...all.map(p => p[1])) + 30];
  const f = `public/data/extracts/amsterdam/bag-tiles/14/${tx}/${ty}.geojson.gz`;
  for (const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString()).features) {
    const gg = ft.geometry, ring = (gg.type === 'Polygon' ? gg.coordinates[0] : gg.coordinates[0][0]).map((p: number[]) => toNative(lngLatToRd(p[0], p[1])));
    const cx = ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length, cz = ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length;
    if (cx < x0 || cx > x1 || cz < z0 || cz > z1) continue;
    parts.push({id: String(ft.properties.id), props: ft.properties, ring: open(ring)});
  }
}
const out = {
  id: ID, anchorRD: [r3(ax), r3(ay)], anchor, groundNAP: ground,
  coordinateConvention: `native east/south metres from the outer BAG ring vertex average (RD) of ${PANDS[0]}; y above its 3DBAG ground groundNAP`,
  sources: {
    bag: `https://service.pdok.nl/lv/bag/wfs/v2_0 identificatie=${PANDS.join(',')} (BAG, CC0, fetched 2026-11-05)`,
    shell: PANDS.map(p => `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${p}`).join(' ') + ' (3DBAG, CC BY 4.0, fetched 2026-11-05)',
    tile: 'public/data/extracts/amsterdam/bag-tiles/14/8414/5385.geojson.gz (OSM building parts, ODbL; BAG tier 3)',
  },
  pands, tileFeatures: parts,
};
fs.writeFileSync(`scripts/landmarks/${ID}-footprints.json`, JSON.stringify(out) + '\n');
console.log('anchor', anchor, 'ground', ground, 'tile features', parts.length, parts.map(p => p.id).join(' '));
