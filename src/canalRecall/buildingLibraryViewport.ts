/** Viewport admission uses complete exported bounds and one representation per owner. */
import * as THREE from 'three';
import {appearanceLod,type AppearanceLod} from './cityAppearanceTiles';
import type {CompiledTile,CompiledTileManifest} from './buildingLibraryTileLoader';
export type BuildingLod=AppearanceLod;
export interface ViewportTile extends CompiledTile {triangles:number;bounds:{min:number[];max:number[]}}
export interface ViewportManifest extends CompiledTileManifest {tiles:ViewportTile[]}
export interface ViewportBudgets {maxChunks:number;maxTriangles:number;maxGeometryBytes:number}
export interface ViewportSelection {key:string;level:BuildingLod;desiredLevel:BuildingLod;distanceM:number;triangles:number;geometryBytes:number;tile:ViewportTile}
const positive=(v:number)=>Number.isInteger(v)&&v>0;
const levels:BuildingLod[]=['detail','facade','massing'];
export class BuildingViewportPlanner {
 readonly variants:Partial<Record<BuildingLod,ViewportManifest>>;
 private previous=new Map<string,BuildingLod>();
 private maps=new Map<BuildingLod,Map<string,ViewportTile>>();
 constructor(variants:Partial<Record<BuildingLod,ViewportManifest>> & {detail:ViewportManifest},readonly budgets:ViewportBudgets){
  if(!positive(budgets.maxChunks)||!positive(budgets.maxTriangles)||!positive(budgets.maxGeometryBytes))throw new Error('Invalid viewport budgets');
  this.variants=variants;
  const identity=(m:ViewportManifest)=>m.owners.map(o=>[o.id,o.buildingId,o.geometryRevision,o.canonicalOwnershipKey]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  const baseline=JSON.stringify(identity(variants.detail));
  for(const level of levels){const manifest=variants[level];if(!manifest)continue;
   if(manifest.version!==1||manifest.binaryEndianness!=='little'||JSON.stringify(identity(manifest))!==baseline)throw new Error('LOD owner identity or canonical ownership mismatch');
   const tiles=new Map<string,ViewportTile>(),owners=new Set<string>();
   for(const tile of manifest.tiles){
    if(!tile.key||tiles.has(tile.key)||!positive(tile.triangles)||!positive(tile.geometryBytes)||tile.offset.length!==3||!tile.offset.every(Number.isFinite))throw new Error('Invalid viewport chunk');
    if(!tile.bounds||!['min','max'].every(k=>Array.isArray(tile.bounds[k as 'min'])&&tile.bounds[k as 'min'].length===3&&tile.bounds[k as 'min'].every(Number.isFinite))||tile.bounds.min.some((n,i)=>n>tile.bounds.max[i]))throw new Error('Invalid exported chunk bounds');
    for(const id of tile.owners){if(owners.has(id)||!manifest.owners.some(o=>o.id===id))throw new Error('Duplicate or unknown render owner');owners.add(id);}
    tiles.set(tile.key,tile);
   }
   if(owners.size!==manifest.owners.length)throw new Error('Unassigned LOD render owner');
   this.maps.set(level,tiles);
  }
  const detail=this.maps.get('detail')!;
  for(const [level,map]of this.maps){if(level==='detail')continue;if(map.size!==detail.size)throw new Error('LOD chunk set mismatch');
   for(const [key,tile]of map){const original=detail.get(key);if(!original||JSON.stringify([...original.owners].sort())!==JSON.stringify([...tile.owners].sort()))throw new Error('LOD chunk owner assignment mismatch');}
  }
 }
 plan(camera:THREE.Camera){
  camera.updateMatrixWorld(true);const position=camera.getWorldPosition(new THREE.Vector3());
  const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  const candidates=[];
  for(const tile of this.maps.get('detail')!.values()){
   const box=new THREE.Box3(new THREE.Vector3().fromArray(tile.bounds.min),new THREE.Vector3().fromArray(tile.bounds.max)).translate(new THREE.Vector3().fromArray(tile.offset));
   if(!frustum.intersectsBox(box))continue;
   const distanceM=box.distanceToPoint(position),desiredLevel=appearanceLod(distanceM,this.previous.get(tile.key));this.previous.set(tile.key,desiredLevel);
   candidates.push({tile,distanceM,desiredLevel});
  }
  candidates.sort((a,b)=>a.distanceM-b.distanceM||a.tile.key.localeCompare(b.tile.key));
  const selected:ViewportSelection[]=[],skipped:{key:string;reason:string;distanceM:number}[]=[];let triangles=0,geometryBytes=0;
  for(const candidate of candidates){
   if(selected.length>=this.budgets.maxChunks){skipped.push({key:candidate.tile.key,reason:'chunk budget',distanceM:candidate.distanceM});continue;}
   const desiredIndex=levels.indexOf(candidate.desiredLevel);
   // Prefer the requested representation, then available lighter geometry.
   // Missing LOD assets are explicit: finer assets are a final fallback.
   const order=[...levels.slice(desiredIndex),...levels.slice(0,desiredIndex).reverse()];let chosen:ViewportSelection|undefined;
   for(const level of order){const tile=this.maps.get(level)?.get(candidate.tile.key);if(!tile)continue;
    if(triangles+tile.triangles<=this.budgets.maxTriangles&&geometryBytes+tile.geometryBytes<=this.budgets.maxGeometryBytes){chosen={key:tile.key,level,desiredLevel:candidate.desiredLevel,distanceM:candidate.distanceM,triangles:tile.triangles,geometryBytes:tile.geometryBytes,tile};break;}
   }
   if(chosen){selected.push(chosen);triangles+=chosen.triangles;geometryBytes+=chosen.geometryBytes;}else skipped.push({key:candidate.tile.key,reason:'geometry budget; no fitting available LOD',distanceM:candidate.distanceM});
  }
  return {selected,skipped,visibleCandidates:candidates.length,triangles,geometryBytes,availableLevels:levels.filter(l=>this.maps.has(l))};
 }
}
