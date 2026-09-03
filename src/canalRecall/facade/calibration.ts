/**
 * Whether the measurement pipeline's confidence means anything, and what to do
 * when it does not.
 *
 * `AMSTERDAM_FACADE_TWIN.md` gates the citywide expansion on this:
 *
 * > Façade measurement is automatic end to end on the pilot boundary, and its
 * > confidence scores are calibrated against held-out hand-verified buildings.
 *
 * and it names the remedy when a field fails:
 *
 * > If a field falls below its threshold, demote that field to a conservative
 * > default across the tier rather than shipping it wrong.
 *
 * A confidence number is not a measurement of anything until something has
 * checked it. `0.9` has to mean "right about nine times in ten" or it is
 * decoration, and a pipeline whose 0.9 is really 0.6 will auto-accept its way
 * through a neighbourhood inventing gables with the review queue empty and
 * every dashboard green.
 *
 * The other thing this module refuses to do is let a small sample speak
 * confidently. Twenty buildings reviewed and eighteen correct is not evidence
 * of 90% accuracy; it is consistent with 70%. Every verdict here is taken
 * against the *lower* bound of a Wilson interval, so an under-reviewed field
 * cannot be accepted on a lucky sample — and, symmetrically, is reported as
 * under-reviewed rather than demoted on an unlucky one.
 */

import type { FacadeSource } from './evidence.ts';

/**
 * One blind-review outcome: what the pipeline claimed, and what a human found.
 *
 * `correct` comes from review, not from a comparison this module performs. Field
 * agreement is a judgement — a *klokgevel* recorded as *verhoogde hals* is
 * wrong, a brick colour two shades off may not be — and encoding that here
 * would bury the judgement inside the scorer.
 */
export interface ReviewOutcome {
  pandId: string;
  field: string;
  /** The confidence the pipeline attached to the value under review. */
  confidence: number;
  /** Where the value came from, so a field can be scored per source. */
  source: FacadeSource;
  /** What blind review found. */
  correct: boolean;
}

/**
 * Wilson score interval for a binomial proportion.
 *
 * Chosen over the textbook normal approximation because the interesting cases
 * here sit near the ends — a field that is right 49 times out of 50 — where the
 * normal interval runs past 1 and stops being usable exactly when the decision
 * matters. Returns `[0, 1]` for an empty sample: no reviews is no information,
 * not 0% accuracy.
 */
export function wilsonInterval(successes: number, trials: number, z = 1.96): [lower: number, upper: number] {
  if (trials <= 0) return [0, 1];
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const centre = (p + z2 / (2 * trials)) / denominator;
  const spread = (z / denominator) * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials));
  return [Math.max(0, centre - spread), Math.min(1, centre + spread)];
}

/** One bucket of a reliability diagram: claimed confidence against observed accuracy. */
export interface CalibrationBin {
  /** Half-open [lower, upper), except the top bin which includes 1. */
  lower: number;
  upper: number;
  count: number;
  /** Mean confidence the pipeline claimed in this bucket. */
  meanConfidence: number;
  /** Share actually correct. This is what the claim is measured against. */
  observedAccuracy: number;
}

/**
 * Bucket outcomes into a reliability diagram.
 *
 * A well-calibrated pipeline has `observedAccuracy ≈ meanConfidence` in every
 * bin. The shape of the disagreement is diagnostic in a way a single number is
 * not: overconfidence concentrated in the top bin is an auto-accept problem,
 * because the top bin is precisely what ships without review.
 */
export function calibrationBins(outcomes: readonly ReviewOutcome[], binCount = 10): CalibrationBin[] {
  const bins = Array.from({ length: binCount }, (_, index) => ({
    lower: index / binCount,
    upper: (index + 1) / binCount,
    count: 0,
    confidence: 0,
    correct: 0,
  }));

  for (const outcome of outcomes) {
    const clamped = Math.min(Math.max(outcome.confidence, 0), 1);
    const index = Math.min(binCount - 1, Math.floor(clamped * binCount));
    const bin = bins[index];
    bin.count += 1;
    bin.confidence += clamped;
    if (outcome.correct) bin.correct += 1;
  }

  return bins.map(bin => ({
    lower: bin.lower,
    upper: bin.upper,
    count: bin.count,
    meanConfidence: bin.count === 0 ? 0 : bin.confidence / bin.count,
    observedAccuracy: bin.count === 0 ? 0 : bin.correct / bin.count,
  }));
}

/**
 * Expected calibration error: the sample-weighted gap between claimed and
 * observed accuracy across the bins. 0 is perfect; empty bins contribute
 * nothing rather than counting as perfect.
 */
