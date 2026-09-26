/** Activate an already staged candidate only after rechecking immutable evidence. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {digest,jsonDigest,verifyEvaluationArtifact} from './evaluation.js';
import {globalBudget} from '../../da-costa-block/global-budget.mjs';
async function immutable(file:string,bytes:Buffer){await fs.mkdir(path.dirname(file),{recursive:true});try{await fs.writeFile(file,bytes,{flag:'wx'});}catch(error:any){if(error.code!=='EEXIST'||digest(await fs.readFile(file))!==digest(bytes))throw error;}}
export async function activateCandidate(options:{releaseRoot:string;evaluationIndex:string;outputRoot:string;ledgerFile?:string;legacyLedgers?:string[]}) {
  const releaseRoot=path.resolve(options.releaseRoot),outputRoot=path.resolve(options.outputRoot);
  const bytes=await fs.readFile(path.join(releaseRoot,'manifest.json')),manifest=JSON.parse(bytes.toString());
  const descriptor=JSON.parse(await fs.readFile(path.join(releaseRoot,'candidate.json'),'utf8'));
  const candidate=descriptor.candidate;
  if(!candidate||manifest.releaseId!==candidate.releaseId||manifest.compilerHash!==candidate.compilerHash||jsonDigest(manifest.candidate)!==jsonDigest(candidate)||jsonDigest(descriptor.artifacts)!==candidate.artifactsSha256)throw Error('Staged candidate binding mismatch');
  if(releaseRoot!==path.join(outputRoot,'releases',candidate.releaseId))throw Error('Candidate must be staged in its immutable release directory');
  if(!Array.isArray(descriptor.artifacts)||!descriptor.artifacts.length)throw Error('Empty candidate artifact inventory');
  for(const ref of descriptor.artifacts){if(typeof ref.path!=='string'||path.isAbsolute(ref.path)||ref.path.split(/[\\/]/).includes('..'))throw Error('Invalid staged artifact path');if(digest(await fs.readFile(path.join(releaseRoot,ref.path)))!==ref.sha256)throw Error(`Stale/corrupt staged artifact: ${ref.path}`);}
  const evaluation=await verifyEvaluationArtifact(options.evaluationIndex,candidate);
  // A saved cost snapshot cannot authorize activation after new unresolved charges.
  const index=JSON.parse(await fs.readFile(options.evaluationIndex,'utf8'));
  const compiled=JSON.parse(await fs.readFile(path.resolve(path.dirname(options.evaluationIndex),index.evidence.compiled.path),'utf8'));
  if(compiled.manifest?.sha256!==digest(bytes))throw Error('Evaluated manifest does not match staged manifest');
  const ledger=JSON.parse(await fs.readFile(path.resolve(path.dirname(options.evaluationIndex),index.evidence.ledger.path),'utf8'));
  const live=await globalBudget({file:options.ledgerFile,legacyLedgers:options.legacyLedgers}).snapshot();
  if(live.entries.some((e:any)=>e.status!=='settled')||jsonDigest(live.entries)!==jsonDigest(ledger.entries))throw Error('Live cost ledger changed; recompute evaluation before activation');
  await immutable(path.join(outputRoot,'evaluations',candidate.releaseId,`${evaluation.indexSha256}.json`),Buffer.from(JSON.stringify(evaluation)));
  try{const prior=await fs.readFile(path.join(outputRoot,'current.json'));await immutable(path.join(outputRoot,'rollback',`${digest(prior)}.json`),prior);}catch(error:any){if(error.code!=='ENOENT')throw error;}
  const temporary=path.join(outputRoot,`current-${process.pid}-${crypto.randomUUID()}.tmp`);
  await fs.writeFile(temporary,bytes,{flag:'wx'});
  await fs.rename(temporary,path.join(outputRoot,'current.json'));
  return evaluation;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const flag=(name:string)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3);
  const releaseRoot=flag('release'),evaluationIndex=flag('evaluation-index'),outputRoot=flag('output-root')??'public/data/city-expansion';
  if(!releaseRoot||!evaluationIndex)throw Error('Usage: activate.ts --release=<staged directory> --evaluation-index=<index.json> [--output-root=public/data/city-expansion]');
  activateCandidate({releaseRoot,evaluationIndex,outputRoot}).then(r=>console.log(JSON.stringify({activated:r.candidate.releaseId}))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
