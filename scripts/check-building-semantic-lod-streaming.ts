/** Exercise real lighter building binaries through the actual viewport loader. */
import fs from 'node:fs';import assert from 'node:assert/strict';import * as THREE from 'three';
import {BuildingViewportStreamer} from '../src/canalRecall/buildingLibraryViewportStreaming';
import {pickOwner} from '../src/canalRecall/buildingLibraryTileBatching';
const rootIndex=process.argv.indexOf('--root'),root=rootIndex<0?'artifacts/building-lod/semantic-pilot':process.argv[rootIndex+1],levels=['detail','facade','massing']as const;
assert.ok(root&&!root.startsWith('--'),'Missing --root');
const variants=Object.fromEntries(levels.map(level=>[level,JSON.parse(fs.readFileSync(`${root}/${level}/chunks/tiles.json`,'utf8'))]))as any;
const parent=new THREE.Group(),camera=new THREE.PerspectiveCamera(70,1.3,.1,1000);camera.up.set(0,0,1);
let fetches=0,picks=0,failedKey:string|undefined,peakTriangles=0,peakBytes=0,disposedGeometry=0,disposedMaterial=0;
const watch=(group:THREE.Object3D)=>{for(const mesh of group.children as THREE.Mesh[]){mesh.geometry.addEventListener('dispose',()=>disposedGeometry++);(mesh.material as THREE.Material).addEventListener('dispose',()=>disposedMaterial++);}};
const observed=new Set<THREE.Object3D>();
const streamer=new BuildingViewportStreamer(variants,{parent,maxChunks:variants.detail.tiles.length,maxTriangles:40000,maxGeometryBytes:3000000,maxConcurrent:2,fetchBinary:async selection=>{
 fetches++;await Promise.resolve();if(selection.key===failedKey&&selection.level==='massing')return new ArrayBuffer(4);
 const bytes=fs.readFileSync(`${root}/${selection.level}/chunks/${selection.tile.binaryUrl}`);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}});
function aim(tile:any,distance:number){const center=new THREE.Vector3(...tile.bounds.min).add(new THREE.Vector3(...tile.bounds.max)).multiplyScalar(.5).add(new THREE.Vector3(...tile.offset));camera.position.copy(center).add(new THREE.Vector3(0,-distance,0));camera.lookAt(center);}
function checks(){
 const stats=streamer.stats;assert.equal(stats.owners.length,new Set(stats.owners).size);assert.ok(stats.residentTriangles<=40000&&stats.residentGeometryBytes<=3000000);peakTriangles=Math.max(peakTriangles,stats.residentTriangles);peakBytes=Math.max(peakBytes,stats.residentGeometryBytes);
 for(const group of parent.children){if(!observed.has(group)){observed.add(group);watch(group);}for(const mesh of group.children as THREE.Mesh[])for(const range of mesh.userData.ownerRanges){assert.equal(pickOwner(mesh,range.firstTriangle)?.ownerId,range.ownerId);assert.equal(pickOwner(mesh,range.firstTriangle+range.triangleCount-1)?.buildingId,range.buildingId);picks+=2;}}
}
const cases=[];
for(const tile of variants.detail.tiles){
 for(const [distance,expected]of [[40,'detail'],[150,'facade'],[350,'massing'],[40,'detail']]as const){
  aim(tile,distance);const result=await streamer.update(camera);assert.ok(result.results.every(r=>r.status==='fulfilled'));assert.equal(streamer.stats.levels[tile.key],expected);checks();cases.push({key:tile.key,distanceM:distance,level:expected,triangles:streamer.stats.residentTriangles,bytes:streamer.stats.residentGeometryBytes});
 }
}
const tile=variants.detail.tiles[0];aim(tile,40);await streamer.update(camera);checks();
const owner=tile.owners[0],good=parent.children.find(group=>group.children.some(mesh=>(mesh as THREE.Mesh).userData.ownerRanges.some((r:any)=>r.ownerId===owner)))!;assert.ok(good);
failedKey=tile.key;aim(tile,350);const failed=await streamer.update(camera);assert.ok(failed.results.some(r=>r.status==='rejected'));assert.equal(streamer.stats.levels[tile.key],'detail');assert.equal(good.parent,parent);checks();
failedKey=undefined;await streamer.update(camera);assert.equal(streamer.stats.levels[tile.key],'massing');assert.equal(good.parent,null);checks();streamer.dispose();assert.equal(parent.children.length,0);assert.equal(streamer.stats.residentTriangles,0);assert.ok(disposedGeometry>0&&disposedMaterial>0);
const report={passed:true,isolated:true,promoted:false,realOwners:variants.detail.owners.length,actualAssetLevels:levels,cameraCases:cases.length,fetches,pickingChecks:picks,peakResidentTriangles:peakTriangles,peakResidentGeometryBytes:peakBytes,failedRealMassingReplacementPreservesReviewedDetail:true,disposedGeometry,disposedMaterial,cases,remaining:'Actual GPU/browser rendering and projected-size transition review'};
fs.writeFileSync(root+'/streaming-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,cases:undefined}));
