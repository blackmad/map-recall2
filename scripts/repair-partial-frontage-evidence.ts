/** Reproject cached evidence for a suspected partial frontage; never alter owner geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import jpeg from 'jpeg-js';
import {facadeCoverage} from './buildingFacadeCoverage.ts';
import {AMSTERDAM_WORLD_ALIGNED, rectifyFacade} from '../src/canalRecall/facade/rectify.ts';

const [recipePath,evidencePath,outputDir]=process.argv.slice(2);
if(!recipePath||!evidencePath||!outputDir)throw new Error('Usage: recipe.json evidence.json output-directory');
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const recipe=await read(recipePath),evidence=await read(evidencePath),coverage=facadeCoverage(recipe);
if(coverage.status!=='partial-frontage-suspected')throw new Error('No partial frontage signal; nothing to repair');
const original=evidence.derived.find((i:any)=>i.tier==='full');
const manifest=await read(original.manifestPath);
const record=manifest.records.find((r:any)=>r.buildingId===recipe.buildingId&&r.images?.full?.panoramaId===original.panoramaId);
if(!record)throw new Error('Matching cached full capture missing');
const source=record.images.full;
const panoramaPath=path.join(path.dirname(original.manifestPath),'panoramas',source.panoramaId+'.jpg');
const bytes=await fs.readFile(panoramaPath);
const sha=(b:Uint8Array)=>crypto.createHash('sha256').update(b).digest('hex');
if(sha(bytes)!==source.panoramaSha256)throw new Error('Cached panorama hash mismatch');
const decoded=jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true,maxMemoryUsageInMB:1024});
const frame=recipe.placement.sourceRDFrame;
const rd=(p:number[])=>({x:frame.anchorRD[0]+p[0]*frame.xAxisRD[0]+p[1]*frame.yAxisRD[0],
 y:frame.anchorRD[1]+p[0]*frame.xAxisRD[1]+p[1]*frame.yAxisRD[1]});
const parts=[{id:'selected-front',start:[0,0],end:[recipe.frontages[0].width,0],surfaceIndices:recipe.frontages[0].sourceWallSelection.surfaceIndices},
 ...coverage.uncoveredStreetWalls.map((wall:any)=>{
  const points=recipe.sourceShell.surfaces[wall.surfaceIndex].rings.flat();
  const start=points.reduce((a:number[],b:number[])=>b[0]<a[0]?b:a),end=points.reduce((a:number[],b:number[])=>b[0]>a[0]?b:a);
  return {id:`offset-wall-${wall.surfaceIndex}`,start:start.slice(0,2),end:end.slice(0,2),surfaceIndices:[wall.surfaceIndex],
   scope:wall.scope,heightRange:wall.heightRange,angleDegrees:wall.angleDegrees};
 })];
await fs.mkdir(outputDir,{recursive:true});
const derived=[];
for(const part of parts){
 const plane={start:rd(part.start),end:rd(part.end),baseZ:source.plane.baseZ,topZ:source.plane.topZ};
 const rect=rectifyFacade(decoded,source.pose,plane,{camera:AMSTERDAM_WORLD_ALIGNED,pixelsPerMetre:80,maxPixels:1000000});
 const output=jpeg.encode(rect,92).data,file=part.id+'.jpg';
 await fs.writeFile(path.join(outputDir,file),output);
 derived.push({...part,plane,file,sha256:sha(output),dimensions:[rect.width,rect.height],captureDate:source.date,
  panoramaId:source.panoramaId,panoramaSha256:sha(bytes),registration:{status:'unregistered',metricEligible:false},
  note:'Separate BAG wall plane; camera/datum and feature alignment still require visual review.'});
}
const report={ownerId:recipe.buildingId,geometryRevision:recipe.geometryRevision,coverage,derived,
 geometryChanged:false,sourceEvidenceChanged:false,policy:'Separate offset wall planes. Preserve original crop. Do not stretch the selected facade across this owner.'};
await fs.writeFile(path.join(outputDir,'extraction-repair.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ownerId:recipe.buildingId,parts:derived.length,outputDir,geometryChanged:false}));
