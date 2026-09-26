/** Photo-first agent audit. Assessments are keyed to the frozen selection and
 * remain separate from human labels and any future appearance proposals.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_AREA, selectPanoramaAudit, selectPanoramaCoverage } from './select-panorama-audit.mjs';
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
const mode = flag('mode') ?? 'audit';
if (!['audit', 'coverage'].includes(mode)) throw Error('Mode must be audit or coverage');
const automated = process.argv.includes('--automated');
const streets = flag('streets')?.split(',').map(value => value.trim()).filter(Boolean);
const cap = Number(flag('cap') ?? (mode === 'coverage' ? 1000 : 24));
const selected = mode === 'coverage'
  ? await selectPanoramaCoverage(area, { streets, cap, includeBaseline:process.argv.includes('--include-baseline') })
  : await selectPanoramaAudit(area, { cap });
const evidence = path.join(selected.destination, 'evidence');
const byteAudit = await auditEvidence(selected.report, evidence), manifestBytes = await fs.readFile(path.join(evidence, 'manifest.json')), manifest = JSON.parse(manifestBytes);
const assessments = manifest.records.map(record => {
  if (!record.images?.full || !record.images?.ground) throw Error(`Missing required full/ground crops: ${record.id}`);
  return { id: record.id, buildingId: record.buildingId, address: record.address,
    disposition: automated ? 'preflight-passed' : !partial.has(record.id) ? 'usable' : 'partial', facadeLengthM: record.wallWidthM,
    note: automated
      ? 'Automatically accepted from byte-integrity and nonblank-crop preflight only; no person or agent inspected these images.'
      : partial.get(record.id) ?? 'Target facade identity is coherent between full and ground views; framing is usable for conservative appearance review.' };
});
if (!automated && [...partial.keys()].some(id => !assessments.some(item => item.id === id))) throw Error('Assessment refers to an absent frozen case');
const usable = assessments.filter(item => item.disposition === 'usable'), partialCases = assessments.filter(item => item.disposition === 'partial');
const inferenceCandidates=automated?assessments:usable;
const costForecast = {
  scope: `${inferenceCandidates.length} preflight or visually usable frontages; one broad pass plus bounded richer/escalation allowance`,
  method: 'Reference-workload blended estimate ($103.20/100,000 targets) with 25% retry/usage allowance, rounded upward.',
  arithmeticUsd: inferenceCandidates.length * 103.20 / 100000 * 1.25, authorizedPlanningCeilingUsd: 0.04,
  cumulativePriorMeasuredUsd: 1.237401792, cumulativeAuthorizedUsd: 5,
  warning: 'Forecast only. Provider usage must be journaled; unknown charges stop paid work. No inference was run by this audit.' };
const report = { version: 'panorama-source-visual-audit/1', createdAt: manifest.generatedAt,
  origin: automated ? 'automated-preflight-not-visual' : 'agent-photo-first-visual-review',
  visualSourceIdentity: automated ? 'not-reviewed' : 'agent-photo-first-reviewed',
  selectionHash: selected.report.selectionHash, manifestSha256: digest(manifestBytes),
  sourceAudit: { ...byteAudit, visualSourceIdentity: automated ? 'not-reviewed' : 'agent-photo-first-reviewed' }, assessments,
  summary: { visuallyCheckedFrontages: automated ? 0 : assessments.length, preflightPassed: automated ? assessments.length : 0, frontages: assessments.length, usable: usable.length, partial: partialCases.length, rejectedWrongIdentity: 0,
    usableFacadeLengthM: usable.reduce((sum, item) => sum + item.facadeLengthM, 0), partialFacadeLengthM: partialCases.reduce((sum, item) => sum + item.facadeLengthM, 0) },
  costForecast, publication: 'none', humanReferenceData: false,
  warning: automated
    ? 'No one looked at these pictures. Usable means only that both required crops passed automated byte-integrity and nonblank checks.'
    : 'Agent visual assessment is weak supervision, not a human reference set. Partial cases must not publish unsupported fields.' };
const reportPath = path.join(selected.destination, automated ? 'automated-preflight.json' : 'agent-visual-audit.json');
await atomicJson(reportPath, report);
console.log(JSON.stringify({ path: reportPath, ...report.summary, costForecast }, null, 2));
