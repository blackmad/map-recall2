/** Bounded alternative-year reference views from already cached source cameras. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {perspectiveCrop} from '../street-appearance/perspective.ts';
const opt=(k:string)=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3);
const admissionFile=opt('admission'),manifestFile=opt('manifest'),output=opt('output');
if(!admissionFile||!manifestFile||!output)throw Error('Use --admission=source-admission.json --manifest=cached-evidence/manifest.json --output=new-private-stage');
const out=path.resolve(output);
if(out.startsWith(path.resolve('public')+path.sep))throw Error('Reference photos belong in private staging, not public assets');
try{await fs.access(out);throw Error('Preserve existing references: choose a new stage');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const admission=JSON.parse(await fs.readFile(admissionFile,'utf8')),manifestBytes=await fs.readFile(manifestFile),manifest=JSON.parse(manifestBytes.toString());
const [a,b]=admission.principalFront.orientedLeftToRightAsSeenFromCanal,width=Math.hypot(b[0]-a[0],b[1]-a[1]);
if(!Number.isFinite(width)||width<=0)throw Error('Invalid source-selected front');
const center=[(a[0]+b[0])/2,(a[1]+b[1])/2],normal=[(b[1]-a[1])/width,-(b[0]-a[0])/width];
const roofNap=admission.heights.groundNapM+admission.heights.bodyEavesNominalM+1.5;
if(!Number.isFinite(roofNap))throw Error('Invalid provisional roof target');
const cameras=new Map<string,any>();
for(const record of manifest.records??[])for(const image of Object.values(record.images??{}) as any[]){
 if(!image.pose||!image.date||!image.panoramaId||!image.panoramaSha256)continue;
 const {x,y,z}=image.pose;if(![x,y,z].every(Number.isFinite))continue;
 const dx=x-center[0],dy=y-center[1],distance=Math.hypot(dx,dy),standoff=dx*normal[0]+dy*normal[1];
 if(distance<8||distance>45||standoff<6)continue;
 const obliquity=Math.acos(Math.min(1,standoff/distance))*180/Math.PI;
 if(obliquity>60)continue;
 const year=Number(image.date.slice(0,4));if(!Number.isInteger(year)||year<1900||year>2100)continue;
 cameras.set(image.panoramaId,{...image,year,distance,standoff,obliquity,score:Math.abs(standoff-20)+obliquity*.18});
}
const byYear=new Map<number,any[]>();for(const camera of cameras.values())byYear.set(camera.year,[...(byYear.get(camera.year)??[]),camera]);
const selected=[...byYear.entries()].sort((a,b)=>b[0]-a[0]).slice(0,3).flatMap(([,views])=>views.sort((a,b)=>a.score-b.score||a.panoramaId.localeCompare(b.panoramaId)).slice(0,2));
await fs.mkdir(out,{recursive:true});const views:any[]=[],gaps:any[]=[];
for(const camera of selected){
 if(path.basename(camera.panoramaId)!==camera.panoramaId)throw Error('Invalid cached panorama identifier');
 const original=path.resolve(path.dirname(manifestFile),'panoramas',camera.panoramaId+'.jpg');
 let bytes:Buffer;try{bytes=await fs.readFile(original);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;gaps.push({panoramaId:camera.panoramaId,status:'cached metadata but original file missing'});continue;}
 const sha=createHash('sha256').update(bytes).digest('hex');if(sha!==camera.panoramaSha256)throw Error('Cached original panorama checksum mismatch');
 const heading=Math.atan2(center[0]-camera.pose.x,center[1]-camera.pose.y)*180/Math.PI,pitch=Math.atan2(roofNap-camera.pose.z,camera.distance)*180/Math.PI;
 const file=`${camera.year}-${views.length+1}-roof-perspective.jpg`,crop=perspectiveCrop(bytes,heading,1200,900,65,pitch);
 await fs.writeFile(path.join(out,file),crop);
 views.push({file,cropSHA256:createHash('sha256').update(crop).digest('hex'),panoramaId:camera.panoramaId,captureDate:camera.date,sourceUrl:camera.url,originalPath:original,originalSHA256:sha,sourceCameraPose:camera.pose,standoffM:camera.standoff,obliquityDeg:camera.obliquity,projection:{headingDeg:heading,pitchDeg:pitch,fovDeg:65,width:1200,height:900,convention:'municipal world-aligned; no vehicle rotation'},datum:camera.datum,heightInferred:camera.heightInferred,metricEligible:false,role:'Alternative roof reference; architectural interpretation pending visual inspection'});
}
const report={id:admission.officialIdentity.pandId,admissionFile,manifestFile,manifestSHA256:createHash('sha256').update(manifestBytes).digest('hex'),generatedAt:new Date().toISOString(),selection:'At most two frontal cached cameras per year, at most three years; 8–45m range and <=60deg obliquity',provisionalRoofTargetNapM:roofNap,views,gaps,limits:['Roof target/camera height are drawing approximations, not metric registration.','Different poses/dates can show alterations and occlusions; compare identities before inferring assemblies.','Reference pixels never enter generated building assets.','No network requests, archive sync, source-profile or game acceptance.']};
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output:out,views:views.length,years:[...new Set(views.map(v=>v.captureDate.slice(0,4)))],gaps:gaps.length,status:'reference-views-unreviewed'}));
