/**
 * The ground-floor extract (lane ground-floor-20261116): merges every source's ground-floor facts per pand
 * (src/canalRecall/groundFloor/merge.ts) and stages `artifacts/ground-floor/staging/ground-floors.json` with a coverage
 * report (pands, by source, by head and sign kind). `--publish` writes the staged file to the Amsterdam extract
 * (public/data/extracts/amsterdam/ground-floors.json): the integrator's step. The page fetches it only under
 * `?groundFloor=1`.
 *   node --import tsx scripts/ground-floor/build.ts [--reads=data/ground-floor/reads-pilot.json,...] [--only=<id,id>] [--except=<id,id>] [--publish]
 */
import fs from 'node:fs';
import path from 'node:path';
import { mergeGroundFloor, drawOf } from '../../src/canalRecall/groundFloor/merge.ts';
import { readProblems, toGroundFloorPart, type GroundFloorRead } from '../../src/canalRecall/groundFloor/read.ts';
import type { GroundFloorExtract } from '../../src/canalRecall/groundFloor/extract.ts';
import type { GroundFloor } from '../../src/canalRecall/groundFloor/types.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const files = (arg('reads') ?? 'data/ground-floor/reads-pilot.json').split(',');
const only = arg('only')?.split(','), except = new Set(arg('except')?.split(',') ?? []);
const STAGE = 'artifacts/ground-floor/staging', PUBLISHED = 'public/data/extracts/amsterdam/ground-floors.json';

const byPand = new Map<string, GroundFloorRead[]>();
let invalid = 0;
for (const f of files) for (const r of (JSON.parse(fs.readFileSync(f, 'utf8')) as { reads: GroundFloorRead[] }).reads) {
  if (readProblems(r).length) { invalid++; console.warn(`invalid read ${r.pandId}: ${readProblems(r).join('; ')}`); continue; }
  if ((only && !only.includes(r.pandId)) || except.has(r.pandId)) continue;
  byPand.set(r.pandId, [...(byPand.get(r.pandId) ?? []), r]);
}
const records: GroundFloor[] = [];
for (const [id, reads] of byPand) {
  const g = mergeGroundFloor(id, reads.map(r => toGroundFloorPart(r, r.image.date ?? null)));
  if (g) records.push(g);
}
const extract: GroundFloorExtract = { version: 1, buildings: Object.fromEntries(records.map(g => [g.pandId, drawOf(g)])) };
const count = <T extends string>(xs: T[]) => xs.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {});
const coverage = {
  pands: records.length, unreadable: [...byPand.values()].filter(rs => rs.every(r => !r.readable)).length, invalid,
  heads: count(records.flatMap(g => g.openings.map(o => o.head))), kinds: count(records.flatMap(g => g.openings.map(o => o.kind))),
  signs: count(records.map(g => g.sign.kind)), finishes: count(records.map(g => g.groundFinish.material)), plinths: count(records.map(g => g.plinth.kind)),
  sources: count(records.flatMap(g => Object.values(g.receipts).map(r => r!.source))),
};
fs.mkdirSync(STAGE, { recursive: true });
fs.writeFileSync(path.join(STAGE, 'ground-floors.json'), JSON.stringify(extract) + '\n');
fs.writeFileSync(path.join(STAGE, 'records.json'), JSON.stringify({ records }, null, 1) + '\n');
fs.writeFileSync(path.join(STAGE, 'coverage.json'), JSON.stringify(coverage, null, 1) + '\n');
console.log(JSON.stringify(coverage));
if (process.argv.includes('--publish')) {
  fs.copyFileSync(path.join(STAGE, 'ground-floors.json'), PUBLISHED);
  console.log(`published ${records.length} pands -> ${PUBLISHED}`);
}
