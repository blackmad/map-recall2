/**
 * Score a façade model's predicted openings against the measured gold set.
 *
 * Usage:
 *   npx tsx scripts/facade-eval/score.ts --pred=<lane.json> --lane=rfdetr [--kinds=window] [--iou=0.5] [--write]
 *
 * Prints the pooled precision/recall/median centre error with explicit
 * denominators, the per-wall spread, and whether the plan's adoption rule is
 * cleared. `--write` appends the result to the gold set's results.json.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ADOPTION_THRESHOLDS,
  clearsThresholds,
  poolScores,
  probeBestShift,
  scoreOpenings,
  type OpeningScore,
  type ScoredBox,
  type WallRect,
} from '../../src/canalRecall/facade/openingScore.ts';

interface GoldWall {
  group: string;
  surfaceId: string;
  buildingId: string;
  wallWidthM: number;
  wallHeightM: number;
  openings: WallRect[];
}
interface PredBox { kind?: string; score?: number; along: number; up: number; width?: number; height?: number; widthM?: number; heightM?: number }
interface PredRecord { buildingId?: string; elevationId?: string; surfaceId?: string; boxes?: PredBox[]; error?: string }

/** The lanes emit `widthM`/`heightM`; accept either spelling. */
const toWallRect = (box: PredBox): ScoredBox | null => {
  const width = box.width ?? box.widthM;
  const height = box.height ?? box.heightM;
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) return null;
  return { along: box.along, up: box.up, width, height, kind: box.kind, score: box.score };
};

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const goldPath = path.resolve(argument('gold') || 'review-data/facade-model-gold/v1/measured.json');
const predPath = argument('pred');
if (!predPath) throw new Error('usage: --pred=<lane.json> --lane=<name> [--kinds=window] [--iou=0.5] [--write]');
const lane = argument('lane') || path.basename(predPath).replace(/\.json$/, '');
const kinds = argument('kinds')?.split(',').filter(Boolean);
const iouThreshold = Number(argument('iou') || 0.5);
const write = process.argv.includes('--write');
const probe = process.argv.includes('--probe');
const minWallWidthM = Number(argument('min-wall-width') || 0);
const minOpeningWidthM = Number(argument('min-opening-width') || 0);
const minOpeningHeightM = Number(argument('min-opening-height') || 0);

const gold = JSON.parse(await readFile(goldPath, 'utf8')) as { walls: GoldWall[]; counts: { walls: number; openings: number } };
const prediction = JSON.parse(await readFile(path.resolve(predPath), 'utf8')) as { setting?: string; model?: string; records: PredRecord[] };
const byElevation = new Map(prediction.records.map((record) => [record.elevationId ?? record.surfaceId ?? '', record]));

// The measured set is dominated by thin 3DBAG wall slices with no openings; a
// façade test set is walls wide enough to be a frontage that carry at least one
// window-sized opening.
const inScope = gold.walls.filter((wall) =>
  wall.wallWidthM >= minWallWidthM
  && wall.openings.some((opening) => opening.width >= minOpeningWidthM && opening.height >= minOpeningHeightM));

const perWall: Array<{ gold: GoldWall; score: OpeningScore }> = [];
const probeInput: Array<{ measured: WallRect[]; predictions: ScoredBox[]; wallWidthM: number }> = [];
let missingPredictions = 0;
for (const wall of inScope) {
  const record = byElevation.get(wall.surfaceId);
  if (!record) missingPredictions += 1;
  const boxes = (record?.boxes ?? []).map(toWallRect).filter((box): box is ScoredBox => box !== null);
  const measured = wall.openings.filter((opening) =>
    minOpeningWidthM || minOpeningHeightM
      ? opening.width >= minOpeningWidthM && opening.height >= minOpeningHeightM
      : true);
  perWall.push({ gold: wall, score: scoreOpenings(measured, boxes, { iouThreshold, kinds }) });
  probeInput.push({ measured, predictions: boxes, wallWidthM: wall.wallWidthM });
}
const pooled = poolScores(perWall.map((entry) => entry.score));
const verdict = clearsThresholds(pooled, ADOPTION_THRESHOLDS);

