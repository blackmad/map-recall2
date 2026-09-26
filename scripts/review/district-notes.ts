import {Router} from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {lockedJson,readJson} from '../da-costa-block/pipeline-state.mjs';
export const issueKinds=['doors','windows','curves','awnings','materials','ground-contact','signs'];
const hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
export function districtNotesRouter(root=process.cwd(),storage=path.join(root,'.cache/city-appearance/review-notes'),packetOverride?: (id:string)=>Promise<any>){
 const router=Router(),token=randomUUID();
 async function packet(release:string){if(packetOverride)return packetOverride(release);if(!/^[a-f0-9]{64}$/.test(release))throw Object.assign(Error('Invalid release'),{status:400});const bytes=await fs.readFile(path.join(root,'public/data/city-expansion/evaluations',release,'comparison-packet.json'));return {value:JSON.parse(bytes.toString()),sha256:hash(bytes)};}
 const file=(release:string)=>path.join(storage,`${release}.json`);
 const initial=(release:string,sha256:string)=>({version:1,releaseId:release,packetSha256:sha256,notes:{},readyForFixes:false,regressionCases:[],excludedEvaluationBuildingIds:[]});
 const bound=(state:any,p:any)=>{if(state.packetSha256!==p.sha256)throw Object.assign(Error('The comparison packet changed. Existing notes were preserved; review the source binding before continuing.'),{status:409});};
 function derive(state:any,p:any){state.regressionCases=p.value.cases.filter((c:any)=>state.notes[c.caseId]&&(state.notes[c.caseId].text.trim()||state.notes[c.caseId].status!=='unreviewed'||state.notes[c.caseId].issues.length)).map((c:any)=>({id:`${state.releaseId}:${c.caseId}`,caseId:c.caseId,role:'development-from-user-review',status:'awaiting-agent-triage',source:c.comparison?.source,images:c.images,renderUrl:c.renderUrl,screenshotUrl:c.screenshotUrl,screenshotSha256:c.screenshotSha256,userReview:state.notes[c.caseId],requiredViews:['tight-ground-floor','full-facade','oblique-game'],quantitativeAssertions:null}));state.excludedEvaluationBuildingIds=[...new Set(state.regressionCases.map((c:any)=>c.source?.buildingId).filter(Boolean))];}
 const error=(res:any,e:any)=>res.status(e.status??(e.code==='ENOENT'?404:500)).json({error:e.message});
 router.get('/:release',async(req,res)=>{try{const p=await packet(req.params.release),state=await readJson(file(req.params.release),initial(req.params.release,p.sha256));bound(state,p);res.set('Cache-Control','no-store').json({...state,token,previousReviews:p.previousReviews??[]});}catch(e){error(res,e);}});
 router.post('/:release',async(req,res)=>{
  if(req.get('x-review-token')!==token){res.status(403).json({error:'Reload this local review page before saving.'});return;}
  try{const p=await packet(req.params.release),body=req.body??{};
   if(body.packetSha256!==p.sha256)throw Object.assign(Error('Source packet changed; reload before saving.'),{status:409});
   const state=await lockedJson(file(req.params.release),initial(req.params.release,p.sha256),(s:any)=>{
    bound(s,p);
    if(body.action==='ready'){
     derive(s,p);if(!s.regressionCases.length)throw Object.assign(Error('Add a note or review a case first.'),{status:400});s.readyForFixes=true;s.readyAt=new Date().toISOString();
    }else{
     if(!p.value.cases.some((c:any)=>c.caseId===body.caseId)||typeof body.text!=='string'||body.text.length>12000||!['unreviewed','needs-work','looks-good'].includes(body.status)||!Array.isArray(body.issues)||body.issues.some((i:any)=>!issueKinds.includes(i))||!Number.isInteger(body.expectedRevision))throw Object.assign(Error('Invalid case note'),{status:400});
     const prior=s.notes[body.caseId];if((prior?.revision??0)!==body.expectedRevision)throw Object.assign(Error('This note changed in another tab. Your draft is kept here; reload and compare before saving.'),{status:409});
     s.notes[body.caseId]={caseId:body.caseId,text:body.text,status:body.status,issues:[...new Set(body.issues)],revision:(prior?.revision??0)+1,updatedAt:new Date().toISOString(),origin:'user-entered-review'};s.readyForFixes=false;derive(s,p);
    }
    return structuredClone(s);
   });res.set('Cache-Control','no-store').json(state);
  }catch(e){error(res,e);}
 });return router;
}

export function facadePreviewNotesRouter(root=process.cwd(),storage=path.join(root,'.cache/city-appearance/repair-preview-notes')){
 return districtNotesRouter(root,storage,async(id:string)=>{
  if(!/^[a-f0-9]{64}$/.test(id))throw Object.assign(Error('Invalid preview identity'),{status:400});
  const bytes=await fs.readFile(path.join(root,'public/data/facade-repair-preview/cases.json'));
  const sha256=hash(bytes);if(id!==sha256)throw Object.assign(Error('The preview changed. Your notes are preserved; reload to review the new version.'),{status:409});
  const preview=JSON.parse(bytes.toString());
  const priorFiles=await fs.readdir(storage).catch(()=>[]);
  const previousReviews=(await Promise.all(priorFiles.filter(name=>/^[a-f0-9]{64}\.json$/.test(name)&&name!==`${id}.json`).map(async name=>{const prior=JSON.parse(await fs.readFile(path.join(storage,name),'utf8'));return {candidateSha256:prior.packetSha256,notes:prior.notes};}))).filter(p=>Object.keys(p.notes??{}).length);
  return {sha256,previousReviews,value:{cases:preview.cases.map((c:any)=>({caseId:c.caseId,comparison:{source:{buildingId:c.owner.id,previewSha256:sha256,sourceImages:c.source}},images:c.source,renderUrl:`/canal-drive/facade-repair-preview.html?case=${c.caseId}`,screenshotUrl:null,screenshotSha256:null}))}};
 });
}
