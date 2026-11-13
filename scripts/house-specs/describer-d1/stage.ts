// Stage D1 describer answers as partial HouseSpecs (house plan P1 step 2): one spec per pand from toSpecPart (source
// `vision-judge`), filtered to what the integrator ruled ships (STAGED below: step-1c fields that cleared the bar, and for
// crown, head and cornice only the answered classes with precision >= 0.8 on the adjudicated labels; per-class.md), plus
// the wall colour sampled from the same describe cut (cuts.json `wallHex`, source `streetlevel-measured`, as W1 does).
// A front whose storeys, crown or bands are not visible inherits them from a twin when its `sameAs` names that side and
// PR1's `similar` holds for the pair (twin-guard.ts: precision 0.94 on the twin-v2 truth). Writes <out>/<pandId>.json and
// <out>/coverage.json. Never publishes: house:publish stays the integrator's step.
//
//   node --import tsx scripts/house-specs/describer-d1/stage.ts --answers <dir> [--cuts <cuts.json>] [--probes <probe-cache.json>]
//     --out <dir> [--at 2026-11-13]
import fs from 'node:fs';
import path from 'node:path';
import { toSpecPart, UNKNOWN, type DescriberAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { emptySpec, provenanceOf, setSpecField, specField, specFields, specProblems, type HouseSpec } from '../../../src/canalRecall/houseSpec/spec.ts';
import { sideOf } from './twins.ts';
import { similar, type Probe } from './partyPairs.ts';
import { loadAnswers } from './score.ts';

/** Answer keys whose share of values (not `not-visible`) the pilot reports. */
export const ANSWER_FIELDS = ['storeys', 'bays', 'windows', 'heads', 'bands', 'windowSurround', 'sills', 'doorBay', 'ground', 'basement', 'crown', 'cornice', 'finish', 'pale'] as const;

const answered = (v: unknown): boolean =>
  v !== undefined && v !== UNKNOWN && !(Array.isArray(v) && (!v.length || v.every(x => x === UNKNOWN)));

/** What ships (integrator ruling on step 1c): a spec path, and for crown/head/cornice the classes that may be staged. Basement
 *  only from a crop (its cut score was below the bar). Everything else toSpecPart writes stays prior-only. */
export const STAGED: Record<string, ((v: unknown, a: DescriberAnswer) => boolean)> = {
  'fronts/0/storeys': () => true,
  'fronts/0/souterrain': () => true,
  'fronts/0/bays': () => true,
  'fronts/0/bands': () => true,
  'facts/pui': () => true,
  'fronts/0/basement': (_v, a) => a.image.kind === 'crop',
  'palette/wallMaterial': () => true,
  // the answered crown class decides (a `mansard` answer compiles to gable cornice + roofFront mansard: precision 0.33, not staged)
  'fronts/0/gable': (_v, a) => a.crown === 'cornice' || a.crown === 'step',
  'fronts/0/windowHead': v => ['flat', 'segmental'].includes((v as { kind?: string })?.kind ?? ''),
  'fronts/0/cornice': v => v === 'none',
};

/** Keep only the STAGED paths (and their provenance) of a spec; the dropped paths are listed. */
export function shipOnly(spec: HouseSpec, a: DescriberAnswer): { spec: HouseSpec; dropped: string[] } {
  const out = emptySpec(spec.pandId), dropped: string[] = [];
  for (const [path, value] of specFields(spec)) {
    if (STAGED[path]?.(value, a)) { setSpecField(out, path, value); out.provenance[path] = provenanceOf(spec, path)!; } else dropped.push(path);
  }
  if (spec.schemaLimits?.length) out.schemaLimits = spec.schemaLimits;
  return { spec: out, dropped };
}

/** The staged spec for one answer: the shipping part of toSpecPart plus the measured wall colour when the cut sampled one. */
export function stageOne(a: DescriberAnswer, wallHex: string | null, at: string | null) {
  const { spec } = shipOnly(toSpecPart(a, at), a);
  if (a.readable && wallHex && /^#[0-9a-f]{6}$/i.test(wallHex)) {
    setSpecField(spec, 'palette/brick', wallHex.toLowerCase());
    spec.provenance['palette/brick'] = { source: 'streetlevel-measured', confidence: 0.6, ref: a.image.ref, at };
  }
  return spec;
}

/** Fields a hidden front inherits from its guarded twin. */
export const INHERIT = ['fronts/0/storeys', 'fronts/0/gable', 'fronts/0/bands'] as const;
type Wall = { a: [number, number]; b: [number, number]; normal: [number, number] };
/** The street wall of a cut row (cuts.json: wall a/b and the camera position, RD metres); the normal points at the camera. */
export function wallOf(row: any): Wall | null {
  const w = row?.wall, c = row?.pose?.rd;
  if (!w?.a || !w?.b || !c) return null;
  const a: [number, number] = [w.a.x, w.a.y], b: [number, number] = [w.b.x, w.b.y];
  let nx = -(b[1] - a[1]), ny = b[0] - a[0];
  const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
  if ((c.x - (a[0] + b[0]) / 2) * nx + (c.y - (a[1] + b[1]) / 2) * ny < 0) { nx = -nx; ny = -ny; }
  return { a, b, normal: [nx, ny] };
}
const adjacentWalls = (w1: Wall, w2: Wall, tol = 1.5) => [w1.a, w1.b].some(p => [w2.a, w2.b].some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < tol));

