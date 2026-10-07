// Decoded export regression probes for feedback 56aad0df; no GPU acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {MeshoptDecoder} from 'meshoptimizer';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as T from 'three';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const root='artifacts/occii-feedback-20261007';
async function load(file){
 const doc=await io.read(file),meshes=[],positions={};let triangles=0;
 for(const node of doc.getRoot().listNodes())for(const prim of node.getMesh()?.listPrimitives()??[]){
  const a=prim.getAttribute('POSITION'),matrix=new T.Matrix4().fromArray(node.getWorldMatrix()),v=[];
  for(let i=0;i<a.getCount();i++)v.push(...new T.Vector3(...a.getElement(i,[])).applyMatrix4(matrix).toArray());
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(Array.from(prim.getIndices().getArray()));triangles+=g.index.count/3;
  const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.name=prim.getMaterial().getName();m.updateMatrixWorld();meshes.push(m);positions[m.name]=v;
 }
 return {meshes,positions,triangles,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
}
const baseline=await load(`${root}/baseline/occii.glb`),candidate=await load(`${root}/candidate/occii.glb`),cx=-1.9,f=x=>31.93+(x-cx)*.12;
function hit(model,x,y){const ray=new T.Raycaster(new T.Vector3(x,y,f(x)+2),new T.Vector3(0,0,-1),0,4);const h=ray.intersectObjects(model.meshes)[0];return h?{material:h.object.name,point:h.point.toArray()}:null;}
const probes=[];
for(const dx of [-3.8,3.8]){
 const old=hit(baseline,cx+dx,5.745),now=hit(candidate,cx+dx,5.745);assert.equal(old?.material,'gold','Baseline must reproduce reported protruding trim');assert.notEqual(now?.material,'gold','Trim must not project outside narrowing gable');probes.push({kind:'former-overhang',dx,y:5.745,baseline:old,candidate:now});
}
for(const dx of [-.55,.55]){
 const old=hit(baseline,cx+dx,6.625),now=hit(candidate,cx+dx,6.625);assert.equal(old?.material,'red','Baseline must reproduce long tripod spoke');assert.equal(now?.material,'brick','Unsupported long spoke removed');probes.push({kind:'former-tripod',dx,y:6.625,baseline:old,candidate:now});
}
const fanAngles=[0,.18,.98,1.15,1.4,1.58,2.35,2.75,Math.PI];
for(const [fanIndex,aa] of fanAngles.entries())for(const fraction of [.25,.5,.75])for(const widthOffset of [-.045,0,.045])for(const oblique of [-.55,0,.55]){
 const radius=.58+(.46*fraction),x=cx+radius*Math.cos(aa)-widthOffset*Math.sin(aa),y=7.15+radius*Math.sin(aa)+widthOffset*Math.cos(aa),target=new T.Vector3(x,y,f(x)+.23);
 const outward=new T.Vector3(oblique,0,1).normalize();
 const ray=new T.Raycaster(target.clone().addScaledVector(outward,2),outward.clone().negate(),0,4),h=ray.intersectObjects(candidate.meshes)[0];
 const now=h?{material:h.object.name,point:h.point.toArray()}:null;
 assert.equal(now?.material,'gold',`Fan ${fanIndex} fraction ${fraction} width ${widthOffset} angle ${oblique} must be exposed`);
 probes.push({kind:'fan-first-hit',fanIndex,fraction,widthOffset,oblique,x,y,candidate:now});
}
for(const dx of [-1.45,1.45])assert.equal(hit(candidate,cx+dx,6.98)?.material,'gold','Short collar exposed');
assert.equal(hit(candidate,cx,7.15)?.material,'white','Roundel face remains exposed');
for(const material of Object.keys(baseline.positions).filter(x=>!['gold','red'].includes(x))){const a=baseline.positions[material],b=candidate.positions[material];assert.equal(a.length,b.length,`${material} unchanged vertex count`);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<.005),`${material} geometry unchanged within export quantization`);}
const report={feedback:'56aad0df-0be9-478c-812a-e99f9e9d9086',scope:'Decoded CPU/first-hit checks only. Gallery, live-game and hosted behavior pending.',baselineSha256:baseline.sha256,candidateSha256:candidate.sha256,triangles:candidate.triangles,bytes:fs.statSync(`${root}/candidate/occii.glb`).size,probes};fs.writeFileSync(`${root}/decoded-checks.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({sha256:candidate.sha256,triangles:candidate.triangles,bytes:report.bytes,probes:probes.length,status:'passed'}));
