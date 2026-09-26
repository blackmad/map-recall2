#!/usr/bin/env node
/** Convert isolated supplemental panorama crops into the shared source-batch schema. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('.');
const STAGING = process.env.SUPPLEMENTAL_STAGING || '.cache/city-appearance/supplemental-1000/staging';
const STAGINGS = (process.env.SUPPLEMENTAL_STAGING_DIRS || STAGING).split(',').map(value => value.trim()).filter(Boolean);
const BASE = 'scripts/review/thousand-building-sources.json';
const HELDOUT = 'scripts/city-appearance/fidelity/heldout-source-inspection.json';
const OUTPUT = 'scripts/review/thousand-building-sources-supplemental.json';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const [base, heldout, stagings] = await Promise.all([
  read(BASE),
  read(HELDOUT),
  Promise.all(STAGINGS.map(async root => ({ root, manifest: await read(path.join(root, 'manifest.json')) })))
]);
const excluded = new Set([...base.records.map(item => item.buildingId), ...heldout.cases.map(item => item.buildingId)]);
const records = [], rejected = [], selectedBuildings = new Set(excluded);
for (const { root: stagingRoot, manifest: staging } of stagings) for (const row of staging.records || []) {
  if (selectedBuildings.has(row.buildingId)) {
    rejected.push({ id: row.id, buildingId: row.buildingId, reason: excluded.has(row.buildingId) ? 'base-or-heldout-building-exclusion' : 'duplicate-supplemental-building' });
    continue;
  }
  const tiers = {};
  let valid = true;
  for (const tier of ['full', 'ground']) {
    const source = row.images?.[tier];
    if (!source) { rejected.push({ id: row.id, buildingId: row.buildingId, tier, reason: 'missing-tier' }); valid = false; continue; }
    const file = path.join(stagingRoot, 'images', source.file);
    const bytes = await fs.readFile(file);
    const actual = sha(bytes);
    if (actual !== source.sha256 || !Number.isFinite(source.width) || !Number.isFinite(source.height) || !source.date) {
      rejected.push({ id: row.id, buildingId: row.buildingId, tier, reason: 'hash-dimension-date-mismatch', expectedSha256: source.sha256, actualSha256: actual }); valid = false; continue;
    }
    tiers[tier] = {
      path: path.relative(ROOT, file),
      sha256: actual,
      captureDate: source.date,
      width: source.width,
      height: source.height,
      bytes: bytes.length,
      sourceDimensions: source.sourceDimensions || null,
      plane: source.plane || null,
      panoramaId: source.panoramaId || null,
      panoramaSha256: source.panoramaSha256 || null
    };
  }
  if (!valid) continue;
  selectedBuildings.add(row.buildingId);
  records.push({
    observationId: row.id,
    sourceObservationId: row.id,
    buildingId: row.buildingId,
    renderBuildingId: row.buildingId,
    geometryRevision: null,
    evidenceKey: null,
    area: staging.areaId || (stagingRoot.includes('broader') ? 'da-costabuurt-v1' : 'da-costa-expansion-550m-v1'),
    address: row.address || null,
    street: row.street || null,
    wall: row.wall || null,
    wallWidthM: row.wallWidthM || null,
    groundNAP: row.groundNAP ?? null,
    surfaceIndices: Number.isInteger(row.wall?.index) ? [row.wall.index] : [],
    sourceEvidenceAreaId: staging.areaId || (stagingRoot.includes('broader') ? 'da-costabuurt-v1' : 'da-costa-expansion-550m-v1'),
    sourceInspection: 'not-performed',
    sourceBinding: 'isolated-supplemental-cached-hash-date-dimension-bound; registration pending',
    reuseRole: 'new-expansion-candidate',
    machineHints: { groundShopfront: 'unknown', wholeUsable: 'unknown' },
    tiers,
    sources: tiers
  });
}
records.sort((a, b) => a.buildingId.localeCompare(b.buildingId));
const combinedBuildings = base.records.length + records.length;
const result = {
  version: 1,
  manifestId: 'cached-expansion-thousand-building-supplemental-v1',
  generatedAt: new Date().toISOString(),
  purpose: 'isolated supplemental cached-photo crops; no source inspection, registration, or fidelity acceptance claimed',
  baseManifest: BASE,
  stagingManifests: STAGINGS.map(root => path.join(root, 'manifest.json')),
  targetBuildings: 1000,
  counts: {
    baseBuildings: base.records.length,
    supplementalUsableBuildings: records.length,
    combinedUniqueBuildings: combinedBuildings,
    remainingTargetGap: Math.max(0, 1000 - combinedBuildings),
    supplementalRejected: rejected.length,
    heldoutExcluded: heldout.cases.length,
    boundedTrancheAvailable: Math.min(100, records.length),
    downloads: stagings.reduce((sum, item) => sum + (item.manifest.downloads || 0), 0)
  },
  readiness: combinedBuildings >= 1000 ? 'target-available' : 'target-gap-explicit',
  exclusions: { heldoutBuildingIds: heldout.cases.map(item => item.buildingId).sort(), duplicateBaseBuildingIds: base.records.map(item => item.buildingId).sort() },
  records,
  rejected,
  limits: ['Supplemental records are source-bound cached crops only; no agent inspection was performed.', 'Only cached expansion geometry candidates are available; remaining target gap requires a wider area or new geometry inventory.', 'Registration and paid extraction remain separate stages.']
};
await fs.writeFile(OUTPUT, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output: OUTPUT, readiness: result.readiness, counts: result.counts }, null, 2));
