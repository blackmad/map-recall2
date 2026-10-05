/** Read-only CPU audit of baked cohorts against actual production street masks. */
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { ORIGIN, asPolygons, type Feature } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { decorateFacade } from '../../src/canalRecall/genericFacades.ts';
import { shortBuildingId } from '../../src/canalRecall/buildingFacts.ts';
import { KIT_HIDE_IDS } from '../../src/canalRecall/threeBuildingsBrowser.ts';
import { streetSegments } from '../../src/canalRecall/streetFronts.ts';
import { compileStreetAppearanceAssignments, streetAppearanceFrontageRecords, validateStreetAppearanceCatalog, type StreetAppearanceFront } from '../../src/canalRecall/streetAppearance.ts';
import { sha256 } from './pipeline.ts';
export async function auditFrontages() {
 const catalog=validateStreetAppearanceCatalog(JSON.parse(await fs.readFile('public/data/street-appearance/profiles.json','utf8')));
 const survey=JSON.parse(await fs.readFile('public/data/street-appearance/frontage-survey.json','utf8'));
 const sourceMismatches:string[]=[];
 const admissionMismatches:string[]=[];
 for(const source of survey.admissionInputs??[]){try{if(sha256(await fs.readFile(source.file))!==source.sha256)admissionMismatches.push(source.file);}catch{admissionMismatches.push(source.file);}}
 const bounds=catalog.profiles.map(p=>{const pad=p.reachM+25,kx=111320*Math.cos(p.segment[0][1]*Math.PI/180);return {west:Math.min(...p.segment.map(v=>v[0]))-pad/kx,east:Math.max(...p.segment.map(v=>v[0]))+pad/kx,south:Math.min(...p.segment.map(v=>v[1]))-pad/110540,north:Math.max(...p.segment.map(v=>v[1]))+pad/110540};});
 const models=JSON.parse(await fs.readFile('public/canal-drive/models/signature-landmarks.json','utf8'));
 const excluded=new Set<string>([...KIT_HIDE_IDS,...Object.values(models.models).flatMap((m:any)=>m.suppressOsmIds??[]).map(String)]);
 const features=new Map<string,Feature>();
 for(const source of survey.sources.filter((s:any)=>s.file.endsWith('.geojson.gz'))){
  const factsPath=source.file.replace('/building-tiles/','/building-facts/').replace('.geojson.gz','.json.gz');
  const bytes=await fs.readFile(source.file),factsBytes=await fs.readFile(factsPath);
  for(const [file,data] of [[source.file,bytes],[factsPath,factsBytes]] as const){const expected=survey.sources.find((s:any)=>s.file===file);if(!expected||sha256(data)!==expected.sha256)sourceMismatches.push(file);}
  const facts=JSON.parse(gunzipSync(factsBytes).toString());
  for(const feature of JSON.parse(gunzipSync(bytes).toString()).features as Feature[]){
   const id=String(feature.properties.id);if(excluded.has(id))continue;
   const ring=asPolygons(feature.geometry).map(p=>p[0]).flat();if(!ring.length)continue;
   const west=Math.min(...ring.map(p=>p[0])),east=Math.max(...ring.map(p=>p[0])),south=Math.min(...ring.map(p=>p[1])),north=Math.max(...ring.map(p=>p[1]));
   if(!bounds.some(b=>west<=b.east&&east>=b.west&&south<=b.north&&north>=b.south))continue;
   const row=facts.buildings[shortBuildingId(id)];
   features.set(id,decorateFacade({...feature,properties:{...feature.properties,appearanceStyleSource:'citywide-identity-palette-v3-not-measured',...(row?{constructionYear:row[0]}:{})}}));
  }
 }
 const routing=JSON.parse(await fs.readFile('public/data/extracts/amsterdam/streets-routing.json','utf8'));
 const paths=routing.flatMap((way:any)=>(way.paths??[way.path]).filter(Boolean).map((points:number[][])=>({highway:way.highway,points:points.map(([lat,lng])=>[lng,lat] as const)})));
 const fullStreets=streetSegments(paths,ORIGIN),streets=streetSegments(catalog.streetFrontPaths??paths,ORIGIN);
 type Applied=StreetAppearanceFront&{profileId:string;hex:string;family:string};
 const bundle=await build({stdin:{contents:"export {buildFeatureChunk} from './src/canalRecall/threeBuildingFeatures.ts'",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'audit-production-frontage',setup(builder){builder.onLoad({filter:/streetFacadeRendering\.ts$/},async args=>{
  let source=await fs.readFile(args.path,'utf8');const anchor='if (!recipe) return building;';if(!source.includes(anchor))throw Error('production survey anchor changed');
  source=source.replace(anchor,`${anchor}\n  if (!context.mappedWallHex) (globalThis as any).__streetAppearanceAudit?.push({building:{id:building.id,year:context.year,heightM:context.sourceHeightM??building.heightM,streetCorner:context.streetCorner},wall:{start:[origin.lng+wall.x0/kx,origin.lat+wall.y0/110540],end:[origin.lng+wall.x1/kx,origin.lat+wall.y1/110540],normal:[wall.nx,wall.ny]},profileId:recipe.profileId,hex:recipe.wallHex??'default',family:recipe.family});`);return {contents:source,loader:'ts'};
 });}}]});
 const module=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
 const all=[...features.values()].sort((a,b)=>String(a.properties.id).localeCompare(String(b.properties.id)));
 const runs=(selected:Feature[],useStreets:boolean,segments=streets)=>{const applied:Applied[]=[];(globalThis as any).__streetAppearanceAudit=applied;try{module.buildFeatureChunk(selected,'photo','walls',useStreets?segments:undefined,catalog.profiles);}finally{delete(globalThis as any).__streetAppearanceAudit;}return applied;};
 const unmasked=runs(all,false),masked=runs(all,true),fullGraphMasked=runs(all,true,fullStreets);
 const recomputed=compileStreetAppearanceAssignments(catalog.profiles,survey.streetSegments?masked:unmasked);
 const maskedAllocation=compileStreetAppearanceAssignments(catalog.profiles,masked);
 const key=(run:Applied)=>JSON.stringify([run.profileId,run.building.id]);
 const profiles=catalog.profiles.map(profile=>{
  const baked=profile.frontages??[],reproduced=streetAppearanceFrontageRecords(profile,recomputed),maskedRecords=streetAppearanceFrontageRecords(profile,maskedAllocation);
  const actual=masked.filter(run=>run.profileId===profile.id),unique=[...new Map(actual.map(run=>[run.building.id,run])).values()];
  const counts=(runs:Applied[])=>runs.reduce((c:Record<string,number>,run)=>(c[run.hex]=(c[run.hex]??0)+1,c),{});
  const widths:Record<string,number>={};for(const run of actual){const kx=111320*Math.cos(run.wall.start[1]*Math.PI/180),width=Math.hypot((run.wall.end[0]-run.wall.start[0])*kx,(run.wall.end[1]-run.wall.start[1])*110540);widths[run.hex]=(widths[run.hex]??0)+width;}
  const missing=baked.filter(front=>!unique.some(run=>run.building.id===front.buildingId)).map(front=>front.buildingId);
  return {id:profile.id,bakedCount:baked.length,reproducedCount:reproduced.length,reproduces:JSON.stringify(baked)===JSON.stringify(reproduced),maskedCohortCount:maskedRecords.length,missingAtRuntime:missing,actualRunPalette:counts(actual),actualBuildingPalette:counts(unique),actualWidthPaletteM:widths};
 });
 // Deliberately split the cohort on its central longitude: baked palettes must
 // survive independently generated subsets even if exposure changes at edges.
 const medianLng=all.map(f=>asPolygons(f.geometry)[0]?.[0]?.[0]?.[0]??0).sort((a,b)=>a-b)[Math.floor(all.length/2)];
 const partA=all.filter(f=>(asPolygons(f.geometry)[0]?.[0]?.[0]?.[0]??0)<=medianLng),partB=all.filter(f=>!partA.includes(f));
 const split=[...runs(partA,true),...runs(partB,true)],fullMap=new Map(masked.map(run=>[key(run),run.hex]));
 const splitPaletteChanges=split.filter(run=>fullMap.has(key(run))&&fullMap.get(key(run))!==run.hex).map(run=>({id:run.building.id,profile:run.profileId,full:fullMap.get(key(run)),split:run.hex}));
 const splitExtraFronts=[...new Set(split.filter(run=>!fullMap.has(key(run))).map(key))];
 const fullStreetMap=new Map(fullGraphMasked.map(run=>[key(run),run.hex])),localStreetMap=new Map(masked.map(run=>[key(run),run.hex]));
 const localStreetMaskChanges=[...new Set([...fullStreetMap.keys(),...localStreetMap.keys()])].filter(key=>fullStreetMap.get(key)!==localStreetMap.get(key));
 return {schemaVersion:1,revision:catalog.revision,surveyRevisionMatches:survey.revision===catalog.revision,admissionRecorded:!!survey.admissionInputs?.length,sourceMismatches,admissionMismatches,features:features.size,unmaskedRuns:unmasked.length,maskedRuns:masked.length,localStreetSegments:streets.length/4,fullStreetSegments:fullStreets.length/4,localStreetMaskChanges,splitPaletteChanges,splitExtraFronts,profiles};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await auditFrontages(),null,2));
