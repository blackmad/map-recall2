/** Frozen eight-parent row. No citywide transfer or fabricated POI identity. */
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {decorateFacade} from '../../src/canalRecall/genericFacades.js';
import {decorateRoof} from '../../src/canalRecall/roofMesh.js';
import {ORIGIN,type Feature} from '../../src/canalRecall/threeBuildingFeatures.js';
import {streetSegments} from '../../src/canalRecall/streetFronts.js';
import {validateStreetAppearanceCatalog,type StreetAppearanceCatalog,type ArchitecturalRecipe} from '../../src/canalRecall/streetAppearance.js';

export const scopePath='docs/references/marnixstraat-repeated-row/scope.json';
export const scope=JSON.parse(fs.readFileSync(scopePath,'utf8'));
export const parents=scope.parents as Array<{installedId:string;installedSource:string;installedHeightMetres:number;geometry:any;marnixstraatFrontage:{vertices:number[][];lengthMetres:number;outwardNormalEastNorth:number[]}}>;
export const rowIds=parents.map(p=>p.installedId);
const tilePaths=[...new Set(parents.map(p=>p.installedSource))];
const features=new Map<string,Feature>();
for(const tile of tilePaths){
 const data=JSON.parse(gunzipSync(fs.readFileSync(tile)).toString());
 const factsPath=tile.replace('building-tiles','building-facts').replace('.geojson.gz','.json.gz');
 const facts=fs.existsSync(factsPath)?JSON.parse(gunzipSync(fs.readFileSync(factsPath)).toString()).buildings:{};
 for(const f of data.features as Feature[]){
  const id=String(f.properties.id),year=facts['P'+id.replace('NL.IMBAG.Pand.','')]?.[0]??f.properties.constructionYear??null;
  const coordinates=JSON.stringify(f.geometry);
  // Context is bounded to this block and its real adjoining/rear/opposite parents.
  const g=f.geometry as {type:string;coordinates:number[][][]};
  const points=g.type==='Polygon'?g.coordinates.flat():[];
  if(!points.some(p=>p[0]>4.87665&&p[0]<4.87815&&p[1]>52.37525&&p[1]<52.3766))continue;
  if(features.has(id)&&JSON.stringify(features.get(id)!.geometry)!==coordinates)throw Error('Duplicate native geometry disagreement '+id);
  features.set(id,decorateRoof(decorateFacade({...f,properties:{...f.properties,constructionYear:year,appearanceStyleSource:'citywide-identity-palette-v3-not-measured'}})));
 }
}
export const contextFeatures=[...features.values()];
export const rowFeatures=parents.map(p=>{const f=features.get(p.installedId);if(!f)throw Error('Missing native parent '+p.installedId);return f;});
const kx=111320*Math.cos(ORIGIN.lat*Math.PI/180);
export const xy=(p:readonly number[]):[number,number]=>[(p[0]-ORIGIN.lng)*kx,(p[1]-ORIGIN.lat)*110540];
const a=parents[0].marnixstraatFrontage.vertices[0],b=parents.at(-1)!.marnixstraatFrontage.vertices[1],n=parents[0].marnixstraatFrontage.outwardNormalEastNorth;
const offset=(p:number[]):[number,number]=>[p[0]+n[0]*12/kx,p[1]+n[1]*12/110540];
export const segment=[offset(a),offset(b)] as const;
export const streets=streetSegments([{points:segment}],ORIGIN);
const hash=(file:string)=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const stations=scope.selectedPanoramaStations.filter((s:any)=>s.label==='south'||s.label==='middle');
const evidence=stations.map((s:any)=>({id:s.panoId,kind:'municipal-panorama' as const,captureDate:s.captureTimestamp,sha256:s.originalImageSha256??hash(`artifacts/marnixstraat-sources/raw/${s.label}-2023.jpg`),url:s.originalImageUrl,panoramaId:s.panoId,inference:'agent-visual-review' as const,quality:.9,notes:'Clear leaf-off 2023 source; 2024 user image corroborates row. 2025 renovation scaffold obscures current facade; approximate dimensions, not survey.'}));
export const frontageRecipe={columns:3 as const,insetM:.8,frameWidthM:.085,sashWidthM:.045,recessDepthM:.14,
 upperRows:[{bottomM:4.45,heightM:2.35,widthM:2,axisWidthsM:[2,1.65,2],transomFraction:.74},
  {bottomM:7.45,heightM:2.1,widthM:2,axisWidthsM:[2,1.65,2],transomFraction:.74},
  {bottomM:10.35,heightM:1.7,widthM:2,axisWidthsM:[2,1.65,2],transomFraction:.74}],
 ground:{bottomM:.05,heightM:3.05,widthM:1.75},groundWindowRow:{bottomM:.65,heightM:2.35,widthM:2,transomFraction:.74},
 entrance:{axisIndex:1,leafHeightM:2.15},
 stringCourses:[{bottomM:.40,heightM:.07,projectionM:.04},{bottomM:3.68,heightM:.10,projectionM:.07},{bottomM:7.1,heightM:.07,projectionM:.04},{bottomM:9.95,heightM:.07,projectionM:.04}],
 segmentalLintel:{riseM:.10,bandM:.06,projectionM:.035}};
const baseRecipe:ArchitecturalRecipe={family:'masonry',period:'c19',confidence:.86,wallHex:'#8b7059',frameHex:'#e3e2ce',sashHex:'#2e4d3f',courseHex:'#b9a47c',wallMaterial:'brick',sash:'transom',balconyPolicy:'assembly-only',trimDensity:'restrained',repeatedTerraceFrontage:frontageRecipe};
export const catalog:StreetAppearanceCatalog=validateStreetAppearanceCatalog({schemaVersion:1,revision:'marnixstraat-eight-parent-accepted-20261009',profiles:[{
 id:'marnixstraat-124-138-repeated-row',streetName:'Marnixstraat',revision:'source-2023-eight-parent-accepted-20261009',status:'pilot',buildingIds:rowIds,segment,side:1,reachM:20,confidence:.86,assemblyM:13,
 recipes:parents.map((p,i)=>({weight:1,frontageMin:12,frontageMax:14,heightMin:14,heightMax:17,recipe:{...baseRecipe,repeatedTerraceRoof:{riseM:2.4,widthM:3.05,gable:i%2?'spout' as const:'step' as const,exposedEnds:[i===0,i===parents.length-1] as [boolean,boolean]}}})),
 evidence,frontages:parents.map((p,i)=>({buildingId:p.installedId,recipeIndex:i,frontage:{start:p.marnixstraatFrontage.vertices[0],end:p.marnixstraatFrontage.vertices[1],widthM:p.marnixstraatFrontage.lengthMetres}}))
}]});
export const profiles=catalog.profiles;
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const out='public/data/street-appearance/marnixstraat-pilot.json';fs.writeFileSync(out,JSON.stringify(catalog,null,2)+'\n');
 console.log(JSON.stringify({out,parents:rowIds.length,context:contextFeatures.length,admission:'accepted installed pilot; exactly eight native parents; no family transfer'}));
}
