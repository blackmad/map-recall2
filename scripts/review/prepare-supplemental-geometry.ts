/**
 * Produce a staged-only common-frame block for cached supplemental buildings.
 * The district block is never edited: base building objects are reused as-is,
 * while only selected source-block buildings are rebased to its local frame.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {compileBlockAppearance,sha256} from '../city-appearance/compile-block-tiles.js';
import {prepareInventoryTargetsFromOwners} from './thousand-building-inventory-targets.ts';

const digest=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const read=async(file:string)=>JSON.parse(await fs.readFile(file,'utf8'));
const round=(value:number)=>Math.round(value*1000)/1000;
type Point=[number,number];
const transformCoordinates=(value:any,dx:number,dz:number):any=>typeof value[0]==='number'?(value.length===3?[round(value[0]+dx),value[1],round(value[2]+dz)]:[round(value[0]+dx),round(value[1]+dz)]):value.map((child:any)=>transformCoordinates(child,dx,dz));
const polygonRings=(footprint:any):Point[][][]=>footprint.type==='Polygon'?[footprint.coordinates]:footprint.coordinates;
const inside=(point:Point,ring:Point[])=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
const bounds=(ring:Point[])=>ring.reduce((out,point)=>({minX:Math.min(out.minX,point[0]),minY:Math.min(out.minY,point[1]),maxX:Math.max(out.maxX,point[0]),maxY:Math.max(out.maxY,point[1])}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
const overlapsBounds=(a:any,b:any)=>a.minX<b.maxX-1e-6&&b.minX<a.maxX-1e-6&&a.minY<b.maxY-1e-6&&b.minY<a.maxY-1e-6;
const centroid=(ring:Point[]):Point=>{const points=ring.slice(0,-1);return [points.reduce((sum,p)=>sum+p[0],0)/points.length,points.reduce((sum,p)=>sum+p[1],0)/points.length];};
/** Reject only area overlap, not shared parcel edges. Centroid containment
 * catches equal footprints and proper intersections catch crossing outlines. */
