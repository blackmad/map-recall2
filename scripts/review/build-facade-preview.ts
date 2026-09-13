/** Development-only preview: native crop planes are candidates, never registrations. */
import fs from 'node:fs/promises';
import {prepareRoofCoverageStudy,applyRoofCoverageStudy} from './roof-coverage-corrections.ts';
import {applyRetailSourceCorrections} from './retail-source-corrections.ts';
import {buildTemporalCandidate} from './next-stage-temporal.ts';
import {prepareRoofStudy} from './next-stage-roofs.ts';
import {applySourceSilhouette} from './apply-source-silhouette.ts';
import {prepareTemporalPreviewEvidence} from './temporal-preview-evidence.ts';
import {applySourceAssemblies} from './apply-source-assemblies.ts';
import {compileSourceShapePreview} from './source-shape-preview.ts';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {compileFacadePatches,facadeWallFrame,FACADE_PATCH_COLOURS} from '../../src/canalRecall/cityAppearanceFacadeRecipes.ts';
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const sha=(b:any)=>crypto.createHash('sha256').update(b).digest('hex');
const regressions=await read('scripts/review/facade-regressions.json');
const references=await read('scripts/review/window-shape-reference.json');
const corrections=await read('scripts/review/development-photo-corrections.json');
const signReferences=await read('scripts/review/roof-sign-corrections.json');
const temporal=await read('scripts/review/temporal-evidence-inventory.json');
const nextSourceReview=await read('scripts/review/next-stage-source-review.json');
const retailReview=await read('scripts/review/retail-priority-source-review.json');
const spatial=await read('scripts/review/spatial-source-corrections.json');
const cache=await read('.cache/city-appearance/fidelity-extraction/analysis-results.json').catch(()=>({results:[]}));
const index=await read('.cache/city-appearance/fidelity-extraction/development-analysis-index.json');
if(index.manifestSha256!==sha(await fs.readFile('scripts/review/facade-regression-analysis-manifest.json')))throw Error('Stale analysis manifest');
const currentKeys=new Set(index.cases.map((c:any)=>c.key));
const complete=cache.results.filter((r:any)=>currentKeys.has(r.key)&&r.status==='complete'&&r.proposal);
const cases=[];
for(const c of regressions.cases){
 for(const tier of ['full','ground']){if(sha(await fs.readFile(c.source[tier].path))!==c.source[tier].sha256)throw Error('Stale photograph');}
 const tileBytes=await fs.readFile(c.binding.tile.path);if(sha(tileBytes)!==c.binding.tile.sha256)throw Error('Stale tile');
 const tile=JSON.parse(gunzipSync(tileBytes).toString());
 const owner=tile.owners.find((o:any)=>o.id===c.binding.buildingId);
 const original=owner.observations.find((o:any)=>o.id===c.binding.observationId).payload;
 const primary=(original.renderSurfaceIndices??c.binding.surfaceIndices).find((i:number)=>facadeWallFrame(owner.geometry.building.surfaces[i],owner,[owner]));
 const frame=primary===undefined?null:facadeWallFrame(owner.geometry.building.surfaces[primary],owner,[owner]);
 const shapeFeatures:any={};const candidateObservations:any[]=[];const patches:any[]=[];const omissions:string[]=[];let analyzedTiers=0;
 if(!frame)omissions.push('No usable published facade surface');
 if(c.caseId!=='case-26'&&frame){
  const indices=original.renderSurfaceIndices??[primary];
  for(const index of indices){
   const surface=owner.geometry.building.surfaces[index],f=facadeWallFrame(surface,owner,[owner]);if(!f)continue;
   const r=structuredClone(original);r.renderSurfaceIndices=[index];
   const d:any={version:1,extractionVersion:'user-repair-development-preview-v1',buildingId:owner.id,geometryRevision:owner.geometryRevision,evidenceKey:r.evidenceKey,frontage:[r.localStart,r.localEnd],surfaceIndices:[index],sources:{}};
   for(const tier of ['full','ground']){
    const im=r.images[tier],analysis=complete.findLast((a:any)=>a.source.cropSha256===im.sha256);
    const ref=references.entries.find((e:any)=>e.caseId===c.caseId&&e.tier===tier);
    if(!analysis){if(index===indices[0])omissions.push(`${tier}: ${ref?'partial manual shape repair only':'analysis unavailable'}`);if(!ref)continue;}
    if(analysis&&index===indices[0])analyzedTiers++;
    const plane=im.plane,origin=owner.geometry.frame.originRD;
    if(!plane)continue;
    const local=(p:any)=>[p.x-origin.x,origin.y-p.y];
    const left=local(plane.start),right=local(plane.end);
    const off=(p:number[])=>Math.abs((p[0]-f.a[0])*f.u[1]-(p[1]-f.a[1])*f.u[0]);
    const along=(p:number[])=>(p[0]-f.a[0])*f.u[0]+(p[1]-f.a[1])*f.u[1];
    const transform=[(along(right)-along(left))/im.width,0,along(left),0,(plane.baseZ-plane.topZ)/im.height,plane.topZ-(f.bottom+.65),0,0,1];
    let features=structuredClone(analysis?.proposal.features??[]).map((a:any)=>({...a,id:`${tier}:${a.id}`,disposition:'machine-observed-unreviewed'}));
    // These are deliberate development repairs from independently inspected photos,
    // not untouched evaluation predictions. Keep the references themselves separate.
    if(ref){
     if(ref.cropSha256!==im.sha256)throw Error('Stale shape reference');
     const overlap=(a:number[],b:number[])=>{const intersection=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));return intersection/Math.min((a[2]-a[0])*(a[3]-a[1]),(b[2]-b[0])*(b[3]-b[1]));};
     for(const shape of ref.features){
      const old=features.find((v:any)=>['door','window'].includes(v.kind)&&overlap(v.bounds,shape.bounds)>.6);
      features=features.filter((v:any)=>!(['door','window'].includes(v.kind)&&overlap(v.bounds,shape.bounds)>.6));
      const updated:any={...old,...shape,id:`${tier}:review:${shape.id}`,disposition:'agent-inspected'};
      for(const key of ['archRise','transom','topCornerRadius']){if(shape[`${key}Range`])updated[key]=(shape[`${key}Range`][0]+shape[`${key}Range`][1])/2;delete updated[`${key}Range`];}
      if(updated.head==='rectangular')delete updated.archRise;else delete updated.topCornerRadius;
      features.push(updated);
     }
    }
    const correction=corrections.cases[c.caseId]?.[tier];
    if(correction){features=features.filter((f:any)=>!correction.remove?.includes(f.id)).map((f:any)=>{const update=correction.update?.[f.id];if(!update)return f;const out={...f,...update,disposition:'agent-inspected'};for(const key of Object.keys(out))if(out[key]===null)delete out[key];return out;});}
    const spatialFix=spatial.cases[c.caseId]?.[tier];
    if(spatialFix){
     if(spatialFix.source.cropSha256!==im.sha256||spatialFix.source.captureDate!==im.date)throw Error('Stale spatial correction');
     features=features.filter((f:any)=>!spatialFix.remove?.includes(f.id)).map((f:any)=>{const update=spatialFix.update?.[f.id];if(!update)return f;const out={...f,...update,disposition:'agent-inspected'};for(const key of Object.keys(out))if(out[key]===null)delete out[key];return out;});
     features.push(...(spatialFix.add??[]).map((f:any)=>({...f,disposition:'agent-inspected'})));
    }
    const signRef=signReferences.corrections.find((entry:any)=>entry.caseId===c.caseId&&entry.kind==='tenant-sign');
    if(signRef){
     if(signRef.source[tier].sha256!==im.sha256||signRef.source[tier].captureDate!==im.date)throw Error('Stale sign reference');
     // Each physical fascia is independently visible in this dated crop.
     const ids=tier==='full'?['full:fascia-main','full:fascia-awning']:['ground:fascia-1'];
     features=features.filter((feature:any)=>!ids.includes(feature.id));
     const bounds=tier==='full'?signRef.sign.fullBoundsPx:signRef.sign.groundBoundsPx;
     features.push({id:`${tier}:review:moeders-main`,kind:'fascia',bounds,text:'moeders',physicalSignId:'moeders:rozengracht-251:primary-fascia',colour:signRef.sign.background,textColour:signRef.sign.colour,signFont:'italic bold 82px Georgia',disposition:'agent-inspected'});
     const secondary=tier==='full'?signRef.sign.secondaryFullFasciaBoundsPx:signRef.sign.secondaryGroundFasciaBoundsPx;
     features.push({id:`${tier}:review:moeders-secondary`,kind:'fascia',bounds:secondary,text:'moeders',physicalSignId:'moeders:rozengracht-251:awning-valance',colour:signRef.sign.background,textColour:signRef.sign.colour,signFont:'italic bold 82px Georgia',disposition:'agent-inspected'});
    }
    shapeFeatures[tier]=applyRetailSourceCorrections(c.caseId,tier,{features,width:im.width,height:im.height,cropSha256:im.sha256,captureDate:im.date},retailReview);
    features=shapeFeatures[tier].features;
    if(Math.max(off(left),off(right))>.18){omissions.push(`${tier}/surface ${index}: noncoplanar source abstained`);continue;}
    d.sources[tier]={cropSha256:im.sha256,captureDate:im.date,imageDimensions:{width:im.width,height:im.height},openingsComplete:analysis?.proposal.openingsComplete??false,features,registration:{status:'ambiguous',uncertaintyM:999,imageToWall:[],surfaceIndex:index,sourceDatum:'NAP',canonicalDatum:'surface-base',pixelConvention:'pixel-edge',preview:{kind:'native-crop-plane',cropSha256:im.sha256,imageDimensions:{width:im.width,height:im.height},imageToWall:transform,note:'Native cached crop plane; camera height and wall alignment unverified. Development inspection only.'}}};
   }
   r.facadeDescription=d;
   candidateObservations.push(r);
   patches.push(...compileFacadePatches(owner,surface,index,[r],[owner],{procedural:false,contextual:false,observed:true,candidateRegistrationPreview:true}).filter(p=>p.previewOnly).map(p=>({...p,colour:FACADE_PATCH_COLOURS[p.colour]??p.colour})));
  }
 }
 // A missing metric face does not prevent inspecting a source-space proposal.
 if(c.caseId!=='case-26')for(const tier of ['full','ground'])if(!shapeFeatures[tier]){const im=original.images[tier],a=complete.findLast((a:any)=>a.source.cropSha256===im.sha256);if(a)shapeFeatures[tier]={features:a.proposal.features.map((f:any)=>({...f,id:`${tier}:${f.id}`,disposition:'machine-observed-unreviewed'})),width:im.width,height:im.height,cropSha256:im.sha256,captureDate:im.date};}
 for(const tier of ['full','ground']){const input=shapeFeatures[tier],fix=spatial.cases[c.caseId]?.[tier];if(input&&fix){
  if(fix.source.cropSha256!==input.cropSha256||fix.source.captureDate!==input.captureDate)throw Error('Stale spatial source study');
  input.features=input.features.filter((f:any)=>!fix.remove?.includes(f.id)).map((f:any)=>{const update=fix.update?.[f.id];const out={...f,...update,...(update?{disposition:'agent-inspected',correctionEvidenceDisposition:update.disposition}: {})};for(const key of Object.keys(out))if(out[key]===null)delete out[key];return out;});
  for(const added of fix.add??[])if(!input.features.some((f:any)=>f.id===added.id))input.features.push({...added,disposition:'agent-inspected'});
 }}
 for(const tier of ['full','ground'])if(shapeFeatures[tier])shapeFeatures[tier]=applyRetailSourceCorrections(c.caseId,tier,shapeFeatures[tier],retailReview);
 const roofReview=nextSourceReview.cases.find((review:any)=>review.caseId===c.caseId&&review.roofStudy);
 const roof=roofReview&&shapeFeatures.full?prepareRoofStudy(shapeFeatures.full,roofReview):null;
 if(roof)shapeFeatures.full=roof.input;
 const coverageRoof=['case-01','case-04','case-09'].includes(c.caseId)&&shapeFeatures.full?prepareRoofCoverageStudy(c.caseId,shapeFeatures.full):null;
 if(coverageRoof)shapeFeatures.full=coverageRoof.input;
 const shapeStudy=Object.fromEntries(Object.entries(shapeFeatures).map(([tier,input])=>[tier,applySourceAssemblies(compileSourceShapePreview(input as any),input,spatial.cases[c.caseId]?.[tier]?.entranceAssemblies)]));
 if(coverageRoof)applyRoofCoverageStudy(shapeStudy.full,coverageRoof);
 if(roof)applySourceSilhouette(shapeStudy.full,shapeFeatures.full,roof.polygon);
 const counts=Object.fromEntries(['door','window','awning','material'].map(kind=>[kind,new Set(patches.filter(p=>p.featureKind===`observed-${kind}`).map(p=>p.featureId)).size]));
 const temporalEvidence=await prepareTemporalPreviewEvidence(temporal.cases.find((entry:any)=>entry.caseId===c.caseId),c.binding);
 cases.push({caseId:c.caseId,candidateObservations,roofReview:coverageRoof?{status:"source-outline-reviewed",uncertainty:coverageRoof.occlusionUncertainty}:roof?{status:"source-outline-reviewed"}:{status:"source-outline-not-reviewed"},address:spatial.cases[c.caseId]?.address??original.address??c.binding.buildingId,temporalEvidence,note:c.userNote.text,source:Object.fromEntries(['full','ground'].map(t=>[t,{...c.source[t],url:'/'+c.source[t].path.replace(/^public\//,'')}])),previousRenderUrl:'/'+c.render.path.replace(/^public\//,''),status:c.caseId==='case-26'?'Source identity unresolved: no inferred repair':`Development preview · alignment unverified · ${analyzedTiers}/2 image tiers analyzed`,frame,owner,patches,counts,omissions,shapeFeatures,shapeStudy,shapeReferenceUsedForDevelopmentRepair:references.entries.some((e:any)=>e.caseId===c.caseId)});
}
for(const c of cases)if(c.caseId==='case-17'){const candidate=buildTemporalCandidate(c);(c as any).architectureComposite={study:compileSourceShapePreview(candidate as any),provenance:candidate.provenance,omissions:candidate.omissions};}
await fs.mkdir('public/data/facade-repair-preview',{recursive:true});
await fs.writeFile('public/data/facade-repair-preview/cases.json',JSON.stringify({version:1,releaseId:regressions.releaseId,previewOnly:true,originalTwelveOutstanding:true,createdAt:new Date().toISOString(),cases}));
console.log(JSON.stringify(cases.map(c=>({id:c.caseId,counts:c.counts,patches:c.patches.length,omissions:c.omissions}))));
