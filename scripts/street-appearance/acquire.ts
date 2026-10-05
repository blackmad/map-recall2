/** Offline, resumable street-side perspectives. No facade homographies or BAG matching.
 * node --import tsx scripts/street-appearance/acquire.ts [--model=qwen3.5:9b] [--limit=2]
 * With --model, writes observations and compiled municipal pilot profiles.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { storePanoramaFile } from '../da-costa-block/panorama-file-cache.ts';
import { aggregateObservations, sha256, type Observation } from './pipeline.ts';
import { perspectiveCrop } from './perspective.ts';
import { validateStreetAppearanceCatalog, profileLocation, type StreetAppearanceCatalog } from '../../src/canalRecall/streetAppearance.ts';
const arg = (key: string, fallback='') => process.argv.find(x=>x.startsWith(`--${key}=`))?.slice(key.length+3) ?? fallback;
const root = path.resolve(arg('cache','.cache/street-appearance'));
const input = arg('input','public/data/street-appearance/pilot-segments.json');
const seeds: StreetAppearanceCatalog = JSON.parse(await fs.readFile(input,'utf8'));
const model = arg('model'); const limit = Number(arg('limit','0')) || Infinity;
const samplesPerProfile = Number(arg('samples-per-profile','0')) || Infinity;
await fs.mkdir(path.join(root,'images'),{recursive:true});await fs.mkdir(path.join(root,'panoramas'),{recursive:true});
async function json(url:string) { const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json(); }
const manifest:any={schemaVersion:1,source:'Gemeente Amsterdam panorama CC BY 4.0',camera:'Amsterdam world aligned; heading degrees clockwise from north',samplingM:25,images:[],failures:[],holdoutSegments:seeds.profiles.filter(p=>p.holdout).map(p=>p.id)};
const observations:Observation[]=[];
let count=0;
for(const p of seeds.profiles) {
 const loc=profileLocation(p,p.segment[0])!; const nx=-loc.dy/loc.lengthM*p.side,ny=loc.dx/loc.lengthM*p.side;
 // Wide crops overlap. Each inference only votes for its central 25m station cell.
 for(let along=12.5, sample=0;along<loc.lengthM && count<limit && sample<samplesPerProfile;along+=25,sample++) {
  const fraction=along/loc.lengthM; const lng=p.segment[0][0]+fraction*(p.segment[1][0]-p.segment[0][0]),lat=p.segment[0][1]+fraction*(p.segment[1][1]-p.segment[0][1]);
  const heading=(Math.atan2(nx,ny)*180/Math.PI+360)%360;
  const key=`${p.id}-${Math.round(along)}`; count++;
  try {
   const selectionKey=sha256(JSON.stringify({lng,lat,radiusM:18})).slice(0,12);
   const metadataFile=path.join(root,key+'.'+selectionKey+'.json');let camera:any;
   try {camera=JSON.parse(await fs.readFile(metadataFile,'utf8'));}catch{
    const pick=await json(`https://api.data.amsterdam.nl/panorama/thumbnail/?lon=${lng}&lat=${lat}&radius=18&width=1200&fov=90&aspect=1.6&horizon=0.35`);
    if(!pick.pano_id)throw Error('no panorama');camera=await json(`https://api.data.amsterdam.nl/panorama/panoramas/${encodeURIComponent(pick.pano_id)}/`);await fs.writeFile(metadataFile,JSON.stringify(camera,null,2)+'\n');
   }
   const url=camera._links.equirectangular_medium.href;
   const sourceFile=path.join(root,'panoramas',camera.pano_id+'.jpg');let source:Buffer;
   try{source=await fs.readFile(sourceFile);}catch{const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`panorama HTTP ${r.status}`);source=Buffer.from(await r.arrayBuffer());if(source[0]!==255||source[1]!==216)throw Error('panorama is not JPEG');await storePanoramaFile(sourceFile,source);}
   const perspective={version:2,width:1200,height:p.reachM<=12?900:750,fovDeg:p.reachM<=12?110:90,pitchDeg:p.reachM<=12?35:8};
   const renderKey=sha256(JSON.stringify({panoramaSha256:sha256(source),heading,perspective})).slice(0,12);
   const file=path.join(root,'images',key+'-'+renderKey+'-perspective-v2.jpg');let bytes:Buffer;
   try{bytes=await fs.readFile(file);}catch{bytes=perspectiveCrop(source,heading,perspective.width,perspective.height,perspective.fovDeg,perspective.pitchDeg);await storePanoramaFile(file,bytes);}
   const evidence={id:key,kind:'municipal-panorama' as const,panoramaId:camera.pano_id,captureDate:camera.timestamp,sha256:sha256(bytes),url,inference:'model' as const,model,quality:.65,notes:'Perspective street-side crop. Central station interval supplies one vote; overlapping crops deduplicated in 5m frontage cells. No individual building registration.'};
   const {inference:_pendingInference,model:_pendingModel,quality:_pendingQuality,...sourceEvidence}=evidence;
   manifest.images.push({profileId:p.id,alongM:along,file:path.relative(process.cwd(),file),...sourceEvidence,inferenceRequested:model||null,heading,holdout:!!p.holdout,camera:camera.geometry,sourceFile,panoramaSha256:sha256(source),perspective});
   if(model && !p.holdout) {
    const observationFile=path.join(root,key+'.'+renderKey+'.'+sha256(model).slice(0,8)+'.perspective-v2.observation.json');let result:any;
    try{result=JSON.parse(await fs.readFile(observationFile,'utf8'));}catch{
     const prompt=`Describe street architecture in the central half of this perspective image; ignore vegetation, vehicles, sky, people and text. We seek street rhythm, not exact building identity. Return JSON {quality:0..1,notes:string,recipes:[{weight:number,recipe:{family:"masonry"|"punched"|"ribbon"|"curtain",period:"canal"|"c19"|"school"|"postwar"|"modern"|"tower",wallHex:"#rrggbb",frameHex:"#rrggbb",windowWidth:0.2..0.9,windowHeight:0.2..0.85,windowProportions:"tall"|"balanced"|"wide",frameColor:"pale"|"dark",lintel:"flat"|"arch"|"none",paleAccents:boolean,trim:{frames:0..1,lintels:0..1,cornice:0..1,courses:0..1,quoins:0..1,arches:0..1},confidence:0..1}}]}. Supply at most 3 JOINT common combinations. masonry is brick/stone with separate vertically proportioned windows; punched is modern solid walls with individual openings; ribbon is continuous horizontal glazing; curtain is a full glass grid. Period is visual architectural type, not a factual construction date. Do not label separate windows ribbon. Omit uncertain colours, ratios or trim instead of inventing them. Lower quality for poor visibility.`;
     const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(180000),body:JSON.stringify({model,think:false,stream:false,format:'json',messages:[{role:'user',content:prompt,images:[bytes.toString('base64')]}],options:{temperature:0,num_predict:1800}})});
     if(!response.ok)throw Error(`inference HTTP ${response.status}`);const value=await response.json();result=JSON.parse(value.message.content);await fs.writeFile(observationFile,JSON.stringify(result,null,2)+'\n');
    }
    const recipes=result.recipes.map((r:any)=>({...r,...(['canal','c19','school'].includes(r.recipe.period)?{yearMax:1945}:{yearMin:1946})}));
    const evidenceReviewed={...evidence,quality:Math.min(.8,Number(result.quality)||0),notes:result.notes+' '+evidence.notes};
    const check={schemaVersion:1 as const,revision:'pending',profiles:[{...p,evidence:[evidenceReviewed],recipes}]};validateStreetAppearanceCatalog(check);
    observations.push({profileId:p.id,startM:Math.max(0,along-12.5),endM:Math.min(loc.lengthM,along+12.5),quality:evidenceReviewed.quality,evidence:evidenceReviewed,recipes});
   }
   console.log(`${key}: crop ${bytes.length} bytes${model&&!p.holdout?' + inference':''}`);
  } catch(error) {manifest.failures.push({key,reason:String(error)});console.error(`${key}: ${String(error)}`);}
 }
}
await fs.writeFile(path.join(root,model?'inference-manifest.json':'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
if(model)await fs.writeFile(path.join(root,'observations.json'),JSON.stringify(observations,null,2)+'\n');
if(model){const profiles=seeds.profiles.filter(p=>!p.holdout).map(p=>aggregateObservations(p,observations)).filter(p=>p.recipes.length);const catalog={schemaVersion:1 as const,revision:sha256(JSON.stringify(profiles)).slice(0,16),profiles};validateStreetAppearanceCatalog(catalog);await fs.writeFile(arg('out','public/data/street-appearance/municipal-pilot.json'),JSON.stringify(catalog,null,2)+'\n');}
