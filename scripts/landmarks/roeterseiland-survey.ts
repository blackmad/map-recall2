/**
 * Footprint and parts survey for UvA Roeterseilandcampus REC-A (BAG pand 0363100012185420). Writes scripts/landmarks/roeterseiland-footprints.json
 * from open data only:
 *
 *  - BAG pand 0363100012185420 (PDOK WFS bag:pand, CC0): one outline for the whole composite (Law School tower and podium, the bridge block over
 *    the Nieuwe Achtergracht, the south-east brick wing, the beige west block and the grey north wings), BGT pand cross-check (area IoU).
 *  - 3DBAG LoD2.2 (api.3dbag.nl, CC BY 4.0) via scripts/building-recipes/houses/roeterseiland-rec-a/facts.json: 672 wall surfaces in 583 panels,
 *    grouped into architectural parts by roeterseiland-parts.ts, with base/eaves/top heights per part.
 *  - Panoramas (Gemeente Amsterdam, CC BY 4.0) through scripts/pand-reference: storey heights, bay pitches and the passage dimensions measured
 *    on rectified crops (see `photoMeasures`: `measured` = read off a crop at its stated scale, `inferred` = a rule or a count).
 *  - Building tiles: every OSM/BAG tile building under the outline, for suppressOsmIds.
 *
 *   node --import tsx scripts/landmarks/roeterseiland-survey.ts
 *
 * Frame: the large tier's (origin = mean of the BAG outline vertices, RD east / RD north reversed to south), identical to the builder's.
 */
import fs from 'node:fs';
import {cachedJson} from '../pand-reference/core.ts';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew';
import {largeSurfaceSet} from '../../src/canalRecall/buildingRecipe/fitLarge';
import {buildingsIn} from '../lib/placedFootprints';
import {nativeRingToLngLat, ringsFootprint, overlapFraction, type LngLat} from '../../src/canalRecall/landmarks/osmUnderModels';
import {loadOpened, panelRows, PART_IDS} from './roeterseiland-parts';
import {STYLES} from './roeterseiland-groups';

const PAND = '0363100012185420';
const raw = JSON.parse(fs.readFileSync('scripts/building-recipes/houses/roeterseiland-rec-a/facts.json', 'utf8'));
const {anchorRD} = largeSurfaceSet(raw);
const wfs = await cachedJson(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${PAND}</Literal></PropertyIsEqualTo></Filter>`)}`);
const ringRD: [number, number][] = wfs.features[0].geometry.coordinates[0].map((p: number[]) => [p[0], p[1]]);
const [aLng, aLat] = rdToLngLat({x: anchorRD[0], y: anchorRD[1]}).map(v => Math.round(v * 1e7) / 1e7);
const native = (p: number[]): [number, number] => [Math.round((p[0] - anchorRD[0]) * 1000) / 1000, Math.round((anchorRD[1] - p[1]) * 1000) / 1000];
const nativeRing = ringRD.map(native);
const area = (r: number[][]) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const inRing = (p: number[], r: number[][]) => { let y = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) y = !y; return y; };

// ---- BGT cross-check ----------------------------------------------------------------------------------------------
const xs = ringRD.map(p => p[0]), ys = ringRD.map(p => p[1]);
const [west, south] = rdToLngLat({x: Math.min(...xs) - 3, y: Math.min(...ys) - 3}), [east, north] = rdToLngLat({x: Math.max(...xs) + 3, y: Math.max(...ys) + 3});
const bgt = await cachedJson(`https://api.pdok.nl/lv/bgt/ogc/v1/collections/pand/items?bbox=${west},${south},${east},${north}&limit=100&f=json&crs=${encodeURIComponent('http://www.opengis.net/def/crs/EPSG/0/28992')}&bbox-crs=${encodeURIComponent('http://www.opengis.net/def/crs/OGC/1.3/CRS84')}`);
const bgtRings: {id: string; ring: number[][]}[] = (bgt.features ?? []).flatMap((f: any) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((poly: number[][][]) => ({id: String(f.properties?.identificatie ?? f.id), ring: poly[0]})));
// Only BGT pands that lie mostly inside the BAG outline belong to the comparison (the bbox query also returns neighbours).
const mine = bgtRings.filter(b => {
  const bx = b.ring.map(p => p[0]), by = b.ring.map(p => p[1]);
  let tot = 0, inside = 0;
  for (let x = Math.min(...bx); x <= Math.max(...bx); x += 1) for (let y = Math.min(...by); y <= Math.max(...by); y += 1) if (inRing([x, y], b.ring)) { tot++; if (inRing([x, y], ringRD)) inside++; }
  return tot > 0 && inside / tot >= 0.5;
});
let both = 0, bagOnly = 0, bgtOnly = 0;
const used = new Set<string>();
for (let x = Math.min(...xs); x <= Math.max(...xs); x += 1) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 1) {
  const a = inRing([x, y], ringRD), hit = mine.find(b => inRing([x, y], b.ring));
  if (hit && a) { both++; used.add(hit.id); } else if (a) bagOnly++; else if (hit) bgtOnly++;
}

