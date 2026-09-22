/**
 * Publish the façade-model comparison.
 *
 * Copies the gold crops and every lane's predictions into a served, versioned
 * directory and scores each lane in two scopes, so the comparison page can show
 * the numbers without recomputing them:
 *  - `all`  — every gold wall that carries an opening.
 *  - `facade` — walls at least 4 m wide with at least one window-sized opening,
 *    which is the closest thing this gold set has to a real façade test set.
 *
 * Usage: npx tsx scripts/facade-eval/publish-eval-demo.ts [--version=v1]
 */
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ADOPTION_THRESHOLDS,
  clearsThresholds,
  poolScores,
  probeBestShift,
  scoreOpenings,
  type ScoredBox,
  type WallRect,
} from '../../src/canalRecall/facade/openingScore.ts';

const argument = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const version = argument('version') || 'v1';
const outDir = path.resolve(argument('out') || `public/data/facade-model-eval/${version}`);
const goldDir = path.resolve('review-data/facade-model-gold/v1');
const evalManifestDir = path.resolve(argument('crops') || '.cache/facade-eval/oudzuid-eval');
const cacheDir = path.resolve('.cache/facade-eval');

/** Every model we have run, with what it can and cannot see. */
const LANES = [
  { id: 'rfdetr-R0', file: 'rfdetr-oudzuid-R0.json', label: 'RF-DETR-seg-2XL', model: 'building-facade-segmentation-instance/4', kind: 'photo', door: false, roof: false, sky: false, licence: 'CC BY 4.0 (uploader-asserted)', notes: 'instance masks; the one we already had cached' },
  { id: 'rsjek-R0', file: 'rsjek-oudzuid-R0.json', label: 'YOLO26x-seg', model: 'facade-rsjek/5', kind: 'photo', door: true, roof: false, sky: false, licence: 'CC BY 4.0 (uploader-asserted)', notes: 'has an `entrance` class — the only box model with doors' },
  { id: 'amsseg-R0', file: 'amsseg-oudzuid-R0.json', label: 'Amsterdam Facade (DeepLabV3+)', model: 'cmp-zosci/amsterdam-facade/2', kind: 'photo', door: true, roof: false, sky: true, licence: 'CC BY 4.0 (uploader-asserted)', notes: 'the Amsterdam-specific model; semantic segmentation, so outlines not boxes' },
  { id: 'union-R0', file: 'union-oudzuid-R0.json', label: 'Union (D1)', model: 'union(RF-DETR, YOLO26x) — doors win', kind: 'photo', door: true, roof: false, sky: false, licence: 'inherits both', notes: 'decision D1: union of windows, doors win over overlapping windows' },
  { id: 'windet-R0', file: 'windet-oudzuid-R0.json', label: 'win_det_heatmaps', model: 'lck1201/win_det_heatmaps', kind: 'photo', door: false, roof: false, sky: false, licence: 'MIT', notes: 'window corners and grid rhythm' },
  { id: 'ptv1-R0', file: 'ptv1-R0.json', label: 'UnderOneFacade PTv1', model: 'PT_lofg3_xyz.pth (global)', kind: 'cloud', door: true, roof: true, sky: false, licence: 'MIT code / CC BY 4.0 weights', notes: 'point-cloud model; GPU run, $0.04' },
  { id: 'dgcnn-R0', file: 'dgcnn-oudzuid-lofg3.json', label: 'UnderOneFacade DGCNN', model: 'DGCNN_lofg3_xyz.pth (global)', kind: 'cloud', door: true, roof: true, sky: false, licence: 'MIT code / CC BY 4.0 weights', notes: 'point-cloud model; local CPU/MPS' },
];

interface GoldWall { surfaceId: string; group: string; wallWidthM: number; wallHeightM: number; openings: WallRect[] }
interface PredBox { along: number; up: number; widthM?: number; width?: number; heightM?: number; height?: number; kind?: string; score?: number }
interface PredRecord { elevationId?: string; surfaceId?: string; boxes?: PredBox[] }

const toRect = (box: PredBox): ScoredBox | null => {
  const width = box.width ?? box.widthM;
  const height = box.height ?? box.heightM;
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) return null;
  return { along: box.along, up: box.up, width, height, kind: box.kind, score: box.score };
};

const gold = JSON.parse(await readFile(path.join(goldDir, 'measured.json'), 'utf8')) as { walls: GoldWall[]; counts: { walls: number; openings: number } };
const goldSha = (await readFile(path.join(goldDir, 'measured.sha256'), 'utf8')).trim();

