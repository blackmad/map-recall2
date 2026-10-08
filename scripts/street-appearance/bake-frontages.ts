/** Allocate approximate joint recipes to full, surveyed street-side cohorts.
 * The production wall builder supplies exposed fronts; no facade registration.
 * Run after compile-reviewed.ts. Result is stable across streaming/chunk splits.
 */
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { ORIGIN, asPolygons, type Feature } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { decorateFacade } from '../../src/canalRecall/genericFacades.ts';
import { shortBuildingId } from '../../src/canalRecall/buildingFacts.ts';
import { KIT_HIDE_IDS } from '../../src/canalRecall/threeBuildingsBrowser.ts';
import { FRONT_HIGHWAYS, streetSegments } from '../../src/canalRecall/streetFronts.ts';
import { compileStreetAppearanceAssignments, streetAppearanceFrontageRecords, validateStreetAppearanceCatalog, type StreetAppearanceFront, type StreetAppearanceStreetPath } from '../../src/canalRecall/streetAppearance.ts';
import { sha256 } from './pipeline.ts';

const option=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3)??fallback;
const catalogPath = option('catalog-path','public/data/street-appearance/profiles.json');
const surveyPath = option('survey-path',catalogPath==='public/data/street-appearance/profiles.json'?'public/data/street-appearance/frontage-survey.json':catalogPath.replace(/[^/]+$/, 'frontage-survey.json'));
const catalog = validateStreetAppearanceCatalog(JSON.parse(await fs.readFile(catalogPath, 'utf8')));
catalog.profiles.sort((a,b)=>a.id.localeCompare(b.id));
for (const profile of catalog.profiles) delete profile.frontages;
const bounds = catalog.profiles.map(p => {
  const pad = p.reachM + 25;
  return { west: Math.min(...p.segment.map(v => v[0])) - pad / (111320 * Math.cos(p.segment[0][1] * Math.PI / 180)),
    east: Math.max(...p.segment.map(v => v[0])) + pad / (111320 * Math.cos(p.segment[0][1] * Math.PI / 180)),
    south: Math.min(...p.segment.map(v => v[1])) - pad / 110540, north: Math.max(...p.segment.map(v => v[1])) + pad / 110540 };
});
const tileAt = (lng: number, lat: number) => [Math.floor((lng + 180) / 360 * 16384), Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 16384)];
const tiles = new Set<string>();
for (const b of bounds) { const [x0,y0] = tileAt(b.west,b.north), [x1,y1] = tileAt(b.east,b.south); for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)tiles.add(`${x}/${y}`); }
const models = JSON.parse(await fs.readFile('public/canal-drive/models/signature-landmarks.json','utf8'));
const excluded = new Set<string>([...KIT_HIDE_IDS, ...Object.values(models.models).flatMap((m: any) => m.suppressOsmIds ?? []).map(String)]);
const sources: Array<{file: string; sha256: string}> = [], features = new Map<string,Feature>();
for (const tile of [...tiles].sort()) {
  const sourcePath = `public/data/extracts/amsterdam/building-tiles/14/${tile}.geojson.gz`, factsPath = `public/data/extracts/amsterdam/building-facts/14/${tile}.json.gz`;
  const bytes = await fs.readFile(sourcePath), factBytes = await fs.readFile(factsPath);
  sources.push({file:sourcePath,sha256:sha256(bytes)},{file:factsPath,sha256:sha256(factBytes)});
  const data = JSON.parse(gunzipSync(bytes).toString()), facts = JSON.parse(gunzipSync(factBytes).toString());
  for (const f of data.features as Feature[]) {
    const id = String(f.properties.id); if (excluded.has(id)) continue;
    const rings = asPolygons(f.geometry).map(p => p[0]).flat(); if (!rings.length) continue;
    const west=Math.min(...rings.map(p=>p[0])),east=Math.max(...rings.map(p=>p[0])),south=Math.min(...rings.map(p=>p[1])),north=Math.max(...rings.map(p=>p[1]));
    if (!bounds.some(b=>west<=b.east&&east>=b.west&&south<=b.north&&north>=b.south)) continue;
    const row = facts.buildings[shortBuildingId(id)];
    features.set(id, decorateFacade({...f,properties:{...f.properties,appearanceStyleSource:'citywide-identity-palette-v3-not-measured',...(row?{constructionYear:row[0]}:{})}}));
  }
}
const fronts: StreetAppearanceFront[] = [];
const routingPath='public/data/extracts/amsterdam/streets-routing.json',routingBytes=await fs.readFile(routingPath);
const routing=JSON.parse(routingBytes.toString());
const streetPaths:StreetAppearanceStreetPath[]=[],pathKeys=new Set<string>();
for(const way of routing){
 if(way.highway&&!FRONT_HIGHWAYS.has(way.highway))continue;
 for(const points of way.paths??[way.path]){
  if(!points)continue;let run:StreetAppearanceStreetPath['points']=[];
  const flush=()=>{if(run.length>1){const streetPath={highway:way.highway,points:run},key=JSON.stringify(streetPath);if(!pathKeys.has(key)){streetPaths.push(streetPath);pathKeys.add(key);}}run=[];};
  for(let i=1;i<points.length;i++){
   const [a,b]=[points[i-1],points[i]];
   const intersects=bounds.some(box=>Math.min(a[1],b[1])<=box.east&&Math.max(a[1],b[1])>=box.west&&Math.min(a[0],b[0])<=box.north&&Math.max(a[0],b[0])>=box.south);
   if(intersects){if(!run.length)run.push([a[1],a[0]]);run.push([b[1],b[0]]);}else flush();
  }flush();
 }
}
catalog.streetFrontPaths=streetPaths;
const streets=streetSegments(streetPaths,ORIGIN);
const admissionSources=[routingPath,'public/canal-drive/models/signature-landmarks.json','scripts/street-appearance/bake-frontages.ts',...['streetAppearance.ts','streetFacadeRendering.ts','threeBuildingFeatures.ts','threeBuildingMesh.ts','genericFacades.ts','streetFronts.ts','threeBuildingsBrowser.ts','streetCrown.ts','bayLook.ts','bayTextures.ts','facadeOrnaments.ts','facadeExtras.ts','facadeOpenings.ts','facadeExtraCore.ts','shopCanopies.ts','glassBlockTexture.ts','interwarFrontageLayout.ts','interwarGroundFrontage.ts','compoundFrontageLayout.ts','facadeLayout.ts'].map(name=>'src/canalRecall/'+name)];
admissionSources.push('src/canalRecall/sourceVisualRoof.ts','src/canalRecall/roofMesh.ts','src/canalRecall/regularCanalFrontage.ts');
admissionSources.push('src/canalRecall/surveyedBuildingEnvelope.ts','src/canalRecall/surveyedEnvelopeMeshBinding.ts','src/canalRecall/surveyedEnvelopeTransport.ts','src/canalRecall/threeBuildingsWorker.ts','public/canal-drive/js/pyramidal-roofs-source.js');
const admissionInputs=await Promise.all(admissionSources.map(async file=>({file,sha256:sha256(await fs.readFile(file))})));
(globalThis as any).__streetAppearanceFrontageSurvey = fronts;
// Observe the same neighbor suppression and continuous wall runs as runtime.
// This instrumentation is confined to the authoring tool, never game bundles.
const bundle=await build({stdin:{contents:"export {buildFeatureChunk} from './src/canalRecall/threeBuildingFeatures.ts'",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',plugins:[{
  name:'collect-exposed-street-fronts',setup(builder){builder.onLoad({filter:/streetFacadeRendering\.ts$/},async args=>{
    let source=await fs.readFile(args.path,'utf8');const anchor='if (!recipe) return building;';
    if(!source.includes(anchor))throw Error('Frontage survey instrumentation anchor changed');
    source=source.replace(anchor,`${anchor}\n  if (!context.mappedWallHex) (globalThis as any).__streetAppearanceFrontageSurvey?.push({building:{id:building.id,year:context.year,heightM:context.sourceHeightM??building.heightM,streetCorner:context.streetCorner},wall:{start:[origin.lng+wall.x0/kx,origin.lat+wall.y0/110540],end:[origin.lng+wall.x1/kx,origin.lat+wall.y1/110540],normal:[wall.nx,wall.ny]}});`);
    return {contents:source,loader:'ts'};
  });}
}]});
const module=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
module.buildFeatureChunk([...features.values()].sort((a,b)=>String(a.properties.id).localeCompare(String(b.properties.id))),'photo','walls',streets,catalog.profiles);
delete (globalThis as any).__streetAppearanceFrontageSurvey;
const assignments=compileStreetAppearanceAssignments(catalog.profiles,fronts);
for(const profile of catalog.profiles) profile.frontages=streetAppearanceFrontageRecords(profile,assignments);
catalog.revision=sha256(JSON.stringify({profiles:catalog.profiles,streetFrontPaths:catalog.streetFrontPaths})).slice(0,16);
validateStreetAppearanceCatalog(catalog);
await fs.writeFile(catalogPath,JSON.stringify(catalog,null,2)+'\n');
const report={schemaVersion:1,revision:catalog.revision,origin:ORIGIN,sources,admissionInputs,streetFrontPathsSha256:sha256(JSON.stringify(streetPaths)),streetSegments:streets.length/4,neighborHaloM:25,features:features.size,exposedRuns:fronts.length,assignments:assignments.size,
  profiles:catalog.profiles.map(p=>({id:p.id,frontages:p.frontages,palette:p.frontages!.reduce((counts:Record<string,number>,f)=>{const hex=p.recipes[f.recipeIndex].recipe.wallHex??'default';counts[hex]=(counts[hex]??0)+1;return counts;},{})})),
  limits:'Approximate recipes allocated by genuine building identity across complete surveyed street-side cohorts; not per-building photo matching. Neighbor halo retains shared-wall suppression. Source colors and curated identities remain authoritative.'};
await fs.writeFile(surveyPath,JSON.stringify(report,null,2)+'\n');
if(catalogPath==='public/data/street-appearance/profiles.json'){
 const manifestPath='public/data/street-appearance/evidence-manifest.json',manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 manifest.runtimeRevision=catalog.revision;manifest.frontageSurvey={url:'frontage-survey.json',sha256:sha256(JSON.stringify(report,null,2)+'\n'),assignments:assignments.size};
 await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}
console.log(JSON.stringify({revision:catalog.revision,features:features.size,assignments:assignments.size,palette:report.profiles.map(({id,palette})=>({id,palette}))},null,2));
