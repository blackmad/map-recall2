import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildSourceFacadeOwnerCandidate } from './source-to-owner-candidate.js';
import { stageOwnerCandidateOutput } from './staged-owner-output.js';

const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const centroid = (owner: any) => {
  const footprint=owner.geometry?.building?.footprint,ring=footprint?.type==='Polygon'?footprint.coordinates[0]:footprint?.coordinates?.[0]?.[0];
  if(!ring?.length)return null;const points=ring.length>1&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1]?ring.slice(0,-1):ring;
  return points.reduce((sum:number[],point:number[])=>[sum[0]+point[0]/points.length,sum[1]+point[1]/points.length],[0,0]);
};
async function contextOwners(root:string,manifest:any,target:any){const centre=centroid(target),owners:any[]=[];if(!centre)throw Error('Case 30 footprint unavailable');for(const tile of manifest.tiles){const bytes=await fs.readFile(path.join(root,'public',tile.url));if(digest(bytes)!==tile.sha256)throw Error(`Corrupt context tile ${tile.key}`);for(const owner of JSON.parse(gunzipSync(bytes).toString()).owners){if(owner.id===target.id)continue;const other=centroid(owner);if(other&&Math.hypot(other[0]-centre[0],other[1]-centre[1])<=52)owners.push(owner);}}return owners.sort((a,b)=>a.id.localeCompare(b.id));}

