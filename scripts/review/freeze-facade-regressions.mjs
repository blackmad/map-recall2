#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { compileFacadePatches, facadeRecipeRecords } from '../../src/canalRecall/cityAppearanceFacadeRecipes.ts';

const gunzip = promisify(zlib.gunzip);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const flag = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = process.cwd();
const releaseId = flag('release') ?? 'c4bebc1fcc1ad9622ea4972755b3eee69f037928db4573219c86d2c4e088920d';
if (!/^[a-f0-9]{64}$/.test(releaseId)) throw Error('Invalid release id');
const notesPath = path.resolve(flag('notes') ?? `.cache/city-appearance/review-notes/${releaseId}.json`);
const packetPath = path.resolve(`public/data/city-expansion/evaluations/${releaseId}/comparison-packet.json`);
const releasePath = path.resolve(`public/data/city-expansion/releases/${releaseId}/manifest.json`);
const heldoutPath = path.resolve('scripts/city-appearance/fidelity/heldout-source-inspection.json');
const outPath = path.resolve(flag('out') ?? 'scripts/review/facade-regressions.json');
const exclusionsPath = path.resolve(flag('exclusions-out') ?? 'scripts/review/facade-regression-heldout-exclusions.json');
const analysisManifestPath = path.resolve(flag('analysis-out') ?? 'scripts/review/facade-regression-analysis-manifest.json');
const read = async file => { const bytes = await fs.readFile(file); return { bytes, value: JSON.parse(bytes.toString()) }; };
const [notesFile, packetFile, releaseFile, heldoutFile] = await Promise.all([read(notesPath), read(packetPath), read(releasePath), read(heldoutPath)]);
const notes = notesFile.value, packet = packetFile.value, release = releaseFile.value, heldout = heldoutFile.value;
if (notes.version !== 1 || notes.releaseId !== releaseId || notes.readyForFixes !== true) throw Error('Review notes are not frozen and ready');
if (hash(packetFile.bytes) !== notes.packetSha256) throw Error('Review packet changed after notes were entered');
if (release.releaseId !== releaseId || release.version !== 1) throw Error('Published release manifest mismatch');
const noteCases = Object.values(notes.notes);
if (noteCases.length !== 28 || notes.regressionCases.length !== 28 || new Set(noteCases.map(note => note.caseId)).size !== 28) throw Error('Expected 28 unique user-noted cases');

