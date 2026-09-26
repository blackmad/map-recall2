/**
 * Apply the opening lattice to the union predictions and write a lane file the
 * scorer already understands, plus the aggregate row diagnostics that size the
 * hand-labelling job.
 *
 * The union of detectors (`openingMerge.ts`) misses openings hidden behind a
 * van, a tree or a shadow. `fillOpeningLattice` imputes those from the rhythm of
 * the storey rows that *were* detected. This script measures that: it never
 * moves, resizes or drops a detected box, and marks each added box
 * `origin: 'imputed'` so its contribution can be isolated.
 *
 * It also runs two diagnostic counterfactuals — with `other` boxes dropped, and
 * with only windows — because the module's own row diagnostic cannot say whether
 * a rejected candidate was blocked by a real opening or by a spurious `other`
 * region. The counterfactuals are labelled and never written as the lane file.
 *
 * Usage:
 *   npx tsx scripts/facade-eval/apply-lattice.ts \
 *     --pred=public/data/facade-model-eval/v1/predictions/union-R0.json \
 *     --out=public/data/facade-model-eval/v1/predictions/union-R0-lattice.json
 *
 * Optional: --gold=<measured.json> --diagnostics=<out.json>
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  fillOpeningLattice,
  type LatticeRowDiagnostic,
} from '../../src/canalRecall/facade/openingLattice.ts';
import type { MergedBox, OpeningKind } from '../../src/canalRecall/facade/openingMerge.ts';
import {
  poolScores,
  scoreOpenings,
  type OpeningScore,
  type ScoredBox,
  type WallRect,
} from '../../src/canalRecall/facade/openingScore.ts';

interface PredBox {
  kind?: string;
  score?: number;
  along: number;
  up: number;
  widthM?: number;
  width?: number;
  heightM?: number;
  height?: number;
  sources?: string[];
}
interface PredRecord {
  buildingId?: string;
  elevationId?: string;
  surfaceId?: string;
  wallWidthM?: number;
  wallHeightM?: number;
  boxes?: PredBox[];
}
interface PredFile { model?: string; setting?: string; records: PredRecord[] }
interface GoldWall { surfaceId: string; wallWidthM: number; wallHeightM: number; openings: WallRect[] }
interface GoldFile { walls: GoldWall[] }

/** The two scopes the demo and the scorer use, kept identical here. */
const SCOPES = [
  { id: 'all', minWallWidthM: 0, minOpeningWidthM: 0, minOpeningHeightM: 0 },
  { id: 'facade', minWallWidthM: 4, minOpeningWidthM: 0.6, minOpeningHeightM: 0.9 },
] as const;

const argument = (name: string) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const predPath = path.resolve(
  argument('pred') || 'public/data/facade-model-eval/v1/predictions/union-R0.json',
);
const outPath = path.resolve(
  argument('out') || 'public/data/facade-model-eval/v1/predictions/union-R0-lattice.json',
);
const diagnosticsPath = path.resolve(
  argument('diagnostics') || 'public/data/facade-model-eval/v1/lattice-diagnostics.json',
);
const goldPath = path.resolve(argument('gold') || 'review-data/facade-model-gold/v1/measured.json');

const asKind = (kind: string | undefined): OpeningKind =>
  kind === 'door' ? 'door' : kind === 'window' ? 'window' : 'other';

const toMerged = (box: PredBox): MergedBox | null => {
  const width = box.width ?? box.widthM;
  const height = box.height ?? box.heightM;
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) return null;
  return {
    along: box.along,
    up: box.up,
    width,
    height,
    kind: asKind(box.kind),
    score: box.score,
    sources: box.sources ?? [],
  };
};

type OriginedBox = ScoredBox & { origin: string; sources?: string[] };
type OutRecord = PredRecord & { boxes: Array<PredBox & { origin: string; rowSupport?: number }> };

