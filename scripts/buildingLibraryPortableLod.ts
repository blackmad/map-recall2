/** Exact exporter role ranges; no geometry matching or mesh decimation. */
import assert from 'node:assert/strict';
import type {Document} from '@gltf-transform/core';
import * as THREE from 'three';

const policy: Record<string, [boolean, boolean]> = {
 'glazing':[true,true], 'outer-trim':[true,true],
 'jamb-profile':[false,false], 'sash-division':[true,false],
 'opaque-panel':[true,true], 'door-leaf':[true,true],
 'raised-panel':[false,false], 'louvre':[false,false],
 'sill-threshold':[true,true], 'handle':[false,false],
 'entrance-recess':[true,true],
};

export function omitPortableRoles(document:Document, level:'facade'|'massing') {
 const plans:any[] = [], bounds = new THREE.Box3();
 let originalTriangles=0, removedTriangles=0, protectedRanges=0, unknownRanges=0;
 for(const node of document.getRoot().listNodes()) {
  const mesh=node.getMesh(); if(!mesh)continue;
  assert.equal(document.getRoot().listNodes().filter(n=>n.getMesh()===mesh).length,1,'Instanced draft unsupported');
  const transform=new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for(const primitive of mesh.listPrimitives()) {
   assert.equal(primitive.getMode(),4); assert.equal(primitive.listTargets().length,0);
   const position=primitive.getAttribute('POSITION')!, index=primitive.getIndices()!;
   assert.ok(position&&index); const indices=Array.from(index.getArray()!);
   assert.equal(indices.length%3,0);
   const ranges=primitive.getExtras().portableDraftRoleRanges as any[];
   assert.ok(Array.isArray(ranges),'Missing exporter role ranges');
   let next=0;
   const positions=position.getArray()!;
   const points=Array.from({length:position.getCount()},(_,i)=>new THREE.Vector3(positions[i*3],positions[i*3+1],positions[i*3+2]).applyMatrix4(transform));
   for(const range of ranges) {
    assert.equal(range.firstTriangle,next,'Role range gap or overlap');
    assert.ok(Number.isInteger(range.triangleCount)&&range.triangleCount>0);
    next+=range.triangleCount; assert.ok(next<=indices.length/3);
    const declared=policy[range.lodRole];
    if(declared) {
     assert.equal(range.lodFacade,declared[0],'Construction policy disagrees with exporter');
     assert.equal(range.lodMassing,declared[1],'Construction policy disagrees with exporter');
    } else unknownRanges++;
    const rangeBounds=new THREE.Box3();
    for(const i of indices.slice(range.firstTriangle*3,next*3)) {
     assert.ok(Number.isInteger(i)&&i>=0&&i<points.length); rangeBounds.expandByPoint(points[i]);
    }
    bounds.union(rangeBounds);
    plans.push({primitive,index,indices,range,rangeBounds,omit:!!declared&&!range.sourceDerived&&!declared[level==='facade'?0:1]});
   }
   assert.equal(next,indices.length/3,'Role ranges do not cover exported primitive');
   originalTriangles+=next;
  }
 }
 // Keep complete objects that define any owner extent, including protrusions.
 for(const plan of plans) if(plan.omit) {
  if(['x','y','z'].some(axis=>Math.abs(plan.rangeBounds.min[axis]-bounds.min[axis])<1e-7||Math.abs(plan.rangeBounds.max[axis]-bounds.max[axis])<1e-7)) {
   plan.omit=false; protectedRanges++;
  }
 }
 const primitives=[...new Set(plans.map(p=>p.primitive))];
 for(const primitive of primitives) {
  const selected=plans.filter(p=>p.primitive===primitive), retained:number[]=[], ranges:any[]=[];
  for(const plan of selected) {
   if(plan.omit){removedTriangles+=plan.range.triangleCount;continue;}
   ranges.push({...plan.range,firstTriangle:retained.length/3});
   retained.push(...plan.indices.slice(plan.range.firstTriangle*3,(plan.range.firstTriangle+plan.range.triangleCount)*3));
  }
  if(!retained.length) {
   for(const mesh of document.getRoot().listMeshes()) if(mesh.listPrimitives().includes(primitive))mesh.removePrimitive(primitive);
   primitive.dispose();continue;
  }
  const vertices=[...new Set(retained)], remap=new Map(vertices.map((v,i)=>[v,i]));
  for(const semantic of primitive.listSemantics()) {
   const old=primitive.getAttribute(semantic)!; const array=old.getArray()!, size=old.getElementSize();
   const Constructor=array.constructor as any, compact=new Constructor(vertices.length*size);
   vertices.forEach((vertex,i)=>compact.set(array.slice(vertex*size,(vertex+1)*size),i*size));
   primitive.setAttribute(semantic,old.clone().setArray(compact));old.dispose();
  }
  const old=primitive.getIndices()!;
  primitive.setIndices(old.clone().setArray(vertices.length<=65535?Uint16Array.from(retained.map(i=>remap.get(i)!)):Uint32Array.from(retained.map(i=>remap.get(i)!))));old.dispose();
  primitive.setExtras({...primitive.getExtras(),portableDraftRoleRanges:ranges});
 }
 // Dispose unused accessors so omitted geometry does not remain in the binary.
 for(const accessor of document.getRoot().listAccessors()) if(accessor.listParents().length===1)accessor.dispose();
 document.getRoot().setExtras({...document.getRoot().getExtras(),lodLevel:level,lodPolicy:'explicit-construction-roles-v1'});
 return {originalTriangles,triangles:originalTriangles-removedTriangles,removedTriangles,protectedRanges,unknownRanges};
}