export function expectedCalibrationError(outcomes: readonly ReviewOutcome[], binCount = 10): number {
  if (outcomes.length === 0) return 0;
  return calibrationBins(outcomes, binCount)
    .filter(bin => bin.count > 0)
    .reduce((total, bin) => total + (bin.count / outcomes.length) * Math.abs(bin.observedAccuracy - bin.meanConfidence), 0);
}

/**
 * Whether the pipeline claims more than it delivers, and by how much.
 *
 * Signed on purpose. Overconfidence ships fabrications; underconfidence only
 * wastes review capacity. They are not the same failure and must not average
 * into one number that looks fine.
 */
export function confidenceBias(outcomes: readonly ReviewOutcome[]): number {
  if (outcomes.length === 0) return 0;
  const claimed = outcomes.reduce((sum, outcome) => sum + Math.min(Math.max(outcome.confidence, 0), 1), 0) / outcomes.length;
  const observed = outcomes.filter(outcome => outcome.correct).length / outcomes.length;
  return claimed - observed;
}

/** What review found about one field, with the uncertainty kept attached. */
export interface FieldAccuracy {
  field: string;
  reviewed: number;
  correct: number;
  /** Point estimate. Never the basis of a verdict on its own. */
  rate: number;
  /** Wilson bounds at 95%. The lower bound is what decisions are taken against. */
  lower: number;
  upper: number;
  expectedCalibrationError: number;
  /** Positive means the pipeline was overconfident about this field. */
  confidenceBias: number;
}

export function fieldAccuracy(outcomes: readonly ReviewOutcome[]): FieldAccuracy[] {
  const byField = new Map<string, ReviewOutcome[]>();
  for (const outcome of outcomes) {
    const bucket = byField.get(outcome.field);
    if (bucket) bucket.push(outcome);
    else byField.set(outcome.field, [outcome]);
  }

  return [...byField.entries()]
    .map(([field, bucket]) => {
      const correct = bucket.filter(outcome => outcome.correct).length;
      const [lower, upper] = wilsonInterval(correct, bucket.length);
      return {
        field,
        reviewed: bucket.length,
        correct,
        rate: correct / bucket.length,
        lower,
        upper,
        expectedCalibrationError: expectedCalibrationError(bucket),
        confidenceBias: confidenceBias(bucket),
      };
    })
    .sort((a, b) => a.lower - b.lower || a.field.localeCompare(b.field));
}

/**
 * What to do with a field before shipping a tier.
 *
 * `demote` is the doc's remedy and the only honest one: stop rendering that
 * field across the tier and let it fall back to a conservative default, rather
 * than shipping it wrong or — the tempting alternative the doc explicitly
 * forbids — lowering the confidence bar until it passes.
 */
export type FieldVerdict = 'accept' | 'demote' | 'needs-review';

export interface VerdictThresholds {
  /** Accuracy a field must clear to ship. The doc sets 0.85 for gable and roof form. */
  minimumAccuracy: number;
  /** Reviews needed before a verdict is anything but `needs-review`. */
  minimumSample: number;
  /** Calibration error above which confidence is not trustworthy enough to auto-accept. */
  maximumCalibrationError: number;
}

export const DEFAULT_THRESHOLDS: VerdictThresholds = {
  minimumAccuracy: 0.85,
  minimumSample: 30,
  maximumCalibrationError: 0.1,
};

/**
 * Judge one field against its thresholds.
 *
 * Accepting requires the *lower* bound to clear the bar, so a field cannot ship
 * on a small lucky sample. Demoting requires the *upper* bound to fall below
 * it, so a field is not thrown away on a small unlucky one. Everything between
 * those is `needs-review`, which is a request for more reviews rather than a
 * decision — and an under-reviewed field never silently ships.
 */
export function fieldVerdict(accuracy: FieldAccuracy, thresholds: VerdictThresholds = DEFAULT_THRESHOLDS): FieldVerdict {
  if (accuracy.reviewed < thresholds.minimumSample) return 'needs-review';
  if (accuracy.upper < thresholds.minimumAccuracy) return 'demote';
  if (accuracy.lower < thresholds.minimumAccuracy) return 'needs-review';
  // Accurate but badly calibrated is still not safe to auto-accept: the
  // confidence score is what routes buildings past review in the first place.
  if (accuracy.expectedCalibrationError > thresholds.maximumCalibrationError) return 'needs-review';
  return 'accept';
}

/**
 * The two numbers that decide whether expansion is working, in one type so
 * that neither can be published without the other.
 *
 * > A high automation ratio over low observation coverage is not progress; it
 * > is a small measured city with a large invented one behind it.
 *
 * That is the reporting failure this type exists to make impossible: a
 * dashboard showing 97% automation over a neighbourhood where one building in
 * three has ever been looked at.
 */
