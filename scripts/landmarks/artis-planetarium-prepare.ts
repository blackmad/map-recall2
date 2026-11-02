/**
 * Artis Planetarium plan source: BAG pand 0363100012164980 (Plantage Kerklaan, inside ARTIS; Zeiss planetarium opened 1988,
 * BAG year unknown "1005"): a square one-storey glazed hall under the dome, a glazed link with a glass lantern and a
 * two-storey office/entrance block towards the Plantage Middenlaan corner.
 *
 *   node --import tsx scripts/building-recipes/facts.ts --house=ap-tmp-164980 --pand=0363100012164980 --large --no-photo
 *   (move the house dir's facts.json to staging/landmarks/artis-planetarium/facts.json, delete the house dir)
 *   node --import tsx scripts/landmarks/artis-planetarium-prepare.ts
 *
 * Writes scripts/landmarks/artis-planetarium-footprints.json. Native frame: x east, z south, y up from the 3DBAG ground,
 * origin = vertex average of the BAG outer ring (RD). Plan frame: u along the north-east wall (bearing ~120 deg, towards
 * ESE), v along the north-west wall (bearing ~210 deg, towards SSW), origin at the north corner of the square hall:
 * x = X0 + u cos a + v sin a, z = Z0 - u sin a + v cos a with a = planFrameDeg (three.js rotateY(a)).
 */
import fs from 'node:fs';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const f = JSON.parse(fs.readFileSync('staging/landmarks/artis-planetarium/facts.json', 'utf8'));
const g: number = f.heights.groundNAP;
const strip = (r: number[][]) => r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r;
const ringRD = strip(f.bagFootprintRD[0]);
const ax = ringRD.reduce((s: number, p: number[]) => s + p[0], 0) / ringRD.length, ay = ringRD.reduce((s: number, p: number[]) => s + p[1], 0) / ringRD.length;
const r2 = (v: number) => Math.round(v * 100) / 100;
const L = (p: number[]) => [p[0] - ax, -(p[1] - ay)];
// The square hall: north corner = ring vertex 13, east corner = vertex 9 (ring order of the BAG outline).
const local = ringRD.map(L);
const north = local.reduce((m: number[], p: number[]) => (p[1] < m[1] ? p : m));
const east = local.reduce((m: number[], p: number[]) => (p[0] > m[0] ? p : m));
const dirU = [east[0] - north[0], east[1] - north[1]], len = Math.hypot(dirU[0], dirU[1]);
const cu = dirU[0] / len, su = dirU[1] / len;       // u axis in native (x, z)
const a = -Math.atan2(su, cu);                       // rotateY(a) maps (u, 0) to (cu, su)
const UV = (p: number[]) => { const q = L(p), x = q[0] - north[0], z = q[1] - north[1]; return [r2(x * cu + z * su), r2(-x * su + z * cu)]; };
const out = {
  id: 'artis-planetarium', pand: '0363100012164980',
  bag: 'https://api.data.amsterdam.nl/v1/bag/panden/0363100012164980/ (CC0)',
  frame: `x east, z south, y up from the 3DBAG ground (${r2(g)} m NAP); origin = vertex average of the BAG outer ring (RD)`,
  planFrameDeg: r2((a * 180) / Math.PI), planOrigin: [r2(north[0]), r2(north[1])],
  anchorRD: [r2(ax), r2(ay)], anchor: rdToLngLat(ax, ay).map((v: number) => +v.toFixed(7)),
  threeDBag: `${f.source?.threeDBag ?? '3DBAG'} (CC BY 4.0)`,
  heights: {ridgeM: r2(f.heights.ridgeM), groundNAP: r2(g)},
  ring: ringRD.map(L).map((p: number[]) => p.map(r2)), ringUV: ringRD.map(UV),
  ringLngLat: ringRD.map((p: number[]) => rdToLngLat(p[0], p[1]).map((v: number) => +v.toFixed(7))),
  roofsUV: f.roofsRD.map((r: any) => ({id: r.surfaceId.split(':').at(-1), slope: Math.round(r.slopeDeg), area: r2(r.areaM2), ring: r.ringsRD[0].map((p: number[]) => [...UV(p), r2(p[2] - g)])})),
};
fs.writeFileSync('scripts/landmarks/artis-planetarium-footprints.json', JSON.stringify(out));
console.log('anchor', out.anchor, 'frame', out.planFrameDeg, out.planOrigin, 'ring', out.ringUV.length);
