import assert from 'node:assert/strict';
import {Document,NodeIO} from '@gltf-transform/core';
import {omitPortableRoles} from './buildingLibraryPortableLod';
import {verifySemanticLod} from './buildingLibraryLodVerification';

function fixture(){
 const d=new Document(),b=d.createBuffer(),m=d.createMesh(),s=d.createScene();
 const positions=[[-5,-5,-5],[5,-5,5],[0,5,0],[-1,-1,0],[1,-1,0],[0,1,0]];
 const roles=[
  {lodRole:null,lodFacade:false,lodMassing:false}, // Unknown policy must retain.
  {lodRole:'jamb-profile',lodFacade:false,lodMassing:false},
  {lodRole:'sash-division',lodFacade:true,lodMassing:false},
  {lodRole:'door-leaf',lodFacade:true,lodMassing:true},
  {lodRole:'jamb-profile',lodFacade:false,lodMassing:false,sourceDerived:true},
  {lodRole:'handle',lodFacade:false,lodMassing:false}, // Defines owner bounds.
 ];
 const vertices=roles.flatMap((_,i)=>i===0||i===5?positions.slice(0,3):positions.slice(3)), index=Array.from({length:18},(_,i)=>i);
 const a=(type:any,data:Float32Array)=>d.createAccessor().setBuffer(b).setType(type).setArray(data);
 const p=d.createPrimitive().setAttribute('POSITION',a('VEC3',Float32Array.from(vertices.flat())))
  .setAttribute('NORMAL',a('VEC3',Float32Array.from(vertices.flatMap(()=>[0,0,1]))))
  .setAttribute('TEXCOORD_0',a('VEC2',Float32Array.from(vertices.flatMap(v=>v.slice(0,2)))))
  .setIndices(d.createAccessor().setBuffer(b).setType('SCALAR').setArray(Uint16Array.from(index)))
  .setMaterial(d.createMaterial('brick').setBaseColorFactor([.3,.2,.1,1]))
  .setExtras({portableDraftRoleRanges:roles.map((r,i)=>({...r,firstTriangle:i,triangleCount:1}))});
 m.addPrimitive(p);s.addChild(d.createNode('owner').setMesh(m));d.getRoot().setDefaultScene(s);
 return d;
}
const io=new NodeIO(),bytes=await io.writeBinary(fixture());
for(const level of ['facade','massing'] as const){
 const original=await io.readBinary(bytes),candidate=await io.readBinary(bytes);
 const report=omitPortableRoles(candidate,level),roundtrip=await io.readBinary(await io.writeBinary(candidate));
 assert.equal(report.removedTriangles,level==='facade'?1:2);assert.equal(report.protectedRanges,1);assert.equal(report.unknownRanges,1);
 const proof=verifySemanticLod(original,roundtrip,{sourceShell:{surfaces:[{rings:[[[-5,0,-5]]]}]}});
 assert.equal(proof.triangles,level==='facade'?5:4);
 assert.equal(roundtrip.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION')!.getCount(),proof.triangles*3);
 // Reapplying policy retains exact bounds and does not restore omitted roles.
 assert.equal(omitPortableRoles(roundtrip,level).removedTriangles,0);
}
for(const mutation of ['overlap','gap','missing','policy'] as const){
 const d=fixture(),p=d.getRoot().listMeshes()[0].listPrimitives()[0],extras=p.getExtras(),ranges=extras.portableDraftRoleRanges as any[];
 if(mutation==='overlap')ranges[1].firstTriangle=0;
 if(mutation==='gap')ranges[1].firstTriangle=2;
 if(mutation==='missing')ranges.pop();
 if(mutation==='policy')ranges[1].lodFacade=true;
 assert.throws(()=>omitPortableRoles(d,'facade'));
}
console.log('Portable LOD: exact attributes/winding/materials/bounds/native anchors, compaction, unknown/source/extents retained, invalid range/policy rejection passed');
