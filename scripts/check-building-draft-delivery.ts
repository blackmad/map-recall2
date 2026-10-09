/** Exercise current draft binaries through the actual bounded viewport loader. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import assert from 'node:assert/strict';import * as THREE from 'three';
import {decodeBuildingLibraryTile} from '../src/canalRecall/buildingLibraryTileLoader';
import {BuildingViewportStreamer} from '../src/canalRecall/buildingLibraryViewportStreaming';
import {pickOwner} from '../src/canalRecall/buildingLibraryTileBatching';
const arg=(name:string)=>{const i=process.argv.indexOf(name);assert.ok(i>=0&&process.argv[i+1]&&!process.argv[i+1].startsWith('--'),name+' required');return process.argv[i+1];};
const root=arg('--chunk-root'),source=arg('--source-root');
const lodRoot=process.argv.includes('--lod-root')?arg('--lod-root'):undefined;
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=read(path.join(root,'tiles.json')),input=read(path.join(source,'manifest.json'));
assert.equal(manifest.sourceScope,input.scope,'Chunk compilation must retain source review scope');
assert.equal(manifest.owners.length,input.models.length);
const variants:any={detail:manifest};
if(lodRoot)for(const level of ['facade','massing']){
 const variant=read(path.join(lodRoot,level,'chunks/tiles.json'));
 const levelInput=read(path.join(lodRoot,level,'assets/manifest.json'));
 assert.equal(variant.sourceScope,levelInput.scope);
 for(const owner of variant.owners){
  const detail=manifest.owners.find((o:any)=>o.id===owner.id);assert.ok(detail);
  for(const key of ['buildingId','geometryRevision','sourceRDFrame','appearanceRoof','reviewHold','acceptance'])assert.deepEqual(owner[key],detail[key],level+' '+key);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(lodRoot,level,'assets',owner.id+'.glb'))).digest('hex'),owner.sourceModelHash);
 }
 variants[level]=variant;
}
const owners=new Map<string,any>(manifest.owners.map((o:any)=>[o.id,o]));
const allIds=manifest.tiles.flatMap((t:any)=>t.owners);
assert.equal(allIds.length,new Set(allIds).size,'An owner must occur in exactly one whole chunk');
assert.deepEqual([...allIds].sort(),input.models.map((m:any)=>m.id).sort());
for(const owner of manifest.owners){
 const previous=input.models.find((m:any)=>m.id===owner.id);assert.ok(previous);
 for(const key of ['buildingId','geometryRevision','sourceRDFrame','appearanceRoof','reviewHold','acceptance'])assert.deepEqual(owner[key],previous[key],key+' changed');
 const bytes=fs.readFileSync(path.join(source,owner.id+'.glb'));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),owner.sourceModelHash,'Current asset hash differs from chunk input');
}
const bytes=(tile:any)=>{const b=fs.readFileSync(path.join(root,tile.binaryUrl));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
let decodedTriangles=0,pickingChecks=0;
function verifyPicking(group:THREE.Group){
 for(const mesh of group.children as THREE.Mesh[])for(const range of mesh.userData.ownerRanges){
  for(const index of [range.firstTriangle,range.firstTriangle+range.triangleCount-1]){
   const picked=pickOwner(mesh,index)!;assert.equal(picked.ownerId,range.ownerId);assert.equal(picked.buildingId,owners.get(range.ownerId).buildingId);pickingChecks++;
  }
 }
}
for(const tile of manifest.tiles){
 const resource=decodeBuildingLibraryTile(tile,bytes(tile),owners);
 assert.equal(resource.triangles,tile.triangles);assert.equal(resource.geometryBytes,tile.geometryBytes);
 verifyPicking(resource.group);decodedTriangles+=resource.triangles;resource.dispose();assert.equal(resource.disposed,true);
}
assert.equal(decodedTriangles,input.models.reduce((n:number,m:any)=>n+m.triangles,0));
const parent=new THREE.Group(),camera=new THREE.PerspectiveCamera(70,1.3,.1,500);camera.up.set(0,0,1);
const triangleBudget=30000,byteBudget=4000000;
let fetches=0,maxActive=0,maxTriangles=0,maxBytes=0;const visited=new Set<string>();
const omittedAt35M:string[]=[];const observedLevels=new Set<string>();
const streamer=new BuildingViewportStreamer(variants,{parent,maxChunks:8,maxTriangles:triangleBudget,maxGeometryBytes:byteBudget,maxConcurrent:2,
 fetchBinary:async(selection)=>{fetches++;await Promise.resolve();if(!lodRoot||selection.level==='detail')return bytes(selection.tile);const b=fs.readFileSync(path.join(lodRoot,selection.level,'chunks',selection.tile.binaryUrl));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
for(const tile of manifest.tiles){
 const centre=new THREE.Vector3(...tile.bounds.min).add(new THREE.Vector3(...tile.bounds.max)).multiplyScalar(.5).add(new THREE.Vector3(...tile.offset));
 camera.position.copy(centre).add(new THREE.Vector3(0,-35,20));camera.lookAt(centre);
 let pending=streamer.update(camera);maxActive=Math.max(maxActive,streamer.stats.activeRequests);let result=await pending;
 assert.ok(result.results.every(r=>r.status==='fulfilled'),'Viewport fetch/decode failed');
 if(!tile.owners.every((id:string)=>streamer.stats.owners.includes(id))){
  omittedAt35M.push(tile.key);
  camera.position.copy(centre).add(new THREE.Vector3(0,-8,5));camera.lookAt(centre);
  pending=streamer.update(camera);maxActive=Math.max(maxActive,streamer.stats.activeRequests);result=await pending;
  assert.ok(result.results.every(r=>r.status==='fulfilled'),'Closer viewport fetch/decode failed');
 }
 assert.ok(tile.owners.every((id:string)=>streamer.stats.owners.includes(id)),'Target whole chunk omitted even at8m: '+tile.key);
 assert.equal(streamer.stats.owners.length,new Set(streamer.stats.owners).size);
 assert.ok(streamer.stats.residentTriangles<=triangleBudget);assert.ok(streamer.stats.residentGeometryBytes<=byteBudget);
 assert.equal(parent.children.length,streamer.stats.residentChunks);
 for(const id of streamer.stats.owners)visited.add(id);
 for(const level of Object.values(streamer.stats.levels))observedLevels.add(level);
 for(const group of parent.children as THREE.Group[])verifyPicking(group);
 maxTriangles=Math.max(maxTriangles,streamer.stats.residentTriangles);maxBytes=Math.max(maxBytes,streamer.stats.residentGeometryBytes);
}
assert.equal(visited.size,owners.size);streamer.dispose();assert.equal(parent.children.length,0);assert.equal(streamer.stats.residentTriangles,0);await assert.rejects(streamer.update(camera),/disposed/);
const report={passed:true,owners:owners.size,chunks:manifest.tiles.length,sourceScopePreserved:true,sourceAssetHashesVerified:true,wholeOwnersUnique:true,
 preservedEvidenceHolds:manifest.owners.filter((o:any)=>o.reviewHold).length,decodedTriangles,viewportCases:manifest.tiles.length,visitedOwners:visited.size,
 realBinaryFetches:fetches,pickingChecks,triangleBudget,maxResidentTriangles:maxTriangles,byteBudget,maxResidentGeometryBytes:maxBytes,maxActiveRequests:maxActive,
 resourcesDisposed:true,lodLevels:Object.keys(variants),observedLevels:[...observedLevels],targetChunksOmittedAt35M:omittedAt35M,allTargetsVisitedAt35MOr8M:true,
 remaining:lodRoot?'Projected-size transitions and visual/GPU acceptance pending':'Detail-only budget omissions require authored LOD and visual/GPU acceptance before district use',gpuAcceptance:false,likenessAcceptance:false,productionReplacement:false};
fs.writeFileSync(path.join(root,'delivery-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
