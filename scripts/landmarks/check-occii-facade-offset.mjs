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
const root='artifacts/occii-facade-offset';
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
function ray(model,x,y,oblique=0){const target=new T.Vector3(x,y,f(x)+.23),out=new T.Vector3(oblique,0,1).normalize();const h=new T.Raycaster(target.clone().addScaledVector(out,2),out.clone().negate(),0,4).intersectObjects(model.meshes)[0];return h?{material:h.object.name,point:h.point.toArray()}:null;}
const probes=[];
// Preserve the already accepted fan, roundel and short collar on all prior rays.
for(const [fanIndex,aa] of [0,.18,.98,1.15,1.4,1.58,2.35,2.75,Math.PI].entries())for(const fraction of [.25,.5,.75])for(const widthOffset of [-.045,0,.045])for(const oblique of [-.55,0,.55]){
 const radius=.58+.46*fraction,x=cx+radius*Math.cos(aa)-widthOffset*Math.sin(aa),y=7.15+radius*Math.sin(aa)+widthOffset*Math.cos(aa),old=ray(baseline,x,y,oblique),now=ray(candidate,x,y,oblique);
 assert.equal(old?.material,'gold');assert.equal(now?.material,'gold',`Fan ${fanIndex} remains exposed`);assert.ok(new T.Vector3(...old.point).distanceTo(new T.Vector3(...now.point))<.007,'Fan geometry unchanged within independent mesh quantization');probes.push({kind:'preserved-fan',fanIndex,fraction,widthOffset,oblique,old,now});
}
for(const dx of [-1.45,1.45])assert.equal(ray(candidate,cx+dx,6.98)?.material,'gold');assert.equal(ray(candidate,cx,7.15)?.material,'white');
// Probe real facade assemblies at three positions across their widths and from
// both obliques. These rays must see panes rather than floating overlaid letters.
for(const x of [cx-1.3,cx,cx+1.3])for(const dx of [-.25,0,.25])for(const y of [4.6,5.0,5.4])for(const angle of [-.3,0,.3]){const now=ray(candidate,x+dx,y,angle);assert.equal(now?.material,'dark',`Upper pane exposed ${x+dx}, ${y}, ${angle}`);probes.push({kind:'upper-pane',x:x+dx,y,angle,now});}
for(const x of [cx-.6,cx+.4,cx+1.6])for(const y of [.5,1.5,2.8]){const now=ray(candidate,x,y);assert.equal(now?.material,'dark','Door panes exposed');probes.push({kind:'door',x,y,now});}
for(const dx of [-1.04,.96])for(const y of [3.5,3.75,4.02]){const now=ray(candidate,cx+dx,y);assert.equal(now?.material,'white','Banner panel exposed and bounded');probes.push({kind:'banner-panel',x:cx+dx,y,now});}
const left=ray(candidate,cx-1.04,3.75),right=ray(candidate,cx+.96,3.75);assert.ok(Math.abs((right.point[2]-left.point[2])/2-.12)<.003,'Banner follows surveyed wall tangent');
// Probe the actual native letter strokes, independent of the white panel probes.
for(const x of [cx-.735,cx-.355,cx+.025,cx+.465,cx+.705])assert.equal(ray(candidate,x,3.78)?.material,'red','Continuous Gothic letter stroke is exposed');
for(const material of ['brick','slate']){const a=baseline.positions[material],b=candidate.positions[material];assert.equal(a.length,b.length,`${material} unchanged vertex count`);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<.007),`${material} unchanged massing`);}
const report={feedback:['063e3e2c-0627-48a8-b835-f407fee9cbe7','d89b55f3-cc56-4e64-9faa-8cfa6e3d34c4'],scope:'Decoded mesh first-hit CPU checks only; gallery/live-game/hosted acceptance pending.',baselineSha256:baseline.sha256,candidateSha256:candidate.sha256,triangles:candidate.triangles,bytes:fs.statSync(`${root}/candidate/occii.glb`).size,probes};fs.writeFileSync(`${root}/decoded-checks.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({candidateSha256:candidate.sha256,triangles:report.triangles,bytes:report.bytes,probes:probes.length,status:'passed'}));
