import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const EXTRACTION_VERSION = 'facade-description-v3-glazed-doors';
export const MODEL = 'google/gemini-3.1-flash-lite';
export const MAX_TOKENS = 4000;
export const RESERVED_USD = 0.015;
export const PHASE_LIMITS = Object.freeze({ development: 1, 'held-out': 0.5, unseen: 0.5, expansion: 1.5, 'neighbourhood-1000-preview': 10 });
export const FEATURE_KINDS = Object.freeze(['door', 'window', 'material', 'awning', 'fascia']);
export const HEADS = Object.freeze(['rectangular', 'segmental', 'rounded', 'unknown']);
export const MATERIALS = Object.freeze(['brick', 'stone', 'plaster', 'paint', 'unknown']);
export const REGIONS = Object.freeze(['upper-wall', 'ground-floor', 'plinth', 'surround', 'band', 'accent']);
export const INSTALLATIONS = Object.freeze(['folding', 'roller', 'fixed', 'unknown']);
export const AWNING_STATES = Object.freeze(['extended', 'retracted', 'absent', 'unknown']);

export const prompt = 'Inspect this single dated facade crop. Return only visible architectural features. Classify windows and door assemblies separately. Preserve paired entrances, transoms, asymmetrical rows and bays. An upper-floor door aligned with windows or opening onto a balcony may be a glazed balcony/French door: inspect its glass-to-panel proportion and frame rhythm instead of applying an entrance-door default. Set doorStyle=glazed and doorGlazingRatio only when the source visibly supports them; keep kind=door. Do not convert all upper doors to glass, and omit these fields when glazing is hidden or uncertain. doorGlazingRatio is the visible fraction of the door body occupied by glass, from 0.35 to 0.95. Distinguish curved glazing heads from curved masonry lintels. For segmental or rounded glazing, archRise is the curved rise divided by total opening height (0 to 0.5). For a curved masonry lintel, lintelRise is its rise divided by total opening height; rectangular glazing under a curved lintel remains head rectangular with no archRise. For a rectangular opening with only small rounded top corners, keep head rectangular and set topCornerRadius to the radius divided by the smaller of opening width and height. Do not classify decorative shell pediments or curved ornaments as curved glazing. Identify upper-wall, ground-floor, plinth, surround, band and accent regions and observed hex colours. Include separate display windows, entrance doors and fascia with only literal legible tenant sign text. Awnings: extended fabric, retracted housing/roll, absent, or unknown; never infer deployment from installation. Do not guess hidden architecture or identities from an address. Omit invisible features. Unknown fields remain absent. transom is the fraction of opening height above the transom bar; mullions are fractions across opening width from the left, each between zero and one. Set coordinateSpace to permille. Every bounds value [left,top,right,bottom] must be an integer from 0 to 1000, where 0 is the image top or left edge and 1000 is the image bottom or right edge. Do not return pixel coordinates or decimal fractions for bounds. openingsComplete is true only if every opening in this crop is clearly visible. Return JSON.';

