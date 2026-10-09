import assert from 'node:assert/strict';
import type {Document} from '@gltf-transform/core';
import * as THREE from 'three';
/** Independent exported triangle/attribute multiset, including winding/material. */
function geometry(document:Document){
 const triangles=new Map<string,number>(),positions:number[][]=[],bounds=new THREE.Box3();let count=0;
 for(const node of document.getRoot().listNodes()){
  const mesh=node.getMesh();if(!mesh)continue;const transform=new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for(const primitive of mesh.listPrimitives()){
   const semantics=primitive.listSemantics().sort(),arrays=semantics.map(s=>primitive.getAttribute(s)!);
   const indices=primitive.getIndices()!.getArray()!,pos=primitive.getAttribute('POSITION')!.getArray()!;
   for(let i=0;i<indices.length;i+=3){
    const vertices=[];
    for(let k=0;k<3;k++){
     const index=indices[i+k],point=new THREE.Vector3(pos[index*3],pos[index*3+1],pos[index*3+2]).applyMatrix4(transform);positions.push(point.toArray());bounds.expandByPoint(point);
     vertices.push(JSON.stringify(arrays.map(a=>{const data=a.getArray()!,size=a.getElementSize();return [a.getType(),a.getNormalized(),...Array.from(data.slice(index*size,(index+1)*size))];})));
    }
    const rotations=[vertices,[vertices[1],vertices[2],vertices[0]],[vertices[2],vertices[0],vertices[1]]].map(v=>v.join('|')).sort();
    const key=JSON.stringify([node.getWorldMatrix(),primitive.getMaterial()?.getName(),semantics,rotations[0]]);
    triangles.set(key,(triangles.get(key)??0)+1);count++;
   }
  }
 }
 return {triangles,positions,bounds,count};
}
export function verifySemanticLod(original:Document,candidate:Document,recipe:any){
 const a=geometry(original),b=geometry(candidate);
 for(const [triangle,count]of b.triangles)assert.ok((a.triangles.get(triangle)??0)>=count,'Candidate changed retained triangle/attribute/material/winding');
 assert.ok(a.bounds.min.distanceTo(b.bounds.min)<1e-7&&a.bounds.max.distanceTo(b.bounds.max)<1e-7,'Exported bounds changed');
 const native:number[][]=[];for(const surface of recipe.sourceShell?.surfaces??[])for(const ring of surface.rings)for(const p of ring)native.push([p[0],p[2],-p[1]]);
 // Preserve each native position actually present in the approved export.
 let anchors=0;for(const p of native){
  const close=(q:number[])=>Math.hypot(...p.map((v,k)=>v-q[k]))<=.0001;
  if(a.positions.some(close)){assert.ok(b.positions.some(close),'An exported native anchor disappeared');anchors++;}
 }
 const originalMaterials=original.getRoot().listMaterials(),candidateMaterials=candidate.getRoot().listMaterials();
 for(const material of candidateMaterials){const before=originalMaterials.find(m=>m.getName()===material.getName());assert.ok(before);assert.deepEqual(material.getBaseColorFactor(),before.getBaseColorFactor());assert.equal(material.getRoughnessFactor(),before.getRoughnessFactor());assert.equal(material.getMetallicFactor(),before.getMetallicFactor());}
 return {retainedTriangleAttributesAndWindingExact:true,boundsExact:true,exportedNativeAnchorsPreserved:anchors,originalTriangles:a.count,triangles:b.count};
}

