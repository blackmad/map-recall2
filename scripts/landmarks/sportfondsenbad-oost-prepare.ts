/**
 * Sportfondsenbad Oost plan source: the 1886-87 retort house (stokerij) of the Oostergasfabriek, gemeentelijk monument
 * 200525, which covers two BAG panden: 0363100012236677 (north part, the Sportfondsenbad since 1929, Land van Cocagneplein
 * 44) and 0363100012236879 (south part, the former machine room / central kitchen / Sterovita milk factory, now a gym,
 * with the round chimney on its west side).
 *
 *   node --import tsx scripts/building-recipes/facts.ts --house=sfo-tmp-236677 --pand=0363100012236677 --large --no-photo
 *   node --import tsx scripts/building-recipes/facts.ts --house=sfo-tmp-236879 --pand=0363100012236879 --large --no-photo
 *   (move each house dir's facts.json to staging/landmarks/sportfondsenbad-oost/facts.json and facts-236879.json)
 *   node --import tsx scripts/landmarks/sportfondsenbad-oost-prepare.ts
 *
 * Reads the BAG rings and 3DBAG LoD2.2 roofs (BAG CC0, 3DBAG CC BY 4.0, fetched 2026-11-02) and writes
 * scripts/landmarks/sportfondsenbad-oost-footprints.json in the native frame: x east, z south, y up from the 3DBAG ground
 * of 236677, metres, origin = vertex average of the 236677 BAG outer ring (RD). It also writes every ring in the hall
 * frame (u across the halls, positive east-north-east; v along them, positive south-south-east), rotated 18.568 deg
 * from the native frame: x = u cos a + v sin a, z = -u sin a + v cos a (three.js rotateY(a)).
 */
import fs from 'node:fs';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const dir = 'staging/landmarks/sportfondsenbad-oost';
const north = JSON.parse(fs.readFileSync(`${dir}/facts.json`, 'utf8'));
const south = JSON.parse(fs.readFileSync(`${dir}/facts-236879.json`, 'utf8'));
const g: number = north.heights.groundNAP;
const strip = (r: number[][]) => r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r;
const ringRD = strip(north.bagFootprintRD[0]);
const ax = ringRD.reduce((s: number, p: number[]) => s + p[0], 0) / ringRD.length, ay = ringRD.reduce((s: number, p: number[]) => s + p[1], 0) / ringRD.length;
const A = 18.568 * Math.PI / 180, c = Math.cos(A), s = Math.sin(A);
const r2 = (v: number) => Math.round(v * 100) / 100;
const L = (p: number[]) => [r2(p[0] - ax), r2(-(p[1] - ay))];
const UV = (p: number[]) => { const x = p[0] - ax, z = -(p[1] - ay); return [r2(x * c - z * s), r2(x * s + z * c)]; };
const pand = (f: any, id: string) => ({
  id, builtYear: f.heights.builtYear, groundNAP: r2(f.heights.groundNAP), ridgeM: r2(f.heights.ridgeM), roofMaxM: r2(f.heights.roofMaxM),
  bag: `https://api.data.amsterdam.nl/v1/bag/panden/${id}/ (CC0)`,
  ring: strip(f.bagFootprintRD[0]).map(L), ringUV: strip(f.bagFootprintRD[0]).map(UV),
  ringLngLat: strip(f.bagFootprintRD[0]).map((p: number[]) => rdToLngLat(p[0], p[1]).map((v: number) => +v.toFixed(7))),
  roofsUV: f.roofsRD.map((r: any) => ({id: r.surfaceId.split(':').at(-1), slope: Math.round(r.slopeDeg), area: r2(r.areaM2), ring: r.ringsRD[0].map((p: number[]) => [...UV(p), r2(p[2] - g)])})),
});
const out = {
  id: 'sportfondsenbad-oost', panden: ['0363100012236677', '0363100012236879'], monument: 'https://api.data.amsterdam.nl/v1/monumenten/monumenten/9a32d662-086c-4b80-9046-bf218b99f24f (gemeentelijk monument 200525)',
  frame: `x east, z south, y up from the 3DBAG ground of 236677 (${r2(g)} m NAP); origin = vertex average of the 236677 BAG outer ring (RD)`,
  hallFrameDeg: 18.568, anchorRD: [r2(ax), r2(ay)], anchor: rdToLngLat(ax, ay).map((v: number) => +v.toFixed(7)),
  threeDBag: north.source.threeDBag + ' (CC BY 4.0, fetched ' + north.source.fetchedAt + ')',
  ahnChimney: 'AHN4 DSM 0.5 m (PDOK WMS GetFeatureInfo dsm_05m, CC0): chimney top 31.6 m NAP at u -18, v 49.9; ground 0.8 m NAP',
  parts: [pand(north, '0363100012236677'), pand(south, '0363100012236879')],
};
fs.writeFileSync('scripts/landmarks/sportfondsenbad-oost-footprints.json', JSON.stringify(out));
console.log('anchor', out.anchor, out.parts.map(p => `${p.id} ${p.ring.length} pts, ${p.roofsUV.length} roofs`).join('; '));
