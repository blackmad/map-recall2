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
type LoadedJson = { file: string; bytes: Buffer; value: any; sha256: string };
export interface SourceEvaluationReport { schemaVersion: number; evaluator: Record<string, unknown>; provenance: Record<string, unknown>; inputs: Record<string, unknown>; registration: Record<string, unknown>; stage: Record<string, unknown>; coverage: Record<string, any>; aggregateDiagnostics: Record<string, any>; summary: Record<string, number>; cases: any[]; repairQueue: any[]; reproducibility: { canonicalReportSha256: string } }

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  return JSON.stringify(value);
};
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const readJson = async (file: string): Promise<LoadedJson> => {
  const bytes = await fs.readFile(file);
  return { file, bytes, value: JSON.parse(bytes.toString('utf8')), sha256: sha256(bytes) };
};
const input = (loaded: LoadedJson, root: string) => ({ path: path.relative(root, loaded.file) || '.', sha256: loaded.sha256 });

const hashPattern = /^[0-9a-f]{64}$/;
const validBounds = (value: unknown, width: number, height: number): value is Bounds => Array.isArray(value) && value.length === 4 &&
  value.every(Number.isFinite) && value[0] >= 0 && value[1] >= 0 && value[2] <= width && value[3] <= height && value[2] > value[0] && value[3] > value[1];

export function boxIou(a: Bounds, b: Bounds): number {
  const intersection = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const area = (v: Bounds) => Math.max(0, v[2] - v[0]) * Math.max(0, v[3] - v[1]);
  const union = area(a) + area(b) - intersection;
  return union ? intersection / union : 0;
}

export function assignBoxes(references: Opening[], predictions: Opening[], threshold: number) {
  type Pair = { referenceIndex: number; predictionIndex: number; iou: number };
  // Deterministic Hopcroft-Karp: maximize match count. Within each augmenting
  // search, prefer higher IoU, then the lower prediction index; this tie rule
  // is stable but does not claim a globally maximum IoU sum.
  const edges = references.map(reference => predictions.map((prediction, predictionIndex) => ({ predictionIndex, iou: boxIou(reference.bounds, prediction.bounds) }))
    .filter(edge => edge.iou >= threshold).sort((a, b) => b.iou - a.iou || a.predictionIndex - b.predictionIndex));
  const left = Array(references.length).fill(-1), right = Array(predictions.length).fill(-1), distance = Array(references.length).fill(0);
  const bfs = () => {
    const queue: number[] = [];
    left.forEach((match, index) => { distance[index] = match < 0 ? 0 : -1; if (match < 0) queue.push(index); });
    let found = false;
    for (let cursor = 0; cursor < queue.length; cursor++) for (const edge of edges[queue[cursor]]) {
      const paired = right[edge.predictionIndex];
      if (paired < 0) found = true;
      else if (distance[paired] < 0) { distance[paired] = distance[queue[cursor]] + 1; queue.push(paired); }
    }
    return found;
  };
  const dfs = (referenceIndex: number): boolean => {
    for (const edge of edges[referenceIndex]) {
      const paired = right[edge.predictionIndex];
      if (paired < 0 || (distance[paired] === distance[referenceIndex] + 1 && dfs(paired))) {
        left[referenceIndex] = edge.predictionIndex; right[edge.predictionIndex] = referenceIndex; return true;
      }
    }
    distance[referenceIndex] = -1; return false;
  };
  while (bfs()) left.forEach((match, index) => { if (match < 0) dfs(index); });
  return left.flatMap<Pair>((predictionIndex, referenceIndex) => predictionIndex < 0 ? [] : [{ referenceIndex, predictionIndex, iou: boxIou(references[referenceIndex].bounds, predictions[predictionIndex].bounds) }]);
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

function validateReferenceFile(file: any) {
  if (file?.version !== 1 || file?.disposition !== 'independent-source-annotations' || file?.status !== 'partial-ground-tier-reference; not-full-facade-certification' ||
      file?.coordinateConvention !== 'source-image pixels, pixel edges; opening bounds include the assembly perimeter' || !Array.isArray(file?.entries)) {
    throw new Error('Reference file lacks the expected independent development-reference provenance contract');
  }
  const identities = new Set<string>(), caseIds = new Set<string>(), observationIds = new Set<string>();
  return file.entries.map((entry: any, index: number) => {
    const reasons: string[] = [];
    for (const field of ['caseId', 'observationId', 'buildingId']) if (typeof entry?.[field] !== 'string' || !entry[field]) reasons.push(`invalid ${field}`);
    if (entry?.tier !== 'ground') reasons.push('source role must be ground');
    if (!hashPattern.test(entry?.cropSha256 ?? '')) reasons.push('invalid cropSha256');
    const width = entry?.imageDimensions?.width, height = entry?.imageDimensions?.height;
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) reasons.push('invalid imageDimensions');
    if (entry?.disposition !== 'agent-inspected' || typeof entry?.inspectionMethod !== 'string') reasons.push('missing agent-inspected provenance');
    if (!Array.isArray(entry?.openings)) reasons.push('openings must be an array');
    const ids = new Set<string>();
    for (const opening of entry?.openings ?? []) {
      if (typeof opening?.id !== 'string' || !opening.id || ids.has(opening.id)) reasons.push('invalid or duplicate opening id'); else ids.add(opening.id);
      if (!['window', 'door', 'storefront'].includes(opening?.kind)) reasons.push(`invalid opening kind for ${opening?.id ?? '?'}`);
      if (!validBounds(opening?.bounds, width, height)) reasons.push(`invalid bounds for ${opening?.id ?? '?'}`);
      if (!['complete-assembly-outline', 'visible-extent-only-not-complete-box'].includes(opening?.boundsMeaning)) reasons.push(`invalid boundsMeaning for ${opening?.id ?? '?'}`);
    }
    const identity = `${entry?.caseId}\0${entry?.observationId}\0${entry?.cropSha256}`;
    if (identities.has(identity)) reasons.push('duplicate reference identity'); else identities.add(identity);
    if (caseIds.has(entry?.caseId)) reasons.push('duplicate caseId'); else caseIds.add(entry?.caseId);
    if (observationIds.has(entry?.observationId)) reasons.push('duplicate observationId'); else observationIds.add(entry?.observationId);
    return reasons.length ? { index, caseId: entry?.caseId ?? null, reasons } : null;
  }).filter(Boolean);
}