const pct = (value: number | null) => (value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`);
const metres = (value: number | null) => (value === null ? 'n/a' : `${value.toFixed(3)} m`);

const prediction = JSON.parse(await readFile(predPath, 'utf8')) as PredFile;
const gold = JSON.parse(await readFile(goldPath, 'utf8')) as GoldFile;

interface ReasonBucket {
  ground: number;
  tooFew: number;
  noGap: number;
  irregularPitch: number;
}
interface Totals {
  walls: number;
  rows: number;
  accepted: number;
  refused: number;
  acceptedWithImputation: number;
  acceptedAllRejected: number;
  acceptedNoCandidate: number;
  imputed: number;
  rejectedCandidates: number;
  reasons: ReasonBucket;
}
interface RecordDiagnostic {
  surfaceId: string;
  wallWidthM: number;
  wallHeightM: number;
  kinds: { window: number; door: number; other: number };
  rows: LatticeRowDiagnostic[];
}
interface LatticeRun {
  records: OutRecord[];
  totals: Totals;
  recordDiagnostics: RecordDiagnostic[];
}

const classify = (diagnostic: LatticeRowDiagnostic): keyof ReasonBucket | null => {
  const reason = diagnostic.abstained;
  if (reason === null) return null;
  if (reason.includes('ground row')) return 'ground';
  if (reason.includes('fewer than')) return 'tooFew';
  if (reason.includes('no consecutive')) return 'noGap';
  if (reason.includes('not one pitch')) return 'irregularPitch';
  throw new Error(`unclassified abstention: ${reason}`);
};

/** Run the lattice over every record, optionally dropping boxes by predicate. */
const runLattice = (keep: (box: MergedBox) => boolean): LatticeRun => {
  const totals: Totals = {
    walls: 0, rows: 0, accepted: 0, refused: 0,
    acceptedWithImputation: 0, acceptedAllRejected: 0, acceptedNoCandidate: 0,
    imputed: 0, rejectedCandidates: 0,
    reasons: { ground: 0, tooFew: 0, noGap: 0, irregularPitch: 0 },
  };
  const records: OutRecord[] = [];
  const recordDiagnostics: RecordDiagnostic[] = [];
  for (const record of prediction.records) {
    totals.walls += 1;
    const wallWidthM = record.wallWidthM ?? 0;
    const wallHeightM = record.wallHeightM ?? 0;
    const merged = (record.boxes ?? [])
      .map(toMerged)
      .filter((box): box is MergedBox => box !== null)
      .filter(keep);
    const result = fillOpeningLattice(merged, wallWidthM, wallHeightM);

    const kinds = { window: 0, door: 0, other: 0 };
    for (const box of merged) kinds[box.kind] += 1;
    recordDiagnostics.push({
      surfaceId: record.surfaceId ?? record.elevationId ?? '',
      wallWidthM, wallHeightM, kinds, rows: result.rowDiagnostics,
    });

    totals.rows += result.rows;
    for (const diagnostic of result.rowDiagnostics) {
      const bucket = classify(diagnostic);
      if (bucket === null) {
        totals.accepted += 1;
        if (diagnostic.imputed > 0) totals.acceptedWithImputation += 1;
        else if (diagnostic.rejected > 0) totals.acceptedAllRejected += 1;
        else totals.acceptedNoCandidate += 1;
      } else {
        totals.refused += 1;
        totals.reasons[bucket] += 1;
      }
      totals.imputed += diagnostic.imputed;
      totals.rejectedCandidates += diagnostic.rejected;
    }

    records.push({
      ...record,
      boxes: result.boxes.map((box) => ({
        kind: box.kind,
        score: box.score,
        along: box.along,
        up: box.up,
        widthM: box.width,
        heightM: box.height,
        sources: box.sources,
        origin: box.origin,
        ...(box.origin === 'imputed' ? { rowSupport: box.rowSupport } : {}),
      })),
    });
  }
  return { records, totals, recordDiagnostics };
};

const full = runLattice(() => true);

const output = {
  ...prediction,
  lane: 'union-R0-lattice',
  model: `${prediction.model ?? 'union'} + opening lattice (imputed boxes marked origin=imputed)`,
  method: 'fillOpeningLattice over each wall with default options; detected boxes unchanged',
  totals: {
    ...(prediction as { totals?: unknown }).totals,
    boxes: full.records.reduce((sum, record) => sum + record.boxes.length, 0),
    imputed: full.totals.imputed,
  },
  records: full.records,
};
await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(output, null, 1)}\n`);