const pct = (value: number | null) => (value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`);
const metres = (value: number | null) => (value === null ? 'n/a' : `${value.toFixed(3)} m`);
const wallsWithOpenings = perWall.filter((entry) => entry.gold.openings.length > 0).length;
const wallsWithPredictions = perWall.filter((entry) => entry.score.predicted > 0).length;

process.stdout.write([
  `lane ${lane}${prediction.setting ? ` (${prediction.setting})` : ''}${kinds ? ` kinds=[${kinds.join(',')}]` : ' all kinds'} vs measured gold`,
  `model ${prediction.model ?? '?'} · IoU >= ${iouThreshold}`,
  `scope walls>=${minWallWidthM} m with a >=${minOpeningWidthM}x${minOpeningHeightM} m opening -> ${inScope.length}/${gold.walls.length} walls`,
  '',
  `measured openings   ${pooled.measured} across ${wallsWithOpenings}/${inScope.length} walls`,
  `predicted boxes     ${pooled.predicted} across ${wallsWithPredictions}/${inScope.length} walls`,
  `matched             ${pooled.truePositives}   fp ${pooled.falsePositives}   fn ${pooled.falseNegatives}`,
  `precision           ${pct(pooled.precision)}   (${pooled.truePositives}/${pooled.predicted})`,
  `recall              ${pct(pooled.recall)}   (${pooled.truePositives}/${pooled.measured})`,
  `median centre error ${metres(pooled.medianCentreErrorM)}`,
  '',
  `adoption rule (recall>=${ADOPTION_THRESHOLDS.recall}, precision>=${ADOPTION_THRESHOLDS.precision}, centre<=${ADOPTION_THRESHOLDS.centreErrorM} m):`,
  `  recall ${verdict.recall ? 'PASS' : 'FAIL'} · precision ${verdict.precision ? 'PASS' : 'FAIL'} · centre ${verdict.centreError ? 'PASS' : 'FAIL'}`,
  `  => ${Object.values(verdict).every(Boolean) ? 'CLEARS the absolute thresholds' : 'does NOT clear the absolute thresholds'}`,
  missingPredictions ? `\nwarning: ${missingPredictions} in-scope walls had no prediction record` : '',
].filter(Boolean).join('\n') + '\n');

if (probe) {
  const shifts = probeInput.map((entry) => probeBestShift(entry.measured, entry.predictions, {
    maxShiftM: 1, stepM: 0.1, wallWidthM: entry.wallWidthM, iouThreshold, kinds,
  }));
  const best = poolScores(shifts);
  const flipShare = shifts.filter((shift) => shift.flipped).length;
  const shiftsAlong = shifts.filter((shift) => shift.truePositives > 0).map((shift) => shift.shiftAlongM);
  process.stdout.write([
    '',
    'alignment probe (allows a global translate of up to +/-1 m, and a mirror):',
    `  best pooled recall    ${pct(best.recall)}   (${best.truePositives}/${best.measured})`,
    `  best pooled precision ${pct(best.precision)}`,
    `  walls needing a mirror ${flipShare}/${shifts.length}`,
    `  median along shift    ${metres(shiftsAlong.length ? shiftsAlong.sort((a, b) => a - b)[Math.floor(shiftsAlong.length / 2)] : null)}`,
    best.recall !== null && pooled.recall !== null && best.recall - pooled.recall > 0.15
      ? '  => recall jumps under a plausible shift: the crop and the measured geometry are probably not registered'
      : '  => recall does not jump under a plausible shift: alignment is not the explanation',
  ].join('\n') + '\n');
}

if (write) {
  const resultsPath = path.join(path.dirname(goldPath), 'results.json');
  let results: { schemaVersion: number; runs: unknown[] } = { schemaVersion: 1, runs: [] };
  try { results = JSON.parse(await readFile(resultsPath, 'utf8')); } catch { /* first run */ }
  results.runs = results.runs.filter((run) => (run as { lane: string }).lane !== lane);
  results.runs.push({
    lane,
    model: prediction.model ?? null,
    setting: prediction.setting ?? null,
    kinds: kinds ?? 'all',
    iouThreshold,
    goldSha256: (await readFile(path.join(path.dirname(goldPath), 'measured.sha256'), 'utf8')).trim(),
    pooled,
    verdict,
    walls: perWall.map((entry) => ({
      surfaceId: entry.gold.surfaceId,
      measured: entry.score.measured,
      predicted: entry.score.predicted,
      truePositives: entry.score.truePositives,
      falsePositives: entry.score.falsePositives,
      falseNegatives: entry.score.falseNegatives,
      medianCentreErrorM: entry.score.medianCentreErrorM,
    })),
    generatedAt: new Date().toISOString(),
  });
  await mkdir(path.dirname(resultsPath), { recursive: true });
  await writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`);
  process.stdout.write(`appended to ${resultsPath}\n`);
}