export async function buildSourceEvaluation(options: SourceEvaluationOptions): Promise<SourceEvaluationReport> {
  if (!options.root || !path.isAbsolute(options.root)) throw new Error('root must be an explicit absolute path');
  const root = path.resolve(options.root);
  const referencePath = path.resolve(root, options.referencePath ?? 'scripts/city-appearance/fidelity/independent-reference-measurements.json');
  const analysisPath = path.resolve(root, options.analysisPath ?? '.cache/city-appearance/fidelity-extraction/analysis-results.json');
  const manifestPaths = (options.manifestPaths ?? ['scripts/city-appearance/fidelity/active-development-manifest.json']).map(file => path.resolve(root, file));
  const threshold = options.iouThreshold ?? 0.5;
  if (!(threshold > 0 && threshold <= 1)) throw new Error('iouThreshold must be in (0, 1]');
  const referenceLoaded = await readJson(referencePath), analysisLoaded = await readJson(analysisPath);
  const manifestLoaded = await Promise.all(manifestPaths.map(readJson));
  const referencesFile = referenceLoaded.value, analysesFile = analysisLoaded.value;
  const manifests = manifestLoaded.map(loaded => ({ file: loaded.file, value: loaded.value }));
  const invalidReferenceEntries = validateReferenceFile(referencesFile);
  const invalidIndexes = new Set(invalidReferenceEntries.map((value: any) => value.index));
  const references: ReferenceEntry[] = referencesFile.entries.filter((_: any, index: number) => !invalidIndexes.has(index));
  if (!Array.isArray(analysesFile?.results)) throw new Error('Analysis file results must be an array');
  const keyCounts = new Map<string, number>();
  for (const value of analysesFile.results) if (typeof value?.key === 'string') keyCounts.set(value.key, (keyCounts.get(value.key) ?? 0) + 1);
  const invalidAnalysisEntries = analysesFile.results.flatMap((value: any, index: number) => {
    const reasons: string[] = [];
    if (typeof value?.key !== 'string' || !value.key) reasons.push('invalid key'); else if (keyCounts.get(value.key) !== 1) reasons.push('duplicate key');
    if (!hashPattern.test(value?.source?.cropSha256 ?? '')) reasons.push('invalid source cropSha256');
    if (!Number.isInteger(value?.source?.width) || value.source.width <= 0 || !Number.isInteger(value?.source?.height) || value.source.height <= 0) reasons.push('invalid source dimensions');
    return reasons.length ? [{ index, key: value?.key ?? null, reasons }] : [];
  });
  const analyses: Analysis[] = analysesFile.results.filter((value: any) => typeof value?.key === 'string' && keyCounts.get(value.key) === 1 && hashPattern.test(value?.source?.cropSha256 ?? '') && Number.isInteger(value?.source?.width) && value.source.width > 0 && Number.isInteger(value?.source?.height) && value.source.height > 0);
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
    const candidatePredictions = selected?.proposal?.features ?? [];
    const rejectedPredictions = candidatePredictions.flatMap((value, index) => {
      const reasons: string[] = [];
      if (typeof value?.id !== 'string' || !value.id) reasons.push('invalid id');
      if (!['window', 'door', 'storefront'].includes(value?.kind)) reasons.push('unsupported kind');
      if (!validBounds(value?.bounds, reference.imageDimensions.width, reference.imageDimensions.height)) reasons.push('invalid bounds');
      if (candidatePredictions.some((other, otherIndex) => otherIndex !== index && other?.id === value?.id)) reasons.push('duplicate id');
      return reasons.length ? [{ index, id: value?.id ?? null, reasons }] : [];
    });
    const rejectedIndexes = new Set(rejectedPredictions.map(value => value.index));
    const predictions = candidatePredictions.filter((_, index) => !rejectedIndexes.has(index));
    const assignments = selection === 'matched' ? assignBoxes(completeRefs, predictions, threshold) : [];
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
      binding, analysis: { outcome: selection, candidateCount: completed.length, selectedKey: selected?.key ?? null, openingsComplete: selected?.proposal?.openingsComplete ?? null, rejectedPredictions },
      denominators: { completeVisibleReferences: completeRefs.length, partialVisibleExtentsIgnored: partialRefs.length, openingPredictions: predictions.length, rejectedPredictions: rejectedPredictions.length },
      matches,
      misses: selection === 'matched' ? completeRefs.filter((_, index) => !matchedRef.has(index)).map(value => value.id) : [],
      unscoredReferences: selection === 'matched' ? [] : completeRefs.map(value => value.id),
      unmatchedPredictions: predictions.filter((_, index) => !matchedPred.has(index)).map(value => value.id),
      partialReferences: partialRefs.map(value => ({ id: value.id, handling: 'ignored-visible-extent-not-complete-box' as const })),
      diagnostics: {
        localizationRecall: selection === 'matched' && completeRefs.length ? Number((matched / completeRefs.length).toFixed(6)) : null,
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
    if (value.analysis.outcome === 'matched' && value.matches.some(match => match.head === 'incorrect')) rows.push({ caseId: value.caseId, category: 'detection-layout', reason: `${value.matches.filter(match => match.head === 'incorrect').length} localized head-shape errors` });
    if (value.denominators.partialVisibleExtentsIgnored || value.denominators.completeVisibleReferences === 0) rows.push({ caseId: value.caseId, category: 'annotation-needed', reason: `${value.denominators.partialVisibleExtentsIgnored} partial extents ignored; complete image annotation not established` });
    return rows;
  }).slice(0, 50);
  const completeTotal = cases.filter(value => value.analysis.outcome === 'matched').reduce((n, value) => n + value.denominators.completeVisibleReferences, 0);
  const matchedTotal = cases.reduce((n, value) => n + value.matches.length, 0);
  const report = {
    schemaVersion: 1, evaluator: { name: 'source-space-opening-diagnostic', iouThreshold: threshold, thresholdPurpose: 'localization-only diagnostic; not equivalent to a fidelity acceptance gate', matching: 'deterministic maximum-cardinality Hopcroft-Karp; adjacency prefers higher IoU then source order' },
    provenance: { disposition: 'development-agent-inspected-partial-reference', humanReviewed: false, heldout: false, certifiedTruth: false, sourceStatement: referencesFile.scope ?? null },
    inputs: { root, files: [input(referenceLoaded, root), input(analysisLoaded, root), ...manifestLoaded.map(loaded => input(loaded, root))], readConsistency: 'hashes cover the exact bytes parsed for this report' },
    registration: { requiredForThisEvaluation: false, status: 'not-evaluated', metricAccuracyClaimed: false },
    stage: { mode: 'report-only', writesRepairs: false, acceptsCandidates: false },
    coverage: { referenceEntries: referencesFile.entries.length, validReferenceCases: cases.length, invalidReferenceEntries, invalidAnalysisEntries, matchedAnalysisCases: cases.filter(value => value.analysis.outcome === 'matched').length, ambiguousAnalysisCases: cases.filter(value => value.analysis.outcome === 'ambiguous').length, unscorableCases: cases.filter(value => value.analysis.outcome !== 'matched').length + invalidReferenceEntries.length, completeVisibleReferencesOnVerifiedSources: completeTotal, partialVisibleExtentsIgnored: cases.reduce((n, value) => n + value.denominators.partialVisibleExtentsIgnored, 0) },
    aggregateDiagnostics: { extractionLocalizationRecallOnVerifiedSources: completeTotal ? Number((matchedTotal / completeTotal).toFixed(6)) : null, endToEndRecall: null, endToEndOmissionReason: 'Invalid or unverified sources are unscorable, not extraction misses.', precision: null, precisionOmissionReason: 'Complete annotation of all openings and image regions is not proven.' },
    summary: { scoredCases: cases.filter(value => value.status === 'diagnostic-scored').length, annotationNeededCases: cases.filter(value => value.status === 'annotation-needed').length, abstainedCases: cases.filter(value => value.status === 'abstained').length, completeReferenceMatches: matchedTotal, completeReferenceMisses: completeTotal - matchedTotal },
    cases, repairQueue,
  } satisfies Omit<SourceEvaluationReport, 'reproducibility'>;
  return { ...report, reproducibility: { canonicalReportSha256: sha256(stable(report)) } };
}
