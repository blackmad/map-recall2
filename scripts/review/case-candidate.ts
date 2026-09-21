/**
 * Per-case development candidate builder.
 *
 * Shared by the full `build-facade-preview` builder and targeted refresh
 * scripts, so a one-case refresh produces exactly what a full rebuild would for
 * that case. It compiles one reviewed case's metric candidate from its stored
 * observation plus the fidelity-extraction analysis cache, and returns the
 * source-shape features the study is built from.
 *
 * The registered-frontage fallback lives here: when 3DBAG gives no usable wall
 * frame for a reviewed frontage (slivers, skewed or non-planar rings), the case
 * draws on a synthetic rectangle along its own registered frontage instead of
 * abstaining to a blank candidate. The fallback invents no position and is
 * still validated by `facadeWallFrame` against the building boundary.
 */
import {compileFacadePatches,facadeWallFrame,FACADE_PATCH_COLOURS} from '../../src/canalRecall/cityAppearanceFacadeRecipes.ts';
import {applyRetailSourceCorrections} from './retail-source-corrections.ts';
import {registeredFrontageWallSurface} from '../../src/canalRecall/facade/registeredFrontage.ts';

export interface CaseCandidateParams {
  caseId: string;
  owner: any;
  original: any;
  bindingSurfaceIndices?: number[];
  complete: any[];
  references: any;
  corrections: any;
  spatial: any;
  signReferences: any;
  retailReview: any;
}

