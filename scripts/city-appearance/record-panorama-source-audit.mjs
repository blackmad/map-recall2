/** Photo-first agent audit. Assessments are keyed to the frozen selection and
 * remain separate from human labels and any future appearance proposals.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_AREA, selectPanoramaAudit } from './select-panorama-audit.mjs';
import { auditEvidence } from './materialize-panorama-audit.mjs';
import { loadAreaConfig } from '../da-costa-block/area-config.mjs';
import { atomicJson, digest } from '../da-costa-block/pipeline-state.mjs';

const partial = new Map([
  ['0363100012160910_e_1mj364z', 'Ground view is substantially blocked by a parked vehicle; identity and upper facade remain clear.'],
  ['0363100012127485_e_1w0ttzw', 'Ground view is substantially obscured by a tree canopy; broad facade identity remains clear.'],
  ['0363100012160703_e_11jm8u0', 'Scaffolding covers much of the upper facade; ground frontage remains attributable.'],
  ['0363100012153291_e_0apgoy6', 'Full view is dark and vegetation-obscured; ground view supports identity but not complete appearance.'],
]);

const flag = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const area = await loadAreaConfig([`--area-config=${path.resolve(flag('area-config') ?? DEFAULT_AREA)}`]);
const selected = await selectPanoramaAudit(area, { cap: Number(flag('cap') ?? 24) }), evidence = path.join(selected.destination, 'evidence');
const byteAudit = await auditEvidence(selected.report, evidence), manifestBytes = await fs.readFile(path.join(evidence, 'manifest.json')), manifest = JSON.parse(manifestBytes);
const assessments = manifest.records.map(record => ({ id: record.id, buildingId: record.buildingId, address: record.address,
  disposition: partial.has(record.id) ? 'partial' : 'usable', facadeLengthM: record.wallWidthM,
  note: partial.get(record.id) ?? 'Target facade identity is coherent between full and ground views; framing is usable for conservative appearance review.' }));
if ([...partial.keys()].some(id => !assessments.some(item => item.id === id))) throw Error('Assessment refers to an absent frozen case');
const usable = assessments.filter(item => item.disposition === 'usable'), partialCases = assessments.filter(item => item.disposition === 'partial');
const costForecast = {
  scope: `${usable.length} usable frontages; one broad pass plus bounded richer/escalation allowance`,
  method: 'Reference-workload blended estimate ($103.20/100,000 targets) with 25% retry/usage allowance, rounded upward.',
  arithmeticUsd: usable.length * 103.20 / 100000 * 1.25, authorizedPlanningCeilingUsd: 0.04,
  cumulativePriorMeasuredUsd: 1.237401792, cumulativeAuthorizedUsd: 5,
  warning: 'Forecast only. Provider usage must be journaled; unknown charges stop paid work. No inference was run by this audit.' };
const report = { version: 'panorama-source-visual-audit/1', createdAt: new Date().toISOString(), origin: 'agent-photo-first-visual-review',
  selectionHash: selected.report.selectionHash, manifestSha256: digest(manifestBytes), sourceAudit: { ...byteAudit, visualSourceIdentity: 'agent-photo-first-reviewed' }, assessments,
  summary: { frontages: assessments.length, usable: usable.length, partial: partialCases.length, rejectedWrongIdentity: 0,
    usableFacadeLengthM: usable.reduce((sum, item) => sum + item.facadeLengthM, 0), partialFacadeLengthM: partialCases.reduce((sum, item) => sum + item.facadeLengthM, 0) },
  costForecast, publication: 'none', humanReferenceData: false,
  warning: 'Agent visual assessment is weak supervision, not a human reference set. Partial cases must not publish unsupported fields.' };
await atomicJson(path.join(selected.destination, 'agent-visual-audit.json'), report);
console.log(JSON.stringify({ path: path.join(selected.destination, 'agent-visual-audit.json'), ...report.summary, costForecast }, null, 2));
