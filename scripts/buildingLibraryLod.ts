/** Bounded GLB-derived rendering LODs; original source files remain immutable. */
import * as THREE from 'three';
import {MeshoptSimplifier} from 'meshoptimizer';
import type {Document,Accessor} from '@gltf-transform/core';
const key=(p:number[])=>p.map(v=>Math.round(v/0.0001)).join(',');
function sourcePositions(recipe:any){const map=new Map<string,number[][]>();for(const surface of recipe.sourceShell?.surfaces??[])for(const ring of surface.rings)for(const p of ring){const world=[p[0],p[2],-p[1]],k=key(world);const values=map.get(k)??[];values.push(world);map.set(k,values);}return map;}
function matchesSource(p:number[],sources:Map<string,number[][]>){const cell=p.map(v=>Math.round(v/.0001));for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const q of sources.get([cell[0]+x,cell[1]+y,cell[2]+z].join(','))??[])if(Math.hypot(...p.map((v,i)=>v-q[i]))<=.0001)return true;return false;}
const triangleKey=(a:number,b:number,c:number)=>{const rotations=[[a,b,c],[b,c,a],[c,a,b]];return rotations.map(r=>r.join(',')).sort()[0];};
export async function simplifyReviewedDocument(document:Document,recipe:any,options:{ratio:number;maxErrorM:number;normalWeight?:number}){
 if(!(options.ratio>0&&options.ratio<1)||!(options.maxErrorM>0&&options.maxErrorM<=.02))throw new Error('Invalid reviewed LOD approximation limits');
 await MeshoptSimplifier.ready;if(document.getRoot().listTextures().length)throw new Error('Textured assets require a separate LOD contract');const root=document.getRoot(),sources=sourcePositions(recipe),reports=[];
 for(const mesh of root.listMeshes()){
  const nodes=root.listNodes().filter(n=>n.getMesh()===mesh);if(nodes.length!==1)throw new Error('Rendering LOD requires an uninstanced reviewed mesh');const matrix=new THREE.Matrix4().fromArray(nodes[0].getWorldMatrix());
  for(const primitive of mesh.listPrimitives()){
   const position=primitive.getAttribute('POSITION')!,normal=primitive.getAttribute('NORMAL')!,originalIndices=primitive.getIndices()!;
   if(!position||!normal||!originalIndices||primitive.getMode()!==4||primitive.getMaterial()?.getBaseColorTexture())throw new Error('Unsupported reviewed LOD primitive');
   const positions=position.getArray()!,normals=normal.getArray()!,original=Uint32Array.from(originalIndices.getArray()!),world=new Float32Array(position.getCount()*3),locks=new Uint8Array(position.getCount()),box=new THREE.Box3();
   for(let i=0;i<position.getCount();i++){const p=new THREE.Vector3(positions[i*3],positions[i*3+1],positions[i*3+2]).applyMatrix4(matrix);world.set(p.toArray(),i*3);box.expandByPoint(p);}
   let nativeLocks=0;
   for(let i=0;i<locks.length;i++){const p=Array.from(world.subarray(i*3,i*3+3));const native=matchesSource(p,sources);if(native)nativeLocks++;const extrema=p.some((v,k)=>Math.abs(v-box.min.getComponent(k))<1e-6||Math.abs(v-box.max.getComponent(k))<1e-6);if(native||extrema)locks[i]=1;}
   const target=Math.max(3,Math.floor(original.length*options.ratio/3)*3);
   const [indices,error]=MeshoptSimplifier.simplifyWithAttributes(original,world,3,Float32Array.from(normals),3,Array(3).fill(options.normalWeight??.1),locks,target,options.maxErrorM,['ErrorAbsolute','LockBorder','Permissive']);
   if(indices.length>original.length||error>options.maxErrorM+1e-6)throw new Error('LOD simplification exceeded its declared limit');
   const used=new Set(indices),lockedOriginal=new Set(original.filter(i=>locks[i]));let maxProtectedNormalAliasError=0,protectedAliases=0;
   const pointKey=(i:number)=>Array.from(world.subarray(i*3,i*3+3)).join(',');
   const usedPositions=new Map<string,number[]>();for(const i of used){const k=pointKey(i),values=usedPositions.get(k)??[];values.push(i);usedPositions.set(k,values);}
   for(const i of lockedOriginal)if(!used.has(i)){
    const aliases=usedPositions.get(pointKey(i))??[];const error=Math.min(Infinity,...aliases.map(j=>Math.hypot(normals[j*3]-normals[i*3],normals[j*3+1]-normals[i*3+1],normals[j*3+2]-normals[i*3+2])));
    if(error>1e-4)throw new Error('LOD discarded a protected position/normal');maxProtectedNormalAliasError=Math.max(maxProtectedNormalAliasError,error);protectedAliases++;
   }
   const geometricTriangle=(a:number,b:number,c:number)=>{const p=[pointKey(a),pointKey(b),pointKey(c)];return [p,[p[1],p[2],p[0]],[p[2],p[0],p[1]]].map(r=>r.join('|')).sort()[0];};
   const protectedTriangles=[];for(let i=0;i<original.length;i+=3)if(locks[original[i]]&&locks[original[i+1]]&&locks[original[i+2]])protectedTriangles.push(geometricTriangle(original[i],original[i+1],original[i+2]));
   const actualTriangles=new Set<string>();for(let i=0;i<indices.length;i+=3)actualTriangles.add(geometricTriangle(indices[i],indices[i+1],indices[i+2]));for(const t of protectedTriangles)if(!actualTriangles.has(t))throw new Error('LOD altered a fully protected structural triangle');
   const compactIndices=indices.slice(),[remap,count]=MeshoptSimplifier.compactMesh(compactIndices);const buffer=position.getBuffer()!;const previous:Accessor[]=[];
   for(const semantic of primitive.listSemantics()){
    const old=primitive.getAttribute(semantic)!;previous.push(old);const values=old.getArray()!,size=old.getElementSize(),Constructor=values.constructor as any,compact=new Constructor(count*size);
    for(let i=0;i<remap.length;i++)if(remap[i]!==0xffffffff)for(let k=0;k<size;k++)compact[remap[i]*size+k]=values[i*size+k];
    primitive.setAttribute(semantic,document.createAccessor(old.getName()).setBuffer(buffer).setType(old.getType()).setNormalized(old.getNormalized()).setArray(compact));
   }
   primitive.setIndices(document.createAccessor().setBuffer(buffer).setType('SCALAR').setArray(count<=65535?Uint16Array.from(compactIndices):compactIndices));previous.push(originalIndices);
   for(const old of previous)if(old.listParents().every(p=>p.propertyType==='Root'))old.dispose();
   reports.push({mesh:mesh.getName(),material:primitive.getMaterial()!.getName(),originalTriangles:original.length/3,triangles:indices.length/3,reportedErrorM:error,lockedNativeVertices:nativeLocks,lockedVertices:lockedOriginal.size,protectedTriangles:protectedTriangles.length,protectedAliases,maxProtectedNormalAliasError,retainedVerticesAndAttributesUnmoved:true});
  }
 }
 return {originalTriangles:reports.reduce((n,r)=>n+r.originalTriangles,0),triangles:reports.reduce((n,r)=>n+r.triangles,0),maxReportedErrorM:Math.max(0,...reports.map(r=>r.reportedErrorM)),primitives:reports};
}
