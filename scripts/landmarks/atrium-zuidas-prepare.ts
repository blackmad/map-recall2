/**
 * Source for the Atrium complex (Strawinskylaan 3001-4129, Zuidas): five BAG pands in one native frame.
 *
 *   node --import tsx scripts/landmarks/atrium-zuidas-prepare.ts
 *
 * Reads each BAG outline from PDOK BAG WFS in RD (CC0) and its 3DBAG LoD2.2 shell (CC BY 4.0,
 * https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.<pand>; both cached under .cache/pand-reference) and writes
 * scripts/landmarks/atrium-zuidas-footprints.json: x east, z south, y up from each pand's 3DBAG ground (b3_h_maaiveld), metres,
 * origin = vertex average of the Atrium Parkeergarage BAG ring (0363100012244160) in RD. One entry per pand with its BAG ring
 * and its LoD2.2 surfaces; heights stay per pand (the grounds differ by up to 2.6 m: the NE block stands on the raised
 * Strawinskylaan deck).
 */
import fs from 'node:fs';
import {cachedJson} from '../pand-reference/core.ts';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

export const ATRIUM_PANDS: Record<string, string> = {
  '0363100012244160': 'Atrium Parkeergarage (2018): the garage under the block; its exposed parts are the low deck and ramps',
  '0363100012074056': 'Atrium, former NMB hoofdkantoor (1974): grid-glass blocks, granite cores, the east wing',
  '0363100012246583': 'Atrium Zuidtoren (2017): the bronze-banded tower at Parnassusweg / Eduard van Beinumstraat',
  '0363100012246582': 'Atrium north tower (2019): the banded tower with the ATRIUM letters on Strawinskylaan',
  '0363100012246549': 'Atrium north-east block (2018): the banded block on Strawinskylaan',
};
const ANCHOR_PAND = '0363100012244160';
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const open = (r: number[][]) => (r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);
const wfs = (p: string) => `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${p}</Literal></PropertyIsEqualTo></Filter>`)}`;

const rings: Record<string, number[][]> = {};
for (const p of Object.keys(ATRIUM_PANDS)) rings[p] = open((await cachedJson(wfs(p))).features[0].geometry.coordinates[0]);
const a = rings[ANCHOR_PAND], ax = a.reduce((s, q) => s + q[0], 0) / a.length, ay = a.reduce((s, q) => s + q[1], 0) / a.length;
const pands = [];
for (const [p, role] of Object.entries(ATRIUM_PANDS)) {
  const bag = (await cachedJson(wfs(p))).features[0];
  const d = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${p}`);
  const attrs = d.feature.CityObjects[`NL.IMBAG.Pand.${p}`].attributes;
  const ground = attrs.b3_h_maaiveld as number, tr = d.metadata.transform;
  const verts = (d.feature.vertices as number[][]).map(v => { const q = v.map((n, i) => n * tr.scale[i] + tr.translate[i]); return [r3(q[0] - ax), r3(Math.max(0, q[2] - ground)), r3(-(q[1] - ay))]; });
  const surfaces: {type: string; rings: number[][][]}[] = [];
  for (const [k, co] of Object.entries(d.feature.CityObjects as Record<string, {geometry?: {lod: string; boundaries: number[][][][]; semantics: {surfaces: {type: string}[]; values: number[][]}}[]}>)) {
    if (!/-\d+$/.test(k)) continue;
    const g = co.geometry?.find(x => x.lod === '2.2');
    if (!g) continue;
    g.boundaries[0].forEach((s, i) => surfaces.push({type: g.semantics.surfaces[g.semantics.values[0][i]].type, rings: s.map(r => r.map(n => verts[n]))}));
  }
  pands.push({
    bagId: p, role, bouwjaar: bag.properties?.bouwjaar ?? null, status: bag.properties?.status ?? null, groundNAP: ground,
    attributes: {roofMaxNAP: attrs.b3_h_dak_max, roofMinNAP: attrs.b3_h_dak_min, ridgeNAP: attrs.b3_h_nok, roof70pNAP: attrs.b3_h_dak_70p},
    nativeRing: open(bag.geometry.coordinates[0]).map((q: number[]) => [r3(q[0] - ax), r3(-(q[1] - ay))]),
    lngLatRing: open(bag.geometry.coordinates[0]).map((q: number[]) => rdToLngLat(q[0], q[1]).map(v => +v.toFixed(8))),
    surfaces,
  });
}
const out = {
  id: 'atrium-zuidas', anchorPand: ANCHOR_PAND, anchorRD: [r3(ax), r3(ay)], anchor: rdToLngLat(ax, ay).map(v => +v.toFixed(8)),
  coordinateConvention: 'native east/south metres from anchor; y above each pand\'s 3DBAG ground',
  sources: {
    bag: 'https://service.pdok.nl/lv/bag/wfs/v2_0 identificatie=<pand> (BAG, CC0, fetched 2026-11-06)',
    shell: 'https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.<pand> (3DBAG, CC BY 4.0, fetched 2026-11-06)',
    osm: 'OpenStreetMap (ODbL) Amsterdam extract 2026-10-23: w499393191 Atrium Parkeergarage (ref:bag 0363100012244160, 2018), w27653888 Atrium (0363100012074056, start_date 1972), w900328540 (0363100012246583, 2017), w900328539 (0363100012246582, 2019), w900328541 (0363100012246549, 2018)',
  },
  pands,
};
fs.writeFileSync('scripts/landmarks/atrium-zuidas-footprints.json', JSON.stringify(out) + '\n');
for (const p of pands) console.log(p.bagId, p.bouwjaar, p.status, 'ground', p.groundNAP.toFixed(2), 'ring', p.nativeRing.length, 'surfaces', p.surfaces.length);
