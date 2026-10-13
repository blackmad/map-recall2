/** Offline lower-facade evidence only; never admits observations or accepts geometry.
 * Usage: npx tsx scripts/canalhouse-recipes/project-cached-lower-sources.ts
 *   --house=all --output=artifacts/canalhouse-recipes/<unique-review-directory>
 * Optional --recipes=<pack.json> --stations=<cached-stations.json>
 *   --archive=<source-pack-root> reuse the same offline review for another chunk.
 * Explicit relative paths resolve from the working directory; defaults stay repo-based.
 * Across-canal full-height views can obscure lower facades. These cached near-bank
 * views enable early lower-facade review, but proximity does not prove visibility.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import {perspectiveCrop} from '../street-appearance/perspective.ts';

type Pair = [number, number];
type Entry = {name:string; anchorRD:Pair; frontTarget:[number,number,number]; frontNormal:Pair; recipe:{id:string}};
type Station = {
 camera:{geometry:{coordinates:number[]}; pano_id:string; [key:string]:unknown};
 source:{url:string; rawPath:string; sha256:string; bytes?:number; [key:string]:unknown};
};
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaults={
 archive:path.resolve(repo, '../map-recall2-source-data/streets/canalhouse-recipes-pilot'),
 recipes:path.join(repo, 'docs/references/canalhouse-recipes/recipes.json'),
 stations:path.join(repo, 'artifacts/canalhouse-recipes/cycle-11-basement-datum/cached-source-stations.json'),
};
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const inside=(root:string, child:string)=>{
 const relative=path.relative(root,child);
 return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);
};
const finiteArray=(value:unknown, length:number):value is number[]=>Array.isArray(value)&&value.length===length&&value.every(Number.isFinite);

async function main() {
 const options=new Map<string,string>();
 for(const arg of process.argv.slice(2)) {
  const match=/^--(house|output|recipes|stations|archive)=(.+)$/.exec(arg);
  if(!match||options.has(match[1]))throw Error('Use --house=<id|all>, required --output=<unique-local-directory>, optional --recipes=<pack.json> --stations=<metadata.json> --archive=<source-pack-root>');
  options.set(match[1],match[2]);
 }
 if(!options.has('output'))throw Error('--output=<unique-local-directory> is required');
 const output=path.resolve(options.get('output')!);
 // Source images and projections must stay outside every publishable directory.
 const artifactRoot=await fs.realpath(path.join(repo,'artifacts'));
 const tempRoots=await Promise.all([os.tmpdir(),'/tmp'].map(root=>fs.realpath(root)));
 let ancestor=output;
 while(true) {
  try {ancestor=await fs.realpath(ancestor);break;}
  catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;const parent=path.dirname(ancestor);if(parent===ancestor)throw error;ancestor=parent;}
 }
 const resolvedOutput=path.resolve(ancestor,path.relative(ancestor,output));
 // Check the real existing ancestor as well as the lexical path to reject symlink escapes.
 const safeRoot=[artifactRoot,...tempRoots].find(root=>(ancestor===root||inside(root,ancestor))&&inside(root,output));
 if(!safeRoot||!inside(safeRoot,resolvedOutput))throw Error('Output must be a local artifacts/ or temporary directory without a symlink escape');
 try {await fs.lstat(output);throw Error('Output already exists; choose a unique directory to preserve completed and partial evidence');}
 catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}

 const recipesFile=await fs.realpath(path.resolve(options.get('recipes')??defaults.recipes));
 const stationsFile=await fs.realpath(path.resolve(options.get('stations')??defaults.stations));
 const archive=await fs.realpath(path.resolve(options.get('archive')??defaults.archive));
 if(output===archive||inside(archive,output)||ancestor===archive||inside(archive,ancestor))throw Error('Output must stay outside the read-only source archive');
 const [recipeBytes,stationBytes,rawRoot]=await Promise.all([fs.readFile(recipesFile),fs.readFile(stationsFile),fs.realpath(path.join(archive,'raw'))]);
 if(rawRoot!==path.join(archive,'raw'))throw Error('Source archive/raw must not be a symlink to a different directory');
 const pack=JSON.parse(recipeBytes.toString());
 if(!Array.isArray(pack.entries)||!pack.entries.length)throw Error('Expected nonempty recipe entries');
 const all=pack.entries as Entry[], ids=new Set<string>();
 for(const e of all) {
  if(!/^[a-z0-9-]+$/.test(e.recipe?.id)||ids.has(e.recipe.id))throw Error('Invalid or duplicate house ID');
  ids.add(e.recipe.id);
  if(!finiteArray(e.anchorRD,2)||!finiteArray(e.frontTarget,3)||!finiteArray(e.frontNormal,2)||Math.hypot(...e.frontNormal)<.001)throw Error(`Missing front plane: ${e.recipe.id}`);
 }
 const requested=options.get('house')??'all';
 const entries=requested==='all'?all:all.filter(e=>e.recipe.id===requested);
 if(!entries.length)throw Error(`Unknown house: ${requested}`);
 const stations=JSON.parse(stationBytes.toString()) as Station[];
 if(!Array.isArray(stations))throw Error('Expected a cached station array');
 // Validate all declared raw paths before selecting; no fallback fetching exists.
 const cached=await Promise.all(stations.map(async station=>{
  const source=station.source, coords=station.camera?.geometry?.coordinates;
  if(!source?.url||!source.rawPath||!/^[a-f0-9]{64}$/.test(source.sha256)||!Array.isArray(coords)||!Number.isFinite(coords[0])||!Number.isFinite(coords[1]))throw Error('Malformed cached source/camera');
  const lexical=path.resolve(archive,source.rawPath);
  if(!source.rawPath.startsWith('raw/')||!inside(path.join(archive,'raw'),lexical))throw Error('Raw source path escapes archive/raw');
  const rawFile=await fs.realpath(lexical);
  if(!inside(rawRoot,rawFile))throw Error('Raw source symlink escapes archive/raw');
  return {station,rawFile,cameraRD:lngLatToRd([coords[0],coords[1]])};
 }));
 const plans=entries.map(entry=>{
  // Recipe X/Z are RD east/south; frontNormal uses the same local X/Z frame.
  const targetRD={x:entry.anchorRD[0]+entry.frontTarget[0],y:entry.anchorRD[1]-entry.frontTarget[2]};
  const normalLength=Math.hypot(...entry.frontNormal);
  const outwardRD={x:entry.frontNormal[0]/normalLength,y:-entry.frontNormal[1]/normalLength};
  const candidates=cached.map(c=>{
   const east=c.cameraRD.x-targetRD.x,north=c.cameraRD.y-targetRD.y,distanceM=Math.hypot(east,north);
   const outwardDistanceM=east*outwardRD.x+north*outwardRD.y;
   return {...c,distanceM,outwardDistanceM,obliquityCos:outwardDistanceM/distanceM};
  }).filter(c=>c.outwardDistanceM>.5&&c.obliquityCos>.2&&c.distanceM>=2&&c.distanceM<=30)
   .sort((a,b)=>a.distanceM-b.distanceM||a.station.camera.pano_id.localeCompare(b.station.camera.pano_id));
  const urls=new Set<string>(),paths=new Set<string>(),checksums=new Set<string>(),cameraIds=new Set<string>();
  const selected=candidates.filter(c=>{
   const s=c.station.source,id=c.station.camera.pano_id;
   if(urls.has(s.url)||paths.has(c.rawFile)||checksums.has(s.sha256)||cameraIds.has(id))return false;
   urls.add(s.url);paths.add(c.rawFile);checksums.add(s.sha256);cameraIds.add(id);return true;
  }).slice(0,2);
  return {entry,targetRD,outwardRD,candidateCount:candidates.length,selected};
 });
 // Verify every selected raw checksum before creating any projection evidence.
 const verified=new Map<string,Buffer>();
 for(const plan of plans)for(const c of plan.selected) {
  let bytes=verified.get(c.rawFile);
  if(!bytes){bytes=await fs.readFile(c.rawFile);verified.set(c.rawFile,bytes);}
  if(sha(bytes)!==c.station.source.sha256)throw Error(`Raw checksum mismatch: ${c.station.camera.pano_id}`);
  if(c.station.source.bytes!==undefined&&bytes.length!==c.station.source.bytes)throw Error(`Raw byte count mismatch: ${c.station.camera.pano_id}`);
 }
 await fs.mkdir(path.dirname(output),{recursive:true});
 await fs.mkdir(output); // Refuses a race with an existing evidence directory.
 const houses=[];
 for(const plan of plans) {
  const {entry,targetRD,outwardRD,selected}=plan,projections=[];
  const targetLngLat=rdToLngLat(targetRD);
  for(const [index,c] of selected.entries()) {
   const coordinates=c.station.camera.geometry.coordinates;
   // Geographic north is at panorama centre. Vehicle heading/pitch/roll are
   // retained in metadata but must NOT be applied to these world-aligned pixels.
   const headingDeg=(Math.atan2((targetLngLat[0]-coordinates[0])*Math.cos(coordinates[1]*Math.PI/180),targetLngLat[1]-coordinates[1])*180/Math.PI+360)%360;
   const projection={headingDeg,width:1200,height:1000,fovDeg:95,pitchDeg:-10};
   const bytes=perspectiveCrop(verified.get(c.rawFile)!,headingDeg,projection.width,projection.height,projection.fovDeg,projection.pitchDeg);
   const filename=`${entry.recipe.id}-lower-${index+1}.jpg`;
   await fs.writeFile(path.join(output,filename),bytes,{flag:'wx'});
   projections.push({filename,sha256:sha(bytes),bytes:bytes.length,camera:c.station.camera,cameraRD:c.cameraRD,
    rawSource:c.station.source,verifiedRawPath:c.rawFile,rawChecksumVerified:true,
    selection:{distanceM:c.distanceM,outwardDistanceM:c.outwardDistanceM,obliquityCos:c.obliquityCos},projection});
  }
  houses.push({id:entry.recipe.id,name:entry.name,anchorRD:entry.anchorRD,frontTarget:entry.frontTarget,frontNormal:entry.frontNormal,
   targetRD,targetLngLat,outwardRD,candidateCount:plan.candidateCount,
   status:selected.length===2?'projected-awaiting-visual-review':selected.length?'only-one-suitable-cached-source':'missing-suitable-cached-source',projections});
 }
 const metadata={schemaVersion:1,status:'completed',createdAt:new Date().toISOString(),requestedHouse:requested,
  purpose:'Early mandatory lower-facade inspection evidence; no automatic source admission or visual acceptance.',
  limits:'Nearest front-facing archived cameras may still contain occlusions; inspect each projection. Missing second sources are reported, never fetched.',
  sourceArchive:{path:archive,recipeRecordedSourceCommit:pack.sourceArchive?.commit??null},
  inputs:{recipes:{path:recipesFile,sha256:sha(recipeBytes),explicit:options.has('recipes')},stations:{path:stationsFile,sha256:sha(stationBytes),explicit:options.has('stations')},archive:{path:archive,rawRoot,explicit:options.has('archive')}},
  convention:{recipe:'local X east, Z south; RD X east/Y north',panorama:'amsterdam-world-aligned/v1; north at horizontal centre; source vehicle heading/pitch/roll not applied',heading:'geographic bearing camera to explicit frontTarget, never footprint mean'},
  selection:{perHouse:2,outwardDistanceMExclusiveMin:.5,obliquityCosExclusiveMin:.2,distanceMInclusive:[2,30],order:'closest RD horizontal distance',dedup:'source URL, real raw path, raw checksum, camera ID'},houses};
 await fs.writeFile(path.join(output,'metadata.json'),JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({houses:houses.length,projections:houses.reduce((n,h)=>n+h.projections.length,0),missingSecondSources:houses.filter(h=>h.projections.length<2).length,missingAllSources:houses.filter(h=>!h.projections.length).length}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
