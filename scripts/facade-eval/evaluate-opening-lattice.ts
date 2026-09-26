/**
 * Evaluate the default opening lattice on the frozen union-R0 predictions.
 *
 * npx tsx scripts/facade-eval/evaluate-opening-lattice.ts
 *   [--pred=public/data/facade-model-eval/v1/predictions/union-R0.json]
 *   [--gold=review-data/facade-model-gold/v1/measured.json]
 *   [--out=/tmp/lattice-evaluation.json]
 *
 * T2.4's input is union-R0.json as written, so the primary run feeds every union
 * box to `fillOpeningLattice`. The union's `other` boxes are semantic masks, not
 * openings, and they cover whole walls, so a second diagnostic run drops them
 * before the lattice to show what the same function does on a cleaner window
 * skeleton. Every score keeps all union kinds, so both runs share one baseline.
 *
 * The output is deterministic and read-only unless --out is supplied. The
 * measured set is a point-cloud lower bound, not a hand-labelled photo set.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fillOpeningLattice, type LatticeBox, type LatticeRowDiagnostic } from '../../src/canalRecall/facade/openingLattice.ts';
import type { MergedBox, OpeningKind } from '../../src/canalRecall/facade/openingMerge.ts';
import { poolScores, scoreOpenings, type OpeningScore, type ScoredBox, type WallRect } from '../../src/canalRecall/facade/openingScore.ts';

interface GoldWall { surfaceId: string; wallWidthM: number; wallHeightM: number; openings: WallRect[] }
interface PredictionBox { kind?: string; score?: number; along: number; up: number; widthM?: number; heightM?: number; width?: number; height?: number; sources?: string[] }
interface PredictionRecord { elevationId?: string; surfaceId?: string; wallWidthM?: number; wallHeightM?: number; boxes?: PredictionBox[] }

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const predPath = path.resolve(arg('pred') ?? 'public/data/facade-model-eval/v1/predictions/union-R0.json');
const goldPath = path.resolve(arg('gold') ?? 'review-data/facade-model-gold/v1/measured.json');
const outputPath = arg('out');
const prediction = JSON.parse(await readFile(predPath, 'utf8')) as { records: PredictionRecord[] };
const gold = JSON.parse(await readFile(goldPath, 'utf8')) as { walls: GoldWall[] };
const bySurface = new Map(prediction.records.map((record) => [record.elevationId ?? record.surfaceId ?? '', record]));

const toRect = (box: PredictionBox): ScoredBox | null => {
  const width = box.width ?? box.widthM;
  const height = box.height ?? box.heightM;
  if (!(typeof width === 'number' && width > 0 && typeof height === 'number' && height > 0)) return null;
  return { along: box.along, up: box.up, width, height, kind: box.kind, score: box.score };
};
const isOpening = (kind: OpeningKind): boolean => kind === 'window' || kind === 'door';
/** The union emits `window`/`door`/`other`; anything else is semantic background. */
const asKind = (kind: string | undefined): OpeningKind => (kind === 'window' || kind === 'door' ? kind : 'other');
/** The lattice's own box contract (`MergedBox`), with the union's sources dropped. */
const toMerged = (box: ScoredBox): MergedBox =>
  ({ along: box.along, up: box.up, width: box.width, height: box.height, kind: asKind(box.kind), score: box.score, sources: [] });
const compact = (score: OpeningScore) => ({
  measured: score.measured, predicted: score.predicted,
  truePositives: score.truePositives, falsePositives: score.falsePositives,
  falseNegatives: score.falseNegatives, precision: score.precision,
  recall: score.recall, medianCentreErrorM: score.medianCentreErrorM,
});

const abstentionCounts = (diagnostics: readonly LatticeRowDiagnostic[]) =>
  Object.fromEntries([...new Set(diagnostics.map((row) => row.abstained).filter((reason): reason is string => reason !== null))]
    .sort().map((reason) => [reason, diagnostics.filter((row) => row.abstained === reason).length]));

type LatticeInput = 'union' | 'openings';
type WallEvaluation = { gold: GoldWall; all: ScoredBox[]; additions: LatticeBox[]; diagnostics: LatticeRowDiagnostic[] };