export async function buildCase30GlazedBalconyDoorCandidate(root='.'){
  const casesPath='public/data/facade-repair-preview/cases.json',correctionPath='scripts/review/case30-glazed-balcony-door-correction.json',pointerPath='public/data/city-expansion/current.json';
  const [casesBytes,correctionBytes,pointerBytes]=await Promise.all([fs.readFile(path.join(root,casesPath)),fs.readFile(path.join(root,correctionPath)),fs.readFile(path.join(root,pointerPath))]);
  const pointer=JSON.parse(pointerBytes.toString()),manifestPath=`public/data/city-expansion/releases/${pointer.releaseId}/manifest.json`,manifestBytes=await fs.readFile(path.join(root,manifestPath)),manifest=JSON.parse(manifestBytes.toString());
  const cases=JSON.parse(casesBytes.toString()),correction=JSON.parse(correctionBytes.toString()),item=cases.cases.find((entry:any)=>entry.caseId===correction.caseId);
  if(!item||item.owner.id!==correction.buildingId)throw Error('Case 30 owner binding unavailable');
  const observation=item.candidateObservations?.find((entry:any)=>entry.id===correction.observationId);
  if(!item.shapeFeatures?.full||!item.shapeFeatures?.ground||!observation?.images?.full||!observation?.images?.ground)throw Error('Case 30 source evidence unavailable');
  const source=(features:any,image:any)=>({...features,projection:{plane:image.plane,localToNAPOffsetM:.65}});
  const preappliedSourceFeatureOverrides:any[]=[];
  const pendingSourceFeatureOverrides=correction.sourceFeatureOverrides.filter((override:any)=>{const feature=item.shapeFeatures.full.features.find((entry:any)=>entry.id===override.featureId),current=feature&&digest(JSON.stringify(feature));if(current===override.expectedFeatureSha256)return true;if(current===override.expectedResultFeatureSha256){const repair=correction.sourceGeometryRepair?.find((entry:any)=>entry.featureId===override.featureId);preappliedSourceFeatureOverrides.push({featureId:override.featureId,sourceCropSha256:override.sourceCropSha256,resultFeatureSha256:current,basis:override.basis,...(repair?{repairBasis:repair.basis}:{}),status:'already-applied-in-source-packet'});return false;}throw Error(`Case30 source feature is neither exact before nor exact corrected result: ${override.featureId}`);});
  const effectiveCorrection={...correction,sourceFeatureOverrides:pendingSourceFeatureOverrides};
  const result=buildSourceFacadeOwnerCandidate(item.owner,{...effectiveCorrection,sources:{full:source(item.shapeFeatures.full,observation.images.full),ground:source(item.shapeFeatures.ground,observation.images.ground)}});
  const context=await contextOwners(root,manifest,item.owner),fullImage=observation.images.full,origin=item.owner.geometry.frame.originRD;
  const sourceCameraLocal={x:fullImage.pose.x-origin.x,y:fullImage.pose.z-.65,z:origin.y-fullImage.pose.y};
  const planeMid={x:(fullImage.plane.start.x+fullImage.plane.end.x)/2-origin.x,y:8,z:origin.y-(fullImage.plane.start.y+fullImage.plane.end.y)/2};
  const dx=sourceCameraLocal.x-planeMid.x,dz=sourceCameraLocal.z-planeMid.z,length=Math.hypot(dx,dz),distance=20;
  if(!(length>0))throw Error('Case30 source camera coincides with facade plane');
  const streetContextFraming={kind:'normal-perspective-wide-street-eye-context',sourceEyeLocal:sourceCameraLocal,frontWallTargetLocal:planeMid,inferredInspectionEyeLocal:{x:planeMid.x+dx/length*distance,y:sourceCameraLocal.y,z:planeMid.z+dz/length*distance},inferredHorizontalDistanceM:distance,assumedVerticalFovDeg:54,targetY:planeMid.y,positionStatus:'inferred source-side inspection position; walking-ground validity unverified',fovStatus:'assumed',targetStatus:'source-plane midpoint'};
  const unresolved=['Native roof geometry occludes most of the top source opening in the actual-owner view; only its sill remains visible. No roof correction or whole-facade fidelity claim is included.','Ground material stripe moiré remains visible in the actual-owner view and is outside this three-door repair.'];
  const packet={version:1,kind:'source-to-owner-facade-candidate',generatedAt:new Date().toISOString(),target:{caseId:item.caseId,buildingId:item.owner.id,address:item.address,candidateLabel:'Glazed balcony-door candidate',scopeNote:correction.scopeNote,baseline:item.owner,candidate:result.owner},contextOwners:context,provenance:{...result.provenance,preappliedSourceFeatureOverrides,unresolved,source:{publicCropUrl:fullImage.publicUrl,cropSha256:fullImage.sha256,dimensions:{width:fullImage.width,height:fullImage.height},captureDate:fullImage.date,pose:fullImage.pose,samplingPlane:fullImage.plane,localToNAPOffsetM:.65},sourceCameraLocal,streetContextFraming,inputs:{casesJson:{path:casesPath,sha256:digest(casesBytes)},correction:{path:correctionPath,sha256:digest(correctionBytes)},activeReleasePointer:{path:pointerPath,sha256:digest(pointerBytes),releaseId:pointer.releaseId},activeReleaseManifest:{path:manifestPath,sha256:digest(manifestBytes)}},context:{ownerCount:context.length,radiusM:52,targetExcluded:true},releaseActivation:'none'}};
  const packetText=JSON.stringify(packet,null,2)+'\n',livePublicPath='public/canal-drive/data/case30-glazed-balcony-door-preview.json',codePaths=['scripts/review/build-case30-glazed-balcony-door-candidate.ts','scripts/review/source-to-owner-candidate.ts','src/canalRecall/facadeDescription.ts','src/canalRecall/cityAppearanceFacadeRecipes.ts'];
  const inputBindings=[{path:casesPath,sha256:digest(casesBytes)},{path:correctionPath,sha256:digest(correctionBytes)},{path:pointerPath,sha256:digest(pointerBytes)},{path:manifestPath,sha256:digest(manifestBytes)},{path:`public${fullImage.publicUrl}`,sha256:fullImage.sha256},{path:`public${observation.images.ground.publicUrl}`,sha256:observation.images.ground.sha256},...await Promise.all(codePaths.map(async file=>({path:file,sha256:digest(await fs.readFile(path.join(root,file)))})))];
  return {...await stageOwnerCandidateOutput({root,caseId:'case30',packetText,livePublicPath,inputBindings}),candidateGeometryRevision:result.owner.geometryRevision,contextOwners:context.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))buildCase30GlazedBalconyDoorCandidate().then(value=>console.log(JSON.stringify(value))).catch(error=>{console.error(error);process.exitCode=1;});
