/**
 * house:rows (lane D, house rows first, #386; docs/house-line.md "Rows"). Node only; stages, never publishes.
 *
 *   npm run house:rows -- <row> [<row> ...] [--out <dir>] [--check]
 *   npm run house:rows -- --list
 *
 * <row> is an id from scripts/house-specs/rows/rows.json (lane P's row definitions: kinkerstraat-86-110,
 * weteringschans-168096-171218). For each row it loads the street survey, the block-face intent (the type, the house
 * overrides, the measured eaves), the strip, 3DBAG grounds and the D1 answers, solves the row
 * (src/canalRecall/houseSpec/row/solve.ts) and writes, under artifacts/house-rows/staging/:
 *   <row>.json             { row: RowRecord, rowFronts: RowFrontRecord[] }   (lane R reads both)
 *   <row>.row-check.json   lane P's check:rows shape (houseSpec/row/check.ts, the one adapter)
 *   <row>.report.md        the per-row report: source of each field, members overruled, fields read and not drawn, flags
 *   <row>/<pandId>.json    one HouseSpec per pand (face spec through houseSpec/fromFace.ts + the series design),
 *                          the dir `house:row-sheet -- <row> --drawn-specs` takes
 * --check prints the report and writes nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadRowDefs, REPO, type RowDef } from './rowDefs.ts';
import { validateBlockFace, type BlockFaceIntent } from '../../../src/canalRecall/blockFace/intent.ts';
import { fromBlockFace } from '../../../src/canalRecall/houseSpec/adapters.ts';
import { specFromFace } from '../../../src/canalRecall/houseSpec/fromFace.ts';
import { specProblems, type HouseSpec } from '../../../src/canalRecall/houseSpec/spec.ts';
import type { DescriberAnswer } from '../../../src/canalRecall/houseSpec/describer.ts';
import { solveRow, type MemberInput, type RowInput } from '../../../src/canalRecall/houseSpec/row/solve.ts';
import { faceFronts } from '../../../src/canalRecall/houseSpec/row/face.ts';
import { rowFrontRecords, rowSpec } from '../../../src/canalRecall/houseSpec/row/emit.ts';
import { toRowCheck } from '../../../src/canalRecall/houseSpec/row/check.ts';
import { rowReport } from '../../../src/canalRecall/houseSpec/row/report.ts';
import type { RowRecord } from '../../../src/canalRecall/houseSpec/row/types.ts';

const RAW = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/house-specs/rows/rows.json'), 'utf8')) as { rows: Record<string, { street?: string; face?: string }> };
const readJson = (f: string) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
const rel = (f: string) => path.relative(REPO, f).startsWith('..') ? f : path.relative(REPO, f);

export interface Loaded { input: RowInput; answers: Record<string, DescriberAnswer | null>; faceSpecs: Record<string, HouseSpec> }

export function loadRow(def: RowDef, solvedAt = new Date().toISOString().slice(0, 10), street?: string): Loaded {
  const raw = { ...(RAW.rows[def.id] ?? {}), ...(street ? { street } : {}) };
  const inputs: string[] = [];
  const answers: Record<string, DescriberAnswer | null> = {};
  const faceSpecs: Record<string, HouseSpec> = {};
  let face: BlockFaceIntent | null = null, strip: { heightM: number; pixelsPerMetre: number; groundNAP: number } | null = null;
  let survey: { pands: Array<{ pandId: string; label: string; numbers: number[]; buildYear: number; survey?: { frontWidthM?: number } }> } | null = null;
  if (def.face) {
    const dir = path.join(REPO, 'scripts/block-face/faces', def.face);
    face = validateBlockFace(readJson(path.join(dir, 'intent.json')));
    strip = readJson(path.join(dir, 'strip.json'));
    inputs.push(rel(path.join(dir, 'intent.json')), rel(path.join(dir, 'strip.json')));
  }
  if (raw.street) { const f = path.join(REPO, 'scripts/street-surveys/streets', `${raw.street}.json`); survey = readJson(f); if (survey) inputs.push(rel(f)); }
  const cuts = readJson(path.join(def.cutsDir, 'cuts.json')) as { rows: Array<{ pandId: string; wall: { heightM: number } }> } | null;
  if (cuts) inputs.push(rel(path.join(def.cutsDir, 'cuts.json')));
  inputs.push(`${rel(def.answersDir)}/<pandId>.json`);
  const members: MemberInput[] = def.members.map(md => {
    const pid = md.pandId;
    const sp = survey?.pands.find(p => p.pandId === pid);
    const answer = readJson(path.join(def.answersDir, `${pid}.json`)) as DescriberAnswer | null;
    answers[pid] = answer;
    let fronts: ReturnType<typeof faceFronts> | undefined;
    if (face) {
      const base = fromBlockFace(face, pid, `scripts/block-face/faces/${face.id}/strip.json`);
      if (base) { const s = specFromFace(base); faceSpecs[pid] = s; fronts = faceFronts(face, pid, s, strip); }
    }
    const bag = def.face ? readJson(path.join(REPO, 'scripts/block-face/faces', def.face, 'pands', pid, '3dbag.json')) : null;
    const attrs = bag ? (Object.values(bag.feature.CityObjects)[0] as { attributes: Record<string, number> }).attributes : null;
    const groundOffsetM = attrs && strip ? Math.round((attrs.b3_h_maaiveld - strip.groundNAP) * 100) / 100 : null;
    const cut = cuts?.rows.find(r => r.pandId === pid);
    return {
      pandId: pid, label: sp?.label ?? `${def.title.split(' ')[0]} (pand ${md.label})`, numbers: sp?.numbers ?? [], built: sp?.buildYear ?? null,
      widthM: sp?.survey?.frontWidthM ?? md.widthM ?? null, groundOffsetM,
      height3dbag: cut?.wall.heightM ?? (attrs ? Math.round((attrs.b3_h_dak_50p - attrs.b3_h_maaiveld) * 100) / 100 : null),
      ...(fronts?.length ? { face: fronts } : {}), read: answer, readRef: answer?.image?.ref,
    };
  });
  const side = (survey?.pands.find(p => p.pandId === members[0]?.pandId) as { side?: 'even' | 'odd' } | undefined)?.side ?? 'mixed';
  return { input: { id: def.id, street: face?.street ?? def.title.split(' ')[0], side, ...(def.face ? { face: def.face, faceRef: `scripts/block-face/faces/${def.face}/intent.json` } : {}), members, inputs, solvedAt }, answers, faceSpecs };
}

export function stageRow(def: RowDef, outDir: string, write: boolean): { row: RowRecord; specs: Record<string, HouseSpec>; problems: string[]; report: string } {
  const { input, answers, faceSpecs } = loadRow(def);
  const row = solveRow(input);
  const specs: Record<string, HouseSpec> = {};
  const problems: string[] = [];
  for (const m of row.members) {
    const s = rowSpec(row, m.pandId, faceSpecs[m.pandId], input.solvedAt);
    if (!s) continue;
    const p = specProblems(s);
    if (p.length) { problems.push(`${m.pandId}: ${p.join('; ')}`); continue; }
    specs[m.pandId] = s;
  }
  const rowFronts = rowFrontRecords(row);
  const check = toRowCheck(row, answers, new Set(Object.keys(specs)));
  const report = rowReport(row, Object.keys(specs), problems);
  if (write) {
    const dir = path.join(outDir, def.id);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) fs.rmSync(path.join(dir, f));
    for (const [pid, s] of Object.entries(specs)) fs.writeFileSync(path.join(dir, `${pid}.json`), JSON.stringify(s, null, 1) + '\n');
    fs.writeFileSync(path.join(outDir, `${def.id}.json`), JSON.stringify({ row, rowFronts }, null, 1) + '\n');
    fs.writeFileSync(path.join(outDir, `${def.id}.row-check.json`), JSON.stringify(check, null, 1) + '\n');
    fs.writeFileSync(path.join(outDir, `${def.id}.report.md`), report);
  }
  return { row, specs, problems, report };
}

function main(argv: string[]): number {
  const defs = loadRowDefs();
  if (argv.includes('--list') || argv.includes('--help') || !argv.filter(a => !a.startsWith('--')).length) {
    console.log(`house:rows -- <row> [...] [--out dir] [--check]\nrows: ${Object.keys(defs).join(', ')}`);
    return argv.includes('--list') || argv.includes('--help') ? 0 : 2;
  }
  const oi = argv.indexOf('--out');
  const out = oi >= 0 ? path.resolve(argv[oi + 1]) : path.join(REPO, 'artifacts/house-rows/staging');
  const ids = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
  let bad = 0;
  for (const id of ids) {
    const def = defs[id];
    if (!def) { console.error(`house:rows: unknown row ${id} (--list)`); bad++; continue; }
    const r = stageRow(def, out, !argv.includes('--check'));
    console.log(r.report);
    if (r.problems.length) bad++;
  }
  return bad ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) process.exitCode = main(process.argv.slice(2));
