import assert from 'node:assert/strict';
// @ts-expect-error runtime-only Three package
import * as THREE from 'three';
import {compactGeometryNormals, createCityAppearanceThreeAdapter, unpackUnitNormal} from '../../src/canalRecall/cityAppearanceThree.ts';
import {owner, record, source, image} from '../city-appearance/fidelity/synthetic-fixture.ts';

const geometry=new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0],3));
geometry.computeVertexNormals();
const floatBytes=geometry.getAttribute('normal').array.byteLength;
compactGeometryNormals(geometry);
const compact=geometry.getAttribute('normal');
assert.ok(compact.array instanceof Int8Array,'lighting normals use an Int8 buffer');
assert.equal(compact.normalized,true,'lighting normals are normalized by WebGL');
assert.equal(compact.array.byteLength,floatBytes/4,'compact normals take one quarter of Float32 normal storage');
for(let i=0;i<compact.count;i++){
  const x=unpackUnitNormal(compact.array[i*3]),y=unpackUnitNormal(compact.array[i*3+1]),z=unpackUnitNormal(compact.array[i*3+2]);
  assert.ok(Math.abs(Math.hypot(x,y,z)-1)<.01,'quantized normal remains approximately unit length');
}

const normalOwner:any=structuredClone(owner);normalOwner.observations=[];
const resource=createCityAppearanceThreeAdapter({parent:new THREE.Group(),targetOriginRD:normalOwner.geometry.frame.originRD,targetOffsetNAP:.65,observedFacades:false})([normalOwner]);
resource.flush();
const mesh=resource.group.children.find((child:any)=>child.isMesh&&!child.userData.runtimeSelection)!;
assert.ok(mesh.geometry.getAttribute('normal').array instanceof Int8Array,'rendered standard-material mesh has compact normals');
assert.equal(resource.pick(mesh,0)?.buildingId,'test','triangle identity picking remains positional and survives normal compaction');
const compactBytes=resource.stats.geometryBufferBytes;
assert.ok(compactBytes>0,'compact mesh buffers are counted before disposal');
resource.dispose();assert.equal(resource.stats.geometryBufferBytes,0,'disposed meshes release compact buffers from runtime accounting');

const signOwner:any=structuredClone(owner);const signRecord:any=structuredClone(record);signRecord.derivationKey='sign-derivation';signRecord.images={ground:image};signRecord.facadeDescription.sources={ground:{...structuredClone(source),features:[{id:'sign',kind:'fascia',bounds:[100,100,500,150],colour:'#263330',text:'TEST',physicalSignId:'physical-test-01',disposition:'agent-inspected'}]}};signOwner.observations=[{buildingId:'test',geometryRevision:'geometry',evidenceKey:'evidence',payload:signRecord}];
// CanvasTexture only needs this small canvas surface in the headless geometry
// test; actual text rasterization is covered by the browser sign tests.
Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',font:'',fillRect(){},measureText(){return{width:1}},fillText(){}})})}});
const signed=createCityAppearanceThreeAdapter({parent:new THREE.Group(),targetOriginRD:signOwner.geometry.frame.originRD,targetOffsetNAP:.65,observedFacades:true})([signOwner]);signed.flush();
const signMesh=signed.group.children.find((child:any)=>child.userData.sourceSign)!;
assert.equal(signMesh.geometry.getAttribute('normal'),undefined,'MeshBasic source-sign mesh omits unused normal storage');
signed.dispose();
console.log(`Compact normals: ${floatBytes} B to ${compact.array.byteLength} B per test triangle; picking and disposal verified.`);
