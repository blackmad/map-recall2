import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type Bounds = [number, number, number, number];
export type SourceEvaluationOptions = {
  root: string;
  referencePath?: string;
  analysisPath?: string;
  manifestPaths?: string[];
  iouThreshold?: number;
};

type Opening = { id: string; kind: string; head?: string; bounds: Bounds; visible?: boolean; boundsMeaning?: string };
type ReferenceEntry = {
  caseId: string; observationId: string; buildingId: string; cropSha256: string;
  captureDate?: string; imageDimensions: { width: number; height: number }; openings: Opening[];
  disposition?: string; registrationStatus?: string; fullTierAnnotationStatus?: string;
  architecturalAssertions?: Record<string, unknown>;
};
type Analysis = { key: string; status: string; source?: { cropSha256?: string; width?: number; height?: number }; proposal?: { openingsComplete?: boolean; features?: Opening[] } };

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  return JSON.stringify(value);
};
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const readJson = async (file: string) => JSON.parse(await fs.readFile(file, 'utf8'));
const input = async (file: string, root: string) => ({ path: path.relative(root, file) || '.', sha256: sha256(await fs.readFile(file)) });

export function boxIou(a: Bounds, b: Bounds): number {
  const intersection = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const area = (v: Bounds) => Math.max(0, v[2] - v[0]) * Math.max(0, v[3] - v[1]);
  const union = area(a) + area(b) - intersection;
  return union ? intersection / union : 0;
}

export function assignBoxes(references: Opening[], predictions: Opening[], threshold: number) {
  type Pair = { referenceIndex: number; predictionIndex: number; iou: number };
  let best: Pair[] = [];
  const walk = (referenceIndex: number, used: Set<number>, pairs: Pair[]) => {
    if (referenceIndex === references.length) {
      const sum = (items: Pair[]) => items.reduce((n, item) => n + item.iou, 0);
      if (pairs.length > best.length || (pairs.length === best.length && sum(pairs) > sum(best))) best = [...pairs];
      return;
    }
    walk(referenceIndex + 1, used, pairs);
    predictions.forEach((prediction, predictionIndex) => {
      if (used.has(predictionIndex)) return;
      const iou = boxIou(references[referenceIndex].bounds, prediction.bounds);
      if (iou < threshold) return;
      used.add(predictionIndex); pairs.push({ referenceIndex, predictionIndex, iou });
      walk(referenceIndex + 1, used, pairs);
      pairs.pop(); used.delete(predictionIndex);
    });
  };
  walk(0, new Set(), []);
  return best.sort((a, b) => a.referenceIndex - b.referenceIndex);
}

async function manifestBinding(entry: ReferenceEntry, manifests: { value: any; file: string }[]) {
  const candidates = manifests.flatMap(manifest => (manifest.value.cases ?? []).filter((item: any) =>
    item.observationId === entry.observationId && item.buildingId === entry.buildingId &&
    item.sources?.ground?.cropSha256 === entry.cropSha256).map((item: any) => ({ item, manifestFile: manifest.file })));
  const exact = candidates.filter(({ item }: any) => item.sources.ground.width === entry.imageDimensions.width && item.sources.ground.height === entry.imageDimensions.height &&
    (!entry.captureDate || item.sources.ground.captureDate === entry.captureDate));
  if (exact.length === 1) {
    const source = exact[0].item.sources.ground;
    const imagePath = path.resolve(path.dirname(exact[0].manifestFile), source.path);
    try {
      const actualSha256 = sha256(await fs.readFile(imagePath));
      return { status: actualSha256 === entry.cropSha256 ? 'verified' as const : 'bad-source' as const, candidates: 1, image: { path: path.relative(path.dirname(exact[0].manifestFile), imagePath), available: true, actualSha256 } };
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
      return { status: 'missing-image' as const, candidates: 1, image: { path: source.path, available: false, actualSha256: null } };
    }
  }
  if (exact.length > 1) return { status: 'ambiguous' as const, candidates: exact.length };
  return { status: manifests.length ? 'mismatch' as const : 'not-checked' as const, candidates: candidates.length };
}

