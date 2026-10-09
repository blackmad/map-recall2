/** Cancellable viewport loading with atomic LOD replacement and shared budgets. */
import * as THREE from 'three';
import {decodeBuildingLibraryTile,type TileResource} from './buildingLibraryTileLoader';
import {BuildingViewportPlanner,type BuildingLod,type ViewportSelection,type ViewportManifest,type ViewportBudgets} from './buildingLibraryViewport';
interface Resident {level:BuildingLod;resource:TileResource}
interface Job {selection:ViewportSelection;controller:AbortController;settled:boolean;promise:Promise<TileResource|null>;resolve:(r:TileResource|null)=>void;reject:(e:unknown)=>void}
export class BuildingViewportStreamer {
 readonly planner:BuildingViewportPlanner;
 private resident=new Map<string,Resident>();private jobs=new Map<string,Job>();private queue:Job[]=[];
 private desired=new Map<string,BuildingLod>();private ownerMaps=new Map<BuildingLod,Map<string,any>>();private active=0;private disposed=false;
 constructor(variants:Partial<Record<BuildingLod,ViewportManifest>>&{detail:ViewportManifest},readonly options:ViewportBudgets&{parent:THREE.Group|THREE.Scene;maxConcurrent?:number;fetchBinary:(selection:ViewportSelection,signal:AbortSignal)=>Promise<ArrayBuffer>}){
  this.planner=new BuildingViewportPlanner(variants,options);
  if(!Number.isInteger(options.maxConcurrent??2)||(options.maxConcurrent??2)<1)throw new Error('Invalid viewport concurrency');
  for(const [level,manifest]of Object.entries(variants))if(manifest)this.ownerMaps.set(level as BuildingLod,new Map(manifest.owners.map(o=>[o.id,o])));
 }
 get stats(){const resources=[...this.resident.values()];return {disposed:this.disposed,residentChunks:resources.length,residentTriangles:resources.reduce((n,r)=>n+r.resource.triangles,0),residentGeometryBytes:resources.reduce((n,r)=>n+r.resource.geometryBytes,0),activeRequests:this.active,pendingRequests:this.jobs.size,owners:resources.flatMap(r=>r.resource.ownerIds),levels:Object.fromEntries([...this.resident].map(([key,r])=>[key,r.level]))};}
 async update(camera:THREE.Camera){
  if(this.disposed)throw new Error('Viewport streamer disposed');
  const plan=this.planner.plan(camera);this.desired=new Map(plan.selected.map(s=>[s.key,s.level]));
  for(const [key,job]of this.jobs)if(this.desired.get(key)!==job.selection.level)this.cancel(key,job);
  for(const key of this.resident.keys())if(!this.desired.has(key))this.retire(key);
  // Decreasing representations free budget before detail upgrades.
  const selected=[...plan.selected].sort((a,b)=>(a.triangles-(this.resident.get(a.key)?.resource.triangles??0))-(b.triangles-(this.resident.get(b.key)?.resource.triangles??0))||a.distanceM-b.distanceM);
  const promises=[];
  for(const selection of selected){
   if(this.resident.get(selection.key)?.level===selection.level)continue;
   const current=this.jobs.get(selection.key);if(current){promises.push(current.promise);continue;}
   let resolve!:Job['resolve'],reject!:Job['reject'];const promise=new Promise<TileResource|null>((a,b)=>{resolve=a;reject=b;});const job:Job={selection,controller:new AbortController(),settled:false,promise,resolve,reject};
   this.jobs.set(selection.key,job);this.queue.push(job);promises.push(promise);
  }
  this.pump();return {plan,results:await Promise.allSettled(promises),stats:this.stats};
 }
 private fits(key:string,triangles:number,bytes:number){const old=this.resident.get(key);const stats=this.stats;return stats.residentChunks+(old?0:1)<=this.options.maxChunks&&stats.residentTriangles-(old?.resource.triangles??0)+triangles<=this.options.maxTriangles&&stats.residentGeometryBytes-(old?.resource.geometryBytes??0)+bytes<=this.options.maxGeometryBytes;}
 private cancel(key:string,job:Job){this.jobs.delete(key);job.settled=true;job.controller.abort();job.resolve(null);}
 private retire(key:string){const current=this.resident.get(key);if(current){this.resident.delete(key);current.resource.dispose();}}
 private pump(){
  if(this.disposed)return;this.queue=this.queue.filter(j=>!j.settled);
  while(this.active<(this.options.maxConcurrent??2)&&this.queue.length){
   const index=this.queue.findIndex(j=>this.fits(j.selection.key,j.selection.triangles,j.selection.geometryBytes));
   if(index<0){if(this.active>0)return;for(const job of this.queue.splice(0)){this.jobs.delete(job.selection.key);job.settled=true;job.reject(new Error('Viewport replacement deferred by resident budgets'));}return;}
   const [job]=this.queue.splice(index,1);this.active++;void this.run(job);
  }
 }
 private async run(job:Job){let resource:TileResource|undefined;const s=job.selection;
  try{
   const binary=await this.options.fetchBinary(s,job.controller.signal);
   if(job.settled||this.disposed||this.desired.get(s.key)!==s.level)return;
   resource=decodeBuildingLibraryTile(s.tile,binary,this.ownerMaps.get(s.level)!);
   if(!this.fits(s.key,resource.triangles,resource.geometryBytes))throw new Error('Viewport replacement deferred by resident budgets');
   // Retire only after a complete valid replacement is ready. No draw can see
   // both representations, and failed fetch/validation preserves the old one.
   this.retire(s.key);this.resident.set(s.key,{level:s.level,resource});this.options.parent.add(resource.group);job.settled=true;job.resolve(resource);resource=undefined;
  }catch(error){resource?.dispose();if(!job.settled){job.settled=true;job.reject(error);}}
  finally{if(this.jobs.get(s.key)===job)this.jobs.delete(s.key);this.active--;this.pump();}
 }
 dispose(){if(this.disposed)return;this.disposed=true;for(const [key,job]of this.jobs)this.cancel(key,job);for(const key of this.resident.keys())this.retire(key);this.queue=[];}
}
