import assert from 'node:assert/strict';
import * as T from 'three';
import {buildSloterdijkLandmark} from './landmarks/sloterdijk-builders';
import type {BuildingTools} from './landmarks/cultural-builders';
import specs from './landmarks/sloterdijk-specs.json';
import sources from './landmarks/sloterdijk-footprints.json';
for(const spec of specs){
 const geometries:T.BufferGeometry[]=[];
 const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);geometries.push(g)};
 const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
 const tools:BuildingTools={add,box,prism:()=>{throw Error('unused')},gableRoof:()=>{},hip:()=>{},window:()=>{},clock:()=>{},sign:(label,x,y,z,pixel,c='dark')=>{for(let j=0;j<label.length*35;j++)box(x+(j%35)*pixel,y+Math.floor(j/35)*pixel,z,pixel,pixel,pixel*.45,c)}};
 buildSloterdijkLandmark(spec.id,0,0,tools);
 let triangles=0;const bounds=new T.Box3(),material=new T.MeshBasicMaterial({side:T.DoubleSide});
 const meshes=geometries.map(g=>{g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??g.getAttribute('position').count)/3;for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));return new T.Mesh(g,material)});
 const hit=(x:number,y:number,z:number,dir:T.Vector3)=>new T.Raycaster(new T.Vector3(x,y,z),dir).intersectObjects(meshes,false)[0]?.point;
 assert(triangles<40000,`triangle count ${triangles}`);assert.equal(spec.spatialSuppression,false);
 assert(spec.suppressOsmIds.every(id=>/^(?:[nwr]\d+|NL\.IMBAG\.Pand\.\d{16})$/.test(id)));
 assert(specs.filter(s=>s.id!==spec.id).every(other=>!other.suppressOsmIds.some(id=>spec.suppressOsmIds.includes(id))));
 if(spec.id==='sloterdijk-station'){
  assert(!hit(-34.2,7.5,-3,new T.Vector3(0,-1,0)),'passage under raised hall open');
  assert(hit(-34.2,10,-3,new T.Vector3(0,-1,0))!.y>7.9,'actual raised deck present');
  assert(Math.abs(hit(-34.2,30,-3,new T.Vector3(0,-1,0))!.y-19.23)<.1,'glass hall roof measured height');
  assert(!hit(-34.2,22,-3,new T.Vector3(0,0,1)),'table truss crown is an open lattice');
  assert(hit(-55,10.5,-4.5,new T.Vector3(1,0,0))!.x>-45,'mapped main west entrance admits a ray past portal to the far interior wall');
  assert(hit(-55,14,-4.5,new T.Vector3(1,0,0)), 'glazing over west door remains present');
  assert(hit(-34.2,10.5,22,new T.Vector3(0,0,-1)), 'south wall restored rather than an invented south entrance');
  assert(bounds.max.y<24.2&&bounds.max.y>23.3);
 }else{
  assert(bounds.max.y<42.6&&bounds.max.y>42.5,'restrained measured roof plant');
  assert(!hit(-14,30,15,new T.Vector3(0,-1,0)),'actual concave wing bay remains open');
  assert(sources.find(s=>s.id===spec.id)!.bagId==='0363100012131039');
 }
 console.log(spec.id,JSON.stringify({triangles,height:bounds.max.y,width:bounds.max.x-bounds.min.x,depth:bounds.max.z-bounds.min.z}));
 geometries.forEach(g=>g.dispose());material.dispose();
}
