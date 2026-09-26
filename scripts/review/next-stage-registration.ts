/** Candidate-registration audit. Native crop planes are useful geometry candidates,
 * never metric registrations until an independent image alignment is recorded. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import jpeg from 'jpeg-js';
import {prepareRegistration, type RegistrationInput} from '../city-appearance/fidelity/registration.ts';
import {AMSTERDAM_WORLD_ALIGNED,worldToEquirectangularPixel} from '../../src/canalRecall/facade/rectify.ts';

export const MAX_UNCERTAINTY_M=.15;
const dist=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function endpointComparison(a:[number[],number[]],b:[number[],number[]]){
 const direct=Math.max(dist(a[0],b[0]),dist(a[1],b[1])),reverse=Math.max(dist(a[0],b[1]),dist(a[1],b[0]));
 return {directEndpointErrorM:direct,reverseEndpointErrorM:reverse,signedDirection:direct<=reverse?1:-1,bestEndpointErrorM:Math.min(direct,reverse)};
}
export function nativeCandidate(source:any,native:any,binding:any,surfaceBaseNapM:number){
 const image=native?.images?.[source.tier],wall=native?.wall,plane=image?.plane;
 const dimensions={width:source.width,height:source.height};
 if(!image||!wall||!plane)return {status:'ambiguous',abstention:'native-source-plane-unavailable'};
 if(image.width!==source.width||image.height!==source.height)return {status:'ambiguous',abstention:'source-dimensions-mismatch',nativeDimensions:{width:image.width,height:image.height},declaredDimensions:dimensions};
 const dx=wall.end.x-wall.start.x,dy=wall.end.y-wall.start.y,length=Math.hypot(dx,dy),u=[dx/length,dy/length] as [number,number];
 const t=(p:any)=>(p.x-wall.start.x)*u[0]+(p.y-wall.start.y)*u[1];
 const planeAlong:[number,number]=[t(plane.start),t(plane.end)];
 const origin=binding.originRD;
 const selected=binding.frontage.map((p:number[])=>[p[0],p[1]]) as [number[],number[]];
 const nativeWall:[[number,number],[number,number]]=[[wall.start.x-origin.x,origin.y-wall.start.y],[wall.end.x-origin.x,origin.y-wall.end.y]];
 const geometry=endpointComparison(selected,nativeWall);
 const planeGeometry=endpointComparison(nativeWall,[[plane.start.x-origin.x,origin.y-plane.start.y],[plane.end.x-origin.x,origin.y-plane.end.y]]);
 const input:RegistrationInput={tier:source.tier,cropSha256:source.sha256,actualDimensions:dimensions,declaredDimensions:dimensions,cropMarginsPx:{left:0,top:0,right:0,bottom:0},surfaceIndex:binding.surfaceIndex,wallDirection:u,plane:{pixelEdges:[0,0,source.width,source.height],wallAlongM:planeAlong,napAtTopBottomM:[plane.topZ,plane.baseZ],surfaceBaseNapM},alignment:{wallIdentity:geometry.bestEndpointErrorM<=MAX_UNCERTAINTY_M?'ambiguous':'failed',boundaryEvidence:false,rooflineEvidence:false,cameraHeightResolved:false,orientationVerified:geometry.signedDirection===1,uncertaintyM:NaN}};
 const registration=prepareRegistration(input);
 return {status:'ambiguous',registration,source:{cropSha256:source.sha256,captureDate:source.captureDate,dimensions,plane,pose:image.pose,datum:image.datum,heightInferred:image.heightInferred,standoffM:image.standoff,obliquityDeg:image.obliquity},geometryBinding:geometry,planeVsNativeWall:planeGeometry,derivation:{wallDirection:u,wallLengthM:length,planeAlongM:planeAlong,sourceDatum:'NAP',canonicalDatum:'surface-base',pixelConvention:'pixel-edge'},missingEvidence:['independent pixel boundary correspondences','independent roofline correspondence','resolved camera height / vertical datum','measured registration uncertainty at or below 0.15 m']};
}
async function walk(dir:string):Promise<string[]>{const out:string[]=[];for(const e of await fs.readdir(dir,{withFileTypes:true})) {const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else if(e.name==='manifest.json')out.push(p);}return out;}
async function findNative(hashes:Set<string>){const found=new Map<string,any>();for(const file of await walk('.cache')){let m:any;try{m=JSON.parse(await fs.readFile(file,'utf8'));}catch{continue;}for(const record of m.records??[])for(const image of Object.values(record.images??{}) as any[])if(hashes.has(image?.sha256))found.set(image.sha256,{record,file});}return found;}
function draw(data:Uint8Array,x:number,y:number,width:number,height:number,colour:number[]){for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const px=Math.round(x+dx),py=Math.round(y+dy);if(px<0||py<0||px>=width||py>=height)continue;const at=(py*width+px)*4;data[at]=colour[0];data[at+1]=colour[1];data[at+2]=colour[2];}}
function line(data:Uint8Array,a:number[],b:number[],width:number,height:number,colour:number[]){const steps=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])));for(let i=0;i<=steps;i++)draw(data,a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps,width,height,colour);}
async function case24Overlay(root:string,native:any){
 const record=native.record,image=record.images.full,rawPath=path.join(root,'.cache/city-appearance/shared-panoramas',`${image.panoramaId}.jpg`),raw=jpeg.decode(await fs.readFile(rawPath),{useTArray:true,formatAsRGBA:true});
 const wall=record.wall,pose=image.pose,base=record.groundNAP,top=image.plane.topZ;
 const project=(p:any,z:number)=>worldToEquirectangularPixel({x:p.x,y:p.y,z},pose,raw,AMSTERDAM_WORLD_ALIGNED);
 const landmarks=[
  {id:'wall-start-ground',world:{point:wall.start,z:base},predicted:project(wall.start,base)},
  {id:'wall-end-ground',world:{point:wall.end,z:base},predicted:project(wall.end,base)},
  {id:'wall-start-plane-top',world:{point:wall.start,z:top},predicted:project(wall.start,top)},
  {id:'wall-end-plane-top',world:{point:wall.end,z:top},predicted:project(wall.end,top)},
 ];
 // The raw panorama makes the camera-model audit reviewable. No observed pixel
 // coordinates are asserted here: that would be a new manual measurement.
 const us=landmarks.map(x=>x.predicted[0]),vs=landmarks.map(x=>x.predicted[1]);let anchor=us[0];const unwrap=(u:number)=>{while(u-anchor>raw.width/2)u-=raw.width;while(u-anchor<-raw.width/2)u+=raw.width;return u;};const uu=us.map(unwrap),x0=Math.floor(Math.min(...uu)-180),x1=Math.ceil(Math.max(...uu)+180),y0=Math.max(0,Math.floor(Math.min(...vs)-120)),y1=Math.min(raw.height,Math.ceil(Math.max(...vs)+120)),w=x1-x0,h=y1-y0,pixels=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=((x0+x)%raw.width+raw.width)%raw.width,from=((y0+y)*raw.width+sx)*4,to=(y*w+x)*4;pixels[to]=raw.data[from];pixels[to+1]=raw.data[from+1];pixels[to+2]=raw.data[from+2];pixels[to+3]=255;}
 const local=(p:number[])=>[unwrap(p[0])-x0,p[1]-y0];for(const [a,b] of [[0,1],[1,3],[3,2],[2,0]])line(pixels,local(landmarks[a].predicted),local(landmarks[b].predicted),w,h,[30,245,120]);for(const mark of landmarks)draw(pixels,...local(mark.predicted),w,h,[255,70,40]);
 const out='scripts/review/next-stage-registration-case24-overlay.jpg';await fs.writeFile(path.join(root,out),jpeg.encode({width:w,height:h,data:Buffer.from(pixels)},92).data);
 return {path:out,rawPanorama:{path:path.relative(root,rawPath),panoramaId:image.panoramaId,dimensions:{width:raw.width,height:raw.height},sha256:crypto.createHash('sha256').update(await fs.readFile(rawPath)).digest('hex')},cameraModel:AMSTERDAM_WORLD_ALIGNED,landmarks:landmarks.map(x=>({...x,observedPixel:null,residualPx:null,residualM:null,measurementStatus:'not-measured; overlay supplies candidate only'})),reviewRequirement:'Record at least three source-pixel correspondences on the raw panorama, then solve residuals with a calibrated camera height and datum before considering <=0.15m acceptance.'};
}
const visual:any={
 'case-13':{full:'Tree canopy masks the roofline and left wall boundary; native full pose datum is track-unsolved.',ground:'Tree and lamp mask designated wall/pavement correspondences; camera height is inferred.'},
 'case-18':{full:'Foreground bus/sign blocks the lower façade contact and the native full pose datum is track-unsolved.',ground:'Ground crop may show entrance detail but no independently surveyed camera height or roofline anchor.'},
 'case-21':{full:'Distant crop shows a different date and lacks a ground contact anchor; no independent camera-height solution.',ground:'Recess perspective has multiple planes, so a single planar wall transform would be invalid without surface-specific anchors.'},
 'case-24':{full:'Roof and frontage are visible, but the supplied plane remains derived from a track-unsolved pose; no independent pixel-to-roof/boundary fit is saved.',ground:'Vehicle occludes pavement contact; camera height is inferred despite low obliquity.'},
 'case-14':{full:'Identity resolved by exact source hash, but source registration remains unverified.',ground:'Identity resolved by exact source hash, but source registration remains unverified.'},
};
export async function buildNextStage(root='.'){
 const regressions=JSON.parse(await fs.readFile(path.join(root,'scripts/review/facade-regressions.json'),'utf8'));
 const targets=regressions.cases.filter((c:any)=>['case-13','case-18','case-21','case-24','case-14'].includes(c.caseId));
 const hashes=new Set(targets.flatMap((c:any)=>Object.values(c.source).map((s:any)=>s.sha256)) as string[]);const native=await findNative(hashes);
 const cases=[];
 for(const item of targets){const tile=JSON.parse(gunzipSync(await fs.readFile(path.join(root,item.binding.tile.path))).toString());const owner=tile.owners.find((o:any)=>o.id===item.binding.buildingId);const origin=owner.geometry.frame.originRD;const binding={frontage:item.binding.frontage,surfaceIndex:item.binding.surfaceIndices[0],originRD:origin};const result:any={caseId:item.caseId,buildingId:item.binding.buildingId,geometryRevision:item.binding.geometryRevision,sourceIdentity:{},tiers:{}};
  for(const tier of ['full','ground'] as const){const source={...item.source[tier],tier};const file=path.join(root,source.path);const fileHash=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');const hashVerified=fileHash===source.sha256;const found=native.get(source.sha256);result.sourceIdentity[tier]=found?{resolved:true,manifest:found.file,observationId:found.record.id,buildingId:found.record.buildingId,hash:source.sha256,fileHashVerified:hashVerified}:{resolved:false,hash:source.sha256,fileHashVerified:hashVerified};result.tiers[tier]=found&&hashVerified?{...nativeCandidate(source,found.record,binding,found.record.groundNAP),visualReview:visual[item.caseId]?.[tier]}:{status:'ambiguous',abstention:hashVerified?'native-source-identity-unresolved':'source-file-hash-mismatch',visualReview:visual[item.caseId]?.[tier]};}
  cases.push(result);
 }
 const case24=native.get(targets.find((c:any)=>c.caseId==='case-24').source.full.sha256);const overlay=case24?await case24Overlay(root,case24):null;
 return {version:1,kind:'next-stage-registration-diagnostic',maxAcceptedUncertaintyM:MAX_UNCERTAINTY_M,canonicalDatum:'surface-base',pixelConvention:'pixel-edge',generatedAt:new Date().toISOString(),cases,case24Overlay:overlay};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const artifact=await buildNextStage('.');const bytes=JSON.stringify(artifact,null,2)+'\n';await fs.writeFile('scripts/review/next-stage-registration.json',bytes);console.log(JSON.stringify({cases:artifact.cases.length,registered:0,resolvedSources:artifact.cases.flatMap((c:any)=>Object.values(c.sourceIdentity)).filter((x:any)=>x.resolved).length,output:'scripts/review/next-stage-registration.json'}));}
