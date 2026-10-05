/** Read-only source investigation; never updates runtime profiles or facts. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { perspectiveCrop } from './perspective.ts';
import { sha256 } from './pipeline.ts';
const output='artifacts/street-appearance/retry/7/source';
const query='https://api.data.amsterdam.nl/panorama/panoramas/?bbox=4.89805,52.37158,4.89855,52.37184&page_size=100';
const response=await fetch(query,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error(`Discovery HTTP ${response.status}`);
const discovery=await response.json();
await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'discovery.json'),JSON.stringify(discovery,null,2)+'\n');
const ids=['TMX7316010203-000227_pano_0000_000670','TMX7316010203-000227_pano_0000_000671','TMX7316010203-000227_pano_0000_000672','TMX7316010203-000709_pano_0000_001502','TMX7316010203-000709_pano_0000_001508','TMX7316010203-001662_pano_0000_000195'];
const evidence=[];
for(const id of ids){
 const metadata=discovery._embedded.panoramas.find((p:any)=>p.pano_id===id);
 if(!metadata)throw Error(`Missing station ${id}`);
 const sourceUrl=metadata._links.equirectangular_medium.href;
 const sourceFile=path.join(output,id+'.jpg');
 let bytes:Buffer;
 try{bytes=await fs.readFile(sourceFile);}catch{const r=await fetch(sourceUrl,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Source HTTP ${r.status}`);bytes=Buffer.from(await r.arrayBuffer());if(bytes[0]!==255||bytes[1]!==216)throw Error('Not JPEG');await fs.writeFile(sourceFile,bytes);}
 const perspective={headingDeg:206.8568220654033,width:1200,height:900,fovDeg:110,pitchDeg:35};
 const crop=perspectiveCrop(bytes,perspective.headingDeg,perspective.width,perspective.height,perspective.fovDeg,perspective.pitchDeg);
 const cropFile=path.join(output,id+'-side.jpg');await fs.writeFile(cropFile,crop);
 evidence.push({id,captureDate:metadata.timestamp,camera:metadata.geometry,sourceUrl,sourceFile,sourceSha256:sha256(bytes),cropFile,cropSha256:sha256(crop),perspective});
 console.log(`${id}: ${crop.length} bytes`);
}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({schemaVersion:1,discoveryQuery:query,attribution:'Gemeente Amsterdam panorama CC BY 4.0',purpose:'Independent stations challenge the historic/modern transition; no observations admitted to runtime or holdout tuning.',evidence},null,2)+'\n');
