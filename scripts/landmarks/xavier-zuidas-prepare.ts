/**
 * Plan source for Xavier (Gustav Mahlerlaan, Zuidas; K en K Architecten / Pim Köther, 2016-2019; nl.wikipedia "Xavier (Amsterdam)").
 * Two BAG pands: 0363100012246555 (the 21-storey front on the Gustav Mahlerlaan with the east wing, BAG 2019, 22 storeys) and
 * 0363100012246554 (the six-storey south-west block on the George Gershwinlaan side, BAG 2019).
 *
 *   node --import tsx scripts/landmarks/xavier-zuidas-prepare.ts
 *
 * Copy of telefooncentrale-telegraaf-prepare.ts for two pands on one anchor (vertex average of the tower pand's BAG ring, RD).
 * BAG outlines from PDOK BAG WFS (CC0), 3DBAG LoD2.2 shells (CC BY 4.0), both cached under .cache/pand-reference.
 * Writes scripts/landmarks/xavier-zuidas-footprints.json: x east, z south, y up from each pand's 3DBAG ground, metres.
 */
import fs from 'node:fs';
import {cachedJson} from '../pand-reference/core.ts';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const ID = 'xavier-zuidas';
const PANDS = ['0363100012246555', '0363100012246554'];
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const open = (r: number[][]) => (r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);
const wfs = (p: string) => `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${p}</Literal></PropertyIsEqualTo></Filter>`)}`;
const rings = await Promise.all(PANDS.map(async p => open((await cachedJson(wfs(p))).features[0].geometry.coordinates[0])));
const ax = rings[0].reduce((s: number, p: number[]) => s + p[0], 0) / rings[0].length, ay = rings[0].reduce((s: number, p: number[]) => s + p[1], 0) / rings[0].length;
const pands = [];
for (const [k, PAND] of PANDS.entries()) {
  const d = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND}`);
  const attrs = d.feature.CityObjects[`NL.IMBAG.Pand.${PAND}`].attributes;
  const ground = attrs.b3_h_maaiveld as number;
  const tr = d.metadata.transform;
  const verts = (d.feature.vertices as number[][]).map(v => { const p = v.map((n, i) => n * tr.scale[i] + tr.translate[i]); return [r3(p[0] - ax), r3(Math.max(0, p[2] - ground)), r3(-(p[1] - ay))]; });
  const g = d.feature.CityObjects[`NL.IMBAG.Pand.${PAND}-0`].geometry.find((x: {lod: string}) => x.lod === '2.2');
  const surfaces = (g.boundaries[0] as number[][][]).map((s, i) => ({type: g.semantics.surfaces[g.semantics.values[0][i]].type as string, rings: s.map(r => r.map(q => verts[q]))}));
  pands.push({
    bagId: PAND, groundNAP: ground,
    attributes: {roofMaxNAP: attrs.b3_h_dak_max, roofMinNAP: attrs.b3_h_dak_min, ridgeNAP: attrs.b3_h_nok, roof70pNAP: attrs.b3_h_dak_70p, storeys: attrs.b3_bouwlagen ?? null},
    nativeRing: rings[k].map((p: number[]) => [r3(p[0] - ax), r3(-(p[1] - ay))]),
    surfaces,
  });
}
const out = {
  id: ID, anchorRD: [r3(ax), r3(ay)], anchor: rdToLngLat(ax, ay).map(v => +v.toFixed(8)),
  coordinateConvention: 'native east/south metres from anchor; y above each pand local ground',
  sources: {
    bag: PANDS.map(p => `https://service.pdok.nl/lv/bag/wfs/v2_0 identificatie=${p} (BAG, CC0, fetched 2026-11-06)`),
    shell: PANDS.map(p => `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${p} (3DBAG, CC BY 4.0, fetched 2026-11-06)`),
    osm: ['w457006345 Xavier (building=apartments, height 70, 21 levels, ref:bag 0363100012246555)', 'w457006347 Xavier (height 20, 6 levels, ref:bag 0363100012246554); OSM extract 2026-10-23, ODbL'],
    wikipedia: 'https://nl.wikipedia.org/wiki/Xavier_(Amsterdam) (CC BY-SA 4.0, read 2026-11-06)',
  },
  pands,
};
fs.writeFileSync(`scripts/landmarks/${ID}-footprints.json`, JSON.stringify(out) + '\n');
for (const p of pands) {
  const roofs = p.surfaces.filter(s => s.type === 'RoofSurface').map(s => ({h: s.rings[0].reduce((a, q) => a + q[1], 0) / s.rings[0].length, x: s.rings[0].reduce((a, q) => a + q[0], 0) / s.rings[0].length, z: s.rings[0].reduce((a, q) => a + q[2], 0) / s.rings[0].length, n: s.rings[0].length}));
  console.log(p.bagId, 'ground', p.groundNAP, 'surfaces', p.surfaces.length, p.attributes);
  for (const r of roofs.sort((a, b) => b.h - a.h)) console.log('  roof h', r.h.toFixed(1), 'at', r.x.toFixed(1), r.z.toFixed(1), 'n', r.n);
}
console.log('anchor', out.anchor);
