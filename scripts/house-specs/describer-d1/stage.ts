// Stage D1 describer answers as partial HouseSpecs (house plan P1 step 2 pilot): one spec per pand from toSpecPart
// (source `vision-judge`), plus the wall colour sampled from the same describe cut (cuts.json `wallHex`, source
// `streetlevel-measured`, as W1 measures it). Writes <out>/<pandId>.json and <out>/coverage.json. Never publishes:
// house:publish stays the integrator's step.
//
//   node --import tsx scripts/house-specs/describer-d1/stage.ts --answers <dir> [--cuts <cuts.json>] --out <dir> [--at 2026-11-13]
import fs from 'node:fs';
import path from 'node:path';
import { toSpecPart, UNKNOWN, type DescriberAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { setSpecField, specFields, specProblems } from '../../../src/canalRecall/houseSpec/spec.ts';
import { loadAnswers } from './score.ts';

/** Answer keys whose share of values (not `not-visible`) the pilot reports. */
export const ANSWER_FIELDS = ['storeys', 'bays', 'windows', 'heads', 'bands', 'windowSurround', 'sills', 'doorBay', 'ground', 'basement', 'crown', 'cornice', 'finish', 'pale'] as const;

const answered = (v: unknown): boolean =>
  v !== undefined && v !== UNKNOWN && !(Array.isArray(v) && (!v.length || v.every(x => x === UNKNOWN)));

/** The staged spec for one answer: toSpecPart plus the measured wall colour when the cut sampled one. */
export function stageOne(a: DescriberAnswer, wallHex: string | null, at: string | null) {
  const spec = toSpecPart(a, at);
  if (a.readable && wallHex && /^#[0-9a-f]{6}$/i.test(wallHex)) {
    setSpecField(spec, 'palette/brick', wallHex.toLowerCase());
    spec.provenance['palette/brick'] = { source: 'streetlevel-measured', confidence: 0.6, ref: a.image.ref, at };
  }
  return spec;
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const dir = opt('answers'), out = opt('out');
  if (!dir || !out) { console.error('usage: stage.ts --answers <dir> [--cuts cuts.json] --out <dir>'); process.exit(2); }
  const at = opt('at') ?? null;
  const hex = new Map<string, string>();
  if (opt('cuts')) for (const r of JSON.parse(fs.readFileSync(opt('cuts')!, 'utf8')).rows ?? []) if (r.wallHex) hex.set(r.pandId, r.wallHex);
  const A = loadAnswers(dir);
  fs.mkdirSync(out, { recursive: true });
  const fieldCount: Record<string, number> = {}, answerCount: Record<string, number> = {};
  let readable = 0, staged = 0, nv = 0, cells = 0;
  const problems: Record<string, string[]> = {};
  for (const [id, a] of A) {
    if (a.readable) readable++;
    for (const k of ANSWER_FIELDS) {
      if (!a.readable) continue;
      cells++;
      const v = (a as any)[k];
      if (answered(v)) answerCount[k] = (answerCount[k] ?? 0) + 1; else nv++;
    }
    const spec = stageOne(a, hex.get(id) ?? null, at);
    const p = specProblems(spec);
    if (p.length) { problems[id] = p; continue; }
    for (const [f] of specFields(spec)) fieldCount[f.replace(/^fronts\/\d+\//, 'fronts/*/')] = (fieldCount[f.replace(/^fronts\/\d+\//, 'fronts/*/')] ?? 0) + 1;
    fs.writeFileSync(path.join(out, `${id}.json`), `${JSON.stringify(spec, null, 1)}\n`);
    staged++;
  }
  const share = (n: number) => +(n / Math.max(1, readable)).toFixed(3);
  const report = {
    v: 1, answers: A.size, readable, staged, notVisibleRate: +(nv / Math.max(1, cells)).toFixed(3),
    answerCoverage: Object.fromEntries(ANSWER_FIELDS.map(k => [k, share(answerCount[k] ?? 0)])),
    specFieldCoverage: Object.fromEntries(Object.entries(fieldCount).sort().map(([k, n]) => [k, share(n)])),
    problems,
  };
  fs.writeFileSync(path.join(out, 'coverage.json'), `${JSON.stringify(report, null, 1)}\n`);
  console.log(JSON.stringify({ ...report, problems: Object.keys(problems).length }, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
