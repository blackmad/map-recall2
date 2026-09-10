import fs from 'node:fs/promises';
import path from 'node:path';
import { roofGeometry } from './roof-geometry.mjs';
import { roofFrontageComponents } from './roof-components.mjs';
import { roofPlan } from './roof-plan.mjs';
import { assessRoofEvidence } from '../../public/canal-drive/da-costa-block/roof-assessment.js';
import { reviewEvidenceKey } from './review-dependencies.mjs';
import { surfaceMatches } from '../../public/canal-drive/da-costa-block/evidence.js';
import { matchingVisualReview,applyVisualProposal,applyHumanAppearance,roofSourceEligible } from './visual-review.mjs';
const arg=(key,fallback)=>process.argv.find(v=>v.startsWith(`--${key}=`))?.slice(key.length+3)||fallback;
const root=arg('root','.cache/da-costa-neighbourhood'),output=arg('out','public/data/da-costa-block/neighbourhood.json');
const read=async p=>JSON.parse(await fs.readFile(p));
const manifest=await read(root+'/manifest.json'),ledger=await read(root+'/spend.json');
const block=await read('public/data/da-costa-block/block.json');
let aerial=[];try{aerial=(await read(root+'/aerial.json')).records;}catch(e){if(e.code!=='ENOENT')throw e;}
let events=[];try{events=(await read(root+'/reviews.json')).events;}catch(e){if(e.code!=='ENOENT')throw e;}
let agent=[];try{agent=(await read(root+'/agent-review.json')).records;}catch(e){if(e.code!=='ENOENT')throw e;}
let visual=[];for(const file of ['findings.json','corrected-findings.json','height-findings.json','height-followup-findings.json','roof-findings.json','expanded-ground-findings.json','expanded-roof-findings.json'])try{visual.push(...(await read(root+'/self-review-2026-09-09/'+file)).records);}catch(e){if(e.code!=='ENOENT')throw e;}
try{visual.push(...await read(root+'/blind-storefront-2026-09-09/findings.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
try{visual.push(...(await read(root+'/self-review-2026-09-09/storefront-roof-findings.json')).records);}catch(e){if(e.code!=='ENOENT')throw e;}
let awningRows=[];try{awningRows=(await read(root+'/blind-storefront-2026-09-09/awning-observations-v1.json')).records;}catch(e){if(e.code!=='ENOENT')throw e;}
const validRuns=ledger.results.filter(x=>x.status==='ok'&&manifest.records.some(r=>r.id===x.id&&r.derivationKey===x.derivationKey));
const visualById=new Map(manifest.records.map(r=>[r.id,matchingVisualReview(visual,r,aerial.find(a=>a.buildingId===r.buildingId))]));
const records=manifest.records.map(r=>{
  const b=block.buildings.find(b=>b.id===r.buildingId);
  r={...r,mapFootprint:b.footprint}; // Compact local east/south outline for placement orientation.
  const runs=ledger.results.filter(x=>x.id===r.id&&x.derivationKey===r.derivationKey&&x.status==='ok');
  const air=aerial.find(a=>a.buildingId===r.buildingId);
  const buildingRuns=validRuns.filter(x=>manifest.records.find(r=>r.id===x.id)?.buildingId===r.buildingId&&x.aerialSha256===air?.sha256&&roofSourceEligible(air,visualById.get(x.id)));
  const airRun=buildingRuns.find(x=>x.mode==='aerial');
  const oracleRuns=buildingRuns.filter(x=>x.mode==='roof'&&x.model==='google/gemini-3.1-pro-preview'&&x.contextSha256===air?.context?.sha256);
  const oracleRun=oracleRuns.findLast(x=>x.id===r.id)||oracleRuns.at(-1);
  const roofOracleConflict=new Set(oracleRuns.filter(x=>x.proposal.roofVisible!=='no'&&x.proposal.roofShape&&x.proposal.roofShape!=='unknown').map(x=>x.proposal.roofShape)).size>1;
  const agentReview=agent.find(a=>a.id===r.id&&a.derivationKey===r.derivationKey&&a.images.every(m=>m.sha256===(m.file===air?.file?air:Object.values(r.images).find(i=>i.file===m.file))?.sha256));
  const result=runs.find(x=>x.mode==='multi'&&x.model.includes('3.1-flash-lite'))||runs.find(x=>x.mode==='multi');
  const proposal=result?{...result.proposal}:null;
  if(proposal?.groundUsable==='no'){proposal.shopfront='unknown';proposal.awning='unknown';proposal.visibleSignText='';}
  if(proposal?.roofVisible==='no'){proposal.roofShape='unknown';proposal.roofMaterial='unknown';}
  const comparisons=runs.filter(x=>x!==result).map(x=>({model:x.model,mode:x.mode,proposal:x.proposal,disagreements:Object.keys(x.proposal).filter(k=>x.proposal[k]!==result?.proposal[k])}));
  const evidenceKey=reviewEvidenceKey(r,air);
  const history=events.filter(e=>e.id===r.id&&e.derivationKey===r.derivationKey&&e.evidenceKey===evidenceKey);
  const review=history.at(-1)?.decision??null;
  const target=review?.placement==='accepted'?manifest.records.find(t=>t.id===review.targetId)||r:r;
  const targetBuilding=block.buildings.find(b=>b.id===target.buildingId);
  const boundVisual=visualById.get(r.id);
  const visualReview=boundVisual?{...Object.fromEntries(['origin','reviewer','derivationKey','buildingMatch','cropQuality','appearanceEligible','needsReview','evidence','fieldEligibility','proposal','sourceReviewCount'].map(key=>[key,boundVisual[key]])),images:boundVisual.images.map(({file,sha256,panoramaSha256})=>({file,sha256,...(panoramaSha256?{panoramaSha256}:{})}))}:null;
  const extracted=applyVisualProposal(proposal,visualReview);
  const provisional=review?.placement!=='crop-repair'&&(!agentReview?.suppressAppearance||review?.placement==='accepted')?extracted.proposal:null;
  const effectiveProposal=applyHumanAppearance(provisional,review);
  if(review?.placement==='accepted')for(const key of ['shopfront','awning','roofShape','facadeTop'])extracted.sources[key]='human-review';
  const geometry=roofGeometry(b);
  const roofConflict=!!proposal&&proposal.roofShape!=='unknown'&&['flat','pitched-gable'].includes(geometry.shape)&&proposal.roofShape!==geometry.shape||!!oracleRun&&(oracleRun.proposal.roofVisible==='no'||oracleRun.proposal.roofShape!==airRun?.proposal.roofShape)||roofOracleConflict;
  const reasons=[!result?'needs-inference':null,proposal?.shopfront==='yes'?'storefront':null,proposal?.visibleSignText?'visible-sign':null,proposal?.awning==='yes'?'awning':null,roofConflict?'roof-conflict':null,comparisons.some(c=>c.disagreements.length)?'model-disagreement':null,proposal?.groundUsable!=='yes'?'ground-obscured':null].filter(Boolean);
  return {...r,evidenceKey,images:{...r.images,...(air?{aerial:air}:{})},proposal,effectiveProposal,proposalSources:extracted.sources,visualReview,proposalModel:result?.model,agentReview:agentReview?{origin:agentReview.origin,reviewer:agentReview.reviewer,needsReview:agentReview.needsReview,suppressAppearance:!!agentReview.suppressAppearance,evidence:agentReview.evidence,roofShape:agentReview.roofShape,disagreements:agentReview.disagreements}:null,comparisons,roofEvidence:geometry,roofAerialProposal:airRun?{sourceId:airRun.id,model:airRun.model,shape:airRun.proposal.roofShape,material:airRun.proposal.roofMaterial,visible:airRun.proposal.roofVisible}:null,roofOracleProposal:oracleRun?{sourceId:oracleRun.id,model:oracleRun.model,...oracleRun.proposal,facadeTop:oracleRun.id===r.id?oracleRun.proposal.facadeTop:'unknown'}:null,roofOracleConflict,roofOracleCandidates:oracleRuns.map(x=>({sourceId:x.id,shape:x.proposal.roofShape,roofVisible:x.proposal.roofVisible,evidence:x.proposal.evidence})),roofConflict,surfaceIndices:surfaceMatches(b,r),renderBuildingId:target.buildingId,renderSurfaceIndices:surfaceMatches(targetBuilding,target),review,reviewReasons:[...reasons,...(agentReview?.needsReview?['agent-review-needed']:[]),...(visualReview?.appearanceEligible===false?['crop-repair-needed']:[]),...(roofOracleConflict?['roof-view-conflict']:[])]};
});
// Deterministic short session: difficult roofs, visible shops and ordinary controls.
for(const r of records){
  const awning=matchingVisualReview(awningRows,r);
  r.awningEvidence=awning?{origin:awning.origin,derivationKey:awning.derivationKey,buildingMatch:awning.buildingMatch,appearanceEligible:awning.appearanceEligible,awningObservation:awning.awningObservation,images:awning.images.map(({file,sha256,panoramaSha256,date})=>({file,sha256,panoramaSha256,date}))}:null;
  const building=block.buildings.find(b=>b.id===r.buildingId);
  r.roofComponents=roofFrontageComponents(building,r);
  r.roofPlan=roofPlan(building,r,r.roofComponents);
  const air=r.images.aerial;
  const alternatives=validRuns.filter(x=>x.model==='openai/gpt-5.6-sol'&&x.mode==='roof'&&x.aerialSha256===air?.sha256&&x.contextSha256===air?.context?.sha256&&manifest.records.find(m=>m.id===x.id)?.buildingId===r.buildingId&&roofSourceEligible(air,visualById.get(x.id)));
  const gpt=alternatives.findLast(x=>x.id===r.id)||alternatives.at(-1);
  r.roofGptProposal=gpt?{model:gpt.model,sourceId:gpt.id,...gpt.proposal,facadeTop:gpt.id===r.id?gpt.proposal.facadeTop:'unknown'}:null;
  if(gpt&&gpt.proposal.roofShape!==r.roofOracleProposal?.roofShape){r.roofConflict=true;r.reviewReasons.push('roof-model-conflict');}
  if(air?.coverageComplete===false){r.roofConflict=true;r.reviewReasons.push('aerial-clipped');r.roofSourceWarning='Whole-building roof candidates withheld: aerial coverage is incomplete.';}
  r.roofAssessment=assessRoofEvidence(r);
  r.roofConflict=r.roofAssessment.imageDisagreement;
  r.reviewReasons=r.reviewReasons.filter(reason=>!['roof-conflict','roof-model-conflict','roof-view-conflict'].includes(reason));
  r.reviewReasons.push(...r.roofAssessment.reasons);
}
const priority=[];
const take=(pool,count)=>{count=Math.min(count,20-priority.length);if(count<=0)return;let added=0;for(const r of pool){if(r.visualReview?.appearanceEligible===false||priority.some(id=>records.find(p=>p.id===id).buildingId===r.buildingId))continue;priority.push(r.id);if(++added===count)break;}};
// User-identified crop failure: review this complex building through its verified broad front.
take(records.filter(r=>r.id==='0363100012237064_e_1hyy18v'),1);
take(records.filter(r=>r.agentReview?.suppressAppearance),1);
// Explicit review priorities from the image critique, never inference hints.
const roofReviewBuildings=['0363100012236088','0363100012152665','0363100012236521','0363100012165211','0363100012236141','0363100012160273'];
for(const id of roofReviewBuildings)take(records.filter(r=>r.buildingId===id),1);
take(records.filter(r=>r.agentReview?.needsReview),1);
take(records.filter(r=>r.proposal?.visibleSignText),8);
take(records.filter((r,i)=>i%13===0),4);
take(records,20-priority.length);
for(const r of records)r.priorityRank=priority.indexOf(r.id)>=0?priority.indexOf(r.id)+1:null;
const stats={frontages:records.length,buildings:new Set(records.map(r=>r.buildingId)).size,proposals:records.filter(r=>r.proposal).length,storefronts:records.filter(r=>r.proposal?.shopfront==='yes').length,awnings:records.filter(r=>r.proposal?.awning==='yes').length,roofConflicts:records.filter(r=>r.roofConflict).length,reviewed:records.filter(r=>r.review).length,costUsd:ledger.results.reduce((s,r)=>s+(Number.isFinite(r.usage?.cost)?r.usage.cost:r.reservedUsd),0)};
Object.assign(stats,{visualReviewed:records.filter(r=>r.visualReview).length,agentPrimary:records.filter(r=>Object.values(r.proposalSources).includes('agent-visual-review')).length,cropRepairs:records.filter(r=>r.visualReview?.appearanceEligible===false||r.review?.placement==='crop-repair').length,effectiveStorefronts:records.filter(r=>r.effectiveProposal?.shopfront==='yes'&&!['uncertain','rejected'].includes(r.review?.placement)).length});
Object.assign(stats,{roofQuestions:records.filter(r=>r.roofAssessment.needsReview).length,roofMeshDetailQuestions:records.filter(r=>r.roofAssessment.meshDetailDifference||r.roofAssessment.componentQuestion).length,roofInsufficient:records.filter(r=>r.roofAssessment.status==='insufficient-evidence').length});
const out={version:manifest.version,sourceHash:manifest.sourceHash,generatedAt:new Date().toISOString(),stats,records,omitted:manifest.omitted,policy:'Machine proposals, approximate appearance. Names and distinctive awnings require placement review. Roof geometry is preserved.'};
await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output+'.tmp',JSON.stringify(out));await fs.rename(output+'.tmp',output);
console.log(JSON.stringify(stats));
