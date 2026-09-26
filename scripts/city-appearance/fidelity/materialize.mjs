import { analysisKey, EXTRACTION_VERSION, validateProposal } from './extraction-contract.mjs';

const clone = value => structuredClone(value);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const imageDate = image => image?.date ?? image?.capturedAt;
const protectedFeature = feature => feature?.disposition === 'human-reviewed' || feature?.disposition === 'revoked';

function mergeFeatures(existing = [], proposed) {
  const protectedById = new Map(existing.filter(protectedFeature).map(feature => [feature.id, feature]));
  const generated = proposed
    .filter(feature => !protectedById.has(feature.id))
    .map(feature => ({ ...feature, disposition: 'machine-observed-unreviewed' }));
  return [...protectedById.values(), ...generated].sort((a, b) => a.id.localeCompare(b.id));
}

/** Attach cached image analysis to exact observation/date/geometry bindings.
 * The input records are cloned. A changed date/hash, revocation or human-owned
 * description becomes an omission rather than an overwrite.
 */
export function materializeFacadeDescriptions({ manifest, analyses, records }) {
  const output = clone(records);
  const report = { version: 1, attached: [], omitted: [] };
  const byKey = new Map(analyses.filter(value => value.status === 'complete').map(value => [value.key, value]));
  for (const item of manifest.cases) {
    const observationId = item.observationId ?? item.id;
    const record = output.find(value => value.id === observationId || value.observationId === observationId);
    if (!record) { report.omitted.push({ observationId, reason: 'observation-not-found' }); continue; }
    if (record.machineRevocation?.revoked) { report.omitted.push({ observationId, reason: 'observation-revoked' }); continue; }
    if (record.buildingId !== item.buildingId || record.geometryRevision !== item.geometryRevision || record.evidenceKey !== item.evidenceKey || !equal([record.localStart, record.localEnd], item.frontage)) {
      report.omitted.push({ observationId, reason: 'stale-observation-binding' }); continue;
    }
    if (record.facadeDescription && (record.facadeDescription.buildingId !== item.buildingId || record.facadeDescription.geometryRevision !== item.geometryRevision || record.facadeDescription.evidenceKey !== item.evidenceKey || !equal(record.facadeDescription.frontage, item.frontage))) {
      report.omitted.push({ observationId, reason: 'existing-description-has-different-binding' }); continue;
    }
    const description = clone(record.facadeDescription ?? { version: 1, extractionVersion: EXTRACTION_VERSION, buildingId: item.buildingId, geometryRevision: item.geometryRevision, evidenceKey: item.evidenceKey, frontage: item.frontage, surfaceIndices: item.surfaceIndices, sources: {} });
    description.extractionVersion = EXTRACTION_VERSION;
    let changed = false;
    for (const tier of ['full', 'ground']) {
      const source = item.sources?.[tier];
      if (!source) continue;
      if (source.registration?.status !== 'registered') {
        report.omitted.push({ observationId, tier, reason: `registration-${source.registration?.status ?? 'missing'}` });
        continue;
      }
      const currentImage = record.images?.[tier];
      if (currentImage?.sha256 !== source.cropSha256 || imageDate(currentImage) !== source.captureDate || (Number.isFinite(currentImage.width) && currentImage.width !== source.width) || (Number.isFinite(currentImage.height) && currentImage.height !== source.height)) {
        report.omitted.push({ observationId, tier, reason: 'source-date-hash-or-dimensions-mismatch' }); continue;
      }
      const existing = description.sources?.[tier];
      if (existing && (existing.cropSha256 !== source.cropSha256 || existing.captureDate !== source.captureDate)) {
        report.omitted.push({ observationId, tier, reason: 'existing-source-is-another-capture' }); continue;
      }
      const analysis = byKey.get(analysisKey(source));
      if (!analysis) { report.omitted.push({ observationId, tier, reason: 'cached-analysis-missing' }); continue; }
      const proposal = validateProposal(analysis.proposal, source);
      const features = proposal.features.map(feature => ({ ...feature, id: `${tier}:${feature.id}` }));
      description.sources[tier] = {
        cropSha256: source.cropSha256,
        captureDate: source.captureDate,
        imageDimensions: { width: source.width, height: source.height },
        registration: clone(source.registration),
        openingsComplete: proposal.openingsComplete,
        features: mergeFeatures(existing?.features, features),
      };
      changed = true;
      report.attached.push({ observationId, tier, analysisKey: analysis.key, featureCount: features.length });
    }
    if (changed) record.facadeDescription = description;
  }
  report.attached.sort((a, b) => `${a.observationId}:${a.tier}`.localeCompare(`${b.observationId}:${b.tier}`));
  report.omitted.sort((a, b) => `${a.observationId}:${a.tier ?? ''}:${a.reason}`.localeCompare(`${b.observationId}:${b.tier ?? ''}:${b.reason}`));
  return { records: output, report };
}