export function buildCaseCandidate(params: CaseCandidateParams) {
  const {caseId, owner, original, complete, references, corrections, spatial, signReferences, retailReview} = params;
  // The registered observation frontage is the extraction's own wall line. When
  // 3DBAG fragments it into slivers/skewed pieces so no surface gives a usable
  // frame, draw on a synthetic rectangle along that registered line instead of
  // abstaining to a blank candidate. The fallback invents no position: the
  // crop plane is already coplanar with the frontage, and `facadeWallFrame`
  // still validates the synthetic ring against the building boundary.
  const declaredIndices=(original.renderSurfaceIndices?.length?original.renderSurfaceIndices:(params.bindingSurfaceIndices??[]));
  const declaredTargets=declaredIndices.flatMap((index:number)=>{const surface=owner.geometry.building.surfaces[index];if(!surface)return[];const surfaceFrame=facadeWallFrame(surface,owner,[owner]);return surfaceFrame?[{index,surface,frame:surfaceFrame}]:[];});
  // Max perpendicular distance from a frame line to the cached crop-plane
  // endpoints. This mirrors the compiler's own `.18` non-coplanarity abstention:
  // a frame further from the crop plane than that will emit no source patches.
  const sourceOrigin=owner.geometry.frame.originRD;
  const cropPlaneOffset=(frame:any)=>{let max=0;for(const tier of ['full','ground']){const plane=original.images?.[tier]?.plane;if(!plane)continue;for(const point of [plane.start,plane.end]){const local=[point.x-sourceOrigin.x,sourceOrigin.y-point.y];max=Math.max(max,Math.abs((local[0]-frame.a[0])*frame.u[1]-(local[1]-frame.a[1])*frame.u[0]));}}return max;};
  // A declared surface is only useful if it is coplanar enough for the compiler
  // to draw on. When every usable declared frame is non-coplanar (3DBAG
  // fragments the frontage into skewed pieces), the registered frontage is the
  // defensible plane.
  const declaredCoplanar=declaredTargets.length>0&&Math.min(...declaredTargets.map((target:any)=>cropPlaneOffset(target.frame)))<=.18;
  const frontageSurface=declaredCoplanar?null:registeredFrontageWallSurface(original.localStart,original.localEnd,owner.geometry.building.surfaces);
  const frontageFrame=frontageSurface?facadeWallFrame(frontageSurface,owner,[owner]):null;
  const useFrontage=!declaredCoplanar&&frontageFrame!=null&&cropPlaneOffset(frontageFrame)<=.18;
  const renderTargets=useFrontage?[{index:declaredIndices[0]??0,surface:frontageSurface!,frame:frontageFrame!}]:declaredTargets.length?declaredTargets:(frontageSurface&&frontageFrame?[{index:declaredIndices[0]??0,surface:frontageSurface,frame:frontageFrame}]:[]);
  const frame=renderTargets[0]?.frame??null;
  const shapeFeatures:any={};const candidateObservations:any[]=[];const patches:any[]=[];const omissions:string[]=[];let analyzedTiers=0;
  if(!frame)omissions.push('No usable published facade surface');
  if(caseId!=='case-26'&&frame){
   for(const {index,surface,frame:f} of renderTargets){
   const r=structuredClone(original);r.renderSurfaceIndices=[index];
   const d:any={version:1,extractionVersion:'user-repair-development-preview-v1',buildingId:owner.id,geometryRevision:owner.geometryRevision,evidenceKey:r.evidenceKey,frontage:[r.localStart,r.localEnd],surfaceIndices:[index],sources:{}};
   for(const tier of ['full','ground']){
    const im=r.images[tier],analysis=complete.findLast((a:any)=>a.source.cropSha256===im.sha256);
    const ref=references.entries.find((e:any)=>e.caseId===caseId&&e.tier===tier);
    if(!analysis){if(index===renderTargets[0].index)omissions.push(`${tier}: ${ref?'partial manual shape repair only':'analysis unavailable'}`);if(!ref)continue;}
    if(analysis&&index===renderTargets[0].index)analyzedTiers++;
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
    const correction=corrections.cases[caseId]?.[tier];
    if(correction){if(correction.source&&(correction.source.cropSha256!==im.sha256||correction.source.captureDate!==im.date))throw Error('Stale development photo correction');features=features.filter((f:any)=>!correction.remove?.includes(f.id)).map((f:any)=>{const update=correction.update?.[f.id];if(!update)return f;const out={...f,...update,disposition:'agent-inspected'};for(const key of Object.keys(out))if(out[key]===null)delete out[key];return out;});}
    const spatialFix=spatial.cases[caseId]?.[tier];
    if(spatialFix){
     if(spatialFix.source.cropSha256!==im.sha256||spatialFix.source.captureDate!==im.date)throw Error('Stale spatial correction');
     features=features.filter((f:any)=>!spatialFix.remove?.includes(f.id)).map((f:any)=>{const update=spatialFix.update?.[f.id];if(!update)return f;const out={...f,...update,disposition:'agent-inspected'};for(const key of Object.keys(out))if(out[key]===null)delete out[key];return out;});
     features.push(...(spatialFix.add??[]).map((f:any)=>({...f,disposition:'agent-inspected'})));
    }
    const signRef=signReferences.corrections.find((entry:any)=>entry.caseId===caseId&&entry.kind==='tenant-sign');
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
    shapeFeatures[tier]=applyRetailSourceCorrections(caseId,tier,{features,width:im.width,height:im.height,cropSha256:im.sha256,captureDate:im.date},retailReview);
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
 if(caseId!=='case-26')for(const tier of ['full','ground'])if(!shapeFeatures[tier]){const im=original.images[tier],a=complete.findLast((a:any)=>a.source.cropSha256===im.sha256);if(a)shapeFeatures[tier]={features:a.proposal.features.map((f:any)=>({...f,id:`${tier}:${f.id}`,disposition:'machine-observed-unreviewed'})),width:im.width,height:im.height,cropSha256:im.sha256,captureDate:im.date};}
 for(const tier of ['full','ground']){const input=shapeFeatures[tier],fix=spatial.cases[caseId]?.[tier];if(input&&fix){
  if(fix.source.cropSha256!==input.cropSha256||fix.source.captureDate!==input.captureDate)throw Error('Stale spatial source study');
  input.features=input.features.filter((f:any)=>!fix.remove?.includes(f.id)).map((f:any)=>{const update=fix.update?.[f.id];const out={...f,...update,...(update?{disposition:'agent-inspected',correctionEvidenceDisposition:update.disposition}: {})};for(const key of Object.keys(out))if(out[key]===null)delete out[key];return out;});
  for(const added of fix.add??[])if(!input.features.some((f:any)=>f.id===added.id))input.features.push({...added,disposition:'agent-inspected'});
 }}
 for(const tier of ['full','ground'])if(shapeFeatures[tier])shapeFeatures[tier]=applyRetailSourceCorrections(caseId,tier,shapeFeatures[tier],retailReview);
 return {frame,candidateObservations,patches,omissions,analyzedTiers,shapeFeatures};
}
