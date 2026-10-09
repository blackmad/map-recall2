/** Batch reference-only views from explicitly selected cached dated cameras.
 * Does not alter recipes, target identities or the primary camera selection. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import jpeg from 'jpeg-js';
import {perspectiveCrop} from '../street-appearance/perspective.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
const option=(name:string)=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
const inventory=option('inventories'),historyFile=option('history'),originalPrefix=option('original-prefix'),output=option('output'),years=option('years');
if(!inventory||!historyFile||!originalPrefix||!output||!years)throw Error('Use --inventories=file1,file2 --history=selection.json --original-prefix=/private/path/prefix --years=2022,2025 --output=/private/path');
const hash=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
const historyBytes=await fs.readFile(historyFile),history=JSON.parse(historyBytes.toString());
const targets:{slug:string;pandId:string;frontageRD:{x:number;y:number}[];inventory:string;inventorySha256:string}[]=[];
for(const file of inventory.split(',')){
 const bytes=await fs.readFile(file),book=JSON.parse(bytes.toString());
 for(const entry of book.entries){
  if(!/^\d{16}$/.test(entry.cachedOwnerId)||entry.orderedFrontageRD?.length!==2)throw Error('Missing explicit target identity/frontage');
  const slug=entry.address.toLowerCase().replaceAll(' ','-');if(!/^[a-z0-9-]+$/.test(slug))throw Error('Unsafe target filename');
  if(targets.some(t=>t.pandId===entry.cachedOwnerId))throw Error('Duplicate target');
  targets.push({slug,pandId:entry.cachedOwnerId,frontageRD:entry.orderedFrontageRD,inventory:path.resolve(file),inventorySha256:hash(bytes)});
 }
}
if(!targets.length)throw Error('No targets');
await fs.mkdir(output,{recursive:true});const views=[];
for(const year of years.split(',')){
 if(!/^\d{4}$/.test(year)||!history[year])throw Error('Missing selected year');
 const selected=history[year],record=selected.record,rawPath=path.resolve(selected.sourcePath),rawBytes=await fs.readFile(rawPath);
 const records=JSON.parse(rawBytes.toString())._embedded?.panoramas;
 if(!records?.some((r:any)=>r.pano_id===record.pano_id&&r.timestamp===record.timestamp&&JSON.stringify(r.geometry)===JSON.stringify(record.geometry)&&r._links.equirectangular_medium.href===record._links.equirectangular_medium.href))throw Error('Camera does not match cached original API record');
 if(!record.timestamp.startsWith(year+'-'))throw Error('Year is not actual capture year');
 const originalPath=path.resolve(originalPrefix+'-'+year+'-original.jpg'),bytes=await fs.readFile(originalPath),decoded=jpeg.decode(bytes,{useTArray:true});
 const camera=lngLatToRd(record.geometry.coordinates);
 for(const target of targets){
  const [a,b]=target.frontageRD,headingDeg=Math.atan2((a.x+b.x)/2-camera.x,(a.y+b.y)/2-camera.y)*180/Math.PI;
  const projection={headingDeg,pitchDeg:27,horizontalFovDeg:58,width:1400,height:1200};
  const crop=perspectiveCrop(bytes,headingDeg,projection.width,projection.height,projection.horizontalFovDeg,projection.pitchDeg),file=path.resolve(output,target.slug+'-roof-'+year+'.jpg');
  await fs.writeFile(file,crop);
  views.push({target,year,panoramaId:record.pano_id,captureDate:record.timestamp,cameraRD:camera,sourceUrl:record._links.equirectangular_medium.href,originalPath,originalSha256:hash(bytes),nativeDimensions:[decoded.width,decoded.height],cameraRecord:record,rawApiPath:rawPath,rawApiSha256:hash(rawBytes),file,sha256:hash(crop),projection,metricEligible:false,association:'Explicit cached camera/image selection; no new HTTP retrieval',visualIdentityReviewRequired:true});
 }
}
const manifest={schemaVersion:1,kind:'dated-neighbor-reference-projections',historyPath:path.resolve(historyFile),historySha256:hash(historyBytes),views,limits:['Source camera selection is independent of target identity.','Perspective recognition views; no surveyed camera altitude or facade measurement claimed.','Inspect obstructions and target identity before using a view.']};
const manifestPath=path.resolve(output,'dated-reference-manifest.json');await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({targets:targets.length,views:views.length,manifestPath,status:'reference-only'}));