export const schema = { type: 'object', additionalProperties: false, required: ['coordinateSpace', 'features', 'openingsComplete'], properties: {
  coordinateSpace: { type: 'string', enum: ['permille'] },
  openingsComplete: { type: 'boolean' },
  features: { type: 'array', maxItems: 100, items: { type: 'object', additionalProperties: false, required: ['id', 'kind', 'bounds'], properties: {
    id: { type: 'string' }, kind: { type: 'string', enum: FEATURE_KINDS }, bounds: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'integer', minimum: 0, maximum: 1000 } },
    head: { type: 'string', enum: HEADS }, archRise: { type: 'number' }, topCornerRadius: { type: 'number' }, lintelHead: { type: 'string', enum: ['segmental', 'rounded'] }, lintelRise: { type: 'number' }, row: { type: 'integer' }, bay: { type: 'integer' }, paired: { type: 'boolean' },
    transom: { type: 'number' }, mullions: { type: 'array', items: { type: 'number' } }, doorStyle: { type: 'string', enum: ['panelled', 'glazed', 'plain'] }, doorGlazingRatio: { type: 'number', minimum: 0.35, maximum: 0.95 }, colour: { type: 'string' }, frameColour: { type: 'string' }, surroundColour: { type: 'string' },
    material: { type: 'string', enum: MATERIALS }, region: { type: 'string', enum: REGIONS }, installation: { type: 'string', enum: INSTALLATIONS }, state: { type: 'string', enum: AWNING_STATES }, text: { type: 'string' }, physicalSignId: { type: 'string' },
  } } },
} };

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export const analysisPrompt = source => `${prompt}\nThe attached original crop is ${source.width} pixels wide by ${source.height} pixels high. Ignore those pixel dimensions when writing bounds: use only integer permille coordinates from 0 through 1000. For example, the exact full image is [0,0,1000,1000]. Material and region fields belong only on separate kind=material features.`;
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const nonempty = value => typeof value === 'string' && value.length > 0;
const finiteArray = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
const assert = (condition, message) => { if (!condition) throw Error(message); };

export function analysisKey(source) {
  // Deliberately excludes observation, registration, wall geometry and output path.
  return sha256(JSON.stringify({ cropSha256: source.cropSha256, width: source.width, height: source.height, model: MODEL, responseFormat: 'json_object-local-schema-validation', extractionVersion: EXTRACTION_VERSION, promptSha256: sha256(analysisPrompt(source)), schemaSha256: sha256(JSON.stringify(schema)), maxTokens: MAX_TOKENS }));
}

