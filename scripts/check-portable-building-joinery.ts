/** Independent portable joinery positions versus reviewed saved Blender scenes. */
import fs from 'node:fs';import assert from 'node:assert/strict';import * as THREE from 'three';
const root='artifacts/jordaan-building-library/overnight-source-review/cafe-draft',samples=JSON.parse(fs.readFileSync(root+'/joinery-probe.json','utf8'));
let objects=0,vertices=0,maxErrorM=0;const heads=new Set<string>();
for(const id of [...new Set<string>(samples.map((s:any)=>s.modelId))]){
 const scene=JSON.parse(fs.readFileSync(`artifacts/building-lod/all-real-scene-topology/${id}.json`,'utf8')),byId=new Map(scene.objects.map((o:any)=>[o.address,o])),matrices=new Map<string,THREE.Matrix4>();
 function matrix(o:any):THREE.Matrix4{if(matrices.has(o.address))return matrices.get(o.address)!;const t=o.transform;assert.equal(t.rotmode,1);const m=new THREE.Matrix4().compose(new THREE.Vector3(...t.loc),new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rot,'ZYX')),new THREE.Vector3(...t.size));if(t.parent!=='0'){m.premultiply(new THREE.Matrix4().fromArray(t.parentinv));m.premultiply(matrix(byId.get(t.parent)));}matrices.set(o.address,m);return m;}
 for(const sample of samples.filter((s:any)=>s.modelId===id)){
  heads.add(sample.head);const available=scene.objects.filter((o:any)=>o.mesh&&o.properties.featureId===sample.featureId&&o.properties.frontageId===sample.frontageId);
  for(const captured of sample.meshes){
   const matches=available.filter((o:any)=>o.name.replace(/\.\d{3}$/,'')===captured.name&&o.mesh.positions.length===captured.vertices.length);assert.ok(matches.length,`Missing reviewed role ${id}: ${captured.name}`);
   let best=Infinity;
   for(const original of matches){const expected=original.mesh.positions.map((p:number[])=>new THREE.Vector3(...p).applyMatrix4(matrix(original))),actual=captured.vertices.map((p:number[])=>new THREE.Vector3(...p));
    // Bidirectional vertex comparison includes every corner, not just bounds.
    const error=Math.max(...actual.map((p:THREE.Vector3)=>Math.min(...expected.map((q:THREE.Vector3)=>p.distanceTo(q)))),...expected.map((p:THREE.Vector3)=>Math.min(...actual.map((q:THREE.Vector3)=>p.distanceTo(q)))));best=Math.min(best,error);
   }
   assert.ok(best<.00002,`Portable joinery differs from reviewed Blender role ${captured.name}: ${best} m`);maxErrorM=Math.max(maxErrorM,best);objects++;vertices+=captured.vertices.length;
  }
 }
}
const report={passed:true,approvedBuildings:3,openings:samples.length,heads:[...heads],comparedObjects:objects,comparedVertices:vertices,maxVertexErrorM:maxErrorM,comparison:'Bidirectional all-corner world-position comparison against independent reviewed Blender scene objects',scope:'Joinery geometry only; does not prove materials, normals, source wall Boolean equivalence or actual rendered draft acceptance'};
fs.writeFileSync(root+'/joinery-checks.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
