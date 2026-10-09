/** Match saved static component faces onto immutable reviewed GLB triangles.
 * Unknown or ambiguous geometry stays. An omitted object must have every face
 * accounted for before any of its triangles can be removed.
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type {Document} from '@gltf-transform/core';

const EPS = .0001;
type Face = {object: number; points: THREE.Vector3[]; normal: THREE.Vector3; area: number; covered: number; planar: boolean};
type Triangle = {indices: number[]; faces: number[]; area: number};
const cell = (v: THREE.Vector3) => [v.x,v.y,v.z].map(n=>Math.floor(n/EPS));

export function omitReviewedRoles(document: Document, scene: any, level: 'facade'|'massing') {
 const objects=scene.objects, byId=new Map(objects.map((o:any)=>[o.address,o])), matrices=new Map<string,THREE.Matrix4>(), active=new Set<string>();
 function matrix(o:any):THREE.Matrix4 {
  if(matrices.has(o.address))return matrices.get(o.address)!;
  assert.ok(!active.has(o.address),'Cyclic object parent');active.add(o.address);
  const t=o.transform;assert.equal(t.partype,0);assert.equal(t.rotmode,1);
  assert.ok(t.dloc.every((n:number)=>n===0)&&t.drot.every((n:number)=>n===0)&&t.dscale.every((n:number)=>n===1),'Unsupported delta transform');
  assert.ok(!Object.values(o.unevaluated).some(Boolean),'Unevaluated scene constraint/modifier');
  const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rot,'ZYX'));
  const local=new THREE.Matrix4().compose(new THREE.Vector3(...t.loc),rotation,new THREE.Vector3(...t.size));
  if(t.parent!=='0') {const parent=byId.get(t.parent);assert.ok(parent,'Missing parent');local.premultiply(new THREE.Matrix4().fromArray(t.parentinv));local.premultiply(matrix(parent));}
  active.delete(o.address);matrices.set(o.address,local);return local;
 }
 const faces:Face[]=[], grid=new Map<string,{point:THREE.Vector3;face:number}[]>();
 objects.forEach((o:any,object:number)=>{
  if(!o.mesh)return;
  const transform=matrix(o), points=o.mesh.positions.map((p:number[])=>{const v=new THREE.Vector3(...p).applyMatrix4(transform);return new THREE.Vector3(v.x,v.z,-v.y);});
  for(const polygon of o.mesh.faces) {
   const ring=polygon.map((i:number)=>points[i]);const areaVector=new THREE.Vector3();
   for(let i=0;i<ring.length;i++)areaVector.add(new THREE.Vector3().crossVectors(ring[i],ring[(i+1)%ring.length]));
   const area=areaVector.length()/2;if(area<1e-10)continue;
   const normal=areaVector.normalize(),planar=ring.every((p:THREE.Vector3)=>Math.abs(normal.dot(p.clone().sub(ring[0])))<=EPS);
   const face=faces.length;faces.push({object,points:ring,normal,area,covered:0,planar});
   for(const point of ring){const key=cell(point).join(',');const values=grid.get(key)??[];values.push({point,face});grid.set(key,values);}
  }
 });
 function at(point:THREE.Vector3) {
  const c=cell(point),result=new Set<number>();
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)
   for(const match of grid.get([c[0]+x,c[1]+y,c[2]+z].join(','))??[])
    if(match.point.distanceTo(point)<=EPS)result.add(match.face);
  return result;
 }
 const plans:any[]=[],bounds=new THREE.Box3();let unmatched=0,originalTriangles=0;
 for(const node of document.getRoot().listNodes()) {
  const mesh=node.getMesh();if(!mesh)continue;
  assert.equal(document.getRoot().listNodes().filter(n=>n.getMesh()===mesh).length,1,'Instancing unsupported');
  const transform=new THREE.Matrix4().fromArray(node.getWorldMatrix());
  for(const primitive of mesh.listPrimitives()) {
   assert.equal(primitive.getMode(),4);const accessor=primitive.getAttribute('POSITION')!, index=primitive.getIndices()!;
   assert.ok(accessor&&index&&primitive.getAttribute('NORMAL'));
   const positions=accessor.getArray()!,original=Array.from(index.getArray()!),points:THREE.Vector3[]=[],members:Set<number>[]=[];
   for(let i=0;i<accessor.getCount();i++){const point=new THREE.Vector3(positions[i*3],positions[i*3+1],positions[i*3+2]).applyMatrix4(transform);points.push(point);members.push(at(point));}
   const triangles:Triangle[]=[];
   for(let i=0;i<original.length;i+=3) {
    const indices=original.slice(i,i+3),[a,b,c]=indices.map(j=>points[j]);bounds.expandByPoint(a).expandByPoint(b).expandByPoint(c);
    const normal=new THREE.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)),area=normal.length()/2;normal.normalize();
    const candidates=[...members[indices[0]]].filter(f=>members[indices[1]].has(f)&&members[indices[2]].has(f)&&faces[f].planar&&normal.dot(faces[f].normal)>.99999);
    for(const f of candidates)faces[f].covered+=area;
    if(!candidates.length)unmatched++;triangles.push({indices,faces:candidates,area});originalTriangles++;
   }
   plans.push({primitive,triangles,points});
  }
 }
 const allowed=new Set<number>();
 objects.forEach((o:any,i:number)=>{if(o.mesh&&!o.sourceOnly&&o.keep[level]===false)allowed.add(i);});
 // Complete face coverage prevents partially dismantling a named frame or rail.
 for(const face of faces)if(!face.planar||Math.abs(face.covered-face.area)>Math.max(1e-7,face.area*.001))allowed.delete(face.object);
 // Keep any object sharing an exported triangle with retained/unmapped geometry.
 let changed=true;
 while(changed) {
  changed=false;
  for(const plan of plans)for(const triangle of plan.triangles){
   const owners=new Set(triangle.faces.map((f:number)=>faces[f].object));
   if([...owners].some(i=>!allowed.has(i)))for(const i of owners)if(allowed.delete(i))changed=true;
  }
 }
 // A decoration setting an exported bound stays, preserving the full envelope.
 for(const face of faces)if(face.points.some(p=>[0,1,2].some(k=>Math.abs(p.getComponent(k)-bounds.min.getComponent(k))<1e-5||Math.abs(p.getComponent(k)-bounds.max.getComponent(k))<1e-5)))allowed.delete(face.object);
 // Repeat overlap closure after envelope protection.
 changed=true;while(changed){changed=false;for(const plan of plans)for(const triangle of plan.triangles){const owners=new Set(triangle.faces.map((f:number)=>faces[f].object));if([...owners].some(i=>!allowed.has(i)))for(const i of owners)if(allowed.delete(i))changed=true;}}
 let removed=0;
 for(const plan of plans) {
  const primitive=plan.primitive,kept:number[]=[];
  for(const triangle of plan.triangles) {
   if(triangle.faces.length&&triangle.faces.every((f:number)=>allowed.has(faces[f].object)))removed++;
   else kept.push(...triangle.indices);
  }
  if(kept.length===plan.triangles.length*3)continue;
  if(!kept.length){primitive.dispose();continue;}
  const oldIndex=primitive.getIndices(),buffer=primitive.getAttribute('POSITION').getBuffer(),used=[...new Set(kept)],remap=new Map(used.map((n,i)=>[n,i])),previous=[oldIndex];
  for(const semantic of primitive.listSemantics()){
   const old=primitive.getAttribute(semantic),source=old.getArray(),size=old.getElementSize(),Constructor=source.constructor as any,values=new Constructor(used.length*size);previous.push(old);
   used.forEach((original,i)=>{for(let k=0;k<size;k++)values[i*size+k]=source[original*size+k];});
   primitive.setAttribute(semantic,document.createAccessor(old.getName()).setBuffer(buffer).setType(old.getType()).setNormalized(old.getNormalized()).setArray(values));
  }
  const Index=used.length<=65535?Uint16Array:Uint32Array;
  primitive.setIndices(document.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(Index.from(kept.map(i=>remap.get(i)!))));
  for(const old of previous)if(old.listParents().every((p:any)=>p.propertyType==='Root'))old.dispose();
 }
 for(const mesh of document.getRoot().listMeshes())if(!mesh.listPrimitives().length){
  for(const node of document.getRoot().listNodes())if(node.getMesh()===mesh)node.setMesh(null);
  mesh.dispose();
 }
 // Entirely removed primitives can leave large accessor payloads rooted but unused.
 for(const accessor of document.getRoot().listAccessors())
  if(accessor.listParents().every(p=>p.propertyType==='Root'))accessor.dispose();
 return {originalTriangles,triangles:originalTriangles-removed,removedTriangles:removed,unmatchedTrianglesRetained:unmatched,
  omittedObjects:[...allowed].map(i=>objects[i].name),retainedAttributesExact:true,matchingToleranceM:EPS,status:'isolated; pending independent geometry and visual review'};
}