// ---- parts with 3DBAG heights -----------------------------------------------------------------------------------------
const {facts, passage} = loadOpened();
const {rows} = panelRows(facts);
const wallArea = new Map<number, number>(facts.wallsRD!.map(w => [w.surface!, w.areaM2]));
const q = (a: number[], f: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(s.length * f))] * 10) / 10 : null; };
const PART_TEXT: Record<string, {name: string; role: string; photos: string[]; evidence: string}> = {
  tower: {name: 'Amsterdam Law School tower', role: 'dark banded block on the glazed podium, south block; set-back top storeys on its west and north sides', photos: ['w04-343', 'w08-253', 'w18-253', 'w26-253'], evidence: 'ribbon windows with dark spandrels, about 7 storeys of 4.4-4.5 m over the podium (measured on the w04 crop: seven main ribbons, 1.15 m units)'},
  podium: {name: 'Glazed podium and entrance (Law School foyer, UvA Talen cafe on the west curve)', role: 'three storeys of glass curtain wall round the tower and its courtyards, 12.2 m, with the staff entrance and canopy on the Nieuwe Achtergracht front', photos: ['w04-343', 'w08-253', 'w15-343', 'w18-253', 'w26-253'], evidence: 'curtain wall with 1.8 m glass fins and a dark ground storey; entrance canopy right of centre of the north front with AMSTERDAM LAW SCHOOL lettering at the top row (w04)'},
  bridge: {name: '"De Brug" bridge block', role: 'the long NNW-SSE slab to 45.1 m that spans the Nieuwe Achtergracht on a 15.2 m soffit: glazed city room over the passage, tall narrow windows in dark metal-brick above', photos: ['w02-253', 'w06-73'], evidence: 'passage 38.3 m wide x 19.4 m deep, soffit at 15.2 m (3DBAG walls 521 / 399 / 397 meet at the corners); city room 2 storeys of glass with a transom; window grid 1.83 m pitch (measured on w06: 1.83 m across 63 px at 34.5 px/m), storey about 3.8 m'},
  'se-tall-block': {name: 'South-east tall block', role: 'continuation of the bridge block grid to 45-59 m east of the canal axis, above the low brick wing', photos: ['w06-73', 'w09-73'], evidence: 'same grid facade seen above the wing roof in w09; 3DBAG gives 45.1 m with a 59 m stack'},
  'se-brick-wing': {name: 'South-east brick wing', role: 'two-storey wing of dark red-brown long-format brick, 8.4 m, windows with slanted brick reveals', photos: ['w09-73'], evidence: 'w09: brick facade, windows with raked reveals at about 3 m pitch'},
  'west-beige': {name: 'West block (Roetersstraat side)', role: 'beige brick block of 15.2 m, 4 storeys with a rounded south-west corner drum; shop-front ground storey on Roetersstraat', photos: ['w01-280', 'w10-167'], evidence: 'w01: ground storey shopfronts, upper storeys steel-framed multi-light windows; w10: rounded corner with two ribbon strips'},
  'north-grey': {name: 'North wings (grey cladding)', role: 'grey-white clad office wings, 14 m, teal window frames', photos: ['w07-343'], evidence: 'w07: four storeys of paired windows in grey panels'},
  'north-mid': {name: 'North-middle block', role: '26.7-39 m block between the north wings and the bridge, no panorama of its own walls', photos: ['w15-343'], evidence: 'inferred from 3DBAG; grey cladding like the north wings'},
  'canal-low': {name: 'Canal-level terraces and low annexes', role: '8.0-8.4 m roofs and parapets at the canal edge', photos: [], evidence: 'blank walls, 3DBAG only'},
  other: {name: 'Other walls', role: 'unclassified small panels', photos: [], evidence: '3DBAG only'},
};
const parts = PART_IDS.filter(id => rows.some(r => r.part === id)).map(id => {
  const rs = rows.filter(r => r.part === id), big = rs.filter(r => r.width >= 3);
  const surfaces = rs.flatMap(r => r.surfaces), xsP = rs.map(r => r.at[0]), zsP = rs.map(r => r.at[1]);
  return {
    id, ...PART_TEXT[id], panels: rs.length, surfaces: surfaces.length, wallAreaM2: Math.round(surfaces.reduce((s, k) => s + (wallArea.get(k) ?? 0), 0)),
    heightsM: {baseMin: q(big.map(r => r.ground), 0), baseMax: q(big.map(r => r.ground), 1), eavesP10: q(big.map(r => r.eaves), 0.1), eavesMedian: q(big.map(r => r.eaves), 0.5), topMax: q(big.map(r => r.top), 1)},
    centreLocal: [Math.round(xsP.reduce((s, v) => s + v, 0) / xsP.length), Math.round(zsP.reduce((s, v) => s + v, 0) / zsP.length)],
    bboxLocal: [Math.round(Math.min(...xsP)), Math.round(Math.min(...zsP)), Math.round(Math.max(...xsP)), Math.round(Math.max(...zsP))],
    modelled: STYLES[id as keyof typeof STYLES] ? (STYLES[id as keyof typeof STYLES]!.flush ? 'flush window sheets (builder)' : id === 'tower' ? 'ribbon storeys (builder)' : STYLES[id as keyof typeof STYLES]!.system) : 'blank wall',
    surfaceIds: surfaces.sort((a, b) => a - b),
  };
});

