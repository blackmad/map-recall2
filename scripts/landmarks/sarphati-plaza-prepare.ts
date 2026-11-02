/**
 * Sarphati Plaza (Rhijnspoorplein / Weesperplein, BAG 0363100012182840, bouwjaar 1992) plan source.
 *
 *   node --import tsx scripts/landmarks/sarphati-plaza-prepare.ts --street-nap=0.05
 *   node --import tsx scripts/landmarks/sarphati-plaza-prepare.ts --id=apollo-hotel --pand=0363100012148632
 *
 * Reads the BAG ring from PDOK BAG WFS in RD (CC0) and the 3DBAG LoD2.2 shell (CC BY 4.0,
 * https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.0363100012182840; both cached by pand-reference/core.ts) and writes
 * scripts/landmarks/<id>-footprints.json in one native frame: x east, z south, y up from the street datum, metres, origin = vertex
 * average of the outer BAG ring (RD). The street datum defaults to the pand's 3DBAG ground (b3_h_maaiveld); Sarphati Plaza's
 * 3DBAG ground (-2.54 m NAP) is pulled down by its car-park ramp, so it takes the 3DBAG ground of the neighbour on the
 * Sarphatistraat, 0363100012182841 (0.05 m NAP): --street-nap=0.05. `neighbours` are the other BAG pands (committed z14 bag tiles, tier 3)
 * within 3 m of the ring, with their tile height. `roofs` keeps only the 3DBAG RoofSurface polygons.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import {cachedJson} from '../pand-reference/core.ts';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const ID = process.argv.find(a => a.startsWith('--id='))?.slice(5) ?? 'sarphati-plaza';
const PAND = process.argv.find(a => a.startsWith('--pand='))?.slice(7) ?? '0363100012182840';
const STREET = process.argv.find(a => a.startsWith('--street-nap='))?.slice(13);
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const open = (r: number[][]) => (r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);

const wfs = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${PAND}</Literal></PropertyIsEqualTo></Filter>`)}`;
const bagFeature = (await cachedJson(wfs)).features[0];
const rings: number[][][] = bagFeature.geometry.coordinates.map(open);
const outer = rings[0];
const ax = outer.reduce((s, p) => s + p[0], 0) / outer.length, ay = outer.reduce((s, p) => s + p[1], 0) / outer.length;
const toNative = (p: number[]) => [r3(p[0] - ax), r3(-(p[1] - ay))];

const d = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND}`);
const a = d.feature.CityObjects[`NL.IMBAG.Pand.${PAND}`].attributes;
const ground = STREET !== undefined ? Number(STREET) : a.b3_h_maaiveld as number;
const tr = d.metadata.transform;
const verts = (d.feature.vertices as number[][]).map(v => { const q = v.map((n, i) => n * tr.scale[i] + tr.translate[i]); return [r3(q[0] - ax), r3(q[2] - ground), r3(-(q[1] - ay))]; });
const g = d.feature.CityObjects[`NL.IMBAG.Pand.${PAND}-0`].geometry.find((x: {lod: string}) => x.lod === '2.2');
const roofs = (g.boundaries[0] as number[][][]).flatMap((s, i) => g.semantics.surfaces[g.semantics.values[0][i]].type === 'RoofSurface' ? [s.map(r => r.map(kk => verts[kk]))] : []);

const out: Record<string, unknown> = {
  id: ID, bagId: PAND, anchorRD: [r3(ax), r3(ay)], anchor: rdToLngLat(ax, ay).map(v => +v.toFixed(8)), groundNAP: ground, threeDBagGroundNAP: a.b3_h_maaiveld,
  coordinateConvention: 'native east/south metres from the outer BAG ring vertex average (RD); y above the street datum groundNAP',
  bagProperties: {bouwjaar: bagFeature.properties.bouwjaar, status: bagFeature.properties.status, aantal_verblijfsobjecten: bagFeature.properties.aantal_verblijfsobjecten},
  sources: {
    bag: `https://service.pdok.nl/lv/bag/wfs/v2_0 identificatie=${PAND} (BAG, CC0, fetched 2026-11-02)`,
    shell: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND} (3DBAG, CC BY 4.0, fetched 2026-11-02)`,
  },
  attributes: {roofMinNAP: a.b3_h_dak_min, roof50pNAP: a.b3_h_dak_50p, roof70pNAP: a.b3_h_dak_70p, roofMaxNAP: a.b3_h_dak_max},
  rings: rings.map(r => r.map(toNative)), roofs,
};
{
  const [lng, lat] = out.anchor as number[], n = 2 ** 14, tx = Math.floor((lng + 180) / 360 * n);
  const ty = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
  const ours = (out.rings as number[][][])[0];
  const near = (r: number[][]) => r.some(p => ours.some((q, i) => { const c = ours[(i + 1) % ours.length], dx = c[0] - q[0], dz = c[1] - q[1], L2 = dx * dx + dz * dz || 1e-9; const u = Math.max(0, Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dz) / L2)); return Math.hypot(p[0] - q[0] - u * dx, p[1] - q[1] - u * dz) < 3; }));
  const seen = new Set<string>(), neighbours: {id: string; height: number; ring: number[][]}[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const f = `public/data/extracts/amsterdam/bag-tiles/14/${tx + dx}/${ty + dy}.geojson.gz`;
    if (!fs.existsSync(f)) continue;
    for (const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString()).features) {
      const pid = String(ft.properties.id);
      if (seen.has(pid) || pid.endsWith(PAND) || ft.properties.tier !== 3) continue;
      seen.add(pid);
      const gg = ft.geometry, ring = (gg.type === 'Polygon' ? gg.coordinates[0] : gg.coordinates[0][0]).map((p: number[]) => toNative(lngLatToRd(p[0], p[1])));
      if (near(ring)) neighbours.push({id: pid, height: ft.properties.height, ring});
    }
  }
  out.neighbours = neighbours;
  console.log('neighbours', neighbours.map(nb => `${nb.id}:${nb.height}`).join(' '));
}
fs.writeFileSync(`scripts/landmarks/${ID}-footprints.json`, JSON.stringify(out) + '\n');
console.log('anchor', out.anchor, 'ground', ground, 'attrs', out.attributes, 'bag', out.bagProperties);
console.log('ring', JSON.stringify((out.rings as number[][][])[0]), 'holes', rings.length - 1, 'roof polys', roofs.length);