const buildWalls = (latticeInput: LatticeInput) => {
  const walls: WallEvaluation[] = [];
  let missingPredictionRecords = 0;
  let dimensionMismatches = 0;
  for (const wall of gold.walls) {
    const record = bySurface.get(wall.surfaceId);
    if (!record) missingPredictionRecords++;
    if (record && (Math.abs((record.wallWidthM ?? NaN) - wall.wallWidthM) > 0.02
      || Math.abs((record.wallHeightM ?? NaN) - wall.wallHeightM) > 0.02)) dimensionMismatches++;
    const all = (record?.boxes ?? []).map(toRect).filter((box): box is ScoredBox => box !== null);
    // `other` semantic masks are not opening evidence; the diagnostic run keeps
    // only the windows and doors the lattice is meant to complete.
    const merged = all.map(toMerged).filter((box) => latticeInput === 'union' || isOpening(box.kind));
    const filled = fillOpeningLattice(merged, record?.wallWidthM ?? wall.wallWidthM, record?.wallHeightM ?? wall.wallHeightM);
    const additions = filled.boxes.filter((box) => box.origin === 'imputed');
    walls.push({ gold: wall, all, additions, diagnostics: filled.rowDiagnostics });
  }
  return { walls, missingPredictionRecords, dimensionMismatches };
};

const scopes = [
  { id: 'all', label: 'all walls with an opening', eligible: (wall: GoldWall) => wall.openings.length > 0,
    measured: (wall: GoldWall) => wall.openings },
  { id: 'facade', label: 'facades >=4 m with a >=0.6 x 0.9 m opening',
    eligible: (wall: GoldWall) => wall.wallWidthM >= 4 && wall.openings.some((box) => box.width >= 0.6 && box.height >= 0.9),
    measured: (wall: GoldWall) => wall.openings.filter((box) => box.width >= 0.6 && box.height >= 0.9) },
] as const;

const evaluate = (walls: WallEvaluation[]) => scopes.map((scope) => {
  const included = walls.filter(({ gold: wall }) => scope.eligible(wall));
  // The facade scope filters measured boxes, so it must re-score those walls.
  const scored = included.map(({ gold: wall, all, additions }) => ({
    baseline: scoreOpenings(scope.measured(wall), all),
    lattice: scoreOpenings(scope.measured(wall), [...all, ...additions]),
  }));
  const diagnostics = included.flatMap((wall) => wall.diagnostics);
  const baseline = poolScores(scored.map((entry) => entry.baseline));
  const lattice = poolScores(scored.map((entry) => entry.lattice));
  return {
    id: scope.id, label: scope.label, walls: included.length,
    baseline: compact(baseline), lattice: compact(lattice),
    recoveredFalseNegatives: baseline.falseNegatives - lattice.falseNegatives,
    addedFalsePositives: lattice.falsePositives - baseline.falsePositives,
    imputed: included.reduce((sum, wall) => sum + wall.additions.length, 0),
    rows: diagnostics.length, abstainedRows: diagnostics.filter((row) => row.abstained !== null).length,
    abstentions: abstentionCounts(diagnostics),
  };
});

const corpusOf = (walls: WallEvaluation[]) => {
  const diagnostics = walls.flatMap((wall) => wall.diagnostics);
  return {
    walls: walls.length,
    wallsWithoutRows: walls.filter((wall) => wall.diagnostics.length === 0).length,
    rows: diagnostics.length,
    abstainedRows: diagnostics.filter((row) => row.abstained !== null).length,
    imputed: walls.reduce((sum, wall) => sum + wall.additions.length, 0),
    abstentions: abstentionCounts(diagnostics),
  };
};

const unionRun = buildWalls('union');
const openingRun = buildWalls('openings');
const report = {
  prediction: path.relative(process.cwd(), predPath), gold: path.relative(process.cwd(), goldPath),
  iouThreshold: 0.5, latticeOptions: 'defaults',
  missingPredictionRecords: unionRun.missingPredictionRecords, dimensionMismatches: unionRun.dimensionMismatches,
  runs: [
    { id: 'union', label: 'union boxes (windows, doors and other semantic masks)',
      corpus: corpusOf(unionRun.walls), scopes: evaluate(unionRun.walls) },
    { id: 'openings', label: 'windows and doors only (other semantic masks dropped before the lattice)',
      corpus: corpusOf(openingRun.walls), scopes: evaluate(openingRun.walls) },
  ],
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) await writeFile(path.resolve(outputPath), serialized);
process.stdout.write(serialized);
