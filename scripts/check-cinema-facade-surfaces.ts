/** Decode exported meshes: frontage panes must be visible and the rear roof must
 * not share Rialto's cream wall plane. These reproduce reported gallery defects. */
import assert from 'node:assert/strict';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
async function meshes(id:string){
 const doc=await io.read(`${process.env.CINEMA_CHECK_MODEL_DIR??"public/canal-drive/models"}/${id}.glb`),out:T.Mesh[]=[];
 for(const node of doc.getRoot().listNodes())for(const p of node.getMesh()?.listPrimitives()??[]){
  const position=p.getAttribute('POSITION')!,values:number[]=[];
  for(let i=0;i<position.getCount();i++)values.push(...position.getElement(i,[]));
  const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(values,3));
  if(p.getIndices())geometry.setIndex(Array.from(p.getIndices()!.getArray()!));
  const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.name=p.getMaterial()!.getName();mesh.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));mesh.updateMatrixWorld();out.push(mesh);
 }
 return out;
}
const kriterion=await meshes('kriterion');let panes=0;
for(const mesh of kriterion.filter(m=>m.name==='dark')){
 const p=mesh.geometry.getAttribute('position'),ix=mesh.geometry.getIndex();
 for(let i=0;i<(ix?.count??p.count);i+=3){
  const points=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld));
  const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
  const target=points[0].clone().multiplyScalar(.2).addScaledVector(points[1],.3).addScaledVector(points[2],.5);
  if(normal.z<.98||target.y<5)continue;
  const hits=new T.Raycaster(target.clone().addScaledVector(normal,50),normal.clone().negate()).intersectObjects(kriterion);
  assert(['dark','white'].includes(hits[0]?.object.name??''),`Kriterion pane buried at ${target.toArray()}: first material ${hits[0]?.object.name}`);panes++;
 }
}
assert.equal(panes,24,'All twelve front windows need two exposed pane triangles');
const rialto=await meshes('rialto');let separated=0;
for(const z of [-4,-2,0,2,4]){
 const hits=new T.Raycaster(new T.Vector3(50,14.04,z),new T.Vector3(-1,0,0)).intersectObjects(rialto);
 const wall=hits.find(h=>h.object.name==='white');assert(wall);
 const roof=hits.find(h=>h.object.name==='slate');assert(roof);
 assert(wall.point.x-roof.point.x>.8,'Rialto roof shares principal cream facade plane');separated++;
}
console.log(`Cinema frontage checks passed: ${panes} exposed pane triangles; ${separated} roof/facade separation rays.`);
