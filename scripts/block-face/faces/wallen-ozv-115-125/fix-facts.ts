/**
 * Source correction for Oudezijds Voorburgwal 117 (pand 0363100012171878), re-applied after every intake:
 *
 *   node --import tsx scripts/block-face/faces/wallen-ozv-115-125/fix-facts.ts
 *
 * 3DBAG LoD2.2 reconstructs a 0.65 m wedge in front of 117's left half (tip 1.9 m from the 115 party wall) and a
 * 0.23 m notch at mid-front, so the frontage finder returned a diagonal front through the wedge; the compiled
 * chunk then overlapped 115 by 9 cm and pushed 117's cornice 0.26 m past the shared edge (interference gate FAIL).
 * The BAG footprint, the rectified 2021-01-25 boat strip and the level perspective view of panorama
 * TMX7316010203-001981_pano_0000_000252 all show one straight front between the 115 and 119 party walls.
 * The BAG ring's stoep bump in front of 117 is dropped as well (see below).
 * The fix moves the two artefact vertices onto that line, drops the 10 cm stub that would then fold the front back on itself, (footprint and every roof surface that uses them, as the
 * face compile does when it closes front slits) and re-derives the frontage with the normal `findFrontage`.
 */
import fs from 'node:fs';
import {findFrontage, type RD, type StreetPath} from '../../../../src/canalRecall/buildingRecipe/facts.ts';
import {lngLatToRd} from '../../../../src/canalRecall/facade/rdNew.ts';

const file = 'scripts/block-face/faces/wallen-ozv-115-125/pands/0363100012171878/facts.json';
const facts = JSON.parse(fs.readFileSync(file, 'utf8'));
// Artefact vertex -> point on the straight front (BAG front line, RD metres).
const moves: [RD, RD][] = [
  [[121661.20075, 487352.42575], [121661.11085, 487351.29286]], // wedge tip, 0.65 m proud of the front
  [[121660.69575, 487350.41875], [121660.50472, 487350.54839]], // notch, 0.23 m behind the front
];
// The 10 cm stub left of the wedge (front line folds back on itself once the tip is on the line): dropped.
const drops: RD[] = [[121661.70975, 487352.02875]];
const same = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4;
let moved = 0;
for (const [from, to] of moves) {
  for (const poly of facts.surveyFootprintPolygonsRD) for (const ring of poly) for (const v of ring) if (same(v, from)) { v[0] = to[0]; v[1] = to[1]; moved++; }
  for (const roof of facts.roofsRD) for (const v of [...roof.vertices, ...roof.ringsRD.flat()]) if (same(v, from)) { v[0] = to[0]; v[1] = to[1]; moved++; }
}
for (const d of drops) {
  for (const poly of facts.surveyFootprintPolygonsRD) for (const [k, ring] of poly.entries()) { const kept = ring.filter((v: number[]) => !same(v, d)); moved += ring.length - kept.length; poly[k] = kept; }
  for (const roof of facts.roofsRD) {
    const kept = roof.vertices.filter((v: number[]) => !same(v, d)); moved += roof.vertices.length - kept.length; roof.vertices = kept;
    roof.ringsRD = roof.ringsRD.map((ring: number[][]) => ring.filter(v => !same(v, d)));
  }
}
// BAG (LoD0) draws 117's stoep as a 1.5 x 1.26 m bump in front of the facade that starts 10 cm inside 115's frontage;
// the interference gate then counted 115's plinth as penetrating 117. A stoep is not building mass: drop the bump.
const bagStoep: RD[] = [[121661.70975, 487352.02875], [121660.71875, 487352.80475], [121659.77975, 487351.65375]];
for (const [k, ring] of facts.bagFootprintRD.entries()) { const kept = ring.filter((v: number[]) => !bagStoep.some(d => same(v, d))); moved += ring.length - kept.length; facts.bagFootprintRD[k] = kept; }
if (!moved) { console.log(`${file}: already corrected`); process.exit(0); }
const streets: StreetPath[] = (JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as any[]).map(s => ({name: s.name, paths: s.paths ?? [s.path]}));
const toRD = (p: [number, number]): RD => { const r = lngLatToRd(p); return [r.x, r.y]; };
const front = findFrontage(facts.surveyFootprintPolygonsRD, facts.roofsRD, facts.heights.groundNAP, streets, 'Oudezijds Voorburgwal', toRD);
front.uncertainty.push('Source correction (fix-facts.ts): 3DBAG LoD2.2 wedge and notch moved onto the straight BAG front.');
facts.fronts = [front];
fs.writeFileSync(file, JSON.stringify(facts, null, 1) + '\n');
console.log(`${file}: moved ${moved} vertices; front ${front.widthM.toFixed(2)} m, chain ${front.chainRD.length} points`);
