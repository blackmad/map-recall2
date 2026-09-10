import fs from 'node:fs/promises';
import { roofGeometry } from './roof-geometry.mjs';
const root='.cache/da-costa-neighbourhood',read=async p=>JSON.parse(await fs.readFile(p));
const manifest=await read(root+'/manifest.json'),ledger=await read(root+'/spend.json'),block=await read('public/data/da-costa-block/block.json');
const valid=ledger.results.filter(x=>x.status==='ok'&&manifest.records.some(r=>r.id===x.id&&r.derivationKey===x.derivationKey));
const groups={};
for(const x of valid){const k=x.model+'/'+x.mode;(groups[k]??=[]).push(x);}
const summary=Object.fromEntries(Object.entries(groups).map(([k,rows])=>[k,{calls:rows.length,cost:rows.reduce((s,r)=>s+r.usage.cost,0),seconds:rows.reduce((s,r)=>s+r.seconds,0),storefronts:rows.filter(r=>r.proposal.shopfront==='yes'&&r.proposal.groundUsable!=='no').length,roofKnown:rows.filter(r=>r.proposal.roofShape!=='unknown'&&r.proposal.roofVisible!=='no').length,unusableGroundNegative:rows.filter(r=>r.proposal.groundUsable==='no'&&r.proposal.shopfront==='no').length}]));
const aerial=valid.filter(x=>x.mode==='aerial');
const pairs=aerial.map(a=>{
  const base=valid.find(x=>x.id===a.id&&x.mode==='multi'&&x.model===a.model),r=manifest.records.find(r=>r.id===a.id);
  const geometry=roofGeometry(block.buildings.find(b=>b.id===r.buildingId));
  const known=p=>p?.roofVisible!=='no'&&p?.roofShape!=='unknown'&&!!p;
  return {id:a.id,address:r.address,geometry:geometry.shape,before:known(base?.proposal)?base.proposal.roofShape:'unknown',after:known(a.proposal)?a.proposal.roofShape:'unknown',aerial:a.proposal};
});
const pairedFull=valid.filter(r=>r.mode==='full').map(f=>{
  const m=valid.find(r=>r.mode==='multi'&&r.model===f.model&&r.id===f.id);
  return m?{id:f.id,address:manifest.records.find(r=>r.id===f.id).address,single:f.proposal.shopfront,multi:m.proposal.shopfront,groundSingle:f.proposal.groundUsable,groundMulti:m.proposal.groundUsable,singleSign:f.proposal.visibleSignText,multiSign:m.proposal.visibleSignText}:null;
}).filter(Boolean);
const latestContext=valid.filter(r=>r.mode==='roof'&&r.contextSha256).filter((r,i,all)=>all.findLastIndex(x=>x.id===r.id&&x.model===r.model)===i);
const roofHeadToHead=latestContext.filter(r=>r.model.includes('flash-lite')).flatMap(cheap=>{
  const strong=latestContext.find(r=>r.id===cheap.id&&r.model==='google/gemini-3.1-pro-preview'&&r.contextSha256===cheap.contextSha256);
  return strong?[{id:cheap.id,cheap:cheap.proposal.roofShape,strong:strong.proposal.roofShape,agree:cheap.proposal.roofShape===strong.proposal.roofShape}]:[];
});
const contextChanges=latestContext.filter(r=>r.model==='google/gemini-3.1-pro-preview').flatMap(r=>{
  const prior=valid.find(p=>p.id===r.id&&p.mode==='roof'&&p.model===r.model&&!p.contextSha256);
  return prior&&prior.proposal.roofShape!==r.proposal.roofShape?[{id:r.id,before:prior.proposal.roofShape,after:r.proposal.roofShape,note:'Prompt and context changed together; not an isolated causal ablation.'}]:[];
});
const gptRoofComparison=latestContext.filter(r=>r.model==='openai/gpt-5.6-sol').map(gpt=>{
  const other=latestContext.find(r=>r.id===gpt.id&&r.model==='google/gemini-3.1-pro-preview');
  return {id:gpt.id,gpt:gpt.proposal,gemini:other?.proposal,shapeAgrees:other?.proposal.roofShape===gpt.proposal.roofShape};
});
const gptAppearanceComparison=valid.filter(r=>r.mode==='multi'&&r.model==='openai/gpt-5.6-sol').map(gpt=>{
  const cheap=valid.find(r=>r.id===gpt.id&&r.mode==='multi'&&r.model==='google/gemini-3.1-flash-lite');
  return {id:gpt.id,gpt:gpt.proposal,cheap:cheap?.proposal,disagreements:cheap?['shopfront','awning','groundUsable','wholeUsable','roofShape','facadeTop','visibleSignText'].filter(k=>gpt.proposal[k]!==cheap.proposal[k]):[]};
});
const report={generatedAt:new Date().toISOString(),coverage:{frontages:manifest.records.length,buildings:new Set(manifest.records.map(r=>r.buildingId)).size,omitted:manifest.omitted},costUsd:ledger.results.reduce((s,r)=>s+(Number.isFinite(r.usage?.cost)?r.usage.cost:r.reservedUsd),0),ceilingUsd:ledger.ceiling,unknownCharges:ledger.results.filter(r=>!Number.isFinite(r.usage?.cost)).length,summary,pairedFull,pairs,
  roofHeadToHead,contextChanges,gptRoofComparison,gptAppearanceComparison,strongRoofBuildings:new Set(latestContext.filter(r=>r.model==='google/gemini-3.1-pro-preview').map(r=>manifest.records.find(m=>m.id===r.id).buildingId)).size,
  aerialComparison:{cases:pairs.length,knownBefore:pairs.filter(r=>r.before!=='unknown').length,knownAfter:pairs.filter(r=>r.after!=='unknown').length,geometryComparable:pairs.filter(r=>['flat','pitched-gable'].includes(r.geometry)).length,geometryMatchesBefore:pairs.filter(r=>['flat','pitched-gable'].includes(r.geometry)&&r.geometry===r.before).length,geometryMatchesAfter:pairs.filter(r=>['flat','pitched-gable'].includes(r.geometry)&&r.geometry===r.after).length,note:'Agreement with a mesh heuristic is not accuracy; neither is human ground truth.'},
  discovery:valid.filter(r=>r.mode==='multi'&&/sterk/i.test(r.proposal.visibleSignText)).map(r=>({id:r.id,address:manifest.records.find(x=>x.id===r.id).address,model:r.model,text:r.proposal.visibleSignText})),policy:'Development experiments; never converts proposals into human labels.'};
await fs.writeFile(root+'/experiment-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({summary,aerialComparison:report.aerialComparison,storefrontChanges:pairedFull.filter(p=>p.single!==p.multi),costUsd:report.costUsd},null,2));
