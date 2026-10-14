/**
 * Commercial-street survey, phase A: enrich the street-pands index with side, style group, 3DBAG eaves/ridge,
 * frontage width, and propose block faces (same rule as blockFace/discover.ts: frontage on the street, same facing,
 * connected by shared BAG party walls; a break in the chain is a cross street or a gap).
 *
 *   node --import tsx scripts/street-surveys/commercial-faces.ts --street=Kinkerstraat --prefix=kinker
 *
 * Reads/writes scripts/street-surveys/streets/<street>.json (run street-pands.ts first). Phase B (commercial-merge.ts)
 * adds uses, crops and capture dates after the intake runs.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {buildFacts, decodeThreeDBag, type CityJsonItem, type RD, type StreetPath} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import {nearestOnStreet, sharedEdgeLength} from '../../src/canalRecall/blockFace/discover.ts';
import {sharedTerrain} from '../lib/terrainField.ts';
import {cachedJson} from '../pand-reference/core.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const street = arg('street') ?? 'Kinkerstraat', prefix = arg('prefix') ?? 'kinker';
const file = path.join('scripts/street-surveys/streets', `${street.toLowerCase()}.json`);
const doc = JSON.parse(await fs.readFile(file, 'utf8'));
const toRD = (p: [number, number]): RD => { const r = lngLatToRd(p); return [r.x, r.y]; };
const streets: StreetPath[] = (JSON.parse(await fs.readFile('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as any[]).map(s => ({name: s.name, paths: s.paths ?? [s.path]}));
const round = (v: number, d = 1) => +v.toFixed(d);

export const styleGroup = (y: number | null) => y === null ? 'unknown' : y >= 1880 && y <= 1909 ? 'revolutiebouw-1880-1909' : y >= 1910 && y <= 1919 ? '1910s' : y >= 1980 && y <= 1989 ? '1980s-infill' : 'other';
const area = (r: RD[]) => Math.abs(r.reduce((a, q, i) => a + (q[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * q[1]), 0) / 2);

type Cand = {pand: any; facts: ReturnType<typeof buildFacts>; rings: RD[][]};
const cands: Cand[] = [], noFront: {pandId: string; label: string; reason: string}[] = [];
for (const p of doc.pands) {
  const item: any = await cachedJson(`https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${p.pandId}`);
  const ci: CityJsonItem = {feature: item.feature, metadata: item.metadata};
  p.side = p.numbers[0] % 2 ? 'odd' : 'even';
  p.styleGroup = styleGroup(p.buildYear);
  try {
    const facts = buildFacts(p.pandId, ci, streets, [street], toRD, {threeDBag: `https://api.3dbag.nl/collections/pand/items/NL.IMBAG.Pand.${p.pandId}`, fetchedAt: new Date().toISOString().slice(0, 10), streets: 'public/data/extracts/amsterdam/streets-routing.json'}, {terrainAt: sharedTerrain()});
    const f = facts.fronts[0], mid: RD = [(f.endpointsRD[0][0] + f.endpointsRD[1][0]) / 2, (f.endpointsRD[0][1] + f.endpointsRD[1][1]) / 2];
    const near = nearestOnStreet(streets, street, toRD, mid);
    if (!near || near.distance > 30) { noFront.push({pandId: p.pandId, label: p.label, reason: `frontage ${near?.distance.toFixed(0)} m from ${street}`}); p.survey = {frontage: false, reason: 'frontage far from street'}; continue; }
    const {bag} = decodeThreeDBag(ci);
    p.survey = {frontage: true, frontWidthM: round(f.widthM), eavesM: round(f.eavesM), ridgeM: round(facts.heights.ridgeM), roofMaxM: round(facts.heights.roofMaxM), storeys3dbag: facts.heights.storeys, year3dbag: facts.heights.builtYear, footprintAreaM2: round(bag.reduce((s, r) => s + area(r), 0), 0), normal: f.outwardNormalRD.map(v => round(v, 2)), uncertainty: f.uncertainty};
    cands.push({pand: p, facts, rings: bag});
  } catch (e) { noFront.push({pandId: p.pandId, label: p.label, reason: (e as Error).message.slice(0, 80)}); p.survey = {frontage: false, reason: (e as Error).message.slice(0, 80)}; }
}
// Faces: per side, connected components over shared party walls with the same facing.
const faces: any[] = [];
for (const side of ['odd', 'even']) {
  const mine = cands.filter(c => c.pand.side === side);
  const seen = new Set<string>();
  for (const seed of mine) {
    if (seen.has(seed.pand.pandId)) continue;
    const n0 = seed.facts.fronts[0].outwardNormalRD, comp = [seed]; seen.add(seed.pand.pandId);
    for (let i = 0; i < comp.length; i++) for (const c of mine) {
      if (seen.has(c.pand.pandId)) continue;
      const n = c.facts.fronts[0].outwardNormalRD, m = comp[i].facts.fronts[0].outwardNormalRD;
      if (n[0] * m[0] + n[1] * m[1] < 0.8) continue;
      if (comp[i].rings.some(ra => c.rings.some(rb => sharedEdgeLength(ra, rb, 0.1) >= 1))) { seen.add(c.pand.pandId); comp.push(c); }
    }
    const u: RD = [-n0[1], n0[0]];
    const along = (c: Cand) => { const f = c.facts.fronts[0]; return ((f.endpointsRD[0][0] + f.endpointsRD[1][0]) / 2) * u[0] + ((f.endpointsRD[0][1] + f.endpointsRD[1][1]) / 2) * u[1]; };
    comp.sort((a, b) => along(a) - along(b));
    const nums = comp.flatMap(c => c.pand.numbers as number[]);
    faces.push({side, seedPandId: seed.pand.pandId, comp, first: Math.min(...nums), last: Math.max(...nums)});
  }
}
faces.sort((a, b) => a.side.localeCompare(b.side) || a.first - b.first);
const used = new Set<string>();
const faceOut = faces.map(f => {
  let id = `${prefix}-${f.first}-${f.last}`; if (used.has(id)) id += `-${f.seedPandId.slice(-6)}`; used.add(id);
  f.comp.forEach((c: Cand, i: number) => { c.pand.proposedFace = id; c.pand.faceIndex = i; });
  return {id, side: f.side, numbers: [f.first, f.last], pandCount: f.comp.length, seed: f.seedPandId, members: f.comp.map((c: Cand) => c.pand.pandId), lengthM: round(f.comp.reduce((s: number, c: Cand) => s + c.facts.fronts[0].widthM, 0))};
});
doc.faces = faceOut;
doc.noFrontage = noFront;
doc.facesRule = 'commercial-faces.ts: pands with a street frontage <= 30 m from the routing centreline, per odd/even side, joined by shared BAG party walls (>= 1 m, front normals within 0.8 dot); a break is a cross street or gap (same rule as blockFace/discover.ts)';
doc.styleGroupRule = 'BAG bouwjaar: 1880-1909 revolutiebouw, 1910-1919, 1980-1989 urban-renewal infill, else other';
doc.surveyedAt = new Date().toISOString().slice(0, 10);
await fs.writeFile(file, JSON.stringify(doc, null, 1) + '\n');
console.log(`${doc.pands.length} pands, ${cands.length} with frontage, ${noFront.length} without; ${faceOut.length} faces`);
for (const f of faceOut) console.log(f.id.padEnd(22), f.side.padEnd(5), String(f.pandCount).padStart(3), 'pands', f.lengthM, 'm seed', f.seed.slice(-6));
for (const n of noFront) console.log('NOFRONT', n.label, n.pandId.slice(-6), n.reason);
