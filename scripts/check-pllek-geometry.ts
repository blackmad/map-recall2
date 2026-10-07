import assert from 'node:assert/strict';
import * as T from 'three';
import {buildPllek} from './landmarks/pllek-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/pllek-spec.json';
const geometry:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);geometry.push(g)};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const unused=()=>{throw Error('unexpected primitive')};buildPllek(0,0,{add,box,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
let triangles=0;const bounds=new T.Box3();const meshes=geometry.map(g=>{triangles+=(g.index?.count??g.getAttribute('position').count)/3;g.computeBoundingBox();bounds.union(g.boundingBox!);for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));return new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}))});
const ray=(x:number,y:number,z:number,d:T.Vector3)=>new T.Raycaster(new T.Vector3(x,y,z),d).intersectObjects(meshes)[0];
const native=(u:number,v:number)=>new T.Vector3(Math.cos(.2)*u-Math.sin(.2)*v,0,Math.sin(.2)*u+Math.cos(.2)*v);
const down=(u:number,v:number)=>{const p=native(u,v);return ray(p.x,20,p.z,new T.Vector3(0,-1,0));};
const front=(u:number,y:number)=>{const p=native(u,22),dir=native(0,-1);return ray(p.x,y,p.z,dir.normalize());};
assert(triangles<40000);assert(bounds.max.y<12.7&&bounds.max.y>12.5);assert(bounds.max.x-bounds.min.x<58);assert(bounds.max.z-bounds.min.z<34);
for(const u of[-23.5,-20,-17.5,5.5,10.5,16.5])assert.equal(front(u,2.1)!.object.geometry.userData.palette,'glass','both real hall fronts exposed');
// Owner exterior shows red siding on the narrow hall's non-glazed west side.
// Surveyed side edges drift slightly in u; that must not classify them as glass fronts.
for(const v of[0,5.8]){const p=native(-32,v),d=native(1,0).normalize();for(const y of[1.4,2.5])assert.equal(ray(p.x,y,p.z,d)!.object.geometry.userData.palette,'red','narrow hall west side exposes red siding rather than dark shell');}
assert(down(-21.2,0)!.point.y>6.2&&down(-21.2,0)!.point.y<6.3,'western barrel crest');assert(down(11.1,0)!.point.y>7.7&&down(11.1,0)!.point.y<7.9,'eastern barrel crest');assert(down(-5,0)!.point.y<3.6,'low connection remains below halls');
for(const [u,v]of[[0,20],[0,28],[32,0],[-30,0]])assert.equal(down(u,v),undefined,'open beach and adjacent tenants preserved');
for(const g of geometry.filter(g=>g.userData.palette==='red'||g.userData.palette==='ochre'||g.userData.palette==='blue')){const pos=g.getAttribute('position');assert(pos.count>0);}
assert.deepEqual(spec.suppressOsmIds,['w500238189','NL.IMBAG.Pand.0363100012241285']);assert.equal(spec.spatialSuppression,false);
console.log(JSON.stringify({id:spec.id,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},status:'CPU passes; gallery/live visual acceptance pending'}));