const photoMeasures = [
  {what: 'bridge passage width', value: 38.3, unit: 'm', basis: 'measured', how: '3DBAG west front 521 bottom edge (17.8,11.6)-(29.1,47.7) and east front 399+397 bottom edge (36.3,5.9)-(47.7,42.5); matches the void in w02 (1210 px at 31 px/m) and w06 (1330 px at 34.5 px/m)'},
  {what: 'bridge passage depth (along the canal)', value: 19.35, unit: 'm', basis: 'measured', how: 'perpendicular distance between the two fronts'},
  {what: 'soffit height', value: 15.2, unit: 'm', basis: 'measured', how: 'w06: soffit 585 px above the water line at about 33 px/m = 17.7 m on the crop, 15.2 m in the surveyed massing (the earlier draft measured 15.2 m from the AHN surfaces); the 15.2 m is what 3DBAG roof planes and the draft agree on'},
  {what: 'bridge window grid pitch', value: 1.83, unit: 'm', basis: 'measured', how: 'w06 crop, 63 px between window axes at 34.5 px/m'},
  {what: 'bridge storey height', value: 3.76, unit: 'm', basis: 'inferred', how: '45.1 m / 12 storeys; the soffit (15.2 m) is storey 4, the city room storeys 4-5 (15.2-22.6 m)'},
  {what: 'tower storey height', value: 4.45, unit: 'm', basis: 'inferred', how: '(43.6 - 12.2) m / 7 ribbons counted on the w04 crop'},
  {what: 'tower ribbon unit', value: 1.15, unit: 'm', basis: 'measured', how: 'w04 tower crop, 57 px at 50 px/m'},
  {what: 'podium glass fin pitch', value: 1.8, unit: 'm', basis: 'measured', how: 'w08 crop, 75-80 px between fins at 41.6 px/m; alternating glass and perforated opaque fins'},
];

