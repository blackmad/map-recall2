import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicJson } from '../../da-costa-block/pipeline-state.mjs';
import { validateRunManifest } from './extraction-contract.mjs';
import { materializeFacadeDescriptions } from './materialize.mjs';

const flag = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const required = name => { const value = flag(name); if (!value) throw Error(`--${name}=<file> is required`); return path.resolve(value); };
const manifestPath = required('manifest');
const analysesPath = required('analyses');
const outputPath = required('out');
const preflight = process.argv.includes('--preflight');
const recordsPath = preflight ? null : required('records');
if (recordsPath && outputPath === recordsPath) throw Error('Materialization output must be staged separately from its input');
const [manifest, analysisCache] = await Promise.all([
  fs.readFile(manifestPath, 'utf8').then(JSON.parse),
  fs.readFile(analysesPath, 'utf8').then(JSON.parse),
]);
const baseline = JSON.parse(await fs.readFile(new URL('./baseline.json', import.meta.url), 'utf8'));
const validated = await validateRunManifest(manifest, manifestPath, baseline);
if (!Array.isArray(analysisCache.results)) throw Error('Invalid analysis cache');
if (preflight) {
  const cachedKeys = new Set(analysisCache.results.filter(value => value.status === 'complete').map(value => value.key));
  const artifact = {
    version: 1, mode: 'materialization-preflight', activeSetId: validated.activeSet.id, activeSetSha256: validated.activeSet.sha256,
    registeredSourceTiers: validated.requests.length, cachedRegisteredAnalyses: validated.requests.filter(value => cachedKeys.has(value.key)).length,
    attached: [], omitted: validated.abstentions.map(value => ({ observationId: value.observationId, tier: value.tier, reason: `registration-${value.status}`, detail: value.reason })),
  };
  await atomicJson(outputPath, artifact);
  console.log(JSON.stringify({ output: outputPath, attached: 0, omitted: artifact.omitted.length }));
  process.exit(0);
}
const recordsDocument = JSON.parse(await fs.readFile(recordsPath, 'utf8'));
const records = Array.isArray(recordsDocument) ? recordsDocument : recordsDocument.records;
if (!Array.isArray(records)) throw Error('Records document must be an array or contain records[]');
const result = materializeFacadeDescriptions({ manifest, analyses: analysisCache.results, records });
const staged = Array.isArray(recordsDocument) ? result.records : { ...recordsDocument, records: result.records };
await atomicJson(outputPath, staged);
await atomicJson(`${outputPath}.materialization.json`, { ...result.report, manifest: path.relative(path.dirname(outputPath), manifestPath), analyses: path.relative(path.dirname(outputPath), analysesPath), input: path.relative(path.dirname(outputPath), recordsPath) });
console.log(JSON.stringify({ output: outputPath, attached: result.report.attached.length, omitted: result.report.omitted.length }));