const SCOPES = [
  { id: 'all', label: 'all walls with an opening', minWallWidthM: 0, minOpeningWidthM: 0, minOpeningHeightM: 0 },
  { id: 'facade', label: 'façades ≥ 4 m with a window-sized opening', minWallWidthM: 4, minOpeningWidthM: 0.6, minOpeningHeightM: 0.9 },
];

await mkdir(path.join(outDir, 'crops'), { recursive: true });
await mkdir(path.join(outDir, 'predictions'), { recursive: true });
let crops = 0;
for (const file of await readdir(path.join(evalManifestDir, 'images'))) {
  if (!file.endsWith('.jpg')) continue;
  await copyFile(path.join(evalManifestDir, 'images', file), path.join(outDir, 'crops', file));
  crops += 1;
}

const published = [];
const scores: Record<string, Record<string, unknown>> = {};
for (const lane of LANES) {
  let prediction: { model?: string; setting?: string; records: PredRecord[] };
  try {
    prediction = JSON.parse(await readFile(path.join(cacheDir, lane.file), 'utf8'));
  } catch {
    process.stdout.write(`skipping ${lane.id}: ${lane.file} not found\n`);
    continue;
  }
  await copyFile(path.join(cacheDir, lane.file), path.join(outDir, 'predictions', `${lane.id}.json`));
  published.push({ ...lane, records: prediction.records.length });
  const byElevation = new Map(prediction.records.map((record) => [record.elevationId ?? record.surfaceId ?? '', record]));

  scores[lane.id] = {};
  for (const scope of SCOPES) {
    const walls = gold.walls.filter((wall) =>
      wall.wallWidthM >= scope.minWallWidthM
      && wall.openings.some((opening) => opening.width >= scope.minOpeningWidthM && opening.height >= scope.minOpeningHeightM));
    const perWall = walls.map((wall) => {
      const boxes = (byElevation.get(wall.surfaceId)?.boxes ?? []).map(toRect).filter((box): box is ScoredBox => box !== null);
      const measured = wall.openings.filter((opening) =>
        opening.width >= scope.minOpeningWidthM && opening.height >= scope.minOpeningHeightM);
      return { wall, measured, boxes, score: scoreOpenings(measured, boxes, { iouThreshold: 0.5 }) };
    });
    const pooled = poolScores(perWall.map((entry) => entry.score));
    const verdict = clearsThresholds(pooled);
    const shifts = perWall.map((entry) => probeBestShift(entry.measured, entry.boxes, { maxShiftM: 1, stepM: 0.1, wallWidthM: entry.wall.wallWidthM }));
    const best = poolScores(shifts);
    scores[lane.id][scope.id] = {
      scope: scope.label,
      walls: walls.length,
      pooled,
      verdict,
      probe: { recall: best.recall, precision: best.precision, flipped: shifts.filter((shift) => shift.flipped).length },
    };
  }
}

await copyFile(path.join(goldDir, 'measured.json'), path.join(outDir, 'measured.json'));
await writeFile(path.join(outDir, 'measured.sha256'), `${goldSha}\n`);
await writeFile(path.join(outDir, 'scores.json'), `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  thresholds: ADOPTION_THRESHOLDS,
  gold: { walls: gold.counts.walls, openings: gold.counts.openings, sha256: goldSha },
  scopes: SCOPES.map((scope) => ({ id: scope.id, label: scope.label })),
  lanes: published,
  scores,
}, null, 2)}\n`);
await writeFile(path.join(outDir, 'index.json'), `${JSON.stringify({
  version,
  generatedAt: new Date().toISOString(),
  note: 'Measured openings are point-cloud geometry. Model boxes are predictions. Green = measured, others per model.',
  gold: { walls: gold.counts.walls, openings: gold.counts.openings, sha256: goldSha },
  predictions: published,
}, null, 2)}\n`);

process.stdout.write([
  `published ${crops} crops, ${published.length} lanes to ${outDir}`,
  ...published.map((lane) => {
    const all = scores[lane.id].all as { pooled: { precision: number | null; recall: number | null; medianCentreErrorM: number | null } };
    return `  ${lane.id.padEnd(11)} P ${all.pooled.precision === null ? 'n/a' : (all.pooled.precision * 100).toFixed(1) + '%'}  R ${all.pooled.recall === null ? 'n/a' : (all.pooled.recall * 100).toFixed(1) + '%'}`;
  }),
].join('\n') + '\n');
