/** Exhaustive, resumable district panorama rectification. No model calls or publication. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { loadDistrictConfig } from './district-config.mjs';
import { planDistrictCoverageQueue, selectPanoramaDistrictCoverage } from './select-panorama-audit.mjs';
import { auditEvidence } from './materialize-panorama-audit.mjs';
import { atomicJson, digest } from '../da-costa-block/pipeline-state.mjs';

const exec = promisify(execFile);
const flag = (args, name) => args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const integer = (value, label, min, max) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw Error(`${label} must be ${min}–${max}`);
  return number;
};
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));

export async function planDistrictRectification(args = process.argv.slice(2)) {
  const configFile = path.resolve(flag(args, 'district-config') ?? 'scripts/city-appearance/districts/da-costa-jordaan-v1.json');
  const district = await loadDistrictConfig(configFile);
  const batchSize = integer(flag(args, 'batch-size') ?? 100, 'Batch size', 1, 250);
  const fromBatch = integer(flag(args, 'from-batch') ?? 0, 'First batch', 0, 1000000);
  const maxBatches = integer(flag(args, 'max-batches') ?? 1000000, 'Maximum batches', 1, 1000000);
  const sourceProfile=flag(args,'source-profile')??'full';if(!['full','material-4000'].includes(sourceProfile))throw Error('Unknown panorama source profile');
  const areaId = flag(args, 'area-id');
  if (areaId && !district.areas.some(entry => entry.id === areaId)) throw Error(`Unknown district area: ${areaId}`);
  const areas = [];
  const sharedPool = new Set(await fs.readdir(sourceProfile==='full'?'.cache/city-appearance/shared-panoramas':'.cache/city-appearance/shared-panoramas-material-4000').catch(error => {
    if (error.code === 'ENOENT') return []; throw error;
  }));
  const allPanoramas = new Set();
  for (const entry of district.areas.filter(value => !areaId || value.id === areaId)) {
    const queue = await planDistrictCoverageQueue({ ...entry.area, configHash:entry.configHash }, { districtConfigFile:configFile });
    const panoramas = new Set(queue.records.flatMap(record => [record.fullPanorama, record.groundPanorama]));
    for (const id of panoramas) allPanoramas.add(id);
    areas.push({ id:entry.id, district:entry.district, areaConfig:entry.config, queueHash:queue.queueHash,
      inventoryFrontages:queue.inventoryFrontages, districtOwners:queue.districtOwners, frontageOwners:queue.frontageOwners,
      eligibleFrontages:queue.eligibleFrontages, batches:Math.ceil(queue.eligibleFrontages / batchSize),
      uniqueProposedPanoramas:panoramas.size,
      missingFromSharedPool:[...panoramas].filter(id => !sharedPool.has(`${id}.jpg`)).length,
      noEligibleImageryOwnerCount:queue.noEligibleImageryOwners.length,
      noEligibleImageryOwners:queue.noEligibleImageryOwners });
  }
  const missingPanoramas = [...allPanoramas].filter(id => !sharedPool.has(`${id}.jpg`)).length;
  return { version:1, mode:'plan', districtId:district.id, districtConfigHash:district.configHash,
    configFile, sourceProfile, batchSize, fromBatch, maxBatches, areas,
    eligibleFrontages:areas.reduce((sum, area) => sum + area.eligibleFrontages, 0),
    districtOwners:areas.reduce((sum, area) => sum + area.districtOwners, 0),
    frontageOwners:areas.reduce((sum, area) => sum + area.frontageOwners, 0),
    uniqueProposedPanoramas:allPanoramas.size, missingFromSharedPool:missingPanoramas,
    storageEstimate:{assumedMeanPanoramaBytes:sourceProfile==='full'?3.1*1024*1024:908454,missingPanoramaBytes:Math.round(missingPanoramas*(sourceProfile==='full'?3.1*1024*1024:908454)),basis:sourceProfile==='full'?'approximate cached full-panorama mean':'first 20 native 4000px panoramas; forecast only; excludes crops and variance'},
    sourceIdentity:'frozen municipal polygons and publisher owner assignment',
    outputs:'local rectified source crops and automated byte preflight only', paidCalls:0, publication:'none' };
}

async function completed(selection) {
  try {
    const root = selection.destination, report = await read(path.join(root, 'source-audit.json')),
      preflight = await read(path.join(root, 'automated-preflight.json')),
      bytes = await fs.readFile(path.join(root, 'evidence/manifest.json'));
    if (report.selectionHash !== selection.report.selectionHash || report.manifestSha256 !== digest(bytes) ||
        preflight.selectionHash !== selection.report.selectionHash || preflight.manifestSha256 !== digest(bytes) ||
        preflight.visualSourceIdentity !== 'not-reviewed' ||
        preflight.summary.frontages !== report.frontages || report.frontages+report.omitted !== selection.report.records.length) return false;
    await auditEvidence(selection.report, path.join(root, 'evidence'));
    return true;
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function runDistrictRectification(plan) {
  const district = await loadDistrictConfig(plan.configFile);
  if (district.configHash !== plan.districtConfigHash) throw Error('District config changed since planning');
  const output = path.resolve('.cache/city-appearance/districts', plan.districtId, 'rectification', `${plan.districtConfigHash}-${plan.sourceProfile}-batch-${plan.batchSize}.json`);
  const report = { ...plan, mode:'run', generatedAt:new Date().toISOString(), batches:[], paidCalls:0, publication:'none' };
  const checkpoint=async()=>{const completed=report.batches.filter(row=>Number.isInteger(row.rectifiedFrontages));report.progress={completedBatches:completed.length,rectifiedFrontages:completed.reduce((n,row)=>n+row.rectifiedFrontages,0),omittedFrontages:completed.reduce((n,row)=>n+row.omittedFrontages,0),pendingFrontages:plan.eligibleFrontages-completed.reduce((n,row)=>n+row.frontages,0),visuallyAcceptedFrontages:0};await atomicJson(output,report);};
  const launch = async (script, args) => exec(process.execPath, ['--import', 'tsx', script, ...args], { cwd:process.cwd(), maxBuffer:8 * 1024 * 1024 });
  let processed = 0;
  for (const area of plan.areas) for (let index=plan.fromBatch; index<area.batches && processed<plan.maxBatches; index++) {
    const member = district.areas.find(entry => entry.id === area.id);
    if (!member) throw Error(`District area changed: ${area.id}`);
    const selected = await selectPanoramaDistrictCoverage({ ...member.area, configHash:member.configHash }, { districtConfigFile:plan.configFile, batchSize:plan.batchSize, batchIndex:index, sourceProfile:plan.sourceProfile });
    if (selected.report.queueHash !== area.queueHash) throw Error(`District queue changed: ${area.id}`);
    const args = [`--area-config=${area.areaConfig}`, '--mode=district-coverage', `--district-config=${plan.configFile}`,
      `--batch-size=${plan.batchSize}`, `--batch-index=${index}`,`--source-profile=${plan.sourceProfile}`];
    const row = { areaId:area.id, batchIndex:index, selectionHash:selected.report.selectionHash,
      frontages:selected.report.records.length, status:'running' };
    report.batches.push(row); await checkpoint();
    try {
      if (await completed(selected)) row.status = 'reused-verified';
      else {
        await launch('scripts/city-appearance/materialize-panorama-audit.mjs', [...args, '--run']);
        await launch('scripts/city-appearance/record-panorama-source-audit.mjs', [...args, '--automated']);
        if (!await completed(selected)) throw Error(`Batch did not pass source-integrity preflight: ${area.id}/${index}`);
        row.status = 'rectified-and-preflighted';
      }
      const sourceAudit = await read(path.join(selected.destination, 'source-audit.json'));
      row.rectifiedFrontages = sourceAudit.frontages;
      row.omittedFrontages = sourceAudit.omitted;if(sourceAudit.omitted)row.status='rectified-with-recorded-omissions';
      row.uniquePanoramas = sourceAudit.uniquePanoramas;
      processed++;
      await checkpoint();
    } catch (error) {
      row.status = 'failed'; row.error = String(error.message ?? error); await checkpoint(); throw error;
    }
  }
  return { ...report, reportPath:output, processedBatches:processed };
}

async function main() {
  const args = process.argv.slice(2), plan = await planDistrictRectification(args);
  const retries=integer(flag(args,'retry-transient')??0,'Transient retries',0,6);
  console.log(JSON.stringify(args.includes('--run') || args.includes('--resume')
    ? await withTransientRetries(()=>runDistrictRectification(plan),retries)
    : plan, null, 2));
}

export function isTransientRectificationError(error) {
  const message=String(error?.message??error);
  if(/hash mismatch|integrity|disk-space-reserve|ENOSPC|EACCES|config changed|queue changed/i.test(message))return false;
  return /panorama-http-(429|5\d\d)|fetch failed|TimeoutError|UND_ERR_CONNECT_TIMEOUT|ECONNRESET|ETIMEDOUT|EAI_AGAIN/.test(message);
}

export async function withTransientRetries(run,retries,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))) {
  for(let attempt=0;;attempt++){
    try{return await run();}
    catch(error){
      if(attempt>=retries||!isTransientRectificationError(error))throw error;
      const delay=Math.min(300000,30000*2**attempt);
      process.stderr.write(`Transient rectification failure; resuming verified evidence in ${delay/1000}s (${attempt+1}/${retries})\n`);
      await wait(delay);
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error => { process.stderr.write(`${error.stack ?? error.message}\n`); process.exitCode = 1; });