export async function buildSourceEvaluation(options: SourceEvaluationOptions) {
  if (!options.root || !path.isAbsolute(options.root)) throw new Error('root must be an explicit absolute path');
  const root = path.resolve(options.root);
  const referencePath = path.resolve(root, options.referencePath ?? 'scripts/city-appearance/fidelity/independent-reference-measurements.json');
  const analysisPath = path.resolve(root, options.analysisPath ?? '.cache/city-appearance/fidelity-extraction/analysis-results.json');
  const manifestPaths = (options.manifestPaths ?? ['scripts/city-appearance/fidelity/active-development-manifest.json']).map(file => path.resolve(root, file));
  const threshold = options.iouThreshold ?? 0.5;
  if (!(threshold > 0 && threshold <= 1)) throw new Error('iouThreshold must be in (0, 1]');
  const referencesFile = await readJson(referencePath);
  const analysesFile = await readJson(analysisPath);
  const manifests = await Promise.all(manifestPaths.map(async file => ({ file, value: await readJson(file) })));
  const references: ReferenceEntry[] = referencesFile.entries ?? [];
  const analyses: Analysis[] = analysesFile.results ?? [];
  const cases = await Promise.all(references.map(async reference => {
    const candidates = analyses.filter(value => value.source?.cropSha256 === reference.cropSha256 && value.source.width === reference.imageDimensions.width && value.source.height === reference.imageDimensions.height);
    const completed = candidates.filter(value => value.status === 'complete' && value.proposal);
    const binding = await manifestBinding(reference, manifests);
    const completeRefs = reference.openings.filter(value => value.visible === true && value.boundsMeaning === 'complete-assembly-outline');
    const partialRefs = reference.openings.filter(value => value.boundsMeaning !== 'complete-assembly-outline' || value.visible !== true);
    let selection: 'matched' | 'missing' | 'ambiguous' | 'identity-mismatch' = 'missing';
    if (completed.length > 1) selection = 'ambiguous';
    else if (completed.length === 1 && binding.status === 'verified') selection = 'matched';
    else if (completed.length === 1) selection = 'identity-mismatch';
    const selected = selection === 'matched' ? completed[0] : undefined;
    const predictions = (selected?.proposal?.features ?? []).filter(value => ['window', 'door', 'storefront'].includes(value.kind) && Array.isArray(value.bounds));
    const assignments = assignBoxes(completeRefs, predictions, threshold);
    const matchedRef = new Set(assignments.map(value => value.referenceIndex));
    const matchedPred = new Set(assignments.map(value => value.predictionIndex));
    const matches = assignments.map(pair => ({
      referenceId: completeRefs[pair.referenceIndex].id, predictionId: predictions[pair.predictionIndex].id,
      iou: Number(pair.iou.toFixed(6)), localization: 'matched' as const,
      type: completeRefs[pair.referenceIndex].kind === predictions[pair.predictionIndex].kind ? 'correct' as const : 'incorrect' as const,
      head: !completeRefs[pair.referenceIndex].head || completeRefs[pair.referenceIndex].head === 'unknown' ? 'unscored' as const :
        completeRefs[pair.referenceIndex].head === predictions[pair.predictionIndex].head ? 'correct' as const : 'incorrect' as const,
    }));
    const matched = matches.length;
    return {
      caseId: reference.caseId, observationId: reference.observationId, buildingId: reference.buildingId, tier: 'ground' as const,
      cropSha256: reference.cropSha256, dimensions: reference.imageDimensions, captureDate: reference.captureDate ?? null,
      source: { cropSha256: reference.cropSha256, ...reference.imageDimensions, captureDate: reference.captureDate },
      binding, analysis: { outcome: selection, candidateCount: completed.length, selectedKey: selected?.key ?? null, openingsComplete: selected?.proposal?.openingsComplete ?? null },
      denominators: { completeVisibleReferences: completeRefs.length, partialVisibleExtentsIgnored: partialRefs.length, openingPredictions: predictions.length },
      matches,
      misses: completeRefs.filter((_, index) => !matchedRef.has(index)).map(value => value.id),
      unmatchedPredictions: predictions.filter((_, index) => !matchedPred.has(index)).map(value => value.id),
      partialReferences: partialRefs.map(value => ({ id: value.id, handling: 'ignored-visible-extent-not-complete-box' as const })),
      diagnostics: {
        localizationRecall: completeRefs.length ? Number((matched / completeRefs.length).toFixed(6)) : null,
        meanMatchedIou: matched ? Number((matches.reduce((n, value) => n + value.iou, 0) / matched).toFixed(6)) : null,
        typeAccuracyOnLocalized: matched ? Number((matches.filter(value => value.type === 'correct').length / matched).toFixed(6)) : null,
        headAccuracyOnScoredLocalized: matches.some(value => value.head !== 'unscored') ? Number((matches.filter(value => value.head === 'correct').length / matches.filter(value => value.head !== 'unscored').length).toFixed(6)) : null,
        precision: null,
      },
      architecture: {
        headResults: matches.map(value => ({ referenceId: value.referenceId, predictionId: value.predictionId, outcome: value.head })),
        assertions: { count: Object.keys(reference.architecturalAssertions ?? {}).length, status: 'unscored-no-typed-prediction-mapping' as const },
      },
      claimLimits: ['Reference is partial development evidence.', 'Unmatched predictions are diagnostic only because the image is not proven exhaustively annotated.'],
      status: selection === 'matched' ? (completeRefs.length ? 'diagnostic-scored' as const : 'annotation-needed' as const) : 'abstained' as const,
    };
  }));
  const repairQueue = cases.flatMap(value => {
    const rows: any[] = [];
    if (['mismatch', 'bad-source', 'missing-image'].includes(value.binding.status)) rows.push({ caseId: value.caseId, category: 'bad-source', reason: `source binding status: ${value.binding.status}` });
    if (value.binding.status === 'ambiguous' || value.analysis.outcome !== 'matched') rows.push({ caseId: value.caseId, category: 'missing-or-ambiguous-analysis', reason: value.analysis.outcome });
    if (value.analysis.outcome === 'matched' && (value.misses.length || value.matches.some(match => match.type === 'incorrect'))) rows.push({ caseId: value.caseId, category: 'detection-layout', reason: `${value.misses.length} complete reference misses; ${value.matches.filter(match => match.type === 'incorrect').length} localized type errors` });
    if (value.denominators.partialVisibleExtentsIgnored || value.denominators.completeVisibleReferences === 0) rows.push({ caseId: value.caseId, category: 'annotation-needed', reason: `${value.denominators.partialVisibleExtentsIgnored} partial extents ignored; complete image annotation not established` });
    return rows;
  }).slice(0, 50);
  const completeTotal = cases.reduce((n, value) => n + value.denominators.completeVisibleReferences, 0);
  const matchedTotal = cases.reduce((n, value) => n + value.matches.length, 0);
  const report: any = {
    schemaVersion: 1, evaluator: { name: 'source-space-opening-diagnostic', iouThreshold: threshold, reportOnly: true },
    provenance: { disposition: 'development-agent-inspected-partial-reference', humanReviewed: false, heldout: false, certifiedTruth: false, sourceStatement: referencesFile.scope ?? null },
    inputs: { root, files: await Promise.all([input(referencePath, root), input(analysisPath, root), ...manifestPaths.map(file => input(file, root))]) },
    registration: { requiredForThisEvaluation: false, status: 'not-evaluated', metricAccuracyClaimed: false },
    stage: { mode: 'report-only', writesRepairs: false, acceptsCandidates: false },
    coverage: { referenceCases: cases.length, matchedAnalysisCases: cases.filter(value => value.analysis.outcome === 'matched').length, ambiguousAnalysisCases: cases.filter(value => value.analysis.outcome === 'ambiguous').length, omittedAnalysisCases: cases.filter(value => value.analysis.outcome !== 'matched').length, completeVisibleReferences: completeTotal, partialVisibleExtentsIgnored: cases.reduce((n, value) => n + value.denominators.partialVisibleExtentsIgnored, 0) },
    aggregateDiagnostics: { localizationRecallOnCompleteVisibleReferences: completeTotal ? Number((matchedTotal / completeTotal).toFixed(6)) : null, precision: null, precisionOmissionReason: 'Complete annotation of all openings and image regions is not proven.' },
    summary: { scoredCases: cases.filter(value => value.status === 'diagnostic-scored').length, annotationNeededCases: cases.filter(value => value.status === 'annotation-needed').length, abstainedCases: cases.filter(value => value.status === 'abstained').length, completeReferenceMatches: matchedTotal, completeReferenceMisses: completeTotal - matchedTotal },
    cases, repairQueue,
  };
  report.reproducibility = { canonicalReportSha256: sha256(stable(report)) };
  return report;
}
