import assert from 'node:assert/strict';
import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import * as T from 'three';

const specs=JSON.parse(fs.readFileSync('scripts/jan-evertsen-pilot/native-specs.json','utf8'));
const results=[];
for(const spec of specs){
  const doc=await new NodeIO().read(`artifacts/jan-evertsen-pilot/models/${spec.id}.glb`);
  const group=new T.Group();let roofUp=true, triangles=0;
  assert.equal(doc.getRoot().listTextures().length,0,'Texture-free original mesh');
  for(const primitive of doc.getRoot().listMeshes()[0].listPrimitives()){
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(primitive.getAttribute('POSITION')!.getArray()!,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(primitive.getAttribute('NORMAL')!.getArray()!,3));
    const indices=primitive.getIndices()?.getArray(); if(indices)geometry.setIndex(Array.from(indices));
    const name=primitive.getMaterial()!.getName();
    const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.FrontSide}));mesh.name=name;group.add(mesh);
    const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
    triangles+=(geometry.index?.count??p.count)/3;
    for(let i=0;i<p.count;i++){
      assert(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)),'Finite geometry');
      assert(p.getY(i)<=spec.height+.002,'Detail must not grow above measured provisional roof plane');
      if(name==='slate'&&Math.abs(p.getY(i)-spec.height)<.002) roofUp&&=n.getY(i)>.99;
    }
  }
  assert(roofUp,'Explicit roof plane points upward');
  group.updateMatrixWorld(true);
  const [a,b]=spec.frontage.localVertices,angle=spec.frontage.angleRadians,nx=Math.sin(angle),nz=Math.cos(angle),mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
  const probes=[{label:'upper-center-pane',u:.2,y:5.5},{label:'shop-center-pane',u:.7,y:1.5}];
  for(const probe of probes){
    const origin=new T.Vector3(mx+probe.u*Math.cos(angle)+nx*4,probe.y,mz-probe.u*Math.sin(angle)+nz*4);
    const hit=new T.Raycaster(origin,new T.Vector3(-nx,0,-nz),0,6).intersectObject(group,true)[0];
    assert.equal(hit?.object.name,'glass',`${probe.label} must be first hit from outward facade`);
  }
  assert(triangles<40000);assert(fs.statSync(`artifacts/jan-evertsen-pilot/models/${spec.id}.glb`).size<500000);
  results.push({id:spec.id,triangles,checks:['finite native bounds','details below surveyed provisional roof','upward roof','first-hit shop and upper glazing','texture-free','budget'],acceptance:'CPU geometry only; source gaps and game visual checks pending'});
}
fs.writeFileSync('artifacts/jan-evertsen-pilot/geometry-check.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results));
