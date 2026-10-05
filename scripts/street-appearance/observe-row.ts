/** Source-only acquisition for frozen row samples. No inference or runtime writes.
 * npx tsx scripts/street-appearance/observe-row.ts --row-plan=artifacts/.../next-canal-row.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { perspectiveCrop } from './perspective.ts';
const arg=(name:string,fallback='')=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const planFile=arg('row-plan');if(!planFile)throw Error('--row-plan is required');
let output=arg('output','artifacts/street-appearance/register-transition/next-canal-source');
const privateRoot=path.resolve(arg('source-repo','../map-recall2-source-data'));
const digest=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const planBytes=await fs.readFile(planFile),plan=JSON.parse(planBytes.toString());
const evaluation=process.argv.includes('--evaluation');
if(evaluation){
 if(plan.sourceRole!=='evaluation-heldout'||plan.inferenceUse!=='forbidden')throw Error('--evaluation requires evaluation-heldout plan; primary inference use is forbidden');
 if(plan.fixedSamples.representatives.length||plan.fixedSamples.transitions.length)throw Error('Evaluation plan cannot contain primary training samples');
 const stations=plan.fixedSamples.evaluations;
 if(stations?.length!==2||stations.some((s:any,i:number)=>s.role!=='evaluation-heldout'||s.fraction!==[.25,.75][i]||Math.abs(s.alongM-plan.lengthM*s.fraction)>1e-8))throw Error('Heldout requires fixed25% and75% evaluation stations');
 for(const [file,sha] of [[plan.parentPlanFile,plan.parentPlanSha256],[plan.candidateCatalogFile,plan.candidateCatalogSha256]])if(!file||digest(await fs.readFile(file))!==sha)throw Error('Evaluation parent/candidate freeze mismatch');
 const parent=JSON.parse(await fs.readFile(plan.parentPlanFile,'utf8')),heldout=parent.fixedSamples.heldout;
 if(plan.proposalId!==heldout.id||plan.proposalId===parent.proposalId||! /^[a-z0-9-]+$/.test(plan.proposalId))throw Error('Evaluation archive must use original distinct heldout identity');
 for(const key of ['segment','side','reachM','lengthM','nativeInventory'])if(JSON.stringify(plan[key])!==JSON.stringify(heldout[key]))throw Error(`Evaluation changed frozen heldout ${key}`);
 if(!arg('output'))output=`artifacts/street-appearance/rows/${plan.proposalId}/evaluation-source`;
 if(path.resolve(output)===path.resolve('artifacts/street-appearance/register-transition/next-canal-source'))throw Error('Evaluation cannot overwrite primary source output');
}else if(plan.sourceRole==='evaluation-heldout')throw Error('Evaluation source requires --evaluation; primary inference use is forbidden');
const[a,b]=plan.segment,kx=111320*Math.cos(a[1]*Math.PI/180),ky=110540;
const dx=(b[0]-a[0])*kx,dy=(b[1]-a[1])*ky,length=Math.hypot(dx,dy);
const headingDeg=(Math.atan2(-dy*plan.side,dx*plan.side)*180/Math.PI+360)%360;
const samples=evaluation?plan.fixedSamples.evaluations:[...plan.fixedSamples.representatives.map((s:any)=>({...s,role:'training-representative'})),
  ...plan.fixedSamples.transitions.map((s:any)=>({...s,alongM:(s.alongExtentM[0]+s.alongExtentM[1])/2,role:'training-transition'}))];
await fs.mkdir(`${output}/raw`,{recursive:true});await fs.mkdir(`${output}/processed`,{recursive:true});
const files:any[]=[],failures:any[]=[],evidence:any[]=[];
async function raw(url:string,filename:string,kind:string){
 const file=`${output}/raw/${filename}`;let bytes:Buffer,provenance:any;
 try{bytes=await fs.readFile(file);provenance=JSON.parse(await fs.readFile(file+'.provenance.json','utf8'));if(digest(bytes)!==provenance.sha256)throw Error('Cached source checksum mismatch');}
 catch(error){if((error as any).code!=='ENOENT')throw error;const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}: ${url}`);bytes=Buffer.from(await response.arrayBuffer());provenance={url,retrievedAt:new Date().toISOString(),httpStatus:response.status,contentType:response.headers.get('content-type'),sha256:digest(bytes),kind,accessState:'successful original HTTP bytes'};await fs.writeFile(file,bytes);await fs.writeFile(file+'.provenance.json',JSON.stringify(provenance,null,2)+'\n');}
 files.push({file,...provenance});return bytes;
}
// One bounded discovery covers only this plan's fixed extent.
const padX=14/kx,padY=14/ky;
const bbox=[Math.min(a[0],b[0])-padX,Math.min(a[1],b[1])-padY,Math.max(a[0],b[0])+padX,Math.max(a[1],b[1])+padY].join(',');
let next:string|null=`https://api.data.amsterdam.nl/panorama/panoramas/?bbox=${bbox}&page_size=100`;
const cameras:any[]=[];let page=0;
try{while(next){if(page>=20)throw Error('Discovery page bound exceeded');const json=JSON.parse((await raw(next,`discovery-${++page}.json`,'original-panorama-discovery-response')).toString());cameras.push(...json._embedded.panoramas);next=json._links?.next?.href??null;}}
catch(error){if(!evaluation)throw error;failures.push({role:'evaluation-heldout',stage:'discovery',reason:String(error),at:new Date().toISOString()});}
for(const sample of samples){try{
 const target=[a[0]+(b[0]-a[0])*sample.alongM/length,a[1]+(b[1]-a[1])*sample.alongM/length];
 const nearby=cameras.map(c=>({camera:c,distance:Math.hypot((c.geometry.coordinates[0]-target[0])*kx,(c.geometry.coordinates[1]-target[1])*ky)})).filter(c=>c.distance<=12);
 if(!nearby.length)throw Error('No camera within fixed 12m radius');
 const nearest=Math.min(...nearby.map(c=>c.distance));
 const choice=nearby.filter(c=>c.distance<=nearest+4).sort((x,y)=>String(y.camera.timestamp).localeCompare(String(x.camera.timestamp))||x.distance-y.distance)[0];
 const c=choice.camera,url=c._links.equirectangular_medium.href;
 const bytes=await raw(url,c.pano_id+'.jpg','original-downloaded-panorama');if(bytes[0]!==255||bytes[1]!==216)throw Error('Panorama is not JPEG');
 const perspective={headingDeg,width:1200,height:900,fovDeg:110,pitchDeg:35};
 const crop=perspectiveCrop(bytes,headingDeg,perspective.width,perspective.height,perspective.fovDeg,perspective.pitchDeg);
 const cropFile=`${output}/processed/${sample.id}.jpg`;await fs.writeFile(cropFile,crop);
 evidence.push({id:sample.id,role:sample.role,alongM:sample.alongM,purpose:sample.purpose,target,selection:{radiusM:12,newestWithinNearestPlusM:4,cameraDistanceM:choice.distance},panoramaId:c.pano_id,captureDate:c.timestamp,camera:c.geometry,sourceUrl:url,sourceFile:`${output}/raw/${c.pano_id}.jpg`,sourceSha256:digest(bytes),cropFile,cropSha256:digest(crop),perspective,observationState:'unreviewed; central-half row rhythm only; no exact building registration'});
 console.log(`${sample.id}: ${c.timestamp} at ${choice.distance.toFixed(1)}m`);
 }catch(error){failures.push({id:sample.id,role:sample.role,reason:String(error),at:new Date().toISOString()});}}
const manifest={schemaVersion:1,sourceRole:evaluation?'evaluation-heldout':'training-primary',inferenceUse:evaluation?'forbidden':'primary',planFile,planSha256:digest(planBytes),proposalId:plan.proposalId,...(evaluation?{parentPlanSha256:plan.parentPlanSha256,candidateCatalogSha256:plan.candidateCatalogSha256}:{}),reproduction:`npx tsx scripts/street-appearance/observe-row.ts --row-plan=${planFile} --output=${output}${evaluation?' --evaluation':''}`,attribution:'Gemeente Amsterdam panorama CC BY 4.0',cameraConvention:'World aligned; heading clockwise from north; established perspectiveCrop convention.',purpose:evaluation?'Fixed heldout evaluation only; no appearance inspection, inference or tuning permitted during acquisition.':'Fresh primary-row current-appearance check; register supplies architectural questions, photos establish current palette/opening/transition rhythm.',heldout:{role:evaluation?'evaluation-only; sources acquired without inspection':'untouched; no heldout sample requested or inspected',id:plan.fixedSamples.heldout.id},files,evidence,failures};
await fs.writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(`${output}/row-plan.json`,planBytes);
const archive=`streets/${plan.proposalId}/${output}`;const copies:any[]=[];
for(const sub of ['raw','processed'])for(const name of(await fs.readdir(`${output}/${sub}`)).sort())copies.push({from:`${output}/${sub}/${name}`,to:`${archive}/${sub}/${name}`,classification:sub==='raw'?'original source or provenance':'processed perspective'});
for(const name of ['manifest.json','row-plan.json'])copies.push({from:`${output}/${name}`,to:`${archive}/${name}`,classification:'source manifest or frozen plan'});
for(const copy of copies){const bytes=await fs.readFile(copy.from),target=path.join(privateRoot,copy.to);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);copy.sha256=digest(bytes);if(digest(await fs.readFile(target))!==copy.sha256)throw Error('Private copy checksum mismatch');}
const privateManifest=path.join(privateRoot,`streets/${plan.proposalId}/archive-manifest.json`);await fs.writeFile(privateManifest,JSON.stringify({schemaVersion:1,sourceRole:manifest.sourceRole,inferenceUse:manifest.inferenceUse,sourceRepository:'blackmad/map-recall2',planSha256:digest(planBytes),...(evaluation?{parentPlanSha256:plan.parentPlanSha256,candidateCatalogSha256:plan.candidateCatalogSha256}:{}),attribution:manifest.attribution,rawProcessedSeparation:'Original HTTP bytes and provenance in raw; derived crops in processed. CaptureDate and retrieval time remain distinct.',copies,failures},null,2)+'\n');
console.log(JSON.stringify({manifest:`${output}/manifest.json`,privateManifest,samples:evidence.length,failures:failures.length}));
