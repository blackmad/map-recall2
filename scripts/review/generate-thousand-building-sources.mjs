#!/usr/bin/env node
/** Build a deterministic, source-bound expansion extraction manifest. No paid work. */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const ROOT = path.resolve('.');
const OUTPUT = 'scripts/review/thousand-building-sources.json';
const CURRENT = 'public/data/city-expansion/current.json';
const HELDOUT = 'scripts/city-appearance/fidelity/heldout-source-inspection.json';
const ACTIVE = 'scripts/city-appearance/fidelity/active-development-manifest.json';
const AREAS = '.cache/city-appearance/areas';
const TARGET = Number(process.env.SOURCE_BUILDING_TARGET || 1000);
const TRANCHE = Number(process.env.SOURCE_BUILDING_TRANCHE || 100);

const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const sha256File = async file => {
  const hash = crypto.createHash('sha256');
  hash.update(await fs.readFile(file));
  return hash.digest('hex');
};
const walk = async directory => {
  const out = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...await walk(file));
    else if (entry.name === 'manifest.json' && file.includes(`${path.sep}panorama-audit${path.sep}`) && !file.includes(`${path.sep}routing-inputs${path.sep}`)) out.push(file);
  }
  return out.sort();
};
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

const [current, heldout, active] = await Promise.all([readJson(CURRENT), readJson(HELDOUT), readJson(ACTIVE)]);
const heldoutBuildingIds = new Set((heldout.cases || []).map(item => item.buildingId).filter(Boolean));
const developmentBuildingIds = new Set((active.cases || []).map(item => item.buildingId).filter(Boolean));
const manifests = await walk(AREAS);
const sourceRecords = [];
const missing = [];
for (const manifestPath of manifests) {
  const manifest = await readJson(manifestPath);
  const evidenceRoot = path.dirname(manifestPath);
  for (const record of manifest.records || []) {
    const full = record.images?.full;
    const ground = record.images?.ground;
    if (!record.buildingId || !record.id || !full || !ground) {
      missing.push({ id: record.id, buildingId: record.buildingId, reason: 'missing-full-or-ground-tier' });
      continue;
    }
    const tiers = {};
    let usable = true;
    for (const [tier, image] of Object.entries({ full, ground })) {
      const file = path.join(evidenceRoot, 'images', image.file);
      try {
        const stat = await fs.stat(file);
        const actualHash = await sha256File(file);
        if (actualHash !== image.sha256 || !Number.isFinite(image.width) || !Number.isFinite(image.height) || !validDate(image.date)) {
          missing.push({ id: record.id, buildingId: record.buildingId, tier, reason: 'hash-dimension-or-date-mismatch', expectedSha256: image.sha256, actualSha256: actualHash });
          usable = false;
          continue;
        }
        tiers[tier] = {
          path: path.relative(ROOT, file),
          sha256: actualHash,
          captureDate: image.date,
          width: image.width,
          height: image.height,
          bytes: stat.size,
          sourceDimensions: image.sourceDimensions || null,
          plane: image.plane || null,
          panoramaId: image.panoramaId || null,
          panoramaSha256: image.panoramaSha256 || null
        };
      } catch {
        missing.push({ id: record.id, buildingId: record.buildingId, tier, reason: 'cached-image-missing', path: path.relative(ROOT, file) });
        usable = false;
      }
    }
    if (usable) sourceRecords.push({ record, tiers, area: evidenceRoot.split(path.sep).at(-4) || 'unknown', manifestPath: path.relative(ROOT, manifestPath) });
  }
}

