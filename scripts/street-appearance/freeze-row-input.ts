/** Freeze native ordinary-building review inputs from installed, hashed extracts.
 * npx tsx scripts/street-appearance/freeze-row-input.ts --row-plan=path.json
 * No image registration, runtime catalog or native source mutation.
 */
import fs from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { decorateBuildingFeature } from '../../src/canalRecall/buildingTilesBrowser.ts';
import { decorateFacade } from '../../src/canalRecall/genericFacades.ts';
import { shortBuildingId } from '../../src/canalRecall/buildingFacts.ts';
import { decorateRoof } from '../../src/canalRecall/roofMesh.ts';
import { withMonumentGable } from '../../src/canalRecall/monumentGables.ts';
import { asPolygons, ORIGIN, type Feature } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { streetSegments } from '../../src/canalRecall/streetFronts.ts';
const arg=process.argv.find(a=>a.startsWith('--row-plan='))?.slice(11);
if(!arg)throw Error('--row-plan required');
const bytes=await fs.readFile(arg),plan=JSON.parse(bytes.toString());
if(!/^[a-z0-9-]+$/.test(plan.proposalId))throw Error('Unsafe row ID');
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const center:[number,number]=plan.segment[0].map((v:number,i:number)=>(v+plan.segment[1][i])/2);
const kx=111320*Math.cos(center[1]*Math.PI/180),reach=160;
const features=new Map<string,Feature>(),sources=[];
const gablePath='public/data/extracts/amsterdam/monument-gables.json',gableBytes=await fs.readFile(gablePath);
const gables=new Map(Object.entries(JSON.parse(gableBytes.toString()).buildings));
for(const s of plan.sources){
 const raw=await fs.readFile(s.file);if(hash(raw)!==s.sha256)throw Error(`Frozen inventory source changed: ${s.file}`);
 sources.push(s);
 if(!s.file.includes('/building-tiles/'))continue;
 const factsPath=s.file.replace('/building-tiles/','/building-facts/').replace('.geojson.gz','.json.gz');
 const facts=JSON.parse(gunzipSync(await fs.readFile(factsPath)).toString());
 for(const original of JSON.parse(gunzipSync(raw).toString()).features as Feature[]){
  const id=String(original.properties.id),points=asPolygons(original.geometry).flatMap(p=>p[0]);
  if(!points.length)continue;
  const xs=points.map(p=>(p[0]-center[0])*kx),ys=points.map(p=>(p[1]-center[1])*110540);
  if(Math.min(...xs)>reach||Math.max(...xs)<-reach||Math.min(...ys)>reach||Math.max(...ys)<-reach)continue;
  const fact=facts.buildings[shortBuildingId(id)];
  const f={...original,properties:{...original.properties,...(fact?{constructionYear:fact[0]}:{})}};
  // Same ordinary-source decoration sequence as the tile streamer/game.
  const decorated=decorateRoof(withMonumentGable(decorateFacade(decorateBuildingFeature(f,new Map())) as Feature,gables as any));
  features.set(id,decorated);
 }
}
const routingPath='public/data/extracts/amsterdam/streets-routing.json';
const routingBytes=await fs.readFile(routingPath),routing=JSON.parse(routingBytes.toString());
const paths=routing.filter((w:any)=>(w.paths??[w.path]).some((p:any)=>p?.some(([lat,lng]:number[])=>Math.abs((lng-center[0])*kx)<reach+25&&Math.abs((lat-center[1])*110540)<reach+25)));
const frontPaths=paths.flatMap((w:any)=>(w.paths??[w.path]).filter(Boolean).map((p:number[][])=>({highway:w.highway,points:p.map(([lat,lng])=>[lng,lat] as [number,number])})));
const streets=Array.from(streetSegments(frontPaths,ORIGIN));
if(!features.size||!streets.length)throw Error('Empty review input');
const target={id:plan.proposalId,center,profileId:plan.proposalId};
const output=`artifacts/street-appearance/stage-inputs/${plan.proposalId}.json`;
await fs.mkdir('artifacts/street-appearance/stage-inputs',{recursive:true});
await fs.writeFile(output,JSON.stringify({target,features:[...features.values()].sort((a,b)=>String(a.properties.id).localeCompare(String(b.properties.id))),streets,sourcePlanSha256:hash(bytes),sources:[...sources,{file:gablePath,sha256:hash(gableBytes)},{file:routingPath,sha256:hash(routingBytes)}],limits:'Installed native ordinary features intersecting160m bounding extent, including neighbors and courtyards. Same ordinary facade/identity palette/register roof decorators. Curated GLBs, kit/front embellishments, shopfront overrides, cars and trees are outside this stage. This is an offline source-geometry stage, not a captured live-game fixture.'})+'\n');
console.log(JSON.stringify({output,features:features.size,streetSegments:streets.length/4}));