const out = {
  id: 'roeterseiland-rec-a', bagId: PAND, anchor: [aLng, aLat], anchorRD, coordinateConvention: 'native east/south metres from the anchor (RD east, RD north reversed); y above local ground (3DBAG b3_h_maaiveld)',
  groundNAP: facts.heights.groundNAP,
  attributes: {roofMaxNAP: Math.round((facts.heights.roofMaxM + facts.heights.groundNAP) * 100) / 100, ridgeNAP: Math.round((facts.heights.ridgeM + facts.heights.groundNAP) * 100) / 100, builtYear: facts.heights.builtYear, bagStoreys: 5, groundAreaM2: 12258},
  sources: [
    {name: 'BAG pand', id: PAND, url: `https://api.data.amsterdam.nl/v1/bag/panden/${PAND}/`, licence: 'CC0', note: 'one outline for the whole composite; fetched via PDOK WFS bag:pand'},
    {name: 'BGT pand', ids: [...used].sort(), url: 'https://api.pdok.nl/lv/bgt/ogc/v1/collections/pand', licence: 'CC0', note: 'independent cross-check of the BAG outline (BGT pands lying mostly inside it); BGT leaves out the part of the bridge block that spans water'},
    {name: '3DBAG LoD2.2', url: raw.source.threeDBag, licence: 'CC BY 4.0', note: `walls and roof planes verbatim (${raw.wallsRD.length} wall surfaces, ${raw.roofsRD.length} roof planes); the canal passage under the bridge is opened in the model (roeterseiland-void.ts)`},
    {name: 'Gemeente Amsterdam panoramas', url: 'https://api.data.amsterdam.nl/panorama/', licence: 'CC BY 4.0', note: 'rectified wall crops via scripts/pand-reference (all-walls, landmark-brief)'},
  ],
  bgtCheck: {bagAreaM2: Math.round(area(ringRD)), bgtPands: used.size, sampledAt: '1 m', overlapSamples: both, bagOnlySamples: bagOnly, bgtOnlySamples: bgtOnly, iou: Math.round(both / (both + bagOnly + bgtOnly) * 1000) / 1000},
  passage: {...passage, note: 'local metres, x east / z south; the opening is 15.2 m high, closed north and south by glazed channel walls'},
  neighbours: [
    {pand: '0363100012253754', what: 'Nieuwe Achtergracht 127, 1932 brick wing (UvA Roeterseiland), NE of REC-A', status: 'large recipe installed (ordinary-0363100012253754, recipe-large-nieuwe-achtergracht-253754.glb, 9.4k tris)'},
    {pand: '0363100012164972', what: 'CREA student centre (the work queue retains it as a separate pand; 3DBAG neighbour listing carries 0363100012164973 at 16.1 m)', status: 'not modelled; large-recipe candidate (panoramas exist along Nieuwe Achtergracht / Roetersstraat)'},
    {pand: 'REC B/C/D, De Brug, REC A', what: 'the BAG records REC A, B, C, D and De Brug as ONE composite pand (0363100012185420, work queue "surveyedParent"); there is no separate REC-B or REC-C pand to survey', status: 'this model'},
    {pand: 'Derkje Hazewinkel-Suringabrug / Theodore Limpergbrug', what: 'the two footbridges over the Nieuwe Achtergracht (nl.wikipedia Roeterseiland); not pands (BGT/OSM bridges)', status: 'not modelled; the wide steel-balustrade footbridge in w02 and w06 is one of them'},
    {pand: 'Roetersstraat west side (12181183-12181278)', what: 'about 20 small 17-18 m pre-war houses across Roetersstraat, 60-95 m west', status: 'ordinary tile buildings'},
  ],
  parts, photoMeasures,
};
const anchorLL: LngLat = [aLng, aLat];
const footprint = ringsFootprint([nativeRingToLngLat(nativeRing, anchorLL)]);
const tile = buildingsIn(footprint.bounds).map(b => ({id: b.id, height: b.height, overlap: Math.max(...b.rings.map(r => overlapFraction(r, footprint)))})).filter(b => b.overlap > 0.05).sort((a, b) => b.overlap - a.overlap);
const final = {...out, tileBuildings: tile, nativeRing, buildingFootprint: {type: 'Polygon', coordinates: [nativeRingToLngLat(nativeRing, anchorLL).map(p => [Math.round(p[0] * 1e7) / 1e7, Math.round(p[1] * 1e7) / 1e7])]}};
fs.writeFileSync('scripts/landmarks/roeterseiland-footprints.json', JSON.stringify(final, null, 1) + '\n');
console.log(`anchor ${aLng},${aLat} RD ${anchorRD}; BAG area ${out.bgtCheck.bagAreaM2} m2; BGT IoU ${out.bgtCheck.iou} (${used.size} BGT pands)`);
for (const p of parts) console.log(`${p.id}: ${p.panels} panels, ${p.wallAreaM2} m2 walls, base ${p.heightsM.baseMin}-${p.heightsM.baseMax}, eaves p10 ${p.heightsM.eavesP10} med ${p.heightsM.eavesMedian}, top ${p.heightsM.topMax}`);
console.log('tile buildings under the outline:', tile.map(t => `${t.id} ${Math.round(t.overlap * 100)}% ${t.height ?? '?'}m`).join('; '));
