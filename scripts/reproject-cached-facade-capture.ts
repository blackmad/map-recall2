/** Alternate cached capture for extraction diagnosis; never overwrite source evidence. */
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import jpeg from 'jpeg-js';
import {AMSTERDAM_WORLD_ALIGNED,rectifyFacade} from '../src/canalRecall/facade/rectify.ts';
const [recipePath,evidencePath,tier,outputDir,topString]=process.argv.slice(2);
if(!recipePath||!evidencePath||!['ground','roof','full'].includes(tier)||!outputDir||!Number.isFinite(Number(topString)))throw Error('Usage: recipe evidence capture-tier output-dir inferred-top-NAP');
if(!path.resolve(outputDir).startsWith(path.resolve('artifacts')+path.sep))throw Error('Diagnostic outputs must stay under artifacts');
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8')),sha=(b:Uint8Array)=>crypto.createHash('sha256').update(b).digest('hex');
const recipe=await read(recipePath),evidence=await read(evidencePath);
if(evidence.ownerId!==recipe.buildingId||evidence.geometryRevision!==recipe.geometryRevision)throw Error('Owner/revision mismatch');
const original=evidence.derived.find((i:any)=>i.tier===tier);if(!original)throw Error('Capture tier missing');
const manifest=await read(original.manifestPath),record=manifest.records.find((r:any)=>r.buildingId===recipe.buildingId&&r.images?.[tier]?.panoramaId===original.panoramaId);
if(!record)throw Error('Matching source capture missing');
const source=record.images[tier],bytes=await fs.readFile(path.join(path.dirname(original.manifestPath),'panoramas',source.panoramaId+'.jpg'));
if(sha(bytes)!==source.panoramaSha256)throw Error('Panorama hash mismatch');
const decoded=jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true,maxMemoryUsageInMB:1024}),frame=recipe.placement.sourceRDFrame;
const rd=(x:number)=>({x:frame.anchorRD[0]+x*frame.xAxisRD[0],y:frame.anchorRD[1]+x*frame.xAxisRD[1]});
await fs.mkdir(outputDir,{recursive:true});const derived=[];
for(const [id,scale] of [['selected-front',1],['wider-context',2.4]] as const){
 const w=recipe.frontages[0].width,left=w*(1-scale)/2,right=w*(1+scale)/2;
 const plane={start:rd(left),end:rd(right),baseZ:source.plane.baseZ,topZ:Number(topString)};
 if(plane.topZ<=plane.baseZ)throw Error('Invalid diagnostic height range');
 const crop=rectifyFacade(decoded,source.pose,plane,{camera:AMSTERDAM_WORLD_ALIGNED,pixelsPerMetre:80,maxPixels:1000000}),output=jpeg.encode(crop,92).data,file=id+'.jpg';
 await fs.writeFile(path.join(outputDir,file),output);
 derived.push({id,file,plane,sha256:sha(output),captureDate:source.date,panoramaId:source.panoramaId,panoramaSha256:sha(bytes),registration:{status:'unregistered',metricEligible:false},heightInferred:true,note:'Diagnostic full-height reprojection of an alternate dated capture; identity/alignment not accepted.'});
}
await fs.writeFile(path.join(outputDir,'extraction-repair.json'),JSON.stringify({kind:'alternate-capture-diagnostic',ownerId:recipe.buildingId,geometryRevision:recipe.geometryRevision,sourceTier:tier,derived,geometryChanged:false,sourceEvidenceChanged:false},null,2)+'\n');
console.log(JSON.stringify({ownerId:recipe.buildingId,capture:source.date,diagnosticViews:derived.length}));
