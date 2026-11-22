/**
 * Block pilot (lane belt-block-pilot-20261122): BAG outlines and 3DBAG LoD2.2 shells for every pand of one canal face,
 * in ONE shared native frame (x east, z south, y up from each pand's 3DBAG ground, metres from the RD vertex average of
 * all rings), plus the measured front line of each pand (review data walls.json, lng/lat) in the same frame.
 *
 *   node --import tsx scripts/belt-block/prepare.ts <id> <walls.json> <pand,pand,...>
 *
 * Writes scripts/belt-block/<id>-source.json. Sources: PDOK BAG WFS (CC0) and api.3dbag.nl (CC BY 4.0), both cached by
 * scripts/pand-reference/core.ts cachedJson; same reads as scripts/landmarks/bag-shell-prepare.ts, many pands at once.
 */
import fs from 'node:fs';
import {cachedJson} from '../pand-reference/core.ts';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const [ID, WALLS, LIST] = process.argv.slice(2);
if (!ID || !WALLS || !LIST) { console.error('usage: prepare.ts <id> <walls.json> <pand,pand,...>'); process.exit(2); }
const pands = LIST.split(',');
const walls = JSON.parse(fs.readFileSync(WALLS, 'utf8')).walls as Record<string, {a: [number, number]; b: [number, number]; lengthM: number}>;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const open = (r: number[][]) => (r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);

type Raw = {pand: string; ringRD: number[][]; d: any; bag: any};
const raws: Raw[] = [];
for (const pand of pands) {
  const wfs = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${pand}</Literal></PropertyIsEqualTo></Filter>`)}`;
  const bag = (await cachedJson(wfs)).features[0];
  const d = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${pand}`);
  raws.push({pand, ringRD: open(bag.geometry.coordinates[0]), d, bag});
}
const all = raws.flatMap(r => r.ringRD);
const ax = all.reduce((s, p) => s + p[0], 0) / all.length, ay = all.reduce((s, p) => s + p[1], 0) / all.length;
const nat = (x: number, y: number): [number, number] => [r3(x - ax), r3(-(y - ay))];

const out = {
  id: ID, anchorRD: [r3(ax), r3(ay)], anchor: rdToLngLat(ax, ay).map(v => +v.toFixed(8)),
  coordinateConvention: 'native east/south metres from anchorRD; y above each pand\'s 3DBAG ground (groundNAP per pand)',
  sources: {bag: 'https://service.pdok.nl/lv/bag/wfs/v2_0 (BAG, CC0)', shell: 'https://api.3dbag.nl/collections/pand/items (3DBAG, CC BY 4.0)', walls: WALLS},
  pands: raws.map(({pand, ringRD, d, bag}) => {
    const attrs = d.feature.CityObjects[`NL.IMBAG.Pand.${pand}`].attributes, ground = attrs.b3_h_maaiveld as number, tr = d.metadata.transform;
    const verts = (d.feature.vertices as number[][]).map(v => { const p = v.map((n, i) => n * tr.scale[i] + tr.translate[i]); return [r3(p[0] - ax), r3(Math.max(0, p[2] - ground)), r3(-(p[1] - ay))]; });
    const g = d.feature.CityObjects[`NL.IMBAG.Pand.${pand}-0`].geometry.find((x: {lod: string}) => x.lod === '2.2');
    const surfaces = (g.boundaries[0] as number[][][]).map((s, i) => ({type: g.semantics.surfaces[g.semantics.values[0][i]].type as string, rings: s.map(r => r.map(k => verts[k]))}));
    const w = walls[pand];
    const [wa, wb] = [w.a, w.b].map(([lng, lat]) => { const p = lngLatToRd(lng, lat); return nat(p[0], p[1]); });
    return {
      pand, built: bag.properties.bouwjaar, groundNAP: ground,
      attributes: {roofMaxNAP: attrs.b3_h_dak_max, roofMinNAP: attrs.b3_h_dak_min, ridgeNAP: attrs.b3_h_nok, roof70pNAP: attrs.b3_h_dak_70p},
      ring: ringRD.map(p => nat(p[0], p[1])), front: {a: wa, b: wb, lengthM: w.lengthM}, surfaces,
    };
  }),
};
fs.writeFileSync(`scripts/belt-block/${ID}-source.json`, JSON.stringify(out) + '\n');
for (const p of out.pands) console.log(p.pand, p.built, 'ground', p.groundNAP, 'roof max', (p.attributes.roofMaxNAP - p.groundNAP).toFixed(1), 'ridge', (p.attributes.ridgeNAP - p.groundNAP).toFixed(1), 'front', p.front.lengthM, 'surfaces', p.surfaces.length);
