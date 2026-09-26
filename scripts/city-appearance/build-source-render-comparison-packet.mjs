/**
 * Build a deterministic, source-bound comparison packet for a human review.
 * This is deliberately a pure packet builder: it does not call inference,
 * acquire imagery, or write a review decision.
 *
 *   node scripts/city-appearance/build-source-render-comparison-packet.mjs \
 *     --records=.cache/.../records.json --out=.cache/.../packet.json
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const list = value => Array.isArray(value) ? value : Array.isArray(value?.records) ? value.records : [];

const captureDate = record => record.captureDate ?? record.capturedAt ?? record.images?.ground?.date ?? record.images?.full?.date ?? null;
const sourceIdentity = record => ({
  observationId: record.id ?? null,
  buildingId: record.buildingId ?? record.renderBuildingId ?? null,
  renderBuildingId: record.renderBuildingId ?? record.buildingId ?? null,
  evidenceKey: record.evidenceKey ?? null,
  derivationKey: record.derivationKey ?? null,
  panoramaId: record.images?.ground?.panoramaId ?? record.images?.full?.panoramaId ?? record.panoramaId ?? null,
  captureDate: captureDate(record),
  sourceSha256: record.images?.ground?.panoramaSha256 ?? record.images?.full?.panoramaSha256 ?? null,
  cropSha256: record.images?.ground?.sha256 ?? record.images?.full?.sha256 ?? null,
});

const districtOf = record => record.district ?? record.areaDistrict ?? record.areaId ?? record.street ?? 'unassigned';
const classOf = record => {
  const sign = String(record.machineRoutingProposal?.signText ?? '').trim();
  if (sign && record.machineRoutingProposal?.signTextEligible === 'yes') return 'positive';
  if (record.effectiveProposal?.shopfront === 'no' || record.machineRoutingProposal?.groundType === 'residential') return 'negative';
  return 'unknown';
};
const sourceTierOf = record => record.sourceTier ?? record.tier ?? (record.images?.ground && record.images?.full ? 'ground+full' : record.images?.ground ? 'ground' : record.images?.full ? 'full' : 'missing');
const omissionsOf = record => {
  const omitted = [];
  const proposal = record.machineRoutingProposal ?? {};
  if (!String(proposal.signText ?? '').trim()) omitted.push('signText');
  if (proposal.signTextEligible === 'unknown') omitted.push('signText-uncertain');
  if (record.effectiveProposal?.shopfront === 'unknown' || record.effectiveProposal?.shopfront == null) omitted.push('shopfront');
  if (record.visualReview?.fieldEligibility?.signText === false) omitted.push('signText-withheld');
  if (!record.images?.ground) omitted.push('ground-source');
  return [...new Set(omitted)];
};

/** Join a source record to an optional render record without losing identity. */
export function synchronizeComparison(source, render = null) {
  const sourceId = sourceIdentity(source);
  const renderId = render ? sourceIdentity(render) : null;
  const same = renderId && sourceId.observationId === renderId.observationId
    && sourceId.buildingId === renderId.buildingId
    && sourceId.evidenceKey === renderId.evidenceKey
    && sourceId.derivationKey === renderId.derivationKey
    && sourceId.captureDate === renderId.captureDate;
  return {
    source: sourceId,
    render: renderId,
    synchronized: Boolean(same),
    reason: renderId ? (same ? null : 'source-render-identity-or-capture-mismatch') : 'render-record-omitted',
  };
}

/**
 * Select up to `limit` cases with a stable hash ordering, while preserving
 * positive/negative/unknown and district coverage where the input permits it.
 */
export function buildComparisonPacket(records, { renderRecords = [], limit = 30, seed = 'city-appearance-source-render-v1' } = {}) {
  const candidates = list(records).map(record => ({ record, key: `${districtOf(record)}\0${record.id ?? record.buildingId ?? ''}`, class: classOf(record), district: districtOf(record) }))
    .filter(item => item.record.id || item.record.buildingId)
    .sort((a, b) => sha256(`${seed}\0${a.key}`).localeCompare(sha256(`${seed}\0${b.key}`)) || a.key.localeCompare(b.key));
  const renders = new Map(list(renderRecords).map(record => [record.id ?? record.buildingId, record]));
  const selected = [];
  // Round-robin classes and districts avoids a packet made entirely of easy
  // machine positives when one source family dominates the inventory.
  const groups = new Map();
  for (const item of candidates) { const key = `${item.class}\0${item.district}`; (groups.get(key) ?? groups.set(key, []).get(key)).push(item); }
  while (selected.length < Math.min(limit, candidates.length) && groups.size) {
    for (const [key, group] of groups) {
      if (!group.length) { groups.delete(key); continue; }
      selected.push(group.shift());
      if (selected.length >= limit) break;
    }
  }
  const cases = selected.map((item, index) => {
    const render = renders.get(item.record.id ?? item.record.buildingId) ?? null;
    const sync = synchronizeComparison(item.record, render);
    return { caseId: `case-${String(index + 1).padStart(2, '0')}`, district: item.district, label: item.class, sourceTier: sourceTierOf(item.record), omissions: omissionsOf(item.record), comparison: sync, humanReview: { status: 'pending', decision: null, reviewer: null, notes: null } };
  });
  return {
    version: 1,
    packetType: 'source-render-comparison',
    seed,
    limit,
    createdFrom: sha256(JSON.stringify(list(records).map(sourceIdentity).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))),
    humanReviewSeparate: true,
    cases,
    summary: { requested: limit, selected: cases.length, synchronized: cases.filter(item => item.comparison.synchronized).length, classes: Object.fromEntries(['positive', 'negative', 'unknown'].map(label => [label, cases.filter(item => item.label === label).length])), districts: [...new Set(cases.map(item => item.district))].sort() },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const recordsFile = arg('records');
  if (!recordsFile) throw new Error('Usage: --records=<JSON> [--render=<JSON>] [--out=<JSON>] [--limit=30]');
  const records = await readJson(recordsFile);
  const render = arg('render') ? await readJson(arg('render')) : [];
  const packet = buildComparisonPacket(records, { renderRecords: render, limit: Number(arg('limit') ?? 30), seed: arg('seed') ?? undefined });
  const output = JSON.stringify(packet, null, 2) + '\n';
  if (arg('out')) await fs.writeFile(path.resolve(arg('out')), output, { flag: 'wx' });
  process.stdout.write(output);
}