// One source observation per building. The ranking only expresses source completeness
// and the machine proposal's ground-facade hint; it never treats street or proposal as
// an architectural truth and never claims human source inspection.
const byBuilding = new Map();
for (const candidate of sourceRecords) {
  if (heldoutBuildingIds.has(candidate.record.buildingId)) continue;
  const existing = byBuilding.get(candidate.record.buildingId);
  const shopHint = candidate.record.effectiveProposal?.shopfront === 'yes' ? 1 : 0;
  const score = [shopHint, candidate.record.agentSourceAudit?.disposition === 'usable' ? 1 : 0, candidate.record.wallWidthM || 0, candidate.record.id].join('|');
  if (!existing || score > existing.score) byBuilding.set(candidate.record.buildingId, { ...candidate, score });
}
const ordered = [...byBuilding.values()].sort((a, b) => a.record.buildingId.localeCompare(b.record.buildingId));
const selected = ordered.slice(0, TARGET);
const tranche = selected.slice(0, Math.min(TRANCHE, selected.length));
const records = selected.map((candidate, index) => {
  const r = candidate.record;
  return {
    ordinal: index + 1,
    observationId: r.id,
    sourceObservationId: r.id,
    buildingId: r.buildingId,
    renderBuildingId: r.renderBuildingId || r.buildingId,
    geometryRevision: r.geometryRevision || null,
    evidenceKey: r.evidenceKey || null,
    area: candidate.area,
    address: r.address || null,
    street: r.street || null,
    wall: r.wall || null,
    wallWidthM: r.wallWidthM || r.wall?.lengthM || null,
    groundNAP: r.groundNAP ?? null,
    surfaceIndices: r.renderSurfaceIndices || (Number.isInteger(r.wall?.index) ? [r.wall.index] : []),
    sourceEvidenceAreaId: r.evidenceAreaId || null,
    sourceInspection: 'not-performed',
    sourceBinding: 'cached-hash-date-dimension-bound; registration pending',
    reuseRole: developmentBuildingIds.has(r.buildingId) ? 'development-training-reuse' : 'new-expansion-candidate',
    machineHints: { groundShopfront: r.effectiveProposal?.shopfront || 'unknown', wholeUsable: r.effectiveProposal?.wholeUsable || 'unknown' },
    tiers: candidate.tiers,
    sources: candidate.tiers
  };
});
const manifest = {
  version: 1,
  manifestId: 'cached-expansion-thousand-building-source-batch-v1',
  generatedAt: new Date().toISOString(),
  purpose: 'bounded cached-photo source inventory for expansion extraction; no source inspection or registration acceptance claimed',
  targetBuildings: TARGET,
  requestedTranche: Math.min(TRANCHE, selected.length),
  activeCurrentRelease: { releaseId: current.releaseId, path: CURRENT },
  districts: ['Da Costabuurt', 'Jordaan'],
  inputEvidenceManifests: manifests.map(file => ({ path: path.relative(ROOT, file) })),
  exclusions: { heldoutBuildingCount: heldoutBuildingIds.size, heldoutBuildingIds: [...heldoutBuildingIds].sort(), originalTwelveOutstanding: true },
  selectionPolicy: 'unique building ID; both full and ground cached tiers; exact file hash/date/dimensions; deterministic building ID order after source completeness ranking',
  counts: {
    evidenceManifestFiles: manifests.length,
    usableSourceObservations: sourceRecords.length,
    uniqueBuildingsBeforeHeldoutExclusion: new Set(sourceRecords.map(item => item.record.buildingId)).size,
    uniqueBuildingsAfterHeldoutExclusion: ordered.length,
    selectedBuildings: selected.length,
    requestedTargetGap: Math.max(0, TARGET - selected.length),
    boundedTranche: tranche.length,
    missingOrRejectedSourceRows: missing.length,
    developmentTrainingReuse: records.filter(item => item.reuseRole === 'development-training-reuse').length
  },
  readiness: selected.length >= TARGET ? 'target-available' : selected.length >= 100 ? 'bounded-tranche-available-target-gap' : 'insufficient-for-100-tranche',
  records,
  trancheObservationIds: records.slice(0, Math.min(TRANCHE, records.length)).map(item => item.observationId),
  missingOrRejected: missing.slice(0, 200),
  missingOrRejectedTotal: missing.length,
  limits: [
    'Cached source identity and byte hashes are validated; no agent has inspected these photos in this batch.',
    'Registration, wall alignment, opening annotation, and reconstruction fidelity remain unresolved.',
    'Street names and machine proposals are retained as source metadata/hints only and are not typology claims.',
    'The batch is limited by cached evidence availability; no new images or paid extraction were requested.'
  ]
};
await fs.writeFile(OUTPUT, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output: OUTPUT, readiness: manifest.readiness, counts: manifest.counts }, null, 2));
