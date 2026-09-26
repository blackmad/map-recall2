/** Download and byte-audit only the panoramas in a frozen audit selection.
 * Requires --run. Never invokes a model or publishes appearance observations.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { loadAreaConfig } from '../da-costa-block/area-config.mjs';
import { atomicJson, digest } from '../da-costa-block/pipeline-state.mjs';
import { DEFAULT_AREA, selectPanoramaFromArgs } from './select-panorama-audit.mjs';

async function reusePool(sourceProfile='full'){
  const pool=path.resolve(sourceProfile==='full'?'.cache/city-appearance/shared-panoramas':'.cache/city-appearance/shared-panoramas-material-4000');await fs.mkdir(pool,{recursive:true});
  const roots=sourceProfile==='full'?['.cache/da-costa-neighbourhood/panoramas']:[];
  const areaRoot='.cache/city-appearance/areas';
  for(const name of await fs.readdir(areaRoot)){const root=path.join(areaRoot,name,'panorama-audit');let selections;try{selections=await fs.readdir(root);}catch(e){if(e.code==='ENOENT')continue;throw e;}for(const selection of selections){const manifest=await fs.readFile(path.join(root,selection,'selection.json'),'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if((manifest?.sourceProfile??'full')===sourceProfile)roots.push(path.join(root,selection,'evidence/panoramas'));}}
  for(const root of roots){let names;try{names=await fs.readdir(root);}catch(e){if(e.code==='ENOENT')continue;throw e;}for(const name of names.filter(n=>n.endsWith('.jpg'))){try{await fs.link(path.join(root,name),path.join(pool,name));}catch(e){if(e.code!=='EEXIST')throw e;}}}
  return pool;
}
const execFileAsync = promisify(execFile), sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const flag = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);

export async function auditEvidence(selection, evidenceRoot) {
  const manifestPath = path.join(evidenceRoot, 'manifest.json'), bytes = await fs.readFile(manifestPath), manifest = JSON.parse(bytes);
  if((selection.sourceProfile??'full')!==(manifest.sourceProfile??'full'))throw Error('Evidence panorama source profile mismatch');
  const expected = new Set(selection.records.map(record => record.id)), actual = new Set(manifest.records.map(record => record.id));
  const omitted = new Set(manifest.omitted.map(record => record.elevationId.replaceAll(':', '_')));
  if (actual.size !== manifest.records.length || omitted.size !== manifest.omitted.length ||
      [...actual].some(id => !expected.has(id) || omitted.has(id)) ||
      [...expected].some(id => !actual.has(id) && !omitted.has(id))) {
    throw Error(`Evidence mismatch: expected ${expected.size}, materialized ${actual.size}, omitted ${omitted.size}`);
  }
  const files = new Map(), dates = new Set(); let facadeLengthM = 0;
  for (const record of manifest.records) {
    facadeLengthM += record.wallWidthM;
    for (const image of Object.values(record.images)) {
      const crop = path.join(evidenceRoot, 'images', image.file), cropBytes = await fs.readFile(crop);
      if (sha256(cropBytes) !== image.sha256) throw Error(`Crop hash mismatch: ${image.file}`);
      files.set(crop, cropBytes.length); dates.add(image.date?.slice(0, 10));
      const panorama = path.join(evidenceRoot, 'panoramas', `${image.panoramaId}.jpg`), panoramaBytes = await fs.readFile(panorama);
      if (sha256(panoramaBytes) !== image.panoramaSha256) throw Error(`Panorama hash mismatch: ${image.panoramaId}`);
      files.set(panorama, panoramaBytes.length);
    }
  }
  return { version: 'panorama-source-audit-materialization/1', selectionHash: selection.selectionHash,
    manifestSha256: digest(bytes), selectedFrontages: expected.size, frontages: manifest.records.length, facadeLengthM, omitted: manifest.omitted.length,
    omittedRecords: manifest.omitted,
    uniquePanoramas: new Set(manifest.records.flatMap(record => Object.values(record.images).map(image => image.panoramaId))).size,
    sourceDates: [...dates].filter(Boolean).sort(), files: files.size, bytes: [...files.values()].reduce((sum, value) => sum + value, 0),
    byteAudit: 'passed', automatedCropPreflight: 'passed', visualSourceIdentity: 'pending-independent-review', paidCalls: 0,
    warning: 'Hash and nonblank-crop checks are not human confirmation of the correct building or usable framing.' };
}

async function main() {
  const area = await loadAreaConfig([`--area-config=${path.resolve(flag('area-config') ?? DEFAULT_AREA)}`]);
  const mode = flag('mode') ?? 'audit';
  const selected = await selectPanoramaFromArgs(area, process.argv.slice(2));
  const selection = selected.report;
  const evidenceRoot = path.join(selected.destination, 'evidence');
  if (!process.argv.includes('--run')) {
    console.log(JSON.stringify({ mode: 'dry-run', selectionHash: selection.selectionHash, frontages: selection.records.length,
      maxPanoramaDownloads: selection.uniqueProposedPanoramas, evidenceRoot, paidCalls: 0 }, null, 2)); return;
  }
  const pipeline = JSON.parse(await fs.readFile(path.join('.cache/city-appearance/areas', area.id, 'runs', selection.runHash, 'pipeline.json')));
  const elevationFile = path.join(selected.destination, 'elevation-ids.txt');
  await fs.writeFile(elevationFile, `${selection.elevationIds.join('\n')}\n`);
  const args = ['--import', 'tsx', 'scripts/da-costa-block/prepare-neighbourhood.ts', `--area-config=${path.resolve(flag('area-config') ?? DEFAULT_AREA)}`,
    `--block=${pipeline.jobs.compile.output.blockPath}`, `--out=${evidenceRoot}`, `--limit=${selection.cap}`,
    `--downloads=${selection.uniqueProposedPanoramas}`, `--reuse-panoramas=${await reusePool(selection.sourceProfile??'full')}`, `--elevation-file=${elevationFile}`,`--source-profile=${selection.sourceProfile??'full'}`];
  await execFileAsync(process.execPath, args, { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 });
  const report = await auditEvidence(selection, evidenceRoot);
  await atomicJson(path.join(selected.destination, 'source-audit.json'), report);
  console.log(JSON.stringify({ mode: 'materialized', evidenceRoot, ...report }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { process.stderr.write(`${error.stack ?? error.message}\n`); process.exitCode = 1; });
