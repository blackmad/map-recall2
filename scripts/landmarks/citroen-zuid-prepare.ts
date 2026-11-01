/**
 * Plan source for the Citroën garage (citroen-zuid, BAG 0363100012080490) and Kraanspoor (kraanspoor, BAG 0363100012115127).
 *
 *   node --import tsx scripts/landmarks/citroen-zuid-prepare.ts [--id=kraanspoor --pand=0363100012115127]
 *
 * Reads the BAG outline from PDOK BAG WFS in RD (CC0) and the 3DBAG LoD2.2 shell (CC BY 4.0,
 * https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.<pand>; both cached) and writes
 * scripts/landmarks/<id>-footprints.json in the native frame: x east, z south, y up from the 3DBAG ground,
 * metres, origin = vertex average of the BAG ring (RD). `surfaces` is the LoD2.2 shell in the ShellSource format worship-shell and
 * big-kit read; `nativeRing` is the BAG ring; `facadeRing` is the same ring with near-collinear vertices (< 0.15 m off the chord)
 * merged, so a straight front split into many BAG vertices is one facade edge while the curved corners keep their facets.
 */
import fs from 'node:fs';
import {cachedJson} from '../pand-reference/core.ts';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const ID = arg('id', 'citroen-zuid'), PAND = arg('pand', '0363100012080490');
const wfs = `https://service.pdok.nl/lv/bag/wfs/v2_0?service=WFS&version=2.0.0&request=GetFeature&typeName=bag:pand&outputFormat=application/json&srsName=urn:ogc:def:crs:EPSG::28992&count=1&filter=${encodeURIComponent(`<Filter><PropertyIsEqualTo><PropertyName>identificatie</PropertyName><Literal>${PAND}</Literal></PropertyIsEqualTo></Filter>`)}`;
const bag = (await cachedJson(wfs)).features[0];
const d = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND}`);
const open = (r: number[][]) => (r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r);
const ringRD = open(bag.geometry.coordinates[0]);
const ax = ringRD.reduce((s: number, p: number[]) => s + p[0], 0) / ringRD.length, ay = ringRD.reduce((s: number, p: number[]) => s + p[1], 0) / ringRD.length;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
/** Douglas-Peucker on a closed ring. */
function simplify(ring: number[][], tol: number): number[][] {
  const keep = new Array(ring.length).fill(false);
  const dist = (p: number[], a: number[], b: number[]) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1e-9; return Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / L; };
  const rec = (i: number, j: number) => {
    let best = -1, bi = -1;
    for (let k = i + 1; k < j; k++) { const d = dist(ring[k % ring.length], ring[i % ring.length], ring[j % ring.length]); if (d > best) { best = d; bi = k; } }
    if (best > tol) { keep[bi % ring.length] = true; rec(i, bi); rec(bi, j); }
  };
  let far = 0, fd = 0; ring.forEach((p, k) => { const d = Math.hypot(p[0] - ring[0][0], p[1] - ring[0][1]); if (d > fd) { fd = d; far = k; } });
  keep[0] = keep[far] = true; rec(0, far); rec(far, ring.length);
  return ring.filter((_, k) => keep[k]);
}
const attrs = d.feature.CityObjects[`NL.IMBAG.Pand.${PAND}`].attributes;
const ground = attrs.b3_h_maaiveld as number;
const tr = d.metadata.transform;
const verts = (d.feature.vertices as number[][]).map(v => { const p = v.map((n, i) => n * tr.scale[i] + tr.translate[i]); return [r3(p[0] - ax), r3(Math.max(0, p[2] - ground)), r3(-(p[1] - ay))]; });
const g = d.feature.CityObjects[`NL.IMBAG.Pand.${PAND}-0`].geometry.find((x: {lod: string}) => x.lod === '2.2');
const surfaces = (g.boundaries[0] as number[][][]).map((s, i) => ({type: g.semantics.surfaces[g.semantics.values[0][i]].type as string, rings: s.map(r => r.map(k => verts[k]))}));
const out = {
  id: ID, bagId: PAND, anchorRD: [r3(ax), r3(ay)], anchor: rdToLngLat(ax, ay).map(v => +v.toFixed(8)), groundNAP: ground,
  coordinateConvention: 'native east/south metres from anchor; y above local ground',
  sources: {bag: `https://service.pdok.nl/lv/bag/wfs/v2_0 identificatie=${PAND} (BAG, CC0, fetched 2026-11-01)`, shell: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${PAND} (3DBAG, CC BY 4.0, fetched 2026-11-01)`},
  attributes: {roofMaxNAP: attrs.b3_h_dak_max, roofMinNAP: attrs.b3_h_dak_min, ridgeNAP: attrs.b3_h_nok, roof70pNAP: attrs.b3_h_dak_70p},
  nativeRing: ringRD.map((p: number[]) => [r3(p[0] - ax), r3(-(p[1] - ay))]),
  facadeRing: [] as number[][],
  surfaces,
};
out.facadeRing = simplify(out.nativeRing, 0.15);
fs.writeFileSync(`scripts/landmarks/${ID}-footprints.json`, JSON.stringify(out) + '\n');
console.log(out.anchor, 'ring', out.nativeRing.length, 'facade ring', out.facadeRing.length, 'surfaces', surfaces.length, Object.entries(surfaces.reduce((m: Record<string, number>, s) => (m[s.type] = (m[s.type] ?? 0) + 1, m), {})));