const byPacketId = new Map(packet.cases.map(item => [item.caseId, item]));
const byRegressionId = new Map(notes.regressionCases.map(item => [item.caseId, item]));
const tileIndex = new Map(release.tiles.map(tile => [tile.key, tile]));
const observationIndex = new Map(release.observationIndex.map(item => [item.id, item]));
const tileCache = new Map();
async function loadTile(key) {
  if (tileCache.has(key)) return tileCache.get(key);
  const meta = tileIndex.get(key); if (!meta) throw Error(`Published tile missing from manifest: ${key}`);
  const file = path.resolve('public', meta.url.replace(/^\//, ''));
  const bytes = await fs.readFile(file);
  if (hash(bytes) !== meta.sha256) throw Error(`Published tile hash changed: ${key}`);
  const tile = JSON.parse((await gunzip(bytes)).toString());
  const value = { tile, file, sha256: meta.sha256, contentSha256: meta.contentSha256 };
  tileCache.set(key, value); return value;
}
const publicFile = url => path.resolve('public', url.replace(/^\//, ''));
async function hashedPublic(url, expected) {
  const file = publicFile(url), bytes = await fs.readFile(file), sha256 = hash(bytes);
  if (expected && sha256 !== expected) throw Error(`Changed review evidence: ${url}`);
  return { path: path.relative(root, file), sha256 };
}

function assertions(caseId, text) {
  if (caseId === 'case-26') return [{ id: 'source-ambiguity', kind: 'source-ambiguity', expected: { status: 'requires-clarification', prohibitsFeatureInference: true }, source: 'user-note' }];
  const result = [];
  if (/\bdoor(s)?\b|no doors|interpreted as doors/i.test(text)) result.push({ id: 'door-presence', kind: 'feature-count', expected: { feature: 'door', minimum: 1 }, source: 'user-note' });
  if (/interpreted as doors/i.test(text)) result.push({ id: 'door-window-classification', kind: 'feature-classification', expected: { visibleAssemblies: 'door', forbiddenClassification: 'window' }, source: 'user-note' });
  if (/\bawning\b|awkning/i.test(text)) result.push({ id: 'awning-presence', kind: 'feature-count', expected: { feature: 'awning', minimum: 1 }, source: 'user-note' });
  if (/green awning/i.test(text)) result.push({ id: 'awning-colour', kind: 'source-appearance', expected: { feature: 'awning', colourName: 'green' }, source: 'user-note' });
  if (/black awning/i.test(text)) result.push({ id: 'awning-colour', kind: 'source-appearance', expected: { feature: 'awning', colourName: 'black' }, source: 'user-note' });
  if (/small (?:awning|awkning)/i.test(text)) result.push({ id: 'awning-size', kind: 'source-proportion', expected: { feature: 'awning', comparison: 'match-source' }, source: 'user-note' });
  if (/window (?:shape|style)|shape of window|curved shape of windows|wrong window/i.test(text)) result.push({ id: 'window-form', kind: 'source-shape', expected: { feature: 'window', comparison: 'match-source', curvatureExplicit: /curved/i.test(text) }, source: 'user-note' });
  if (/one big pane/i.test(text)) result.push({ id: 'window-pane-layout', kind: 'opening-division', expected: { panes: 1 }, source: 'user-note' });
  if (caseId === 'case-13') result.push({ id: 'upper-window-columns', kind: 'opening-layout', expected: { upperColumns: 3, comparison: 'exact' }, source: 'user-note' });
  if (/white|black brick|red first floor|contrast|accent|masonry/i.test(text)) result.push({ id: 'material-contrast', kind: 'source-appearance', expected: { comparison: 'match-source', noteText: text }, source: 'user-note' });
  if (!result.length) result.push({ id: 'note-requires-source-check', kind: 'source-appearance', expected: { comparison: 'match-source', noteText: text }, source: 'user-note' });
  return result;
}
const uniqueFeatureCount = (patches, pattern) => new Set(patches.filter(patch => pattern.test(patch.featureKind)).map(patch => patch.featureId)).size;

const cases = [];
for (const note of noteCases.sort((a, b) => a.caseId.localeCompare(b.caseId, undefined, { numeric: true }))) {
  const queued = byRegressionId.get(note.caseId), packetCase = byPacketId.get(note.caseId);
  if (!queued || !packetCase || queued.userReview.text !== note.text || queued.userReview.revision !== note.revision) throw Error(`Review case binding changed: ${note.caseId}`);
  const observationId = queued.source.observationId, index = observationIndex.get(observationId);
  if (!index) throw Error(`Observation absent from release index: ${observationId}`);
  const loaded = await loadTile(index.tile), owner = loaded.tile.owners.find(value => value.id === queued.source.buildingId);
  const observation = owner?.observations?.find(value => value.id === observationId);
  if (!owner || !observation || observation.geometryRevision !== owner.geometryRevision || observation.evidenceKey !== queued.source.evidenceKey) throw Error(`Published observation binding mismatch: ${note.caseId}`);
  const record = observation.payload, surfaceIndex = record.wall?.index;
  const hasSurface = Number.isInteger(surfaceIndex) && owner.geometry.building.surfaces[surfaceIndex];
  if (!hasSurface && note.caseId !== 'case-26') throw Error(`Published frontage surface missing: ${note.caseId}`);
  const records = facadeRecipeRecords(loaded.tile.owners);
  const patches = hasSurface ? compileFacadePatches(owner, owner.geometry.building.surfaces[surfaceIndex], surfaceIndex, records, loaded.tile.owners, { procedural: true, contextual: true, reviewedAwnings: true, observed: true }) : [];
  const full = await hashedPublic(queued.images.full, record.images.full.sha256);
  const ground = await hashedPublic(queued.images.ground, record.images.ground.sha256);
  const render = await hashedPublic(queued.screenshotUrl, queued.screenshotSha256);
  cases.push({
    caseId: note.caseId, role: 'development-from-user-review', reviewStatus: note.status,
    userNote: structuredClone(note), noteSha256: hash(Buffer.from(JSON.stringify(note))),
    source: {
      full: { ...full, captureDate: record.images.full.date, width: record.images.full.width, height: record.images.full.height },
      ground: { ...ground, captureDate: record.images.ground.date, width: record.images.ground.width, height: record.images.ground.height },
    },
    render,
    binding: { buildingId: owner.id, observationId, geometryRevision: owner.geometryRevision, evidenceKey: observation.evidenceKey, frontage: record.localStart && record.localEnd ? [record.localStart, record.localEnd] : null, surfaceIndices: hasSurface ? [surfaceIndex] : [], ambiguity: hasSurface ? null : 'published observation has no recoverable wall surface', tile: { key: index.tile, path: path.relative(root, loaded.file), sha256: loaded.sha256, contentSha256: loaded.contentSha256 } },
    assertions: assertions(note.caseId, note.text),
    baselineRenderedFeatureCoverage: { measurementStatus: hasSurface ? 'measured-from-preserved-release-compiler' : 'source-ambiguous-not-measurable', doors: uniqueFeatureCount(patches, /door/), windows: uniqueFeatureCount(patches, /window/), awnings: uniqueFeatureCount(patches, /awning/), materials: uniqueFeatureCount(patches, /material|trim/), featureIds: [...new Set(patches.map(patch => patch.featureId))].sort() },
    pixelReferenceAnnotations: null,
  });
}

const bindings = { notes: { path: path.relative(root, notesPath), sha256: hash(notesFile.bytes) }, packet: { path: path.relative(root, packetPath), sha256: hash(packetFile.bytes) }, release: { path: path.relative(root, releasePath), sha256: hash(releaseFile.bytes) } };
const artifact = { version: 1, releaseId, role: 'user-reviewed-development', status: 'notes-frozen; pixel-reference-annotations-pending', reviewedCases: cases.length, bindings, cases };
const reviewedBuildings = [...new Set(cases.map(item => item.binding.buildingId))].sort();
const overlaps = heldout.cases.filter(item => reviewedBuildings.includes(item.buildingId)).map(item => ({ observationId: item.observationId, buildingId: item.buildingId, district: item.district })).sort((a, b) => a.observationId.localeCompare(b.observationId));
const exclusions = { version: 1, releaseId, status: overlaps.length ? 'reviewed-buildings-retired-from-held-out' : 'no-held-out-overlap', reviewedRegressionSha256: hash(Buffer.from(JSON.stringify(artifact))), heldoutSource: { path: path.relative(root, heldoutPath), sha256: hash(heldoutFile.bytes) }, excludedBuildingIds: reviewedBuildings, actualOverlaps: overlaps, retainedHeldoutObservationIds: heldout.cases.filter(item => !reviewedBuildings.includes(item.buildingId)).map(item => item.observationId).sort() };
const analysisCases = cases.map(item => ({
  id: item.caseId, observationId: item.binding.observationId, buildingId: item.binding.buildingId, geometryRevision: item.binding.geometryRevision, evidenceKey: item.binding.evidenceKey,
  frontage: item.binding.frontage, surfaceIndices: item.binding.surfaceIndices,
  ...(item.caseId === 'case-26' ? { analysisExcludedReason: 'User review identifies source ambiguity; features must not be inferred until the target frontage is clarified.' } : {}),
  sources: Object.fromEntries(['full', 'ground'].map(tier => [tier, { path: path.relative(path.dirname(analysisManifestPath), path.resolve(item.source[tier].path)), cropSha256: item.source[tier].sha256, captureDate: item.source[tier].captureDate, width: item.source[tier].width, height: item.source[tier].height, registration: { status: 'ambiguous' }, registrationAbstention: 'Image analysis is authorized independently; wall registration remains unverified and cannot be materialized.' }])),
}));
const analysisManifest = { version: 2, releaseId, phase: 'development', analysisOnly: true, status: 'source-identities-validated; registrations-abstained', analysisPriority: ['case-04:ground', 'case-11:ground', 'case-19:ground', 'case-22:ground', 'case-25:ground', 'case-30:ground'], activeDevelopmentSet: { id: `user-reviewed-${releaseId}`, status: 'validated', kind: 'user-reviewed-development', originalTwelveOutstanding: true, sha256: hash(Buffer.from(JSON.stringify(analysisCases))) }, notesSha256: bindings.notes.sha256, regressionArtifactSha256: hash(Buffer.from(JSON.stringify(artifact))), cases: analysisCases };
await fs.mkdir(path.dirname(outPath), { recursive: true });
await Promise.all([fs.writeFile(outPath, `${JSON.stringify(artifact, null, 2)}\n`), fs.writeFile(exclusionsPath, `${JSON.stringify(exclusions, null, 2)}\n`), fs.writeFile(analysisManifestPath, `${JSON.stringify(analysisManifest, null, 2)}\n`)]);
console.log(JSON.stringify({ cases: cases.length, noteAssertions: cases.reduce((sum, item) => sum + item.assertions.length, 0), reviewedBuildings: reviewedBuildings.length, heldoutOverlaps: overlaps.length, output: path.relative(root, outPath), exclusions: path.relative(root, exclusionsPath), analysisManifest: path.relative(root, analysisManifestPath) }));
