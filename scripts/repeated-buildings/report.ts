/**
 * Repeated-buildings report (2026-11-15): joins the footprint candidates (detect.ts), the automatic front read
 * (front-check.ts) and the opus front verdicts (verdicts-*.json) into the small committed report.
 *
 *   node --import tsx scripts/repeated-buildings/report.ts [--detect=artifacts/repeated-buildings/detect-v2.json] \
 *     [--fronts=artifacts/repeated-buildings/front-check/front-check.json,...] [--verdicts=scripts/repeated-buildings/verdicts-20261115.json,scripts/repeated-buildings/verdicts-priors-20261116.json] \
 *     [--top=50] [--out=docs/reports/repeated-buildings-20261115.json]
 *
 * A footprint group is a candidate only; `exactFamilies` lists the pands whose fronts a reviewer accepted as one design.
 */
import fs from 'node:fs';

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const detect = JSON.parse(fs.readFileSync(arg('detect', 'artifacts/repeated-buildings/detect-v2.json'), 'utf8'));
const frontFiles = arg('fronts', 'artifacts/repeated-buildings/front-check/front-check.json').split(',').filter(f => fs.existsSync(f));
const verdictFiles = arg('verdicts', 'scripts/repeated-buildings/verdicts-20261115.json').split(',').filter(f => fs.existsSync(f));
const TOP = Number(arg('top', '50')), OUT = arg('out', 'docs/reports/repeated-buildings-20261115.json');

interface Family { name: string; front: string; pands: string[] }
interface Verdict { verdict: string; confidence: string; why?: string; families: Family[]; notInDesign?: string[]; unusable?: string[]; near?: string[] }
const fronts = new Map<string, any>();
for (const f of frontFiles) for (const g of JSON.parse(fs.readFileSync(f, 'utf8')).groups) fronts.set(g.group, g);
const verdicts = new Map<string, Verdict>();
for (const f of verdictFiles) for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(f, 'utf8')).groups)) verdicts.set(k, v as Verdict);

const groups = (detect.groups as any[]);
const pick = groups.filter((g, i) => i < TOP || fronts.has(g.group));
let checked = 0, survived = 0, footprintOnly = 0, copiesExact = 0, copiesChecked = 0;
const out = pick.map(g => {
  const rank = groups.indexOf(g) + 1, fc = fronts.get(g.group), v = verdicts.get(g.group);
  const bySuffix = new Map<string, any>((fc?.copiesDetail ?? []).map((c: any) => [c.pand.slice(-6), c]));
  const resolve = (s: string) => bySuffix.get(s)?.pand ?? (g.members as any[]).find(m => m.pand.endsWith(s))?.pand ?? s;
  const exactFamilies = (v?.families ?? []).filter(f => f.pands.length >= 3).map(f => {
    const pands = f.pands.map(resolve);
    const auto = new Set(f.pands.map(s => bySuffix.get(s)?.family).filter((k: number | undefined) => k !== undefined && k >= 0));
    return {name: f.name, front: f.front, copies: pands.length, autoFamiliesSpanned: auto.size, pands,
      exposure: pands.reduce((s: number, p: string) => s + ((g.members as any[]).find(m => m.pand === p)?.exposure ?? 0), 0)};
  });
  if (fc && v) {
    checked++; copiesChecked += fc.read;
    if (v.verdict === 'exact') survived++;
    const inExact = exactFamilies.reduce((s, f) => s + f.copies, 0);
    copiesExact += v.verdict === 'exact' || v.verdict === 'near' ? inExact : 0;
    footprintOnly += Math.max(0, fc.read - inExact);
  }
  return {rank, group: g.group, copies: g.copies, exposure: g.exposure, archetypeGuess: g.archetypeGuess, years: g.signature.years,
    footprint: {L: g.signature.L, W: g.signature.W, height: g.signature.height, roof: g.signature.roof, complexity: g.signature.complexity},
    spread: g.spread, streets: (g.streets as any[]).slice(0, 5), architects: g.architects, names: g.names,
    detectorConfidence: g.confidence, samplePanorama: g.samplePanorama,
    frontCheck: fc ? {checked: fc.checked, read: fc.read, autoFamilies: (fc.families as any[]).map(f => f.size), montage: `artifacts/repeated-buildings/${frontFiles.find(f => JSON.parse(fs.readFileSync(f, 'utf8')).groups.some((x: any) => x.group === g.group))?.split('/').slice(-2, -1)[0]}/${g.group}.jpg`} : null,
    verdict: v ? {verdict: v.verdict, confidence: v.confidence, why: v.why, notInDesign: v.notInDesign, unusable: v.unusable} : null,
    exactFamilies,
    memberPands: (g.members as any[]).map(m => m.pand)};
});
const summary = {candidatesInDetector: groups.length, reported: out.length, frontChecked: checked, exactGroups: survived,
  copiesFrontChecked: copiesChecked, copiesInFrontFamiliesExactOrNear: copiesExact, copiesFootprintMatchFrontDiffers: footprintOnly};
fs.writeFileSync(OUT, JSON.stringify({generatedAt: new Date().toISOString(), method: {detect: detect.method, rule: 'footprint group = candidate; membership decided on the front photo (opus montage review)'}, summary, groups: out}, null, 1));
console.log(JSON.stringify(summary));
console.log(`wrote ${OUT}`);
