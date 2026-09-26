import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { routingBindingDisposition } from './routing-result-bindings.mjs';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const directories=async root=>{try{return(await fs.readdir(root,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name).sort();}catch(e){if(e.code==='ENOENT')return [];throw e;}};
export async function collectReusableRoutingIds(excludedInputSetHash,root='.cache/city-appearance/areas'){
  const ids=new Set();
  for(const area of await directories(root))for(const selection of await directories(path.join(root,area,'panorama-audit'))){
    const dir=path.join(root,area,'panorama-audit',selection);let manifest,sourceHash;
    try{const bytes=await fs.readFile(path.join(dir,'evidence/manifest.json'));manifest=JSON.parse(bytes);sourceHash=hash(bytes);const preflight=JSON.parse(await fs.readFile(path.join(dir,'automated-preflight.json')));if(preflight.manifestSha256!==sourceHash)continue;}catch{continue;}
    for(const inputSet of await directories(path.join(dir,'routing-inputs'))){
      if(inputSet===excludedInputSetHash)continue;
      const inputRoot=path.join(dir,'routing-inputs',inputSet);let inputs,report;try{inputs=JSON.parse(await fs.readFile(path.join(inputRoot,'manifest.json')));report=JSON.parse(await fs.readFile(path.join(inputRoot,'machine-routing/results.json')));}catch{continue;}
      for(const result of report.results){const record=manifest.records.find(r=>r.id===result.id);if(routingBindingDisposition(record,result,inputs,report,sourceHash)!=='bound')continue;let valid=true;
        for(const image of Object.values(record.images))try{if(hash(await fs.readFile(path.join(dir,'evidence/images',image.file)))!==image.sha256)valid=false;}catch{valid=false;}
        const input=inputs.items.find(r=>r.id===result.id);for(const image of Object.values(input.images))try{if(hash(await fs.readFile(path.join(inputRoot,'images',image.file)))!==image.sha256)valid=false;}catch{valid=false;}
        if(valid)ids.add(result.id);
      }
    }
  }
  return [...ids].sort();
}
