/**
 * Score human labels against the detector, and let the verdict decide.
 *
 * This is the join that has been missing since `calibration.ts` was written:
 * blind human readings on one side, the detector's own output on the other, and
 * `fieldAccuracy` → `fieldVerdict` in between deciding whether a field may be
 * auto-accepted, needs review, or should be demoted across the tier.
 *
 * The verdict is binding, not advisory. A field that comes back `demote` is one
 * the pipeline is not entitled to publish at its current confidence, and the
 * point of running this is to be told that — a run where everything comes back
 * `accept` has usually measured its own assumptions.
 *
 * Usage: npx tsx scripts/facade-twin/score-review.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AMSTERDAM_GRACHTENGORDEL_WEST } from '../../src/canalRecall/facade/areas.ts';
import { confidenceBias, expectedCalibrationError, fieldAccuracy, fieldVerdict, type ReviewOutcome } from '../../src/canalRecall/facade/calibration.ts';
import { UNVALIDATED_CONFIDENCE } from '../../src/canalRecall/facade/streetLevelEvidence.ts';
import { wallFamily } from '../../src/canalRecall/facade/materials.ts';

const AREA = AMSTERDAM_GRACHTENGORDEL_WEST;
const REVIEW = path.resolve('public/canal-drive/facade-review');
const STAGING = path.resolve('public/data/extracts/amsterdam/staging/facade-twin', AREA.areaId);

interface Label {
  pandId: string;
  storeys?: string; bays?: string; gable?: string; wall?: string; usable?: string; notes?: string;
}

let labels: Label[];
try {
  labels = (JSON.parse(await readFile(path.join(REVIEW, 'labels.json'), 'utf8')) as { labels: Label[] }).labels;
} catch {
  console.error('No labels yet. Open public/canal-drive/facade-review/index.html, label the sample,');
  console.error('export, and save the result as public/canal-drive/facade-review/labels.json.');
  process.exit(1);
}
const { truth } = JSON.parse(await readFile(path.join(REVIEW, 'truth.json'), 'utf8')) as {
  truth: Array<{
    pandId: string;
    detector: { storeys: number; bays: number; openings: number; wallRgb: [number, number, number] | null; plausibility: number };
    context: { constructionYear: number | null; declaredStoreys: number | null; eavesAboveGroundM: number; obliquityDeg: number; standoffM: number; registerSays: string | null; stratum: string };
  }>;
};
const byId = new Map(truth.map(t => [t.pandId, t]));

const parseCount = (value: string | undefined): number | null => {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
};

const outcomes: ReviewOutcome[] = [];
const rows: string[] = [];
let unusable = 0, unlabelled = 0;

for (const label of labels) {
  const record = byId.get(label.pandId);
  if (!record) continue;

  // A reviewer who says the image is not a façade has made a measurement about
  // the *acquisition*, not the building. It scores the plausibility filter and
  // is excluded from the field accuracies, which would otherwise be dominated
  // by images of trees.
  if (label.usable === 'no') {
    unusable++;
    outcomes.push({
      pandId: label.pandId, field: 'isFacade', source: 'streetlevel-measured',
      confidence: record.detector.plausibility,
      // The filter is right when it flagged an image the reviewer also rejects.
      correct: record.detector.plausibility < 0.99,
    });
    rows.push(`${label.pandId}  UNUSABLE  detector plausibility ${record.detector.plausibility.toFixed(2)}  ${record.context.stratum}`);
    continue;
  }
  if (!label.storeys && !label.bays) { unlabelled++; continue; }

  outcomes.push({
    pandId: label.pandId, field: 'isFacade', source: 'streetlevel-measured',
    confidence: record.detector.plausibility, correct: record.detector.plausibility >= 0.99,
  });

  const humanStoreys = parseCount(label.storeys);
  if (humanStoreys !== null) {
    outcomes.push({
      pandId: label.pandId, field: 'storeys', source: 'streetlevel-measured',
      confidence: UNVALIDATED_CONFIDENCE,
      correct: record.detector.storeys === humanStoreys,
    });
  }
  const humanBays = parseCount(label.bays);
  if (humanBays !== null) {
    outcomes.push({
      pandId: label.pandId, field: 'bays', source: 'streetlevel-measured',
      confidence: UNVALIDATED_CONFIDENCE,
      correct: record.detector.bays === humanBays,
    });
  }
  // Wall family, not the exact named material: the reviewer is asked brick /
  // painted / stone, which is what a person can honestly judge from a rectified
  // strip, and it is also the decision that routes the colour snap.
  if (label.wall && label.wall !== 'unsure' && record.detector.wallRgb) {
    const detected = wallFamily(record.detector.wallRgb);
    const human = label.wall === 'stone/stucco' ? 'stone' : label.wall;
    outcomes.push({
      pandId: label.pandId, field: 'wallFamily', source: 'streetlevel-measured',
      confidence: UNVALIDATED_CONFIDENCE, correct: detected === human,
    });
  }
  // Gable is scored against the *register*, not the detector: nothing in this
  // pipeline measures a gable yet, so what is being tested is whether the
  // register's statement matches what a person sees — a check on the source,
  // which is the only gable evidence the project has.
  if (label.gable && !['unsure', 'none visible'].includes(label.gable) && record.context.registerSays) {
    const stated = /trapgevel/i.test(record.context.registerSays) ? 'trap'
      : /halsgevel/i.test(record.context.registerSays) ? 'hals'
      : /klokgevel/i.test(record.context.registerSays) ? 'klok'
      : /tuitgevel/i.test(record.context.registerSays) ? 'tuit'
      : /puntgevel/i.test(record.context.registerSays) ? 'punt'
      : /lijstgevel|kroonlijst|rechte lijst|triglyfenlijst/i.test(record.context.registerSays) ? 'lijst' : null;
    if (stated) {
      outcomes.push({
        pandId: label.pandId, field: 'gable', source: 'monument-text',
        confidence: 0.76, correct: stated === label.gable,
      });
    }
  }

  rows.push(`${label.pandId}  human ${label.storeys ?? '—'}st/${label.bays ?? '—'}bay  `
    + `detector ${record.detector.storeys}st/${record.detector.bays}bay  ${record.context.stratum}`);
}

console.log(`${labels.length} labels, ${unusable} marked unusable, ${unlabelled} left blank\n`);
for (const row of rows) console.log('  ' + row);

const accuracies = fieldAccuracy(outcomes);
console.log('\nField accuracy, with a Wilson interval — the verdict is binding\n');
console.log('  field         n   correct   accuracy   95% interval        ECE    verdict');
for (const a of accuracies.sort((x, y) => y.reviewed - x.reviewed)) {
  const verdict = fieldVerdict(a);
  console.log(`  ${a.field.padEnd(12)} ${String(a.reviewed).padStart(3)}  ${String(a.correct).padStart(7)}   `
    + `${(a.accuracy * 100).toFixed(0).padStart(6)}%   `
    + `${(a.lower * 100).toFixed(0).padStart(3)}–${(a.upper * 100).toFixed(0).padEnd(3)}%   `
    + `${a.expectedCalibrationError.toFixed(3)}   ${verdict}`);
}
console.log(`\n  overall calibration error ${expectedCalibrationError(outcomes).toFixed(3)}`);
const bias = confidenceBias(outcomes);
console.log(`  confidence bias ${bias >= 0 ? '+' : ''}${bias.toFixed(3)} — positive means the pipeline is overconfident`);

const report = {
  metadata: {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/facade-twin/score-review.ts',
    labelled: labels.length, unusable, unlabelled,
    note: 'Blind human labels joined to detector output after the fact. Verdicts are binding: a field marked demote may not be published at its current confidence.',
  },
  accuracies: accuracies.map(a => ({ ...a, verdict: fieldVerdict(a) })),
  expectedCalibrationError: expectedCalibrationError(outcomes),
  confidenceBias: bias,
  outcomes,
};
await writeFile(path.join(STAGING, 'calibration.json'), JSON.stringify(report, null, 2));
console.log(`\nwrote ${path.relative(process.cwd(), path.join(STAGING, 'calibration.json'))}`);

const demoted = accuracies.filter(a => fieldVerdict(a) === 'demote');
if (demoted.length) {
  console.log(`\n${demoted.length} field(s) come back DEMOTE: ${demoted.map(a => a.field).join(', ')}.`);
  console.log('Those may not ship at their current confidence — either fix the detector or default the field.');
}
