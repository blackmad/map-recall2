/** Small sequential resumable inference batches; the child owns atomic spend reservations. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {collectReusableRoutingIds} from './collect-routing-reuse.mjs';
import {spawn} from 'node:child_process';
import {planRoutingInputs} from './prepare-routing-inputs.mjs';
const args=process.argv.slice(2),flag=name=>args.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3);
const plan=await planRoutingInputs(args),manifest=JSON.parse(await fs.readFile(path.join(plan.outputRoot,'manifest.json'),'utf8'));
const reused=new Set(args.includes('--reuse-cache')?await collectReusableRoutingIds(plan.inputSetHash):flag('reuse-result-ids')?JSON.parse(await fs.readFile(flag('reuse-result-ids'),'utf8')):[]);
let reuseFile=flag('reuse-result-ids');if(args.includes('--reuse-cache')&&args.includes('--run')){reuseFile=path.join(plan.outputRoot,'reused-frontage-ids.json');await fs.writeFile(reuseFile,JSON.stringify([...reused].sort()));}
const eligible=manifest.items.filter(r=>!reused.has(r.id)).length,batchSize=Number(flag('batch-size')??25);
if(!Number.isInteger(batchSize)||batchSize<1||batchSize>25)throw Error('Batch size must be 1–25');
console.log(JSON.stringify({area:plan.area.id,eligible,reused:manifest.items.length-eligible,batchSize,mode:args.includes('--run')?'run':'plan'}));
if(args.includes('--run'))for(let limit=Math.min(batchSize,eligible);limit>0;limit=Math.min(limit+batchSize,eligible)){
  const childArgs=args.filter(v=>!v.startsWith('--limit=')&&!v.startsWith('--batch-size=')&&!v.startsWith('--reuse-result-ids='));if(reuseFile)childArgs.push(`--reuse-result-ids=${reuseFile}`);
  await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/city-appearance/infer-routing-inputs.mjs',...childArgs,`--limit=${limit}`],{stdio:'inherit'});child.on('error',reject);child.on('exit',(code,signal)=>code===0?resolve():reject(Error(`Inference batch stopped (${code??signal}); inspect journal before resuming`)));});
  if(limit===eligible)break;
}