await mkdir(path.dirname(diagnosticsPath), { recursive: true });
await writeFile(diagnosticsPath, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  prediction: path.relative(process.cwd(), predPath),
  output: path.relative(process.cwd(), outPath),
  totals: full.totals,
  records: full.recordDiagnostics,
}, null, 2)}\n`);

const arrayBoxes = (record: OutRecord | PredRecord | undefined): ScoredBox[] => {
  const boxes = (record?.boxes ?? []) as Array<PredBox & { origin?: string }>;
  const scored: OriginedBox[] = [];
  for (const box of boxes) {
    const rect = toMerged(box);
    if (!rect) continue;
    scored.push({ ...rect, origin: box.origin ?? 'detected' });
  }
  return scored;
};

const scopedWalls = (scope: typeof SCOPES[number]) =>
  gold.walls.filter((wall) =>
    wall.wallWidthM >= scope.minWallWidthM
    && wall.openings.some((opening) => opening.width >= scope.minOpeningWidthM && opening.height >= scope.minOpeningHeightM));

/** Score a run's boxes with the same functions `score.ts` uses. */
const scoreRun = (run: LatticeRun, scope: typeof SCOPES[number]): OpeningScore => {
  const byElevation = new Map(run.records.map((record) => [record.elevationId ?? record.surfaceId ?? '', record]));
  const scores = scopedWalls(scope).map((wall) => scoreOpenings(
    wall.openings.filter((opening) =>
      opening.width >= scope.minOpeningWidthM && opening.height >= scope.minOpeningHeightM),
    arrayBoxes(byElevation.get(wall.surfaceId)),
  ));
  return poolScores(scores);
};

const baselineScore = (scope: typeof SCOPES[number]): OpeningScore => {
  const byElevation = new Map(prediction.records.map((record) => [record.elevationId ?? record.surfaceId ?? '', record]));
  const scores = scopedWalls(scope).map((wall) => scoreOpenings(
    wall.openings.filter((opening) =>
      opening.width >= scope.minOpeningWidthM && opening.height >= scope.minOpeningHeightM),
    arrayBoxes(byElevation.get(wall.surfaceId)),
  ));
  return poolScores(scores);
};

// Coverage of a run: of the baseline false negatives, how many its boxes now
// match, and whether an imputed box did the matching.
const baselineBy = new Map(prediction.records.map((record) => [record.elevationId ?? record.surfaceId ?? '', record]));

interface Coverage { total: number; covered: number; byImputed: number; entries: Array<{ wall: string; opening: WallRect; matchAlong: number | null; origin: string | null }> }

const coverageRun = (run: LatticeRun, scope: typeof SCOPES[number]): Coverage => {
  const afterBy = new Map(run.records.map((record) => [record.elevationId ?? record.surfaceId ?? '', record]));
  const coverage: Coverage = { total: 0, covered: 0, byImputed: 0, entries: [] };
  for (const wall of scopedWalls(scope)) {
    const measured = wall.openings.filter((opening) =>
      opening.width >= scope.minOpeningWidthM && opening.height >= scope.minOpeningHeightM);
    const baselineBoxes = (baselineBy.get(wall.surfaceId)?.boxes ?? [])
      .map(toMerged).filter((box): box is MergedBox => box !== null);
    const before = scoreOpenings(measured, baselineBoxes);
    const after = scoreOpenings(measured, arrayBoxes(afterBy.get(wall.surfaceId)));
    for (const opening of before.unmatchedMeasured) {
      coverage.total += 1;
      const match = after.matches.find((candidate) => candidate.gold === opening);
      const prediction = match?.prediction as OriginedBox | undefined;
      if (match && prediction) {
        coverage.covered += 1;
        if (prediction.origin === 'imputed') coverage.byImputed += 1;
      }
      coverage.entries.push({
        wall: wall.surfaceId,
        opening,
        matchAlong: prediction ? prediction.along + prediction.width / 2 : null,
        origin: prediction?.origin ?? null,
      });
    }
  }
  return coverage;
};

const lines: string[] = [];
lines.push(`wrote ${path.relative(process.cwd(), outPath)} (${full.records.length} walls, ${full.totals.imputed} imputed boxes)`);
lines.push(`wrote ${path.relative(process.cwd(), diagnosticsPath)}`);
lines.push('');
lines.push('lattice row diagnostics (all 60 walls, full union input):');
lines.push(`  rows clustered        ${full.totals.rows}`);
lines.push(`  accepted (ran)        ${full.totals.accepted}  (imputed: ${full.totals.acceptedWithImputation}, candidates all rejected: ${full.totals.acceptedAllRejected}, no candidate: ${full.totals.acceptedNoCandidate})`);
lines.push(`  refused               ${full.totals.refused}  (ground ${full.totals.reasons.ground}, too few windows ${full.totals.reasons.tooFew}, no gap ${full.totals.reasons.noGap}, not one pitch ${full.totals.reasons.irregularPitch})`);
lines.push(`  imputed boxes         ${full.totals.imputed}   rejected candidates ${full.totals.rejectedCandidates}`);

const facadeWalls = new Set(gold.walls
  .filter((wall) => wall.wallWidthM >= 4 && wall.openings.some((opening) => opening.width >= 0.6 && opening.height >= 0.9))
  .map((wall) => wall.surfaceId));
lines.push('');
lines.push(`facade-scope walls (${facadeWalls.size}) in detail:`);
for (const diagnostic of full.recordDiagnostics.filter((record) => facadeWalls.has(record.surfaceId))) {
  lines.push(`  ${diagnostic.surfaceId}  ${diagnostic.wallWidthM.toFixed(2)}x${diagnostic.wallHeightM.toFixed(2)} m  windows ${diagnostic.kinds.window} doors ${diagnostic.kinds.door} other ${diagnostic.kinds.other}`);
  diagnostic.rows.forEach((row) => {
    lines.push(`    row ${row.row} up=${row.centreUp.toFixed(2)} detected ${row.detected} imputed ${row.imputed} rejected ${row.rejected}${row.abstained ? `  [${row.abstained}]` : ''}`);
  });
}

lines.push('');
lines.push('scope scores (before = union, after = union + lattice):');
for (const scope of SCOPES) {
  const before = baselineScore(scope);
  const after = scoreRun(full, scope);
  const coverage = coverageRun(full, scope);
  lines.push(`  scope ${scope.id}:`);
  const row = (label: string, score: OpeningScore) =>
    `    ${label.padEnd(6)} P ${pct(score.precision).padEnd(6)} R ${pct(score.recall).padEnd(6)} centre ${metres(score.medianCentreErrorM).padEnd(8)} tp ${score.truePositives} fp ${score.falsePositives} fn ${score.falseNegatives} predicted ${score.predicted}`;
  lines.push(row('before', before));
  lines.push(row('after', after));
  lines.push(`    baseline false negatives now covered: ${coverage.covered}/${coverage.total} (by imputed box: ${coverage.byImputed})`);
}
lines.push('');
lines.push('facade-scope baseline false negatives (the 12 the union misses):');
for (const entry of coverageRun(full, SCOPES[1]).entries) {
  lines.push(`  ${entry.wall}  measured centre along=${(entry.opening.along + entry.opening.width / 2).toFixed(2)} up=${(entry.opening.up + entry.opening.height / 2).toFixed(2)} w=${entry.opening.width.toFixed(2)} h=${entry.opening.height.toFixed(2)}  covered=${entry.origin ?? 'no'}`);
}

lines.push('');
lines.push('diagnostic counterfactuals (not the delivered lane):');
const counterfactuals: Array<{ label: string; keep: (box: MergedBox) => boolean }> = [
  { label: 'drop other', keep: (box) => box.kind !== 'other' },
  { label: 'windows only', keep: (box) => box.kind === 'window' },
];
for (const counterfactual of counterfactuals) {
  const run = runLattice(counterfactual.keep);
  const facade = scoreRun(run, SCOPES[1]);
  const coverage = coverageRun(run, SCOPES[1]);
  lines.push(`  ${counterfactual.label}: imputed ${run.totals.imputed}, rejected candidates ${run.totals.rejectedCandidates}, accepted ${run.totals.accepted} (imputed ${run.totals.acceptedWithImputation}, all rejected ${run.totals.acceptedAllRejected}, no candidate ${run.totals.acceptedNoCandidate})`);
  lines.push(`    facade scope P ${pct(facade.precision)} R ${pct(facade.recall)} centre ${metres(facade.medianCentreErrorM)} tp ${facade.truePositives} fp ${facade.falsePositives} fn ${facade.falseNegatives}; baseline FN covered ${coverage.covered}/${coverage.total} (imputed ${coverage.byImputed})`);
  const facadeImputed = run.records
    .filter((record) => facadeWalls.has(record.surfaceId ?? ''))
    .flatMap((record) => record.boxes.filter((box) => box.origin === 'imputed')
      .map((box) => `${(box.along + (box.widthM ?? 0) / 2).toFixed(2)}@up${(box.up + (box.heightM ?? 0) / 2).toFixed(2)}`));
  if (facadeImputed.length) lines.push(`    imputed boxes on facade walls: ${facadeImputed.join(', ')}`);
}
process.stdout.write(`${lines.join('\n')}\n`);

process.stdout.write(`\nrun: npx tsx scripts/facade-eval/score.ts --pred=${path.relative(process.cwd(), outPath)} --lane=union-R0-lattice\n`);