/** Copy INHERIT fields a spec lacks from the twin its answer names (`sameAs` left/right/both), only when PR1's `similar` holds.
 *  Returns the paths copied. The copy keeps the twin's provenance source at half confidence, ref `twin:<pandId>`. */
export function inheritFromTwin(spec: HouseSpec, a: DescriberAnswer, twins: { side: 'left' | 'right'; id: string; spec: HouseSpec; similar: boolean }[]): string[] {
  const sides = a.sameAs === 'both' ? ['left', 'right'] : a.sameAs === 'left' || a.sameAs === 'right' ? [a.sameAs] : [];
  const copied: string[] = [];
  for (const t of twins) {
    if (!sides.includes(t.side) || !t.similar) continue;
    for (const path of INHERIT) {
      if (specField(spec, path) !== undefined || copied.includes(path)) continue;
      const v = specField(t.spec, path), pr = provenanceOf(t.spec, path);
      if (v === undefined || !pr || pr.ref?.startsWith('twin:')) continue;
      setSpecField(spec, path, v);
      spec.provenance[path] = { ...pr, confidence: pr.confidence / 2, ref: `twin:${t.id}` };
      copied.push(path);
    }
  }
  return copied;
}

function main() {
  const argv = process.argv.slice(2);
  const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
  const dir = opt('answers'), out = opt('out');
  if (!dir || !out) { console.error('usage: stage.ts --answers <dir> [--cuts cuts.json] --out <dir>'); process.exit(2); }
  const at = opt('at') ?? null;
  const hex = new Map<string, string>(), walls = new Map<string, Wall>();
  if (opt('cuts')) for (const r of JSON.parse(fs.readFileSync(opt('cuts')!, 'utf8')).rows ?? []) {
    if (r.wallHex) hex.set(r.pandId, r.wallHex);
    const w = wallOf(r); if (w) walls.set(r.pandId, w);
  }
  const probes: Record<string, Probe> = opt('probes') ? JSON.parse(fs.readFileSync(opt('probes')!, 'utf8')) : {};
  const A = loadAnswers(dir);
  fs.mkdirSync(out, { recursive: true });
  const fieldCount: Record<string, number> = {}, answerCount: Record<string, number> = {};
  let readable = 0, stagedN = 0, nv = 0, cells = 0;
  const problems: Record<string, string[]> = {};
  const staged = new Map<string, HouseSpec>();
  for (const [id, a] of A) {
    if (a.readable) readable++;
    for (const k of ANSWER_FIELDS) {
      if (!a.readable) continue;
      cells++;
      const v = (a as any)[k];
      if (answered(v)) answerCount[k] = (answerCount[k] ?? 0) + 1; else nv++;
    }
    staged.set(id, stageOne(a, hex.get(id) ?? null, at));
  }
  let inheritedFronts = 0; const inheritedFields: Record<string, number> = {};
  for (const [id, a] of A) {
    const me = walls.get(id), spec = staged.get(id)!;
    if (!me || !a.readable) continue;
    const twins = [...walls].filter(([nid, w]) => nid !== id && staged.has(nid) && adjacentWalls(me, w))
      .map(([nid, w]) => ({ side: sideOf(me, w), id: nid, spec: staged.get(nid)!, similar: !!(probes[id] && probes[nid] && similar(probes[id], probes[nid])) }));
    const got = inheritFromTwin(spec, a, twins);
    if (got.length) inheritedFronts++;
    for (const g of got) inheritedFields[g] = (inheritedFields[g] ?? 0) + 1;
  }
  for (const [id, spec] of staged) {
    const p = specProblems(spec);
    if (p.length) { problems[id] = p; continue; }
    for (const [f] of specFields(spec)) fieldCount[f.replace(/^fronts\/\d+\//, 'fronts/*/')] = (fieldCount[f.replace(/^fronts\/\d+\//, 'fronts/*/')] ?? 0) + 1;
    fs.writeFileSync(path.join(out, `${id}.json`), `${JSON.stringify(spec, null, 1)}\n`);
    stagedN++;
  }
  const share = (n: number) => +(n / Math.max(1, readable)).toFixed(3);
  const report = {
    v: 1, answers: A.size, readable, staged: stagedN, inheritedFronts, inheritedFields, notVisibleRate: +(nv / Math.max(1, cells)).toFixed(3),
    answerCoverage: Object.fromEntries(ANSWER_FIELDS.map(k => [k, share(answerCount[k] ?? 0)])),
    specFieldCoverage: Object.fromEntries(Object.entries(fieldCount).sort().map(([k, n]) => [k, share(n)])),
    problems,
  };
  fs.writeFileSync(path.join(out, 'coverage.json'), `${JSON.stringify(report, null, 1)}\n`);
  console.log(JSON.stringify({ ...report, problems: Object.keys(problems).length }, null, 1));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
