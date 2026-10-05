/** Source-only historical balcony cohort investigation; no runtime writes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { perspectiveCrop } from './perspective.ts';
import { sha256 } from './pipeline.ts';
const output='artifacts/street-appearance/retry/7/source-overtoom';
const query='https://api.data.amsterdam.nl/panorama/panoramas/?bbox=4.8678,52.36075,4.8685,52.36115&page_size=100';
const r=await fetch(query,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Discovery HTTP ${r.status}`);
const discovery=await r.json();await fs.mkdir(output,{recursive:true});
await fs.writeFile(path.join(output,'discovery.json'),JSON.stringify(discovery,null,2)+'\n');
const ids=['TMX7316010203-001039_pano_0002_001676','TMX7316010203-001039_pano_0002_001677','TMX7316010203-000786_pano_0003_000616','TMX7316010203-000052_pano_0002_000784'];
const evidence=[];
for(const id of ids){
 const camera=discovery._embedded.panoramas.find((p:any)=>p.pano_id===id);if(!camera)throw Error(`Missing ${id}`);
 const sourceUrl=camera._links.equirectangular_medium.href,sourceFile=path.join(output,id+'.jpg');let bytes:Buffer;
 try{bytes=await fs.readFile(sourceFile);}catch{const response=await fetch(sourceUrl,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Source HTTP ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());if(bytes[0]!==255||bytes[1]!==216)throw Error('Not JPEG');await fs.writeFile(sourceFile,bytes);}
 const perspective={headingDeg:337.32489261987223,width:1200,height:900,fovDeg:90,pitchDeg:15};
 const crop=perspectiveCrop(bytes,perspective.headingDeg,perspective.width,perspective.height,perspective.fovDeg,perspective.pitchDeg);
 const cropFile=path.join(output,id+'-side.jpg');await fs.writeFile(cropFile,crop);
 evidence.push({id,captureDate:camera.timestamp,camera:camera.geometry,sourceUrl,sourceFile,sourceSha256:sha256(bytes),cropFile,cropSha256:sha256(crop),perspective});console.log(id);
}
const original=JSON.parse(await fs.readFile('.cache/street-appearance/manifest.json','utf8')).images;
const training=original.find((i:any)=>i.id==='overtoom-gerard-brandt-anna-vondel-left-13');
const counterexamples=original.filter((i:any)=>['overtoom-gerard-brandt-anna-vondel-left-38','overtoom-gerard-brandt-anna-vondel-left-63','overtoom-gerard-brandt-anna-vondel-right-63'].includes(i.id));
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({schemaVersion:1,discoveryQuery:query,discoveryPageCount:discovery._embedded.panoramas.length,discoveryTotal:discovery.count,discoveryLimits:'First discovery page is sufficient to select predeclared independent stations; not a complete local panorama/date inventory.',attribution:'Gemeente Amsterdam panorama CC BY 4.0',purpose:'Source investigation of historical projecting balcony/access stack, no profile or factual-year edits.',trainingReference:training,counterexampleReferences:counterexamples,evidence},null,2)+'\n');
