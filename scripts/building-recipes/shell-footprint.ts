/**
 * Footprint diagnostics for `footprint: "bag"`: BAG LoD0 vs LoD2.2 ground areas, their overlap, and how much of the
 * BAG outline the LoD2.2 roofs cover, nearest-fill and max-fill (shellRepair.ts `bagRoofPieces`); plus a plan PNG
 * (BAG outline black, LoD2.2 ground blue, roof pieces shaded by source) at artifacts/building-recipes/<id>/footprint-plan.png.
 *
 *   node --import tsx scripts/building-recipes/shell-footprint.ts --house=<id>[,<id>...]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {bagPolygons, bagRoofPieces} from '../../src/canalRecall/buildingRecipe/shellRepair.ts';
import {footprintIoU} from '../../src/canalRecall/buildingRecipe/gates.ts';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const area = (r: number[][]) => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
for (const id of (arg('house') ?? '').split(',').filter(Boolean)) {
  const facts: BuildingFacts = JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8'));
  const all = facts.bagFootprintRD.flat(), ax = Math.round(all.reduce((s, p) => s + p[0], 0) / all.length * 100) / 100, ay = Math.round(all.reduce((s, p) => s + p[1], 0) / all.length * 100) / 100, g = facts.heights.groundNAP;
  const polys = bagPolygons(facts.bagFootprintRD);
  const bagArea = polys.reduce((s, p) => s + area(p[0]) - p.slice(1).reduce((h, r) => h + area(r), 0), 0);
  const lod = facts.surveyFootprintPolygonsRD.reduce((s, p) => s + area(p[0]) - p.slice(1).reduce((h, r) => h + area(r), 0), 0);
  const iou = footprintIoU(facts, facts.surveyFootprintPolygonsRD.flatMap(p => p.map(r => r.map(q => [q[0] - ax, ay - q[1]]))), [ax, ay]);
  const local = polys.map(poly => poly.map(r => r.map(p => [p[0] - ax, ay - p[1]] as [number, number])));
  const pieces = bagRoofPieces(local, facts.roofsRD.map(r => ({rings: r.ringsRD.map(ring => ring.map(p => [p[0] - ax, p[2] - g, ay - p[1]] as [number, number, number]))})), facts.heights.roofMaxM);
  const by = (pred: (s: number | 'max') => boolean) => pieces.filter(p => pred(p.source)).reduce((s, p) => s + area(p.ring.map(q => [q[0], q[2]])), 0);
  console.log(`${id.padEnd(40)} BAG ${bagArea.toFixed(0)} m2, LoD2.2 ground ${lod.toFixed(0)} m2, IoU ${iou.toFixed(3)}; pieces ${pieces.length}: LoD2.2 roofs ${by(s => s !== 'max').toFixed(0)} m2, max ${by(s => s === 'max').toFixed(0)} m2 at ${facts.heights.roofMaxM.toFixed(1)} m`);
  // plan
  const pts = [...local.flat(2), ...facts.surveyFootprintPolygonsRD.flat(2).map(p => [p[0] - ax, ay - p[1]])];
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]), x0 = Math.min(...xs) - 3, z0 = Math.min(...zs) - 3, span = Math.max(Math.max(...xs) - x0, Math.max(...zs) - z0) + 3, S = 900 / span;
  const P = (x: number, z: number) => `${((x - x0) * S).toFixed(1)},${((z - z0) * S).toFixed(1)}`;
  const shade = (src: number | 'max') => src === 'max' ? '#e05a4a' : `hsl(${(Number(src) * 47) % 360},55%,70%)`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><rect width="900" height="900" fill="#fff"/>
${pieces.map(p => `<polygon points="${p.ring.map(q => P(q[0], q[2])).join(' ')}" fill="${shade(p.source)}" stroke="none"/>`).join('\n')}
${facts.surveyFootprintPolygonsRD.flatMap(poly => poly.map(r => `<polygon points="${r.map(q => P(q[0] - ax, ay - q[1])).join(' ')}" fill="none" stroke="#2050c0" stroke-width="2"/>`)).join('\n')}
${local.flatMap(poly => poly.map(r => `<polygon points="${r.map(q => P(q[0], q[1])).join(' ')}" fill="none" stroke="#000" stroke-width="1.5" stroke-dasharray="6 3"/>`)).join('\n')}
<text x="10" y="20" font-family="sans-serif" font-size="14">${id}: BAG dashed, LoD2.2 ground blue, red = roof max fill; IoU ${iou.toFixed(3)}</text></svg>`;
  const out = path.join('artifacts/building-recipes', id, 'footprint-plan.png');
  fs.mkdirSync(path.dirname(out), {recursive: true});
  await sharp(Buffer.from(svg)).png().toFile(out);
}
