/**
 * Footprint survey for the Tropenmuseum block (Koninklijk Instituut voor de Tropen: museum, kwadrant, instituutsgebouw).
 * Writes scripts/landmarks/tropenmuseum-footprints.json from open data only:
 *
 *  - BAG pand 0363100012237251 (PDOK WFS bag:pand, CC0): one 321-vertex outline for the whole complex, 1926. The city's building tiles
 *    do not carry it, which is why the earlier lane found "~25 OSM stand-in ways"; BAG pand 0363100012082861 (4-vertex rhombus,
 *    1968, 47 x 42 m) is a separate modern glass building in the Oosterpark, not part of the museum, and is not used.
 *  - BGT pand (PDOK OGC API, CC0) as an independent cross-check of the BAG outline (area IoU), listed per BGT id.
 *  - 3DBAG LoD2.2 (api.3dbag.nl, CC BY 4.0) via scripts/landmarks/tropenmuseum-facts.json: eaves/ridge per part.
 *  - Building tiles (public/data/extracts/amsterdam/building-tiles): every OSM/BAG tile building inside the outline, for suppressOsmIds.
 *
 *   node --import tsx scripts/landmarks/tropenmuseum-survey.ts [--refresh]
 *
 * Frame: the large tier's (origin = mean of the BAG outline vertices, RD east / RD north reversed to south), identical to the builder's.
 */
import fs from 'node:fs';
import {cachedJson} from '../pand-reference/core.ts';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew';
import {roofHeightAt, type BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts';
import {largeSurfaceSet} from '../../src/canalRecall/buildingRecipe/fitLarge';
import {buildingsIn} from '../lib/placedFootprints';
import {nativeRingToLngLat, outerRings, ringsFootprint, overlapFraction, type LngLat} from '../../src/canalRecall/landmarks/osmUnderModels';

const PAND = '0363100012237251';
const facts: BuildingFacts = JSON.parse(fs.readFileSync('scripts/landmarks/tropenmuseum-facts.json', 'utf8'));
const wfs = await cachedJson(`https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${PAND}</Literal></PropertyIsEqualTo></Filter>`)}`);
const feature = wfs.features[0];
const ringRD: [number, number][] = feature.geometry.coordinates[0].map((p: number[]) => [p[0], p[1]]);
// The builder's frame: the large tier's anchor (mean of the 3DBAG LoD0 outline vertices, rounded to 1 cm); the BAG outline is placed in it.
const anchorRD = largeSurfaceSet(facts).anchorRD;
const [aLng, aLat] = rdToLngLat({x: anchorRD[0], y: anchorRD[1]}).map(v => Math.round(v * 1e7) / 1e7);
const native = (p: number[]): [number, number] => [Math.round((p[0] - anchorRD[0]) * 1000) / 1000, Math.round((anchorRD[1] - p[1]) * 1000) / 1000];
const nativeRing = ringRD.map(native);
const area = (r: number[][]) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const inRing = (p: number[], r: number[][]) => { let y = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < (r[j][0] - r[i][0]) * (p[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) y = !y; return y; };

// ---- BGT cross-check -------------------------------------------------------------------------------------------------
const xs = ringRD.map(p => p[0]), ys = ringRD.map(p => p[1]);
const [west, south] = rdToLngLat({x: Math.min(...xs) - 3, y: Math.min(...ys) - 3}), [east, north] = rdToLngLat({x: Math.max(...xs) + 3, y: Math.max(...ys) + 3});
const bgt = await cachedJson(`https://api.pdok.nl/lv/bgt/ogc/v1/collections/pand/items?bbox=${west},${south},${east},${north}&limit=100&f=json&crs=${encodeURIComponent('http://www.opengis.net/def/crs/EPSG/0/28992')}&bbox-crs=${encodeURIComponent('http://www.opengis.net/def/crs/OGC/1.3/CRS84')}`);
const bgtRings: {id: string; ring: number[][]}[] = (bgt.features ?? []).flatMap((f: any) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((poly: number[][][]) => ({id: String(f.properties?.identificatie ?? f.id), ring: poly[0]})));
let both = 0, bagOnly = 0, bgtOnly = 0;
const used = new Set<string>();
for (let x = Math.min(...xs); x <= Math.max(...xs); x += 0.5) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 0.5) {
  const a = inRing([x, y], ringRD), hit = bgtRings.find(b => inRing([x, y], b.ring));
  if (hit && a) { both++; used.add(hit.id); } else if (a) bagOnly++; else if (hit) bgtOnly++;
}
const bgtIds = [...used].sort();

