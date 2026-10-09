/** Private, multi-station source board. Reuses cached original pixels and the
 * shared panorama projection; eye height is explicitly approximate. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {perspectiveCrop} from '../street-appearance/perspective.ts';
const option=(name:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const inventoryPath=option('inventory'),output=option('output'),targets=option('targets')?.split(',');
if(!inventoryPath||!output||!targets?.length)throw Error('Use --inventory=... --targets=<recipe IDs> --output=<private directory>');
if(path.resolve(output)===path.resolve('public')||path.resolve(output).startsWith(path.resolve('public')+path.sep))throw Error('Source photos must remain private');
try{await fs.access(path.join(output,'views.json'));throw Error('Source board already exists; preserve it and use a new output directory');}
catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const inventory=JSON.parse(await fs.readFile(inventoryPath,'utf8'));
const cameras=new Map<string,{source:any;pose:{x:number;y:number}}>();
for(const entry of inventory.entries)for(const source of entry.images){
 if(cameras.has(source.panoramaId))continue;
 const manifest=JSON.parse(await fs.readFile(source.manifestPath,'utf8'));
 const record=manifest.records.find((r:any)=>r.id===entry.selectedFacade.replace(':e:','_e_'));
 const pose=record?.images[source.tier]?.pose;
 if(!pose||!Number.isFinite(pose.x+pose.y))throw Error('Missing cached source camera');
 cameras.set(source.panoramaId,{source,pose});
}
await fs.mkdir(output,{recursive:true});
const results=[];
for(const id of targets){
 if(!/^[a-z0-9-]+$/.test(id))throw Error('Invalid recipe ID');
 const input=JSON.parse(await fs.readFile(`docs/references/canalhouse-recipes/${id}-recipe-input.json`,'utf8'));
 const admission=JSON.parse(await fs.readFile(input.admissionFile,'utf8'));
 const [a,b]=admission.principalFront.orientedLeftToRightAsSeenFromCanal;
 const center={x:(a[0]+b[0])/2,y:(a[1]+b[1])/2};
 const width=Math.hypot(b[0]-a[0],b[1]-a[1]);
 for(const [panoId,{source,pose}] of cameras){
  const distance=Math.hypot(center.x-pose.x,center.y-pose.y);
  if(distance>60||distance<1)continue;
  const heading=Math.atan2(center.x-pose.x,center.y-pose.y)*180/Math.PI;
  const targetHeight=admission.heights.bodyEavesNominalM*1.15;
  const pitch=Math.atan2(targetHeight-2.5,distance)*180/Math.PI;
  const fov=Math.max(12,Math.min(85,2*Math.atan(width*1.1/distance)*180/Math.PI));
  const filename=`${id}-${panoId}.jpg`;
  await fs.writeFile(path.join(output,filename),perspectiveCrop(await fs.readFile(source.originalPath),heading,1000,800,fov,pitch));
  results.push({id,filename,panoId,captureDate:source.captureDate,sourceUrl:source.sourceUrl,originalPath:source.originalPath,originalSha256:source.originalSha256,distanceM:distance,headingDeg:heading,pitchDeg:pitch,fovDeg:fov,eyeHeightM:2.5,metricAccepted:false});
 }
}
await fs.writeFile(path.join(output,'views.json'),JSON.stringify({schemaVersion:1,kind:'private-source-perspective-board',results,limits:['Approximate pavement eye height; cached horizontal camera pose.','Viewpoint selection only, no calibrated metric/photo acceptance.']},null,2)+'\n');
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
await fs.writeFile(path.join(output,'index.html'),`<!doctype html><meta charset="utf-8"><title>Source viewpoints</title><style>body{font:16px system-ui;background:#eee}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:16px}img{width:100%}figure{margin:0;background:white;padding:12px}</style><h1>Cached crown viewpoints</h1><p>Private source board. Eye height approximate; these crops are not metric observations.</p><main>${results.map(r=>`<figure><img src="${esc(r.filename)}"><figcaption>${esc(r.id)} · ${esc(r.captureDate)} · ${r.distanceM.toFixed(1)}m · ${esc(r.panoId)}</figcaption></figure>`).join('')}</main>`);
console.log(JSON.stringify({output,views:results.length,newAcquisition:0,metricAccepted:false}));
