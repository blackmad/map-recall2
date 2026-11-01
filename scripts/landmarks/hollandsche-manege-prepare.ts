/**
 * Hollandsche Manege (Vondelstraat 140; BAG 0363100012074454: the riding hall, its stables and the Vondelstraat 140
 * gateway house) plan source.
 *
 *   node --import tsx scripts/building-recipes/facts.ts --house=hm-tmp-074454 --pand=0363100012074454 --large --no-photo
 *   (move the house dir's facts.json to staging/landmarks/hollandsche-manege/facts.json)
 *   node --import tsx scripts/landmarks/hollandsche-manege-prepare.ts [--svg=out.svg]
 *
 * Reads the BAG ring and the 3DBAG LoD2.2 walls and roofs (BAG CC0, 3DBAG CC BY 4.0, fetched 2026-11-01) and writes
 * scripts/landmarks/hollandsche-manege-footprints.json in the native frame: x east, z south, y up from the 3DBAG ground,
 * metres, origin = vertex average of the BAG outer ring (RD).
 */
import fs from 'node:fs';
import {rdToLngLat} from '../../src/canalRecall/rdCoordinates.ts';

const facts = JSON.parse(fs.readFileSync('staging/landmarks/hollandsche-manege/facts.json', 'utf8'));
const g: number = facts.heights.groundNAP;
const strip = (r: number[][]) => r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r;
const ringRD = strip(facts.bagFootprintRD[0]);
const ax = ringRD.reduce((s: number, p: number[]) => s + p[0], 0) / ringRD.length, ay = ringRD.reduce((s: number, p: number[]) => s + p[1], 0) / ringRD.length;
const r2 = (v: number) => Math.round(v * 100) / 100;
const L = (p: number[]) => [r2(p[0] - ax), r2(-(p[1] - ay))];
const L3 = (p: number[]) => [r2(p[0] - ax), r2(p[2] - g), r2(-(p[1] - ay))];
const out = {
  id: 'hollandsche-manege', pand: '0363100012074454',
  frame: 'x east, z south, y up from the 3DBAG ground (' + g + ' m NAP); origin = vertex average of the BAG outer ring (RD)',
  anchorRD: [r2(ax), r2(ay)], anchor: rdToLngLat(ax, ay).map((v: number) => +v.toFixed(7)),
  sources: {bag: 'https://api.data.amsterdam.nl/v1/bag/panden/0363100012074454/ (CC0)', threeDBag: facts.source.threeDBag + ' (CC BY 4.0, fetched ' + facts.source.fetchedAt + ')'},
  ring: ringRD.map(L), hole: facts.bagFootprintRD[1] ? strip(facts.bagFootprintRD[1]).map(L) : [],
  ringLngLat: ringRD.map((p: number[]) => rdToLngLat(p[0], p[1]).map((v: number) => +v.toFixed(7))),
  walls: facts.wallsRD.map((w: any) => ({id: w.surface, ring: w.ringsRD[0].map(L3), top: r2(w.topM), bottom: r2(w.bottomM), bearing: Math.round(w.bearingDeg), edge: w.onFootprintEdge, area: r2(w.areaM2)})),
  roofs: facts.roofsRD.map((s: any) => ({id: s.surfaceId.split(':').at(-1), rings: s.ringsRD.map((rr: number[][]) => rr.map(L3)), slope: Math.round(s.slopeDeg), area: r2(s.areaM2)})),
};
fs.writeFileSync('scripts/landmarks/hollandsche-manege-footprints.json', JSON.stringify(out));
console.log('anchor', out.anchor, 'walls', out.walls.length, 'roofs', out.roofs.length);
const svg = process.argv.find(a => a.startsWith('--svg='))?.slice(6);
if (svg) {
  const S = 10, O = 50, X = (x: number) => (x + O) * S, Z = (z: number) => (z + O) * S;
  const parts: string[] = [];
  for (const r of out.roofs) {
    const ys = r.rings[0].map((p: number[]) => p[1]), h = ys.reduce((a: number, b: number) => a + b, 0) / ys.length;
    const c = Math.round(255 * Math.min(1, h / 16));
    parts.push(`<polygon points="${r.rings[0].map((p: number[]) => `${X(p[0])},${Z(p[2])}`).join(' ')}" fill="rgb(${c},${255 - c},120)" stroke="#000" stroke-width="1"/>`);
    const cx = r.rings[0].reduce((a: number, p: number[]) => a + p[0], 0) / r.rings[0].length, cz = r.rings[0].reduce((a: number, p: number[]) => a + p[2], 0) / r.rings[0].length;
    parts.push(`<text x="${X(cx)}" y="${Z(cz)}" font-size="11">${r.id}:${Math.min(...ys).toFixed(1)}-${Math.max(...ys).toFixed(1)}</text>`);
  }
  parts.push(`<polygon points="${out.ring.map(p => `${X(p[0])},${Z(p[1])}`).join(' ')}" fill="none" stroke="blue" stroke-width="3"/>`);
  out.ring.forEach((p, i) => parts.push(`<text x="${X(p[0])}" y="${Z(p[1])}" font-size="14" fill="blue">${i}</text>`));
  for (let x = -50; x <= 50; x += 10) parts.push(`<line x1="${X(x)}" y1="0" x2="${X(x)}" y2="${100 * S}" stroke="#888" stroke-width=".5"/><text x="${X(x)}" y="12" font-size="11">${x}</text>`);
  for (let z = -50; z <= 50; z += 10) parts.push(`<line y1="${Z(z)}" x1="0" y2="${Z(z)}" x2="${100 * S}" stroke="#888" stroke-width=".5"/><text y="${Z(z)}" x="2" font-size="11">${z}</text>`);
  fs.writeFileSync(svg, `<svg xmlns="http://www.w3.org/2000/svg" width="${100 * S}" height="${100 * S}"><rect width="100%" height="100%" fill="#fff"/>${parts.join('')}</svg>`);
}