// ---- parts with 3DBAG heights ----------------------------------------------------------------------------------------
const clip = (ring: number[][], keep: (p: number[]) => number, cut: (a: number[], b: number[]) => number[]) => {
  const out: number[][] = [];
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length], pk = keep(p) >= 0, qk = keep(q) >= 0;
    if (pk) out.push(p);
    if (pk !== qk) out.push(cut(p, q));
  });
  return out;
};
const sideX = (x0: number, sign: number) => ({keep: (p: number[]) => sign * (p[0] - x0), cut: (a: number[], b: number[]): number[] => { const t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + t * (b[1] - a[1])]; }});
const PART_CUT_X = anchorRD[0] + 29; // museum east of the gap between museum and kwadrant (local x = 29 m)
const museum = clip(ringRD.slice(0, -1), sideX(PART_CUT_X, 1).keep, sideX(PART_CUT_X, 1).cut);
const west_ = clip(ringRD.slice(0, -1), sideX(PART_CUT_X, -1).keep, sideX(PART_CUT_X, -1).cut);
const heights = (ring: number[][]) => {
  const hs: number[] = [], bx = ring.map(p => p[0]), by = ring.map(p => p[1]);
  for (let x = Math.min(...bx); x <= Math.max(...bx); x += 1) for (let y = Math.min(...by); y <= Math.max(...by); y += 1) {
    if (!inRing([x, y], ring)) continue;
    const h = roofHeightAt(facts.roofsRD, [x, y], facts.heights.groundNAP);
    if (h !== null) hs.push(h);
  }
  hs.sort((a, b) => a - b);
  const q = (f: number) => Math.round(hs[Math.min(hs.length - 1, Math.floor(hs.length * f))] * 10) / 10;
  return {eavesP10M: q(0.1), medianM: q(0.5), ridgeMaxM: q(1), samples: hs.length};
};
const part = (id: string, name: string, role: string, ring: number[][]) => ({id, name, role, source: 'BAG pand outline clipped at a cut line, heights from 3DBAG LoD2.2 roof planes (1 m sampling)', areaM2: Math.round(area(ring)), nativeRing: [...ring, ring[0]].map(native), ...heights(ring)});
const parts = [
  part('museum', 'Tropenmuseum (museum wing, Linnaeusstraat front, covered light court)', 'east of local x = 29 m', museum),
  part('instituut-kwadrant', 'Instituutsgebouw, kwadrant and Mauritskade wings', 'west of local x = 29 m', west_),
];

// ---- tile buildings under the outline ---------------------------------------------------------------------------------
const anchorLL: LngLat = [aLng, aLat];
const footprint = ringsFootprint([nativeRingToLngLat(nativeRing, anchorLL)]);
const tile = buildingsIn(footprint.bounds).map(b => ({id: b.id, height: b.height, overlap: Math.max(...b.rings.map(r => overlapFraction(r, footprint)))})).filter(b => b.overlap > 0.05).sort((a, b) => b.overlap - a.overlap);

const out = {
  id: 'tropenmuseum', bagId: PAND, anchor: anchorLL, anchorRD, coordinateConvention: 'native east/south metres from the anchor (RD east, RD north reversed); y above local ground (3DBAG b3_h_maaiveld)',
  groundNAP: facts.heights.groundNAP,
  attributes: {roofMaxNAP: Math.round((facts.heights.roofMaxM + facts.heights.groundNAP) * 100) / 100, ridgeNAP: Math.round((facts.heights.ridgeM + facts.heights.groundNAP) * 100) / 100, builtYear: facts.heights.builtYear, floors: null},
  sources: [
    {name: 'BAG pand', id: PAND, url: `https://api.data.amsterdam.nl/v1/bag/panden/${PAND}/`, licence: 'CC0', note: '321-vertex outline of the whole complex, one pand; fetched via PDOK WFS bag:pand'},
    {name: 'BGT pand', ids: bgtIds, url: 'https://api.pdok.nl/lv/bgt/ogc/v1/collections/pand', licence: 'CC0', note: 'independent cross-check of the BAG outline'},
    {name: '3DBAG LoD2.2', url: facts.source.threeDBag, licence: 'CC BY 4.0', note: 'walls and roof planes verbatim (1,221 wall surfaces, 216 roof planes)'},
    {name: 'Rijksmonument 526987 register text', url: 'https://monumentenregister.cultureelerfgoed.nl/monumenten/526987', licence: 'CC0 (data.amsterdam.nl monumenten)', note: 'wings, bay counts, sculpture programme, roof types'},
  ],
  bgtCheck: {bagAreaM2: Math.round(area(ringRD)), bgtPands: bgtIds.length, sampledAt: '0.5 m', overlapSamples: both, bagOnlySamples: bagOnly, bgtOnlySamples: bgtOnly, iou: Math.round(both / (both + bagOnly + bgtOnly) * 1000) / 1000},
  notBeingModelled: [{pand: '0363100012082861', why: '4-vertex rhombus, 1968, a separate modern glass building in the Oosterpark (panorama recording_2025-06-20_10-43-25_02575); the handoff took it for the museum or a theatre'}],
  parts,
  tileBuildings: tile,
  nativeRing,
  buildingFootprint: {type: 'Polygon', coordinates: [nativeRingToLngLat(nativeRing, anchorLL).map(p => [Math.round(p[0] * 1e7) / 1e7, Math.round(p[1] * 1e7) / 1e7])]},
};
fs.writeFileSync('scripts/landmarks/tropenmuseum-footprints.json', JSON.stringify(out, null, 1) + '\n');
console.log(`anchor ${aLng},${aLat} RD ${anchorRD}; BAG area ${out.bgtCheck.bagAreaM2} m2; BGT IoU ${out.bgtCheck.iou} (${bgtIds.length} BGT pands)`);
for (const p of parts) console.log(`${p.id}: ${p.areaM2} m2 eaves p10 ${p.eavesP10M} median ${p.medianM} ridge/max ${p.ridgeMaxM}`);
console.log('tile buildings under the outline:', tile.map(t => `${t.id} ${Math.round(t.overlap * 100)}% ${t.height ?? '?'}m`).join('; '));
