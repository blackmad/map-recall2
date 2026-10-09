/** Recover a missing owner view from an existing dated panorama camera.
 * Camera provenance stays independent of the target's surveyed facade identity. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {perspectiveCrop} from '../street-appearance/perspective.ts';
const option=(name:string)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
const inventoryFile=option('inventory'),sourceFile=option('source-inventory'),stage=option('stage');
if(!inventoryFile||!sourceFile||!stage)throw Error('Use --inventory=... --source-inventory=... --stage=...');
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
interface Image {tier:string;path:string;manifestPath:string;originalPath:string}
interface Entry {address:string;cachedOwnerId:string;selectedFacade:string;orderedFrontageRD:{x:number;y:number}[];images:Image[]}
interface View {pose:{x:number;y:number;z:number};panoramaId:string;panoramaSha256:string;url:string;date:string;datum:string;heightInferred:boolean;plane?:unknown;visibility?:unknown;standoff?:unknown;obliquity?:unknown}
interface RecordView {id:string;images:Record<string,View>}
const inventory:{entries:Entry[]}=JSON.parse(await fs.readFile(inventoryFile,'utf8'));
const sources:{entries:Entry[]}=JSON.parse(await fs.readFile(sourceFile,'utf8'));
if(sources.entries.length!==1||inventory.entries.length!==1)throw Error('Select one explicit target and one source camera owner');
const target=inventory.entries[0],source=sources.entries[0],number=target.address.split(' ').at(-1);
const native=JSON.parse(await fs.readFile(path.join(stage,number+'-native-screen.json'),'utf8'));
if(!native.source.featureIds.includes('NL.IMBAG.Pand.'+target.cachedOwnerId))throw Error('Missing exact native target identity');
const joins=JSON.parse(await fs.readFile(path.join(stage,'official-parent-joins.json'),'utf8'));
if(!joins.some((j:{pand:string})=>j.pand===target.cachedOwnerId))throw Error('Missing official target parent join');
const [a,b]=native.exact as number[][];
const generated:{tier:string;path:string;sha256:string;captureDate:string;panoramaId:string;nativeDimensions:number[];manifestPath:string;originalPath:string;sourceUrl:string;metricEligible:boolean;derivationKey:string}[]=[];
const views:Record<string,object>={};
const sourceImage=source.images.find(i=>i.tier==='full');if(!sourceImage)throw Error('Missing source camera manifest');
const manifestBytes=await fs.readFile(sourceImage.manifestPath),sourceManifest=JSON.parse(manifestBytes.toString());
const record:RecordView|undefined=sourceManifest.records.find((r:RecordView)=>r.id===source.selectedFacade.replace(':e:','_e_'));
if(!record)throw Error('Missing source camera record');
const manifestPath=path.resolve(stage,number+'-neighbor-camera-manifest.json');
const roofCamera=record.images.roof?.pose;if(!roofCamera)throw Error('Missing roof camera');
const roofDistance=Math.hypot((a[0]+b[0])/2-roofCamera.x,(a[1]+b[1])/2-roofCamera.y);
const frontWallHeights=native.frontWallTopHeights.map((v:[string,number])=>v[1]);
const frontRoofHeights=(native.roofSurfaceSummary??[]).filter((r:{depthM:number[]})=>r.depthM[0]<.2).map((r:{heightM:number[]})=>r.heightM[1]);
const framingHeightBasis=frontWallHeights.length?'front-wall-top':frontRoofHeights.length?'front-roof-max':'front-endpoint-max';
const framingBodyHeight=Math.max(...(frontWallHeights.length?frontWallHeights:frontRoofHeights.length?frontRoofHeights:native.endpointHeights.flat()));
if(!Number.isFinite(framingBodyHeight)||framingBodyHeight<=0)throw Error('Missing source height for reference framing');
// Framing only, not a measured roof/eye height. Low distant houses otherwise
// disappear below a fixed45degree crop. An explicit pitch can override this.
const roofPitch=Number(option('roof-pitch')??Math.atan2(framingBodyHeight+2-2.5,roofDistance)*180/Math.PI);
if(!Number.isFinite(roofPitch)||Math.abs(roofPitch)>80)throw Error('Invalid roof reference pitch');
const specs=[['context',110,20,1400,1000],['full',95,22,1000,1400],['ground',95,-10,1200,1200],['roof',65,roofPitch,1100,1000]] as const;
const key=hash(JSON.stringify({target:target.cachedOwnerId,front:native.exact,sourceManifestSha256:hash(manifestBytes),record:record.id,specs,version:5}));
for(const [tier,fov,pitch,w,h] of specs){
 const original=source.images.find(i=>i.tier===tier),view=record.images[tier];if(!original||!view)throw Error('Missing source tier '+tier);
 const bytes=await fs.readFile(original.originalPath);if(hash(bytes)!==view.panoramaSha256)throw Error('Original panorama checksum mismatch');
 const heading=Math.atan2((a[0]+b[0])/2-view.pose.x,(a[1]+b[1])/2-view.pose.y)*180/Math.PI;
 const crop=perspectiveCrop(bytes,heading,w,h,fov,pitch),file=path.resolve(stage,number+'-'+tier+'-neighbor-perspective.jpg');
 await fs.writeFile(file,crop);
 // These assertions described the camera-selection owner, not the new target.
 const {plane:sourceOwnerPlane,visibility:sourceOwnerVisibility,standoff:sourceOwnerStandoffM,obliquity:sourceOwnerObliquityDeg,...cameraView}=view;
 views[tier]={...cameraView,sourceOwnerPlane,sourceOwnerVisibility,sourceOwnerStandoffM,sourceOwnerObliquityDeg,targetVisibility:'not-evaluated; inspect actual target view',width:w,height:h,file:path.basename(file),sha256:hash(crop),projection:{type:'perspective',headingDeg:heading,pitchDeg:pitch,fovDeg:fov},metricEligible:false};
 generated.push({tier,path:file,sha256:hash(crop),captureDate:view.date,panoramaId:view.panoramaId,nativeDimensions:[4000,2000],manifestPath,originalPath:original.originalPath,sourceUrl:view.url,metricEligible:false,derivationKey:key});
}
const manifest={version:1,kind:'derived-neighbor-camera-projections',sourceHash:key,roofFraming:{pitchDeg:roofPitch,bodyHeightM:framingBodyHeight,framingHeightBasis,eyeHeightM:2.5,roofAllowanceM:2,note:'Approximate framing only; no roof height or camera altitude measurement'},derivedFrom:{manifestPath:path.resolve(sourceImage.manifestPath),manifestSha256:hash(manifestBytes),recordId:record.id,cameraSelectionOwnerId:source.cachedOwnerId},targetPandId:target.cachedOwnerId,targetFrontageRD:native.exact,metricEligible:false,records:[{id:target.selectedFacade.replace(':e:','_e_'),buildingId:target.cachedOwnerId,images:views}]};
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
target.images=generated;await fs.writeFile(inventoryFile,JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify({target:target.cachedOwnerId,sourceCameraOwner:source.cachedOwnerId,views:generated.length,manifestPath,status:'derived-camera-references;visual-identity-review-required'}));
