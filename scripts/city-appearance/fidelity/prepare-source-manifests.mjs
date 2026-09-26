#!/usr/bin/env node
/**
 * Freeze source identities and agent source inspections for the compact
 * façade fidelity run. This script never calls an image model and never
 * assigns a registration transform. It only binds the already cached crop
 * bytes to the routing candidate records and records what is visibly known
 * from an independent source inspection.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../../..');
const fidelity = path.join(root, 'scripts/city-appearance/fidelity');
const candidateRegister = JSON.parse(await fs.readFile(path.join(fidelity, 'unseen-candidates.json'), 'utf8'));
const candidates = candidateRegister.cases;
const releaseId = 'c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d';
const inspectionDate = '2026-09-12';
const namedBuildingIds = new Set(['0363100012159182', '0363100012174146', '0363100012174549']);
const evidenceManifestPaths = [
  path.join(root, '.cache/city-appearance/areas/da-costabuurt-v1/panorama-audit/b4fc23112b0593e31eb3d4ae7226adb95639120d92a75965b4f841fd274a32fd/evidence/manifest.json'),
  path.join(root, '.cache/city-appearance/areas/jordaan-sample-v1/panorama-audit/3efda804ec397771663a9af0cfab35b381c3fd30b70565029222bb0c25fbc61e/evidence/manifest.json')
];

const strata = {
  // The labels below come from the full/ground source crops, independently
  // inspected before any rich extraction. Unknown details remain unknown.
  '0363100012129992_e_1ejkc4i': ['shop-assemblies', 'retracted-awning'],
  '0363100012153319_e_0wxtnpm': ['residential-entrances'],
  '0363100012084787_e_1flwaw8': ['shop-assemblies', 'extended-awning'],
  '0363100012237100_e_1l4m54o': ['contrasting-finishes-or-accents'],
  '0363100012167013_e_0p7lv5i': ['residential-entrances'],
  '0363100012154336_e_1xz6eyd': ['shop-assemblies'],
  '0363100012236441_e_0xxtbct': ['curved-openings'],
  '0363100012067309_e_1c8xhxm': ['residential-entrances'],
  '0363100012165919_e_0ca7kp7': ['obscured-or-unknown'],
  '0363100012164571_e_00e1xvi': ['ground-contact'],
  '0363100012089603_e_1cvhymq': ['contrasting-finishes-or-accents'],
  '0363100012156077_e_1yr2ovu': ['shop-assemblies'],
  '0363100012156054_e_0u23hyv': ['obscured-or-unknown'],
  '0363100012236796_e_11bsna7': ['obscured-or-unknown'],
  '0363100012132271_e_09pgk76': ['residential-entrances'],
  '0363100012167944_e_12245ey': ['ground-contact'],
  '0363100012169892_e_0pklugu': ['residential-entrances'],
  '0363100012168967_e_1fakpw3': ['curved-openings'],
  '0363100012170203_e_0antd5h': ['shop-assemblies'],
  '0363100012170093_e_0n47f1p': ['obscured-or-unknown'],
  '0363100012174288_e_0z6ytzw': ['contrasting-finishes-or-accents'],
  '0363100012174168_e_1x37anp': ['residential-entrances'],
  '0363100012169948_e_0cg9q7q': ['obscured-or-unknown'],
  '0363100012172773_e_0nlsds9': ['shop-assemblies'],
  '0363100012173914_e_1un6nri': ['obscured-or-unknown'],
  '0363100012174278_e_0oy3b32': ['contrasting-finishes-or-accents'],
  '0363100012174159_e_1scn3au': ['obscured-or-unknown'],
  '0363100012174549_e_0brqvmp': ['shop-assemblies', 'retracted-awning'],
  '0363100012173932_e_0ec1tw7': ['curved-openings'],
  '0363100012173863_e_05hdyw7': ['masonry-accent'],
};

// Twelve cached replacements selected for the requested feature mix. They
// are a development convenience set and do not reproduce or resolve the
// original twelve image-numbered cases.
const developmentSelection = [
  ['replacement-entrance-01', '0363100012152464_e_10yua55', 'entrances-layout'],
  ['replacement-entrance-02', '0363100012152562_e_17jq9cd', 'entrances-layout'],
  ['replacement-entrance-03', '0363100012157610_e_0sr2d2k', 'entrances-layout'],
  ['replacement-entrance-04', '0363100012170198_e_1wjd1ln', 'entrances-layout'],
  ['replacement-curved-01', '0363100012163064_e_068m6ak', 'curved-openings'],
  ['replacement-curved-02', '0363100012154294_e_1y3j89u', 'curved-openings'],
  ['replacement-contact-01', '0363100012155777_e_0ggdhqa', 'ground-contact'],
  ['replacement-awning-extended', '0363100012166975_e_1bab2bg', 'extended-awning'],
  ['replacement-awning-retracted', '0363100012169358_e_03ogtfj', 'retracted-awning'],
  ['replacement-finish-01', '0363100012168881_e_03vrmcz', 'contrasting-finishes-or-accents'],
  ['replacement-finish-02', '0363100012170202_e_04beeuu', 'contrasting-finishes-or-accents'],
  ['replacement-masonry-01', '0363100012169410_e_1h0uyal', 'masonry-accent'],
];
const heldoutReplacements = [
  '0363100012152724_e_1cjcooe', '0363100012152977_e_13evhz4', '0363100012158653_e_1do2dbd',
  '0363100012160092_e_0ttw5t9', '0363100012160170_e_0ll0vf2', '0363100012162078_e_1kp3cga',
  '0363100012165211_e_15djkoz', '0363100012165792_e_0tpgvya', '0363100012165927_e_0xxqmsr',
  '0363100012169411_e_139uowc', '0363100012169414_e_11ytrog', '0363100012170188_e_1x9mghy', '0363100012170190_e_1p5ck4k'
];

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function imageSize(file) {
  const out = execFileSync('identify', ['-format', '%w %h', file], { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
  if (out.length !== 2 || out.some(v => !Number.isInteger(v) || v <= 0)) throw new Error(`Invalid dimensions for ${file}`);
  return { width: out[0], height: out[1] };
}
async function findCached(file) {
  const out = execFileSync('find', [path.join(root, '.cache/city-appearance'), '-type', 'f', '-name', file], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const evidence = out.find(v => v.includes('/evidence/images/'));
  if (!evidence) throw new Error(`No evidence-cache crop for ${file}`);
  return evidence;
}
function relativeSource(file) { return path.relative(fidelity, file); }

const sourceCache = new Map();
async function sourceEntry(item, kind) {
  const image = item.images[kind];
  const cached = await findCached(image.file);
  const bytes = await fs.readFile(cached);
  const actualHash = sha256(bytes);
  if (actualHash !== image.sha256) throw new Error(`${item.observationId}/${kind}: hash mismatch`);
  const dimensions = imageSize(cached);
  return {
    path: relativeSource(cached),
    cropSha256: actualHash,
    panoramaSha256: image.panoramaSha256,
    captureDate: image.date,
    dimensions,
    width: dimensions.width,
    height: dimensions.height,
    actualDimensions: dimensions,
    declaredDimensions: dimensions,
    cropMarginsPx: null,
    wallDirection: null,
    plane: null,
    alignment: {
      wallIdentity: 'pending', boundaryEvidence: 'pending', rooflineEvidence: 'pending',
      cameraHeightResolved: false, uncertaintyM: null
    },
    // A registration is deliberately explicit and unresolved until the
    // geometry owner supplies a checked wall transform. It is never guessed.
    registration: {
      status: 'ambiguous',
      surfaceIndex: item.surfaceIndices.length === 1 ? item.surfaceIndices[0] : null,
      uncertaintyM: null,
      imageToWall: null,
      abstentionReason: 'Cached crop identity is verified; wall alignment and camera height are not independently certified in this manifest.',
      registrationAbstention: 'wall alignment and camera height require independent geometry review'
    }
  };
}
function notes(item, primary) {
  const visible = {
    'residential-entrances': 'One or more residential entrance assemblies are visible; exact thresholds and obscured edges remain unknown.',
    'curved-openings': 'At least one curved or arched opening/lintel is visible; glazing versus masonry separation requires pixel annotation.',
    'shop-assemblies': 'A commercial frontage or tenant assembly is visible; sign text and hidden divisions are not inferred.',
    'extended-awning': 'Ground crop visibly contains deployed fabric/canopy; installation and exact extent remain unmeasured.',
    'retracted-awning': 'Ground crop visibly contains a shallow fascia/roll or possible housing; deployment is retained as source-observed and unmeasured.',
    'contrasting-finishes-or-accents': 'Contrasting finish or masonry/material accent is visible in the source crop.',
    'masonry-accent': 'Distinct masonry band, surround, gable or accent is visible in the full crop.',
    'ground-contact': 'Building/base and pavement are both visible enough to nominate a contact check; metric gap remains unmeasured.',
    'obscured-or-unknown': 'Source crop is retained as a hard/partially obscured case; hidden openings, signs and awning state remain unknown.'
  };
  return {
    inspector: 'agent-source-inspection', inspectionDate: inspectionDate,
    disposition: 'agent-inspected', primaryStratum: primary,
    visibleAssertions: primary.map(s => visible[s]),
    annotationStatus: 'qualitative-before-prediction',
    openings: [], materials: [], signs: [], awnings: [], contacts: [],
    limitations: ['No pixel bounds are asserted before independent geometry review.', 'No hidden feature or tenant identity is inferred.', 'This inspection is not human review.']
  };
}

const byObservation = new Map(candidates.map(c => [c.observationId, c]));
const evidenceRecords = new Map();
for (const manifestPath of evidenceManifestPaths) {
  const register = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const district = manifestPath.includes('/jordaan-') ? 'Jordaan' : 'Da Costabuurt';
  for (const record of register.records ?? []) evidenceRecords.set(record.id, { ...record, __district: district });
}
function alternateItem(observationId) {
  const record = evidenceRecords.get(observationId);
  if (!record?.images?.full || !record?.images?.ground) throw new Error(`No complete evidence record for alternate ${observationId}`);
  const geometryRevision = sha256(JSON.stringify({ wall: record.wall, plane: record.images.full.plane, ground: record.groundNAP }));
  return {
    observationId, id: observationId, buildingId: record.buildingId, geometryRevision,
    evidenceKey: sha256(JSON.stringify({ observationId, full: record.images.full.sha256, ground: record.images.ground.sha256 })),
    district: record.__district,
    frontage: [record.localStart, record.localEnd], surfaceIndices: [record.wall.index], images: record.images,
    geometryEvidence: { wall: record.wall, groundNAP: record.groundNAP, fullPlane: record.images.full.plane, groundPlane: record.images.ground.plane }
  };
}
const activeIds = new Set(developmentSelection.map(([, observationId]) => observationId));
const retiredDevelopmentIds = new Set([
  '0363100012153319_e_0wxtnpm', '0363100012167013_e_0p7lv5i', '0363100012067309_e_1c8xhxm',
  '0363100012174168_e_1x37anp', '0363100012236441_e_0xxtbct', '0363100012168967_e_1fakpw3',
  '0363100012164571_e_00e1xvi', '0363100012084787_e_1flwaw8', '0363100012129992_e_1ejkc4i',
  '0363100012237100_e_1l4m54o', '0363100012089603_e_1cvhymq', '0363100012173863_e_05hdyw7', '0363100012174549_e_0brqvmp'
]);
const replacementItems = heldoutReplacements.map(alternateItem);
for (const [, observationId] of developmentSelection) byObservation.set(observationId, alternateItem(observationId));
for (const item of replacementItems) {
  if (activeIds.has(item.observationId)) throw new Error(`Held-out replacement overlaps active development: ${item.observationId}`);
  byObservation.set(item.observationId, item);
}
// Remove development frontages from the held-out register and replenish with
// independently inspected records from the larger cached evidence manifests.
const heldoutCases = candidates.filter(c => !activeIds.has(c.observationId) && !retiredDevelopmentIds.has(c.observationId));
const districtNeeds = { 'Da Costabuurt': 0, Jordaan: 0 };
for (const c of candidates) if (retiredDevelopmentIds.has(c.observationId)) districtNeeds[c.district]++;
for (const item of replacementItems) districtNeeds[item.district]--;
if (Object.values(districtNeeds).some(v => v !== 0)) throw new Error(`Replacement district balance mismatch: ${JSON.stringify(districtNeeds)} replacements=${JSON.stringify(replacementItems.map(v => [v.observationId, v.district]))}`);
const replenished = [...heldoutCases, ...replacementItems];
const inspected = [];
for (const item of replenished) {
  const sources = { full: await sourceEntry(item, 'full'), ground: await sourceEntry(item, 'ground') };
  const primary = strata[item.observationId]?.[0] ?? 'obscured-or-unknown';
  inspected.push({
    id: item.observationId, observationId: item.observationId, buildingId: item.buildingId,
    geometryRevision: item.geometryRevision, evidenceKey: item.evidenceKey, district: item.district,
    frontage: item.frontage, surfaceIndices: item.surfaceIndices, sources,
    featureStrata: ['unverified-pending-independent-inspection'],
    referenceAnnotations: { disposition: 'rejected-pending-independent-inspection', inspector: 'none', reason: 'No quantitative source annotation is claimed by this manifest.' },
    exclusionCheck: namedBuildingIds.has(item.buildingId)
      ? { status: 'blocked-named-compatibility-overlap', excludedFromDevelopment: true, excludedFromNamedCompatibility: false, excludedBuildingIdsSource: 'named-compatibility.json' }
      : { status: 'candidate-exclusion-certified', excludedFromDevelopment: true, excludedFromNamedCompatibility: true, excludedBuildingIdsSource: 'unseen-candidates.json' }
  });
}

const inspectedManifest = {
  version: 2, releaseId, inspectionDate,
  status: 'source-bound-hashes-only',
  certificationStatus: 'uncertified',
  blockingIssues: [{ reason: 'independent-quantitative-source-inspection-pending' }],
  role: 'held-out-reference-source-register', referenceAnnotationsAre: 'agent-inspected-source-not-human-review',
  districtCounts: { 'Da Costabuurt': 15, Jordaan: 15 }, cases: inspected
};
await fs.writeFile(path.join(fidelity, 'heldout-source-inspection.json'), `${JSON.stringify(inspectedManifest, null, 2)}\n`);

const devCases = [];
const devAnnotations = [];
const rejectedAnnotationFractions = {
  'entrances-layout': [
    { id: 'door-1', kind: 'door', head: 'rectangular', box: [.58, .28, .78, .92] },
    { id: 'door-2', kind: 'door', head: 'rectangular', box: [.78, .28, .94, .92] },
    { id: 'window-1', kind: 'window', head: 'rectangular', box: [.08, .27, .30, .80] },
    { id: 'window-2', kind: 'window', head: 'rectangular', box: [.32, .27, .53, .80] }
  ],
  'curved-openings': [
    { id: 'curved-1', kind: 'window', head: 'rounded', box: [.04, .25, .25, .84] },
    { id: 'curved-2', kind: 'window', head: 'rounded', box: [.27, .25, .49, .84] },
    { id: 'curved-3', kind: 'window', head: 'rounded', box: [.52, .25, .74, .84] },
    { id: 'curved-4', kind: 'window', head: 'rounded', box: [.77, .25, .98, .84] }
  ],
  'ground-contact': [
    { id: 'door-1', kind: 'door', head: 'rectangular', box: [.56, .25, .79, .89] },
    { id: 'window-1', kind: 'window', head: 'rectangular', box: [.08, .27, .30, .79] },
    { id: 'window-2', kind: 'window', head: 'rectangular', box: [.33, .27, .53, .79] }
  ],
  'extended-awning': [
    { id: 'awning-1', kind: 'awning', head: 'unknown', box: [.01, .37, .99, .68], state: 'extended' },
    { id: 'door-1', kind: 'door', head: 'rectangular', box: [.43, .50, .57, .98] }
  ],
  'retracted-awning': [
    { id: 'awning-1', kind: 'awning', head: 'unknown', box: [.02, .42, .98, .54], state: 'retracted' },
    { id: 'door-1', kind: 'door', head: 'rectangular', box: [.04, .52, .28, .98] },
    { id: 'window-1', kind: 'window', head: 'rectangular', box: [.30, .52, .88, .98] }
  ],
  'contrasting-finishes-or-accents': [
    { id: 'window-1', kind: 'window', head: 'rectangular', box: [.08, .27, .38, .84] },
    { id: 'door-1', kind: 'door', head: 'rectangular', box: [.67, .28, .90, .94] }
  ],
  'masonry-accent': [
    { id: 'door-1', kind: 'door', head: 'rounded', box: [.06, .35, .25, .92] },
    { id: 'window-1', kind: 'window', head: 'rectangular', box: [.45, .35, .78, .85] }
  ]
};
function pixelAnnotations(source, featureClass) {
  void source; void featureClass;
  return [];
}
for (const [id, observationId, featureClass] of developmentSelection) {
  const item = byObservation.get(observationId);
  if (!item) throw new Error(`Development selection missing candidate ${observationId}`);
  const inspectedItem = inspected.find(v => v.observationId === observationId) ?? {
    sources: { full: await sourceEntry(item, 'full'), ground: await sourceEntry(item, 'ground') },
    referenceAnnotations: notes(item, [featureClass])
  };
  devCases.push({
    id, caseId: id, observationId, sourceObservationId: observationId, buildingId: item.buildingId,
    geometryRevision: item.geometryRevision, evidenceKey: item.evidenceKey, district: item.district,
    frontage: item.frontage, surfaceIndices: item.surfaceIndices, featureClass,
    sources: inspectedItem.sources,
    sourceInspectionId: `${id}-reference-rejected`,
    bindingStatus: 'replacement-development-source-bound; original-image-numbered-case-unresolved',
    requiredViews: ['tight-ground-floor', 'full-facade', 'oblique-game']
  });
  // Quantitative annotations are intentionally not emitted here. The earlier
  // template-based bounds were rejected because they were not inspected per
  // image; preserve the source binding while leaving references empty.
}
await fs.writeFile(path.join(fidelity, 'development-reference-annotations.json'), `${JSON.stringify({ version: 1, status: 'rejected-template-annotations; quantitative-inspection-pending', cases: [] }, null, 2)}\n`);
const active = {
  version: 2, releaseId, phase: 'development',
  activeDevelopmentSet: { id: 'cached-replacements-2026-09-12', status: 'source-bound-hashes-only', kind: 'replacement-development', originalTwelveOutstanding: true },
  developmentSetId: 'cached-replacements-2026-09-12',
  developmentSetStatus: 'replacement-set-source-bound; does-not-resolve-original-twelve',
  activeDevelopmentSetResolved: false,
  suppliedExamplesResolved: false,
  originalImageNumberedCases: { manifest: 'development-examples.json', status: 'outstanding-unresolved', resolvedCount: 0, count: 12 },
  namedCompatibility: { manifest: 'named-compatibility.json', status: 'separate-dated-compatibility-cases' },
  referenceAnnotations: 'development-reference-annotations.json', cases: devCases
};
active.activeDevelopmentSet.sha256 = sha256(Buffer.from(JSON.stringify(devCases)));
await fs.writeFile(path.join(fidelity, 'active-development-manifest.json'), `${JSON.stringify(active, null, 2)}\n`);

  console.log(JSON.stringify({heldOut: inspected.length, development: devCases.length, sourceStatus: 'hashes-and-dimensions-verified', registrationStatus: 'all-ambiguous-explicit-abstention', paidExtraction: 0}, null, 2));
