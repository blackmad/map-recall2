/** Independent accounting of frozen requests, cached analyses and staged coverage. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const root='scripts/review/thousand-building-extraction';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const cacheBytes=await fs.readFile('.cache/city-appearance/fidelity-extraction/analysis-results.json');
const cache=JSON.parse(cacheBytes),heldout=await read('scripts/city-appearance/fidelity/heldout-source-inspection.json');
const excluded=new Set(heldout.cases.map(c=>c.buildingId));
const requests=new Map(),manifestBindings=[];
for(const file of (await fs.readdir(root)).filter(f=>f.endsWith('.json')).sort()){
 const bytes=await fs.readFile(`${root}/${file}`),value=JSON.parse(bytes);
 if(value.phase!=='neighbourhood-1000-preview'||!Array.isArray(value.cases))continue;
 manifestBindings.push({file,sha256:hash(bytes)});
 for(const c of value.cases){if(excluded.has(c.buildingId))continue;for(const [tier,source] of Object.entries(c.sources??{})){
  requests.set(`${c.buildingId}:${tier}:${source.cropSha256}`,{buildingId:c.buildingId,tier,source});
 }}
}
const bySource=new Map();for(const result of cache.results){const s=result.source;if(!s)continue;const key=`${s.cropSha256}:${s.width}:${s.height}`;const list=bySource.get(key)??[];list.push(result);bySource.set(key,list);}
const buildings=new Map();let uniqueTierRequests=0;const statuses={};
for(const request of requests.values()){
 const s=request.source,matches=bySource.get(`${s.cropSha256}:${s.width}:${s.height}`)??[];
 const result=matches.find(r=>r.status==='complete')??matches.at(-1);
 const status=result?.status??'not-started';statuses[status]=(statuses[status]??0)+1;uniqueTierRequests++;
 const entry=buildings.get(request.buildingId)??{buildingId:request.buildingId,tiers:{}};
 const previous=entry.tiers[request.tier];if(!previous||previous.status!=='complete')entry.tiers[request.tier]={status,analysisKey:result?.key??null,cropSha256:s.cropSha256};buildings.set(request.buildingId,entry);
}
const rows=[...buildings.values()];
const phaseResults=cache.results.filter(r=>r.phase==='neighbourhood-1000-preview');
const ledgerBytes=await fs.readFile('.cache/city-appearance/spend.json');
const ledger=JSON.parse(ledgerBytes),batchCharges=ledger.entries.filter(e=>e.fidelityPhase==='neighbourhood-1000-preview');
const reconciliation=await read(`${root}/charge-reconciliation.json`).catch(()=>null);
const conservativeUnknownChargeUsd=reconciliation?.resolution==='charged-abstention-at-full-reservation'?reconciliation.accountedUsd:0;
const confirmedProviderUsd=batchCharges.filter(e=>e.id!==reconciliation?.globalReservation).reduce((sum,e)=>sum+(Number.isFinite(e.actualUsd)?e.actualUsd:0),0);
const pendingReservedUsd=batchCharges.filter(e=>!Number.isFinite(e.actualUsd)).reduce((sum,e)=>sum+e.reservedUsd,0);
const currentBytes=await fs.readFile('public/data/city-expansion/current.json');
const stage=await read('scripts/review/thousand-building-candidate-report.json').catch(()=>null);
const starts=phaseResults.map(r=>Date.parse(r.reservedAt)).filter(Number.isFinite);
const startedAt=starts.length?new Date(Math.min(...starts)).toISOString():null;
const output={version:1,createdAt:new Date().toISOString(),startedAt,elapsedMinutes:startedAt?(Date.now()-Date.parse(startedAt))/60000:null,targetDistinctBuildings:1000,
 processing:{scheduledDistinctBuildings:rows.length,attemptedDistinctBuildings:rows.filter(r=>Object.values(r.tiers).some(t=>t.status!=='not-started')).length,validDistinctBuildings:rows.filter(r=>Object.values(r.tiers).some(t=>t.status==='complete')).length,validGroundBuildings:rows.filter(r=>r.tiers.ground?.status==='complete').length,validFullBuildings:rows.filter(r=>r.tiers.full?.status==='complete').length,validBothTierBuildings:rows.filter(r=>r.tiers.full?.status==='complete'&&r.tiers.ground?.status==='complete').length,uniqueTierRequests,statuses,heldoutBuildingsExcluded:excluded.size},
 costs:{confirmedProviderUsd,conservativeUnknownChargeUsd,pendingReservedUsd,accountedBatchUsd:confirmedProviderUsd+conservativeUnknownChargeUsd,additionalCapUsd:10,scope:'All neighbourhood batch charges, including retired held-out analyses. The interrupted request actual charge is unknown and conservatively accounted separately.'},
 stagedSnapshot:stage?{releaseId:stage.stagedReleaseId,coverage:stage.coverage,sourceGeometry:stage.sourceGeometry}:null,
 evidence:{cacheSha256:hash(cacheBytes),costLedgerSha256:hash(ledgerBytes),requestManifests:manifestBindings,preservedCurrentSha256:hash(currentBytes)},
 acceptance:{metricRegistrationsAccepted:0,photographicFidelity:'not accepted',heldoutGeneralization:'not measured; contaminated cases retired',originalTwelveOutstanding:true},buildings:rows.sort((a,b)=>a.buildingId.localeCompare(b.buildingId))};
await fs.writeFile(`${root}/independent-summary.json`,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({processing:output.processing,costs:output.costs},null,2));
