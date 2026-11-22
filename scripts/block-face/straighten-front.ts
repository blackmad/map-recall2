// Rebuild a pand's front0 as the straight surveyed wall line across entrance notches:
//   npx tsx scripts/block-face/straighten-front.ts <facts.json> <maxNotchDepthM>
// Keeps the survey footprint vertices that lie on the front line (|offset| < 0.05 m) between the outermost ones,
// drops notch vertices, and re-samples topProfile / eavesM / topM as buildingRecipe/facts.ts findFrontage does.
import fs from 'node:fs';
import {roofHeightAt} from '../../src/canalRecall/buildingRecipe/facts.ts';
const [file, maxDepth = '1.5'] = process.argv.slice(2);
const facts = JSON.parse(fs.readFileSync(file, 'utf8'));
const fr = facts.fronts[0];
const [a0, b0] = fr.endpointsRD, n = fr.outwardNormalRD;
const len0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]), u = [(b0[0] - a0[0]) / len0, (b0[1] - a0[1]) / len0];
const along = (p: number[]) => (p[0] - a0[0]) * u[0] + (p[1] - a0[1]) * u[1], off = (p: number[]) => (p[0] - a0[0]) * n[0] + (p[1] - a0[1]) * n[1];
const ring: number[][] = facts.surveyFootprintPolygonsRD[0][0];
const onLine = ring.filter(p => Math.abs(off(p)) < 0.05).sort((p, q) => along(p) - along(q));
const notches = ring.filter(p => off(p) < -0.05 && off(p) > -Number(maxDepth) && along(p) > along(onLine[0]) && along(p) < along(onLine.at(-1)!));
const chain = onLine.filter((p, i) => i === 0 || along(p) - along(onLine[i - 1]) > 0.01);
const a = chain[0], b = chain.at(-1)!, width = Math.hypot(b[0] - a[0], b[1] - a[1]), uu = [(b[0] - a[0]) / width, (b[1] - a[1]) / width];
const topProfile: {alongM: number; heightM: number}[] = [];
for (let k = 0; k <= 40; k++) {
  const t = width * (0.01 + 0.98 * k / 40), on = [a[0] + uu[0] * t, a[1] + uu[1] * t];
  const h = roofHeightAt(facts.roofsRD, [on[0] - n[0] * 0.08, on[1] - n[1] * 0.08], facts.heights.groundNAP);
  if (h !== null) topProfile.push({alongM: t, heightM: h});
}
const hs = topProfile.map(p => p.heightM).sort((x, y) => x - y);
fs.writeFileSync(file.replace(/facts\.json$/, 'facts-before-straighten.json'), JSON.stringify(facts, null, 1) + '\n');
facts.fronts[0] = {...fr, endpointsRD: [a, b], chainRD: chain, widthM: width, topProfile, eavesM: hs[Math.floor(hs.length * 0.1)], topM: hs.at(-1),
  uncertainty: [...fr.uncertainty.filter((x: string) => !/jog/.test(x)), `Front rebuilt on the straight surveyed wall line across ${notches.length} entrance-notch vertices up to ${maxDepth} m deep (strip 2024-12-11: one continuous shop front; scripts/block-face/straighten-front.ts).`]};
fs.writeFileSync(file, JSON.stringify(facts, null, 1) + '\n');
console.log({widthM: +width.toFixed(2), chain: chain.length, notches: notches.map(p => [+along(p).toFixed(2), +off(p).toFixed(2)]), eavesM: facts.fronts[0].eavesM, topM: facts.fronts[0].topM, profile: topProfile.length});
