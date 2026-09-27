import fs from 'node:fs/promises';
const root='.cache/facade-assessment/block-assemblies-v1';
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const geometry=await read(root+'/geometry-report.json');const inventory=await read('review-data/facade-vector-pilot/block-assemblies-v1/inventory.json');
const receipts=[];for(const name of ['mai-clean','mai-clean-v2','banana-clean','banana-masks','classification/strip1','classification/awning']){const r=await read(root+'/'+name+'.json');receipts.push({name,status:r.status,model:r.model,costUsd:r.actualCostUsd??r.usage?.cost??null,error:r.error??null,inputSha256:r.inputSha256??r.inputs?.source?.sha256});}
const alignment=await read(root+'/layer-alignment.json');delete alignment.anchors;
const cleanup=await read(root+'/cleanup-composite.json');cleanup.regions=cleanup.regions.map(({id,cleanupBounds,verified}:any)=>({id,cleanupBounds,verified}));
const out={version:1,status:'partial',inventorySummary:inventory.summary,geometry:geometry.strips.map((s:any)=>({id:s.id,balconies:s.balconies.acceptedBalconies,withheldBalconies:s.balconies.skippedBalconies,entrances:s.entrances.map(({id,status,reason}:any)=>({id,status,reason})),qa:s.qa})),receipts,alignment,cleanup,awningReference:(await read(root+'/classification/awning.json')).classifications,completion:'Not complete: coverage and quality gates have unresolved inventory items. No game data published.'};
await fs.writeFile('review-data/facade-vector-pilot/block-assemblies-v1/run-summary.json',JSON.stringify(out,null,2));
