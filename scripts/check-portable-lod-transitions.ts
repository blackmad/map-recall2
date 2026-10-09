/** Isolate each real whole-owner chunk to verify replacement and failure behavior. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BuildingViewportStreamer} from '../src/canalRecall/buildingLibraryViewportStreaming';
import {pickOwner} from '../src/canalRecall/buildingLibraryTileBatching';
const i=process.argv.indexOf('--root'),root=process.argv[i+1];assert.ok(i>=0&&root&&!root.startsWith('--'));
const levels=['detail','facade','massing'] as const;
const manifests:any=Object.fromEntries(levels.map(level=>[level,JSON.parse(fs.readFileSync(`${root}/${level}/chunks/tiles.json`,'utf8'))]));
let fetches=0,picks=0,cases=0,failures=0,disposals=0,maxTriangles=0,maxBytes=0;
const owners=new Set<string>();
for(const tile of manifests.detail.tiles) {
 const variants:any=Object.fromEntries(levels.map(level=>{
  const m=manifests[level];return [level,{...m,owners:m.owners.filter((o:any)=>tile.owners.includes(o.id)),tiles:m.tiles.filter((t:any)=>t.key===tile.key)}];
 }));
 const parent=new THREE.Group(),camera=new THREE.PerspectiveCamera(70,1.3,.1,1000);camera.up.set(0,0,1);
 const center=new THREE.Vector3(...tile.bounds.min).add(new THREE.Vector3(...tile.bounds.max)).multiplyScalar(.5).add(new THREE.Vector3(...tile.offset));
 let fail=false;const watched=new Set<THREE.Object3D>();
 const streamer=new BuildingViewportStreamer(variants,{parent,maxChunks:8,maxTriangles:30000,maxGeometryBytes:4000000,maxConcurrent:2,
  fetchBinary:async selection=>{
   fetches++;await Promise.resolve();if(fail&&selection.level==='massing')return new ArrayBuffer(4);
   const b=fs.readFileSync(`${root}/${selection.level}/chunks/${selection.tile.binaryUrl}`);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
  }});
 const aim=(distance:number)=>{camera.position.copy(center).add(new THREE.Vector3(0,-distance,0));camera.lookAt(center);};
 function check(expected:string) {
  assert.equal(streamer.stats.levels[tile.key],expected);assert.equal(parent.children.length,1);
  assert.deepEqual([...streamer.stats.owners].sort(),[...tile.owners].sort());
  assert.ok(streamer.stats.residentTriangles<=30000&&streamer.stats.residentGeometryBytes<=4000000);
  maxTriangles=Math.max(maxTriangles,streamer.stats.residentTriangles);maxBytes=Math.max(maxBytes,streamer.stats.residentGeometryBytes);
  for(const group of parent.children) {
   if(!watched.has(group)){watched.add(group);for(const mesh of group.children as THREE.Mesh[])mesh.geometry.addEventListener('dispose',()=>disposals++);}
   for(const mesh of group.children as THREE.Mesh[])for(const range of mesh.userData.ownerRanges)for(const index of [range.firstTriangle,range.firstTriangle+range.triangleCount-1]) {
    const picked=pickOwner(mesh,index)!;assert.equal(picked.ownerId,range.ownerId);assert.equal(picked.buildingId,range.buildingId);picks++;
   }
  }
 }
 for(const [distance,expected]of [[40,'detail'],[150,'facade'],[350,'massing'],[40,'detail']] as const) {
  const old=parent.children[0];aim(distance);const result=await streamer.update(camera);
  assert.ok(result.results.every(r=>r.status==='fulfilled'));check(expected);cases++;
  if(old)assert.equal(old.parent,null,'Previous representation still attached');
 }
 const good=parent.children[0];fail=true;aim(350);const failed=await streamer.update(camera);
 assert.ok(failed.results.some(r=>r.status==='rejected'));assert.equal(good.parent,parent);check('detail');failures++;
 fail=false;await streamer.update(camera);check('massing');assert.equal(good.parent,null);
 for(const owner of tile.owners)owners.add(owner);
 streamer.dispose();assert.equal(parent.children.length,0);assert.equal(streamer.stats.residentGeometryBytes,0);
}
assert.equal(owners.size,manifests.detail.owners.length);
const report={passed:true,owners:owners.size,chunks:manifests.detail.tiles.length,cameraCases:cases,
 actualAssetLevels:levels,realBinaryFetches:fetches,pickingChecks:picks,maxResidentTriangles:maxTriangles,maxResidentGeometryBytes:maxBytes,
 failedReplacementCases:failures,failedReplacementPreservesPriorRepresentation:true,disposedGeometries:disposals,
 scope:'Isolated per-chunk transitions; district admission checked separately',gpuAcceptance:false,likenessAcceptance:false,promoted:false};
fs.writeFileSync(root+'/transition-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
