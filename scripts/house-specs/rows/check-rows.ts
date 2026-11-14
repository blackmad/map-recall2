/**
 * check:rows (lane P, house rows first). Node only, no browser.
 *
 *   npm run check:rows                       unit tests (rowChecks, rowReview), then the gates over lane D's staged row records
 *                                            (artifacts/house-rows/staging/*.row-check.json, or --records <file|dir>); no records
 *                                            reports "no records" and passes, so it can sit in check:canal:rest before D lands
 *   npm run check:rows -- --audit-staged <row>   flatten TODAY's staged D1 specs for a row (rows.json) and run the same gates;
 *                                            prints the findings (the 2026-11-14 defects) and exits 0 unless --strict
 *
 * Record format: `{ "row": id, "members": RowCheckMember[] }` (src/canalRecall/houseSpec/rowChecks.ts), written by lane D's
 * `house:rows` next to its RowRecord (`<row>.row-check.json`); D's types are flattened to it in one place, not here.
 * A file that is not in that format fails the check loudly rather than being skipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { checkRow, runRegressions, type RowCheckMember, type RowCheckRow, type FieldFate } from '../../../src/canalRecall/houseSpec/rowChecks.ts';
import { loadRowDefs, REPO } from './rowDefs.ts';

const argv = process.argv.slice(2);
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const strict = argv.includes('--strict');

const READ_FIELDS = ['storeyParts', 'bays', 'windows', 'heads', 'bands', 'windowSurround', 'sills', 'crown', 'cornice', 'finish', 'whiteFrames', 'dormers', 'balconies', 'bayWindow', 'doorSurround', 'wallFamily'] as const;
const isRead = (v: unknown) => v != null && v !== 'not-visible' && v !== 'none' && v !== false && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && (v as any).count === 0);

/** Today's staged D1 spec + answer for one pand, flattened for the gates. Fields without a spec counterpart have no fate: a silent drop. */
function fromStaged(pandId: string, answersDir: string, stagedDir: string, series: string): RowCheckMember {
  const rd = (d: string) => { const f = path.join(d, `${pandId}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const ans = rd(answersDir), spec = rd(stagedDir);
  const front = spec?.design?.fronts?.[0] ?? {};
  const drawnBy: Record<string, boolean> = { storeyParts: front.storeys != null, bays: front.bays != null, heads: !!front.windowHead, crown: !!front.gable, finish: !!spec?.design?.palette?.wallMaterial };
  const fields: RowCheckMember['fields'] = {};
  for (const f of READ_FIELDS) if (ans && isRead(ans[f])) fields[f] = { fate: (drawnBy[f] ? 'drawn' : 'silent') as FieldFate };
  const pointed = front.gable && front.gable !== 'cornice' ? String(front.gable) : null;
  return {
    key: pandId, pandId, numbers: [], series,
    design: { storeys: front.storeys ?? null, bays: front.bays ?? null, head: front.windowHead?.kind ?? null, crown: front.gable ?? null, wall: spec?.design?.palette?.brick ?? null },
    corniceM: null,
    roof: { kind: front.gable ? String(front.gable) : 'hash', source: front.gable ? 'record' : 'hash', dormers: ans?.dormers?.count ?? 0, dormerKind: ans?.dormers?.kind, gable: pointed },
    extras: [], fields, staged: !!spec,
    scaffold: ans ? /scaffold|netting/i.test(JSON.stringify(ans)) : undefined,
  };
}

function auditStaged(rowId: string) {
  const def = loadRowDefs()[rowId];
  if (!def) { console.error(`unknown row ${rowId}`); process.exit(2); }
  const members = def.members.map(m => fromStaged(m.pandId, def.answersDir, def.stagedDir, def.face ? 'row' : m.pandId));
  const row: RowCheckRow = { row: rowId, members };
  const findings = checkRow(row);
  const byGate = new Map<string, number>();
  for (const f of findings) byGate.set(f.gate, (byGate.get(f.gate) ?? 0) + 1);
  console.log(`audit of today's staged D1 specs for ${rowId}: ${members.length} fronts, ${findings.length} finding(s) ${JSON.stringify(Object.fromEntries(byGate))}`);
  for (const f of findings.slice(0, 60)) console.log(`  [${f.gate}] ${f.key}: ${f.message}`);
  for (const r of runRegressions([row])) console.log(`  regression ${r.id}: ${r.status} (${r.message})`);
  process.exit(strict && findings.length ? 1 : 0);
}

function loadRecords(): RowCheckRow[] {
  const src = arg('records') ?? path.join(REPO, 'artifacts/house-rows/staging');
  if (!fs.existsSync(src)) return [];
  const files = fs.statSync(src).isDirectory() ? fs.readdirSync(src).filter(f => f.endsWith('.row-check.json')).map(f => path.join(src, f)) : [src];
  return files.map(f => {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!j?.row || !Array.isArray(j.members) || !j.members.every((m: any) => m.pandId && m.series && m.design && m.roof && m.fields)) { console.error(`${f}: not a row-check record ({row, members: RowCheckMember[]})`); process.exit(1); }
    return j as RowCheckRow;
  });
}

const audit = arg('audit-staged');
if (audit) auditStaged(audit);
else {
  const rows = loadRecords();
  if (!rows.length) console.log('check:rows: no records (artifacts/house-rows/staging/*.row-check.json); gates idle, regressions pending');
  let bad = 0;
  for (const r of rows) {
    const f = checkRow(r);
    console.log(`${r.row}: ${r.members.length} fronts, ${f.length} finding(s)`);
    for (const x of f) { console.error(`  FAIL [${x.gate}] ${x.key}: ${x.message}`); bad++; }
  }
  for (const r of runRegressions(rows)) {
    console.log(`  regression ${r.id}: ${r.status}${r.status === 'no-records' ? '' : ` (${r.message})`}`);
    if (r.status === 'fail') { console.error(`  FAIL regression ${r.id}: ${r.what}: ${r.message}`); bad++; }
  }
  process.exit(bad ? 1 : 0);
}