export interface ExpansionMetrics {
  neighbourhood: string;
  /** Buildings in the neighbourhood, from BAG. */
  buildings: number;
  /** Buildings with a usable view of the elevation in question. */
  observed: number;
  /** Observed buildings whose measurement was auto-accepted without review. */
  autoAccepted: number;
}

export interface ExpansionReport extends ExpansionMetrics {
  /** observed / buildings. The ceiling on everything else. */
  observationCoverage: number;
  /** autoAccepted / observed — of what was *seen*, never of what exists. */
  automationRatio: number;
  /** autoAccepted / buildings: the share of the neighbourhood actually shipped detailed. */
  measuredShare: number;
}

export function expansionReport(metrics: ExpansionMetrics): ExpansionReport {
  const { buildings, observed, autoAccepted } = metrics;
  return {
    ...metrics,
    observationCoverage: buildings === 0 ? 0 : observed / buildings,
    // Denominated in observations, not buildings. Dividing by `buildings` would
    // make an unobserved neighbourhood look automated rather than unseen.
    automationRatio: observed === 0 ? 0 : autoAccepted / observed,
    measuredShare: buildings === 0 ? 0 : autoAccepted / buildings,
  };
}

/** A reason to stop a tier and reassess, in the doc's terms. */
export interface StopSignal {
  rule: 'automation-ratio' | 'sampled-accuracy' | 'frame-rate' | 'cache-budget' | 'tier-regression';
  detail: string;
}

export interface TierHealth {
  /** The tier's automation-ratio target: 0.95 in Tiers 2 and 4, 0.85 in Tier 1, 0.75 in Tier 3. */
  automationTarget: number;
  report: ExpansionReport;
  accuracy: readonly FieldAccuracy[];
  /** Sustained frame rate in the busiest view, at 1920×1080. */
  sustainedFps: number;
  /** Offline cache for this neighbourhood, and its budget, in bytes. */
  cacheBytes: number;
  cacheBudgetBytes: number;
  /** Named regression locations in already-accepted tiers that this change broke. */
  regressedLocations: readonly string[];
}

/**
 * The doc's stop rules, evaluated together.
 *
 * > Stop a tier and reassess when any of these fire.
 *
 * The gable and roof-form accuracy floor is checked against the fields named in
 * {@link STRUCTURAL_FIELDS} because those are the ones a rider navigates by; a
 * brick colour two shades off is a blemish, a wrong gable is a wrong building.
 */
export const STRUCTURAL_FIELDS: readonly string[] = ['gable', 'gableOrnament', 'storeys', 'bays'];

/** The doc's floor for sampled gable and roof-form accuracy. */
export const STRUCTURAL_ACCURACY_FLOOR = 0.85;
/** The doc's sustained frame-rate floor, at 1920×1080 with the driving runtime live. */
export const MINIMUM_SUSTAINED_FPS = 45;
/** How far below target the automation ratio may sit before the tier stops. */
export const AUTOMATION_RATIO_TOLERANCE = 0.15;

export function evaluateStopRules(health: TierHealth): StopSignal[] {
  const signals: StopSignal[] = [];
  const { report, automationTarget } = health;

  if (report.automationRatio < automationTarget - AUTOMATION_RATIO_TOLERANCE) {
    signals.push({
      rule: 'automation-ratio',
      detail: `${(report.automationRatio * 100).toFixed(0)}% against a ${(automationTarget * 100).toFixed(0)}% target — fix the pipeline for this fabric, not the confidence bar`,
    });
  }

  for (const accuracy of health.accuracy) {
    if (!STRUCTURAL_FIELDS.includes(accuracy.field)) continue;
    if (accuracy.reviewed === 0) continue;
    if (accuracy.lower < STRUCTURAL_ACCURACY_FLOOR) {
      signals.push({
        rule: 'sampled-accuracy',
        detail: `${accuracy.field} at ${(accuracy.rate * 100).toFixed(0)}% (95% lower bound ${(accuracy.lower * 100).toFixed(0)}%) over ${accuracy.reviewed} reviews`,
      });
    }
  }

  if (health.sustainedFps < MINIMUM_SUSTAINED_FPS) {
    signals.push({ rule: 'frame-rate', detail: `${health.sustainedFps.toFixed(0)} FPS in the busiest view, below the ${MINIMUM_SUSTAINED_FPS} FPS floor` });
  }

  if (health.cacheBytes > health.cacheBudgetBytes) {
    const over = (health.cacheBytes / health.cacheBudgetBytes - 1) * 100;
    signals.push({ rule: 'cache-budget', detail: `${report.neighbourhood} offline cache is ${over.toFixed(0)}% over budget` });
  }

  if (health.regressedLocations.length > 0) {
    signals.push({
      rule: 'tier-regression',
      detail: `${health.regressedLocations.length} accepted location(s) regressed: ${health.regressedLocations.slice(0, 5).join(', ')}`,
    });
  }

  return signals;
}