export function validateProposal(value, { width, height }) {
  assert(value && typeof value === 'object' && typeof value.openingsComplete === 'boolean' && Array.isArray(value.features) && value.features.length <= 100, 'Invalid extraction result');
  assert(new Set(value.features.map(feature => feature.id)).size === value.features.length, 'Duplicate feature id');
  for (const feature of value.features) {
    assert(nonempty(feature.id) && FEATURE_KINDS.includes(feature.kind), 'Invalid feature identity or kind');
    assert(finiteArray(feature.bounds, 4), `Invalid bounds for ${feature.id}`);
    const [left, top, right, bottom] = feature.bounds;
    assert(left >= 0 && top >= 0 && right > left && bottom > top && right <= width && bottom <= height, `Out-of-image bounds for ${feature.id}`);
    if (feature.head !== undefined) assert(HEADS.includes(feature.head), `Invalid head for ${feature.id}`);
    if (feature.lintelHead !== undefined) assert(['segmental', 'rounded'].includes(feature.lintelHead), `Invalid lintel head for ${feature.id}`);
    if (feature.archRise !== undefined) assert(Number.isFinite(feature.archRise) && feature.archRise > 0 && feature.archRise <= 0.5 && ['segmental', 'rounded'].includes(feature.head), `Invalid arch rise for ${feature.id}`);
    if (feature.topCornerRadius !== undefined) assert(Number.isFinite(feature.topCornerRadius) && feature.topCornerRadius > 0 && feature.topCornerRadius <= 0.25 && feature.head === 'rectangular', `Invalid top corner radius for ${feature.id}`);
    if (feature.lintelRise !== undefined) assert(Number.isFinite(feature.lintelRise) && feature.lintelRise > 0 && feature.lintelRise <= 0.5 && ['segmental', 'rounded'].includes(feature.lintelHead), `Invalid lintel rise for ${feature.id}`);
    if (feature.material !== undefined) assert(MATERIALS.includes(feature.material), `Invalid material for ${feature.id}`);
    if (feature.region !== undefined) assert(REGIONS.includes(feature.region), `Invalid region for ${feature.id}`);
    if (feature.installation !== undefined) assert(INSTALLATIONS.includes(feature.installation), `Invalid installation for ${feature.id}`);
    if (feature.state !== undefined) assert(AWNING_STATES.includes(feature.state), `Invalid awning state for ${feature.id}`);
    for (const field of ['colour', 'frameColour', 'surroundColour']) if (feature[field] !== undefined) assert(/^#[a-f0-9]{6}$/i.test(feature[field]), `Invalid ${field} for ${feature.id}`);
    if (feature.transom !== undefined) assert(Number.isFinite(feature.transom) && feature.transom > 0 && feature.transom < 1, `Invalid transom fraction for ${feature.id}`);
    if (feature.mullions !== undefined) assert(Array.isArray(feature.mullions) && feature.mullions.every(value => Number.isFinite(value) && value > 0 && value < 1) && feature.mullions.every((value, index) => index === 0 || value > feature.mullions[index - 1]), `Invalid mullion fractions for ${feature.id}`);
    if (feature.doorStyle !== undefined) assert(feature.kind === 'door' && ['panelled', 'glazed', 'plain'].includes(feature.doorStyle), `Invalid door style for ${feature.id}`);
    if (feature.doorGlazingRatio !== undefined) assert(feature.kind === 'door' && feature.doorStyle === 'glazed' && Number.isFinite(feature.doorGlazingRatio) && feature.doorGlazingRatio >= .35 && feature.doorGlazingRatio <= .95, `Invalid door glazing ratio for ${feature.id}`);
    if (feature.row !== undefined) assert(Number.isInteger(feature.row) && feature.row >= 0, `Invalid row for ${feature.id}`);
    if (feature.bay !== undefined) assert(Number.isInteger(feature.bay) && feature.bay >= 0, `Invalid bay for ${feature.id}`);
    if (feature.state !== undefined) assert(feature.kind === 'awning', `Awning state on non-awning ${feature.id}`);
    if (feature.installation !== undefined) assert(feature.kind === 'awning', `Awning installation on non-awning ${feature.id}`);
    if (feature.physicalSignId !== undefined) assert(feature.kind === 'fascia' && nonempty(feature.physicalSignId), `Physical sign id on non-fascia ${feature.id}`);
  }
  return value;
}

export function normalizeProviderProposal(value, source) {
  assert(value?.coordinateSpace === 'permille' && Array.isArray(value.features), 'Provider did not return permille coordinates');
  const rejectedFeatures = [];
  const features = value.features.flatMap(feature => {
    if (!finiteArray(feature.bounds, 4)) {
      rejectedFeatures.push({ id: nonempty(feature?.id) ? feature.id : null, kind: feature?.kind ?? null, reason: 'missing-valid-bounds' });
      return [];
    }
    assert(finiteArray(feature.bounds, 4) && feature.bounds.every(number => Number.isInteger(number) && number >= 0 && number <= 1000), `Invalid permille bounds for ${feature.id ?? 'feature'}`);
    return [{ ...feature, bounds: [feature.bounds[0] * source.width / 1000, feature.bounds[1] * source.height / 1000, feature.bounds[2] * source.width / 1000, feature.bounds[3] * source.height / 1000] }];
  });
  return { openingsComplete: value.openingsComplete, features, ...(rejectedFeatures.length ? { rejectedFeatures } : {}) };
}

function validateRegistration(registration, source, item, label) {
  assert(registration && ['registered', 'correspondence-verified', 'ambiguous', 'failed', 'abstained'].includes(registration.status), `Invalid registration status: ${label}`);
  if (registration.status !== 'registered' && registration.status !== 'correspondence-verified') return false;
  assert(Number.isInteger(registration.surfaceIndex), `Invalid registration surface: ${label}`);
  assert(finiteArray(registration.imageToWall, 9), `Invalid image-to-wall transform: ${label}`);
  assert(finiteArray(registration.wallDirection, 2) && Math.hypot(...registration.wallDirection) > 0, `Missing signed wall direction: ${label}`);
  assert(registration.sourceDatum === 'NAP' && registration.canonicalDatum === 'surface-base' && registration.pixelConvention === 'pixel-edge', `Invalid registration datum or pixel convention: ${label}`);
  const margins = registration.cropMarginsPx;
  assert(margins && ['left', 'top', 'right', 'bottom'].every(key => Number.isFinite(margins[key]) && margins[key] >= 0), `Invalid crop margins: ${label}`);
  assert(margins.left + margins.right < source.width && margins.top + margins.bottom < source.height, `Crop margins consume image: ${label}`);
  const frontageDirection = item.frontage[1].map((value, index) => value - item.frontage[0][index]);
  assert(frontageDirection[0] * registration.wallDirection[0] + frontageDirection[1] * registration.wallDirection[1] > 0, `Mirrored wall direction: ${label}`);
  const h = registration.imageToWall, x = source.width / 2, y = source.height / 2;
  const projectT = pixelX => (h[0] * pixelX + h[1] * y + h[2]) / (h[6] * pixelX + h[7] * y + h[8]);
  assert(Number.isFinite(projectT(x)) && Number.isFinite(projectT(x + 1)) && projectT(x + 1) > projectT(x), `Mirrored image-to-wall transform: ${label}`);
  if (registration.status === 'registered') {
    assert(Number.isFinite(registration.uncertaintyM) && registration.uncertaintyM >= 0 && registration.uncertaintyM <= 0.15, `Registration uncertainty exceeds 0.15 m: ${label}`);
    const alignment = registration.alignment;
    assert(alignment?.wallIdentity === 'verified' && alignment.boundaryEvidence === true && alignment.rooflineEvidence === true && alignment.cameraHeightResolved === true && alignment.orientationVerified === true, `Registration alignment not verified: ${label}`);
  } else {
    // Street-level correspondence: identity/wall verified plus a bounded,
    // independently measured anchor residual. No metre-accuracy claim.
    const residual = registration.residualM;
    assert(residual && Number.isFinite(residual.median) && Number.isFinite(residual.p95) && residual.median <= 0.25 && residual.p95 <= 0.50, `Correspondence residual invalid: ${label}`);
    assert(Number.isInteger(registration.independentAnchors) && registration.independentAnchors >= 3, `Correspondence anchors insufficient: ${label}`);
  }
  return true;
}

function activeSetIdentity(manifest) {
  return manifest.activeDevelopmentSet ?? manifest.activeSet;
}

export function activeSetHash(manifest) {
  return sha256(JSON.stringify(manifest.cases ?? []));
}

export async function validateRunManifest(manifest, manifestPath, baseline, { imageMetadata = async file => sharp(file).metadata() } = {}) {
  assert(manifest?.version === 2 && PHASE_LIMITS[manifest.phase], 'Invalid extraction manifest version or phase');
  assert(manifest.releaseId === baseline.releaseId, 'Manifest is not bound to the preserved release');
  const active = activeSetIdentity(manifest);
  assert(active && nonempty(active.id) && ['validated', 'source-bound-hashes-only'].includes(active.status) && isHash(active.sha256), 'Missing validated active-set identity');
  const previewExpansion=manifest.phase==='neighbourhood-1000-preview';
  if(previewExpansion)assert(manifest.analysisOnly===true&&manifest.publicationBlocked===true&&manifest.userAuthorizedPreviewScale===1000&&active.kind==='source-bound-neighborhood-preview'&&isHash(manifest.batchAuthorization?.sha256)&&nonempty(manifest.batchAuthorization?.path), 'Neighbourhood preview must remain analysis-only, publication-blocked, and explicitly authorized');
  if (manifest.phase === 'development') assert(['replacement-development', 'user-reviewed-development'].includes(active.kind) && active.originalTwelveOutstanding === true, 'Development must use a validated photographed development set and retain the original twelve as outstanding');
  if(manifest.phase==='expansion')assert(active.kind==='release-expansion', 'Release expansion requires a release-expansion active set');
  if (manifest.phase === 'held-out' || manifest.phase === 'unseen') assert(active.kind === 'held-out' && active.untouched === true && active.exclusionsCertified === true, 'Held-out set is not certified and untouched');
  assert(Array.isArray(manifest.cases) && manifest.cases.length > 0, 'Manifest has no cases');
  assert(new Set(manifest.cases.map(item => item.id ?? item.observationId)).size === manifest.cases.length, 'Duplicate case identity');
  const requests = [], abstentions = [], root = path.dirname(path.resolve(manifestPath));
  const computedActiveHash = activeSetHash(manifest);
  assert(active.sha256 === computedActiveHash, 'Active-set hash does not match its cases and source registrations');
  for (const item of manifest.cases) {
    const observationId = item.observationId ?? item.id;
    const pendingSourceOnly=previewExpansion&&item.geometryBindingStatus==='pending-source-only'&&item.geometryRevision===null&&item.evidenceKey===null;
    assert(nonempty(observationId) && nonempty(item.buildingId) && (pendingSourceOnly||(nonempty(item.geometryRevision)&&isHash(item.evidenceKey))), `Missing binding for ${observationId ?? 'case'}`);
    assert(finiteArray(item.frontage?.[0], 2) && finiteArray(item.frontage?.[1], 2) && item.frontage[0].some((value, index) => value !== item.frontage[1][index]), `Invalid frontage for ${observationId}`);
    assert(Array.isArray(item.surfaceIndices) && (manifest.analysisOnly || item.surfaceIndices.length > 0) && item.surfaceIndices.every(Number.isInteger), `Invalid surfaces for ${observationId}`);
    for (const tier of ['full', 'ground']) {
      const source = item.sources?.[tier];
      if (!source) continue; // Missing tiers are explicit omissions.
      const label = `${observationId}:${tier}`;
      assert(nonempty(source.path) && isHash(source.cropSha256) && nonempty(source.captureDate) && !Number.isNaN(Date.parse(source.captureDate)), `Invalid source identity: ${label}`);
      assert(Number.isInteger(source.width) && source.width > 0 && Number.isInteger(source.height) && source.height > 0, `Invalid image dimensions: ${label}`);
      const file = path.resolve(root, source.path);
      const bytes = await fs.readFile(file);
      assert(sha256(bytes) === source.cropSha256, `Changed source crop: ${label}`);
      const metadata = await imageMetadata(file);
      assert(metadata.width === source.width && metadata.height === source.height, `Source dimensions do not match image: ${label}`);
      if (item.analysisExcludedReason) {
        assert(nonempty(item.analysisExcludedReason), `Invalid analysis exclusion: ${label}`);
        abstentions.push({ observationId, tier, status: 'analysis-excluded', reason: item.analysisExcludedReason });
        continue;
      }
      if (!validateRegistration(source.registration, source, item, label)) {
        const reason = source.registrationAbstention ?? source.registration.registrationAbstention ?? source.registration.abstentionReason ?? source.registration.abstention;
        assert(nonempty(reason), `Non-registered source lacks abstention reason: ${label}`);
        abstentions.push({ observationId, tier, status: source.registration.status, reason });
        if (!manifest.analysisOnly) continue;
      }
      if (source.registration.status === 'registered' || source.registration.status === 'correspondence-verified') assert(item.surfaceIndices.includes(source.registration.surfaceIndex), `Registered surface is outside case: ${label}`);
      const mime = metadata.format === 'png' ? 'image/png' : metadata.format === 'webp' ? 'image/webp' : 'image/jpeg';
      requests.push({ item, observationId, tier, source, file, bytes, mime, key: analysisKey(source) });
    }
  }
  assert(requests.length + abstentions.length > 0, 'Manifest contains no source tiers');
  const priorities = new Map((manifest.analysisPriority ?? []).map((label, index) => [label, index]));
  requests.sort((a, b) => (priorities.get(`${a.item.id}:${a.tier}`) ?? Number.MAX_SAFE_INTEGER) - (priorities.get(`${b.item.id}:${b.tier}`) ?? Number.MAX_SAFE_INTEGER));
  const phase = manifest.phase === 'held-out' ? 'unseen' : manifest.phase;
  return { activeSet: active, phase, phaseLimitUsd: PHASE_LIMITS[phase], requests, abstentions };
}