const properCross=(a:Point,b:Point,c:Point,d:Point)=>{const cross=(u:Point,v:Point,p:Point)=>(v[0]-u[0])*(p[1]-u[1])-(v[1]-u[1])*(p[0]-u[0]);const ac=cross(a,b,c),ad=cross(a,b,d),ca=cross(c,d,a),cb=cross(c,d,b);return ac*ad<-1e-10&&ca*cb<-1e-10;};
function footprintsOverlap(a:any,b:any):boolean{
 for(const pa of polygonRings(a.footprint))for(const pb of polygonRings(b.footprint)){const ra=pa[0],rb=pb[0];if(!ra?.length||!rb?.length||!overlapsBounds(bounds(ra),bounds(rb)))continue;if(inside(centroid(ra),rb)||inside(centroid(rb),ra))return true;for(let i=1;i<ra.length;i++)for(let j=1;j<rb.length;j++)if(properCross(ra[i-1],ra[i],rb[j-1],rb[j]))return true;}
 return false;
}
function sameDatum(a:any,b:any){return JSON.stringify(a?.verticalDatum)===JSON.stringify(b?.verticalDatum);}
function rebaseBuilding(building:any,sourceOrigin:any,targetOrigin:any){const dx=sourceOrigin.x-targetOrigin.x,dz=targetOrigin.y-sourceOrigin.y;return {...building,footprint:{...building.footprint,coordinates:transformCoordinates(building.footprint.coordinates,dx,dz)},center:transformCoordinates(building.center,dx,dz),surfaces:(building.surfaces??[]).map((surface:any)=>({...surface,rings:transformCoordinates(surface.rings,dx,dz)})),coordinateFrame:{sourceOriginRD:sourceOrigin,originRD:targetOrigin,axes:'x=east,y=up,z=south',heightDatum:sourceOrigin.heightDatum??undefined}};}
export function mergeSupplementalBlock(baseBlock:any,supplementalBlock:any,importIds:Iterable<string>){
 if(!baseBlock?.origin||!supplementalBlock?.origin||!sameDatum(baseBlock,supplementalBlock))throw Error('Supplemental block height datum mismatch');
 const selected=new Set(importIds),baseIds=new Set((baseBlock.buildings??[]).map((building:any)=>building.id)),source=new Map((supplementalBlock.buildings??[]).map((building:any)=>[building.id,building]));
 const imports:any[]=[],rejected:any[]=[];for(const id of [...selected].sort()){
  const raw=source.get(id);if(!raw){rejected.push({buildingId:id,reason:'source-building-not-found'});continue;}
  if(baseIds.has(id)){rejected.push({buildingId:id,reason:'duplicate-building-id'});continue;}
  const rebased=rebaseBuilding(raw,supplementalBlock.origin,baseBlock.origin);const overlap=(baseBlock.buildings??[]).find((existing:any)=>footprintsOverlap(rebased,existing))??imports.find(existing=>footprintsOverlap(rebased,existing));
  if(overlap){rejected.push({buildingId:id,reason:'different-id-physical-footprint-overlap',conflictingBuildingId:overlap.id});continue;}
  imports.push(rebased);
 }
 const block={...baseBlock,buildings:[...(baseBlock.buildings??[]),...imports],stats:{...(baseBlock.stats??{}),buildings:(baseBlock.buildings?.length??0)+imports.length,supplementalImportedBuildings:imports.length},sources:[...(baseBlock.sources??[]),{areaId:'supplemental-cached-source-block',blockSha256:sha256(JSON.stringify(supplementalBlock)),importedBuildingIds:imports.map(b=>b.id)}]};
 return {block,imports,rejected};
}
export async function prepareSupplementalGeometry(options:{baseBlockPath?:string;supplementalBlockPath?:string;inventoryPaths?:string[];reportPath?:string;outputRoot?:string}={}){
 const current=await read('public/data/city-expansion/current.json');
 const baseBlockPath=options.baseBlockPath??path.join('.cache/city-appearance/districts/da-costa-jordaan-v1',current.runHash,'block.json');
 const supplementalBlockPath=options.supplementalBlockPath??'.cache/city-appearance/areas/da-costa-expansion-550m-v1/runs/1628882208aaa4cb458140032cac1dd1536dd63a2a803d036833a185a23e33bd/compile-Un3ROY/block.json';
 const inventoryPaths=options.inventoryPaths??['scripts/review/thousand-building-sources.json','scripts/review/thousand-building-sources-supplemental.json'];
 const [baseBytes,supplementalBytes,...inventories]=await Promise.all([fs.readFile(baseBlockPath),fs.readFile(supplementalBlockPath),...inventoryPaths.map(read)]);
 const baseIds=new Set(JSON.parse(baseBytes.toString()).buildings.map((building:any)=>building.id));
 // Derive missing owners from immutable source inputs, never the previous output report.
 // Otherwise a successful import disappears on the next staging run.
 const missingIds=new Set(inventories.flatMap((inventory:any)=>inventory.records??[]).filter((record:any)=>!baseIds.has(record.buildingId)).map((record:any)=>record.observationId));
 const sourceRecords=inventories.flatMap((inventory:any)=>inventory.records??[]).filter((record:any)=>missingIds.has(record.observationId));
 const supplemental=JSON.parse(supplementalBytes.toString()),sourceOwners=compileBlockAppearance(supplemental,{records:[]}).tiles.flatMap((tile:any)=>tile.owners);
 const targetPreparation=prepareInventoryTargetsFromOwners({version:1,records:sourceRecords},sourceOwners),matched=targetPreparation.targetRecords;
 const merged=mergeSupplementalBlock(JSON.parse(baseBytes.toString()),supplemental,matched.map((record:any)=>record.buildingId));
 const compiled=compileBlockAppearance(merged.block,{records:[]}),importedOwners=compiled.tiles.flatMap((tile:any)=>tile.owners).filter((owner:any)=>merged.imports.some(building=>building.id===owner.id)).sort((a:any,b:any)=>a.id.localeCompare(b.id));
 const omissions=[...targetPreparation.omissions,...merged.rejected];
 const geometryBinding={version:1,mode:'supplemental-source-geometry-common-frame-candidate-only',baseBlock:{path:baseBlockPath,sha256:sha256(baseBytes)},sourceBlock:{path:supplementalBlockPath,sha256:sha256(supplementalBytes),originRD:supplemental.origin},targetOriginRD:merged.block.origin,requestedMissingOwners:missingIds.size,planeMatchedOwnerIds:matched.map((record:any)=>record.buildingId).sort(),importedOwnerIds:importedOwners.map((owner:any)=>owner.id),omissions,geometryEvidence:merged.imports.map((building:any)=>{const original=supplemental.buildings.find((source:any)=>source.id===building.id);const owner=importedOwners.find((candidate:any)=>candidate.id===building.id);return {buildingId:building.id,sourceBuildingSha256:digest(original),sourceSurfacesSha256:digest(original.surfaces),rebasedBuildingSha256:digest(building),rebasedSurfacesSha256:digest(building.surfaces),geometryRevision:owner?.geometryRevision??null};})};
 const identity=digest({version:2,base:geometryBinding.baseBlock.sha256,source:geometryBinding.sourceBlock.sha256,imported:geometryBinding.importedOwnerIds,omissions});const outputRoot=options.outputRoot??'.cache/city-appearance/supplemental-geometry';const output=path.join(outputRoot,identity);await fs.mkdir(output,{recursive:true});
 const blockPath=path.join(output,'block.json'),bindingPath=path.join(output,'geometry-binding.json'),blockOutput=Buffer.from(JSON.stringify(merged.block,null,2)+'\n'),blockSha256=sha256(blockOutput);for(const [file,value] of [[blockPath,blockOutput],[bindingPath,Buffer.from(JSON.stringify(geometryBinding,null,2)+'\n')]] as const){try{await fs.writeFile(file,value,{flag:'wx'});}catch(error:any){if(error.code!=='EEXIST'||sha256(await fs.readFile(file))!==sha256(value))throw error;}}
 return {blockPath,block:merged.block,blockSha256,importedOwners,geometryBinding,omissions};
}
