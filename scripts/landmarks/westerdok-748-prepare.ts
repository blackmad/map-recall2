/**
 * Westerdok 748 courtyard block (Westerdokseiland) plan source.
 *
 *   node --import tsx scripts/landmarks/westerdok-748-prepare.ts
 *
 * One BAG pand, 0363100012186003 (bouwjaar 2008). Reads the BAG ring from PDOK BAG WFS in RD (CC0) and the 3DBAG LoD2.2 shell
 * (CC BY 4.0, https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012186003; both cached by pand-reference/core.ts)
 * and writes scripts/landmarks/westerdok-748-footprints.json in one native frame: x east, z south, y up from the street
 * (the 3DBAG ground, b3_h_maaiveld), metres, origin = vertex average of the outer BAG ring (RD).
 * `neighbours` are the other BAG pands (committed z14 bag tiles, tier 3) within 3 m of the ring, with their tile height.
 * `roofs.main` keeps only the 3DBAG RoofSurface polygons (the walls are derived from the rings).
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import {cachedJson} from '../pand-reference/core.ts';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const PANDS = {main: '0363100012186003'} as const;
const STREET_NAP = 1.3;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const open = (r: number[][]) => (r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);

const bag: Record<string, {rings: number[][][]}> = {};
for (const [k, p] of Object.entries(PANDS)) {
  const wfs = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${p}</Literal></PropertyIsEqualTo></Filter>`)}`;
  bag[k] = {rings: (await cachedJson(wfs)).features[0].geometry.coordinates.map(open)};
}
const outer = bag.main.rings[0];
const ax = outer.reduce((s, p) => s + p[0], 0) / outer.length, ay = outer.reduce((s, p) => s + p[1], 0) / outer.length;
const toNative = (p: number[]) => [r3(p[0] - ax), r3(-(p[1] - ay))];

const out: Record<string, unknown> = {
  id: 'westerdok-748', bagIds: PANDS, anchorRD: [r3(ax), r3(ay)], anchor: rdToLngLat(ax, ay).map(v => +v.toFixed(8)), streetNAP: STREET_NAP,
  coordinateConvention: 'native east/south metres from the main pand outer-ring vertex average (RD); y above 1.30 m NAP (street, 3DBAG ground)',
  sources: Object.fromEntries(Object.entries(PANDS).map(([k, p]) => [k, {
    bag: `https://service.pdok.nl/lv/bag/wfs/v2_0 identificatie=${p} (BAG, CC0, fetched 2026-11-02)`,
    shell: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${p} (3DBAG, CC BY 4.0, fetched 2026-11-02)`,
  }])),
  attributes: {} as Record<string, unknown>, rings: {} as Record<string, number[][][]>, roofs: {} as Record<string, number[][][][]>,
};
for (const [k, p] of Object.entries(PANDS)) {
  const d = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${p}`);
  const a = d.feature.CityObjects[`NL.IMBAG.Pand.${p}`].attributes;
  (out.attributes as Record<string, unknown>)[k] = {groundNAP: a.b3_h_maaiveld, roofMinNAP: a.b3_h_dak_min, roof50pNAP: a.b3_h_dak_50p, roof70pNAP: a.b3_h_dak_70p, roofMaxNAP: a.b3_h_dak_max};
  (out.rings as Record<string, number[][][]>)[k] = bag[k].rings.map(r => r.map(toNative));
  const tr = d.metadata.transform;
  const verts = (d.feature.vertices as number[][]).map(v => { const q = v.map((n, i) => n * tr.scale[i] + tr.translate[i]); return [r3(q[0] - ax), r3(q[2] - STREET_NAP), r3(-(q[1] - ay))]; });
  const g = d.feature.CityObjects[`NL.IMBAG.Pand.${p}-0`].geometry.find((x: {lod: string}) => x.lod === '2.2');
  const roofs = (g.boundaries[0] as number[][][]).flatMap((s, i) => g.semantics.surfaces[g.semantics.values[0][i]].type === 'RoofSurface' ? [s.map(r => r.map(kk => verts[kk]))] : []);
  (out.roofs as Record<string, unknown>)[k] = roofs;
  console.log(k, p, 'rings', bag[k].rings.length, 'roof polys', roofs.length);
}
{
  const [lng, lat] = out.anchor as number[], n = 2 ** 14, tx = Math.floor((lng + 180) / 360 * n);
  const ty = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  const ours = Object.values(out.rings as Record<string, number[][][]>).map(r => r[0]);
  const near = (r: number[][]) => r.some(p => ours.some(R => R.some((q, i) => { const c = R[(i + 1) % R.length], dx = c[0] - q[0], dz = c[1] - q[1], L2 = dx * dx + dz * dz || 1e-9; const u = Math.max(0, Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dz) / L2)); return Math.hypot(p[0] - q[0] - u * dx, p[1] - q[1] - u * dz) < 3; })));
  const seen = new Set<string>(), neighbours: {id: string; height: number; ring: number[][]}[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const f = `public/data/extracts/amsterdam/bag-tiles/14/${tx + dx}/${ty + dy}.geojson.gz`;
    if (!fs.existsSync(f)) continue;
    for (const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString()).features) {
      const pid = String(ft.properties.id);
      if (seen.has(pid) || Object.values(PANDS).some(p => pid.endsWith(p)) || ft.properties.tier !== 3) continue;
      seen.add(pid);
      const g = ft.geometry, ring = (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]).map((p: number[]) => toNative(lngLatToRd(p[0], p[1])));
      if (near(ring)) neighbours.push({id: pid, height: ft.properties.height, ring});
    }
  }
  out.neighbours = neighbours;
  console.log('neighbours', neighbours.map(nb => `${nb.id}:${nb.height}`).join(' '));
}
fs.writeFileSync('scripts/landmarks/westerdok-748-footprints.json', JSON.stringify(out) + '\n');
console.log('anchor', out.anchor);
