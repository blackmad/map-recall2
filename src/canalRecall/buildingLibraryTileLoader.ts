/** Bounded delivery of compiled building-library tiles; no replacement policy. */
import * as THREE from 'three';
import {makeBatchMesh} from './buildingLibraryTileBatching';
export interface CompiledTile {key:string;offset:number[];binaryUrl:string;geometryBytes:number;triangles?:number;owners:string[];batches:any[]}
export interface CompiledTileManifest {version:number;binaryEndianness:string;owners:any[];tiles:CompiledTile[]}
export interface TileResource {key:string;group:THREE.Group;ownerIds:string[];meshes:THREE.Mesh[];geometryBytes:number;triangles:number;disposed:boolean;dispose():void}
const integer=(v:any)=>Number.isInteger(v)&&v>=0;
export function decodeBuildingLibraryTile(tile:CompiledTile,binary:ArrayBuffer,owners:Map<string,any>):TileResource {
 if(!integer(tile.geometryBytes)||tile.geometryBytes===0||binary.byteLength!==tile.geometryBytes)throw new Error('Invalid tile buffer range: byte length');
 if(!Array.isArray(tile.offset)||tile.offset.length!==3||!tile.offset.every(Number.isFinite))throw new Error('Invalid tile origin');
 if(!Array.isArray(tile.batches)||!tile.batches.length||!Array.isArray(tile.owners)||!tile.owners.length)throw new Error('Empty tile delivery');
 const represented=new Set<string>();const group=new THREE.Group();group.position.fromArray(tile.offset);const meshes:THREE.Mesh[]=[];
 try{
  for(const batch of tile.batches){
   const arrays:any={};for(const key of ['position','normal','colour','index']){
    const a=batch.attributes[key],Constructor=a?.type==='float32'?Float32Array:a?.type==='uint16'?Uint16Array:a?.type==='uint32'?Uint32Array:null;
    if(!Constructor||!integer(a.byteOffset)||!integer(a.length)||a.byteOffset%Constructor.BYTES_PER_ELEMENT||a.byteOffset+a.length*Constructor.BYTES_PER_ELEMENT>binary.byteLength||key!=='index'&&a.type!=='float32'||key==='index'&&a.type==='float32')throw new Error('Invalid tile buffer range');
    arrays[key]=new Constructor(binary,a.byteOffset,a.length);if(!arrays[key].every(Number.isFinite))throw new Error('Nonfinite tile attribute');
   }
   const vertices=arrays.position.length/3;
   if(!integer(vertices)||vertices===0||arrays.index.length===0||arrays.normal.length!==arrays.position.length||arrays.colour.length!==arrays.position.length||arrays.index.length%3||!arrays.index.every((i:number)=>i<vertices)||batch.triangles!==arrays.index.length/3)throw new Error('Invalid indexed tile geometry');
   let next=0;for(const range of batch.ownerRanges){const owner=owners.get(range.ownerId);
    if(!owner||!tile.owners.includes(range.ownerId)||owner.buildingId!==range.buildingId||owner.geometryRevision!==range.geometryRevision||owner.sourceModelHash!==range.sourceModelHash||range.firstTriangle!==next||!integer(range.triangleCount)||range.triangleCount===0)throw new Error('Invalid tile owner triangle range');next+=range.triangleCount;represented.add(range.ownerId);
   }
   if(next!==batch.triangles)throw new Error('Tile owner ranges do not cover geometry');
   const s=batch.state;if(s.type!=='MeshStandardMaterial'||s.transparent||s.opacity!==1||s.alphaTest!==0||![0,1,2].includes(s.side)||![s.roughness,s.metalness,...s.emissive].every(Number.isFinite)||s.roughness<0||s.roughness>1||s.metalness<0||s.metalness>1)throw new Error('Unsupported compiled PBR state');
   const mesh=makeBatchMesh({...batch,...arrays});meshes.push(mesh);group.add(mesh);
  }
  if(tile.owners.some(id=>!represented.has(id)))throw new Error('Owner missing from tile geometry');
 }catch(error){for(const mesh of meshes){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}throw error;}
 const triangles=meshes.reduce((n,m)=>n+m.geometry.index!.count/3,0);
 if(tile.triangles!==undefined&&tile.triangles!==triangles){for(const mesh of meshes){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}throw new Error('Invalid tile triangle total');}
 const resource:TileResource={key:tile.key,group,ownerIds:[...tile.owners],meshes,geometryBytes:binary.byteLength,triangles,disposed:false,dispose(){if(this.disposed)return;this.disposed=true;group.removeFromParent();for(const mesh of meshes){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}group.clear();}};return resource;
}
interface Job {key:string;controller:AbortController;promise:Promise<TileResource|null>;resolve:(value:TileResource|null)=>void;reject:(error:unknown)=>void;settled:boolean}
export class BuildingLibraryTileStore {
 private tiles=new Map<string,CompiledTile>();private owners=new Map<string,any>();private resident=new Map<string,TileResource>();private jobs=new Map<string,Job>();private queue:Job[]=[];private active=0;private disposed=false;
 constructor(private manifest:CompiledTileManifest,private options:{parent:THREE.Group|THREE.Scene;fetchBinary:(tile:CompiledTile,signal:AbortSignal)=>Promise<ArrayBuffer>;maxTiles:number;maxConcurrent?:number;maxResidentGeometryBytes?:number;maxResidentTriangles?:number}){
  if(manifest.version!==1||manifest.binaryEndianness!=='little'||!Number.isInteger(options.maxTiles)||options.maxTiles<1||!Number.isInteger(options.maxConcurrent??2)||(options.maxConcurrent??2)<1)throw new Error('Invalid tile store contract');
  if(options.maxResidentGeometryBytes!==undefined&&(!integer(options.maxResidentGeometryBytes)||options.maxResidentGeometryBytes<1))throw new Error('Invalid geometry byte budget');
  if(options.maxResidentTriangles!==undefined&&(!integer(options.maxResidentTriangles)||options.maxResidentTriangles<1))throw new Error('Invalid resident triangle budget');
  for(const owner of manifest.owners){if(!owner.id||this.owners.has(owner.id))throw new Error('Duplicate tile owner');this.owners.set(owner.id,owner);}
  const assigned=new Set<string>();for(const tile of manifest.tiles){if(this.tiles.has(tile.key))throw new Error('Duplicate tile key');this.tiles.set(tile.key,tile);for(const id of tile.owners){if(!this.owners.has(id)||assigned.has(id))throw new Error('Duplicate/unknown tile ownership');assigned.add(id);}}
  if(assigned.size!==this.owners.size)throw new Error('Unassigned compiled owner');
 }
 get stats(){return {residentTiles:this.resident.size,activeRequests:this.active,pendingTiles:this.jobs.size,queuedRequests:this.queue.filter(j=>!j.settled).length,owners:[...this.resident.values()].flatMap(r=>r.ownerIds),meshes:[...this.resident.values()].reduce((n,r)=>n+r.meshes.length,0),residentGeometryBytes:[...this.resident.values()].reduce((n,r)=>n+r.geometryBytes,0),residentTriangles:[...this.resident.values()].reduce((n,r)=>n+r.triangles,0),disposed:this.disposed};}
 load(key:string):Promise<TileResource|null>{
  if(this.disposed)return Promise.reject(new Error('Tile store disposed'));if(!this.tiles.has(key))return Promise.reject(new Error('Unknown tile '+key));
  if(this.tiles.get(key)!.geometryBytes>(this.options.maxResidentGeometryBytes??Infinity))return Promise.reject(new Error('Tile exceeds resident geometry byte budget'));
  const tile=this.tiles.get(key)!,triangles=tile.triangles??tile.batches.reduce((n,b)=>n+b.triangles,0);
  if(!integer(triangles)||triangles===0)return Promise.reject(new Error('Invalid tile triangle total'));
  if(triangles>(this.options.maxResidentTriangles??Infinity))return Promise.reject(new Error('Tile exceeds resident triangle budget'));
  const existing=this.resident.get(key);if(existing){this.resident.delete(key);this.resident.set(key,existing);return Promise.resolve(existing);}const pending=this.jobs.get(key);if(pending)return pending.promise;
  let resolve!:Job['resolve'],reject!:Job['reject'];const promise=new Promise<TileResource|null>((a,b)=>{resolve=a;reject=b;});const job={key,controller:new AbortController(),promise,resolve,reject,settled:false};this.jobs.set(key,job);this.queue.push(job);this.pump();return promise;
 }
 unload(key:string){const resource=this.resident.get(key);if(resource){this.resident.delete(key);resource.dispose();}const job=this.jobs.get(key);if(job){this.jobs.delete(key);job.settled=true;job.controller.abort();job.resolve(null);}this.pump();}
 dispose(){if(this.disposed)return;this.disposed=true;for(const key of [...this.resident.keys(),...this.jobs.keys()])this.unload(key);this.queue=[];}
 private pump(){if(this.disposed)return;while(this.active<(this.options.maxConcurrent??2)&&this.queue.length){const job=this.queue.shift()!;if(job.settled)continue;this.active++;void this.run(job);}}
 private async run(job:Job){let resource:TileResource|undefined;
  try{const tile=this.tiles.get(job.key)!,binary=await this.options.fetchBinary(tile,job.controller.signal);if(job.settled||this.disposed)return;
   resource=decodeBuildingLibraryTile(tile,binary,this.owners);
   if(resource.triangles>(this.options.maxResidentTriangles??Infinity))throw new Error('Tile exceeds resident triangle budget');
   while(this.resident.size>=this.options.maxTiles||this.stats.residentGeometryBytes+resource.geometryBytes>(this.options.maxResidentGeometryBytes??Infinity)||this.stats.residentTriangles+resource.triangles>(this.options.maxResidentTriangles??Infinity))this.unload(this.resident.keys().next().value!);
   this.resident.set(job.key,resource);this.options.parent.add(resource.group);job.settled=true;job.resolve(resource);
  }catch(error){if(this.resident.get(job.key)===resource)this.resident.delete(job.key);resource?.dispose();if(!job.settled){job.settled=true;job.reject(error);}}
  finally{if(this.jobs.get(job.key)===job)this.jobs.delete(job.key);this.active--;this.pump();}
 }
}
