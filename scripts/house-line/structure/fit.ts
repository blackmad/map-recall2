/**
 * Lane PR1 step 2: fit the structure prior (src/canalRecall/houseSpec/structurePrior.ts) on the read houses and score it
 * on the held-out benchmark labels.
 *
 *   node --import tsx scripts/house-line/structure/fit.ts [--write] [--no-typed] [--probe-cache f.json] [--json out.json] [--labels benchmark.json]
 *
 * Training: block-face houses (designed and type-placed; `--no-typed` drops the placed ones) and belt/pilot/hand specs
 * (dataset.ts) built before MAX_YEAR, with their street run's exposed height and width from the Node probe (probe.ts).
 * Held out entirely: every benchmark-v1 pand, and every training pand within HOLDOUT_M of one (its row).
 * Model selection: 5-fold cross-validation over 300 m blocks of the training houses, scored on the read (not
 * type-placed) houses of the held fold; the grid is GRID; the best exact-match setting per field wins (first in grid
 * order on a tie). The benchmark is scored once, after selection. `--write` writes structure-prior.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../../house-preview/nodeDom.ts';
import { probeAll } from './baseline.ts';
import { faceReadings, specReadings, type Reading } from './dataset.ts';
import { benchmarkTruths, fmt, score, type Score } from './labels.ts';
import type { ProbeRecord } from './probe.ts';
import { structureGuess, type KnnParams, type PriorRow, type StructurePriorTable } from '../../../src/canalRecall/houseSpec/structurePrior.ts';

export const HOLDOUT_M = 60, MAX_YEAR = 1945, FOLDS = 5, BLOCK_M = 300;
export const GRID = { k: [7, 15, 25], yearScale: [10, 25, 60], sizeScale: [0.3, 0.5, 1], distanceScale: [0, 500, 2000] };
const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;

type Row = { r: Reading; p: ProbeRecord; row: PriorRow; block: string };
const round = (v: number, d: number) => +v.toFixed(d);
const hashFold = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % FOLDS; };

export function tableOf(rows: Row[], storeys: KnnParams, columns: KnnParams): StructurePriorTable {
  return { v: 1, maxYear: MAX_YEAR, storeys, columns, rows: rows.map(x => x.row) };
}

function grid(): KnnParams[] {
  const out: KnnParams[] = [];
  for (const k of GRID.k) for (const yearScale of GRID.yearScale) for (const sizeScale of GRID.sizeScale) for (const distanceScale of GRID.distanceScale) out.push({ k, yearScale, sizeScale, distanceScale });
  return out;
}

/** Cross-validated exact match of one field under one setting. */
function cv(train: Row[], field: 'storeys' | 'columns', p: KnnParams): { k: number; n: number } {
  let k = 0, n = 0;
  for (let f = 0; f < FOLDS; f++) {
    const fit = train.filter(x => hashFold(x.block) !== f);
    const t = tableOf(fit, p, p);
    for (const x of train) {
      if (hashFold(x.block) !== f || x.r.source === 'face-type' || !x.r[field]) continue;
      const g = structureGuess({ lng: x.row[0], lat: x.row[1], year: x.row[2], exposedM: x.row[3], widthM: x.row[4] }, t);
      n++; if (g?.[field] === x.r[field]) k++;
    }
  }
  return { k, n };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const face = faceReadings(REPO_ROOT), spec = specReadings(REPO_ROOT);
  const byPand = new Map<string, Reading>();
  for (const r of [...face, ...spec]) if (!(args.includes('--no-typed') && r.source === 'face-type')) byPand.set(r.pandId, r);
  const truths = benchmarkTruths(REPO_ROOT, opt('--labels'));
  const probes = await probeAll([...new Set([...byPand.keys(), ...truths.map(t => t.pandId)])], opt('--probe-cache') ?? 'artifacts/structure-priors/probe-cache.json');
  const bench = truths.map(t => probes.get(t.pandId)).filter(p => p?.at) as ProbeRecord[];
  const benchIds = new Set(truths.map(t => t.pandId));
  const nearBench = (p: ProbeRecord) => bench.some(b => Math.hypot((b.at![0] - p.at![0]) * KX, (b.at![1] - p.at![1]) * KY) <= HOLDOUT_M);
  let heldRows = 0;
  const train: Row[] = [];
  for (const r of [...byPand.values()].sort((a, b) => a.pandId.localeCompare(b.pandId))) {
    const p = probes.get(r.pandId);
    if (benchIds.has(r.pandId) || !p?.drawn || p.year === null || p.year >= MAX_YEAR || !p.at || !(r.storeys || r.columns)) continue;
    if (nearBench(p)) { heldRows++; continue; }
    train.push({ r, p, block: `${Math.floor(p.at[0] * KX / BLOCK_M)}:${Math.floor(p.at[1] * KY / BLOCK_M)}`,
      row: [round(p.at[0], 6), round(p.at[1], 6), p.year, round(p.drawn.exposedM, 2), round(p.drawn.runM, 2), r.storeys ?? 0, r.columns ?? 0] });
  }
  console.log(`training ${train.length} pands before ${MAX_YEAR} (storeys ${train.filter(x => x.r.storeys).length}, columns ${train.filter(x => x.r.columns).length}; read ${train.filter(x => x.r.source !== 'face-type').length}, type-placed ${train.filter(x => x.r.source === 'face-type').length}); held out as benchmark rows (within ${HOLDOUT_M} m): ${heldRows}`);
  const chosen: Record<'storeys' | 'columns', KnnParams> = {} as never;
  const cvLog: Record<string, unknown[]> = {};
  for (const field of ['storeys', 'columns'] as const) {
    const res = grid().map(p => ({ p, ...cv(train, field, p) }));
    res.sort((a, b) => b.k - a.k);
    chosen[field] = res[0].p;
    cvLog[field] = res.map(r => ({ ...r.p, cv: round(r.k / r.n, 4), n: r.n }));
    console.log(`${field}: CV best ${JSON.stringify(res[0].p)} ${fmt(score(Array.from({ length: res[0].n }, (_, i) => [1, i < res[0].k ? 1 : 0])))}`);
  }
  const t = tableOf(train, chosen.storeys, chosen.columns);
  // Held out: the prior alone (no mesher clamps) and today's drawn, on the benchmark subsets.
  const rows = truths.map(tr => ({ tr, p: probes.get(tr.pandId) })).filter(x => x.p?.route === 'generic' && x.p.drawn) as { tr: typeof truths[number]; p: ProbeRecord }[];
  const unspec = (p: ProbeRecord) => !p.spec?.storeys && !p.spec?.bays && !p.drawn?.recipe;
  const g = (x: typeof rows[number]) => structureGuess({ lng: x.p.at![0], lat: x.p.at![1], year: x.p.year, exposedM: x.p.drawn!.exposedM, widthM: x.p.drawn!.runM }, t);
  const report: Record<string, Record<string, Score>> = {};
  for (const [name, keep] of [['generic (all)', () => true], ['unspecified', (x: typeof rows[number]) => unspec(x.p)], ['unspecified, one front', (x: typeof rows[number]) => unspec(x.p) && x.tr.oneFront]] as const) {
    const rs = rows.filter(keep as (x: typeof rows[number]) => boolean);
    report[name] = {
      'storeys today': score(rs.map(x => [x.tr.storeys, x.p.drawn!.storeys]), true), 'storeys prior': score(rs.map(x => [x.tr.storeys, g(x)?.storeys ?? x.p.drawn!.storeys]), true),
      'columns today': score(rs.map(x => [x.tr.columns, x.p.drawn!.columns]), true), 'columns prior': score(rs.map(x => [x.tr.columns, g(x)?.columns ?? x.p.drawn!.columns]), true),
    };
    console.log(`\nheld-out ${name} (n ${rs.length})`);
    for (const [k, v] of Object.entries(report[name])) console.log(`  ${k.padEnd(14)} ${fmt(v)}`);
    const dir = (pick: (x: typeof rows[number]) => number | null | undefined, truth: (x: typeof rows[number]) => number | null) => {
      const d = rs.map(x => [pick(x), truth(x)]).filter(([a, b]) => a != null && b != null).map(([a, b]) => (a as number) - (b as number));
      return `over ${d.filter(v => v > 0).length} (by 1: ${d.filter(v => v === 1).length}), under ${d.filter(v => v < 0).length} (by 1: ${d.filter(v => v === -1).length})`;
    };
    console.log(`  storeys errors today: ${dir(x => x.p.drawn!.storeys, x => x.tr.storeys)}; prior: ${dir(x => g(x)?.storeys ?? x.p.drawn!.storeys, x => x.tr.storeys)}`);
    console.log(`  columns errors today: ${dir(x => x.p.drawn!.columns, x => x.tr.columns)}; prior: ${dir(x => g(x)?.columns ?? x.p.drawn!.columns, x => x.tr.columns)}`);
  }
  if (opt('--json')) fs.writeFileSync(opt('--json')!, JSON.stringify({ chosen, cv: cvLog, report }, null, 1));
  if (args.includes('--write')) {
    const out = path.join(REPO_ROOT, 'src/canalRecall/houseSpec/structure-prior.json');
    const meta = { v: 1, fitted: 'scripts/house-line/structure/fit.ts', maxYear: MAX_YEAR, storeys: chosen.storeys, columns: chosen.columns, training: { pands: train.length, heldOutRows: heldRows, holdoutM: HOLDOUT_M, typed: !args.includes('--no-typed') } };
    fs.writeFileSync(out, JSON.stringify(meta, null, 1).replace(/\n}$/, `,\n "rows": [\n${t.rows.map(r => '  ' + JSON.stringify(r)).join(',\n')}\n ]\n}\n`));
    console.log(`wrote ${path.relative(REPO_ROOT, out)} (${t.rows.length} rows)`);
  }
}
