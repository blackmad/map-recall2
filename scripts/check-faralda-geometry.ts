import assert from 'node:assert/strict';import * as T from 'three';
import {buildFaralda} from './landmarks/faralda-builder';import type {BuildingTools} from './landmarks/cultural-builders';import spec from './landmarks/faralda-spec.json';
const gs:T.BufferGeometry[]=[];const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);gs.push(g)};const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const b:BuildingTools={add,box,prism:()=>{throw Error('unused')},gableRoof:()=>{},hip:()=>{},window:()=>{},clock:()=>{},sign:()=>{}};buildFaralda(0,0,b);
const material=new T.MeshBasicMaterial({side:T.DoubleSide}),meshes=gs.map(g=>new T.Mesh(g,material)),bounds=new T.Box3();let triangles=0;for(const g of gs){for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}
assert(triangles<40000);assert(bounds.max.y>49&&bounds.max.y<51);assert(bounds.min.y>=-.001);assert(bounds.max.x>33&&bounds.min.x<-17,'long boom and counterweight present');
const hit=(x:number,y:number,z:number,dx:number,dy:number,dz:number)=>new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(dx,dy,dz)).intersectObjects(meshes)[0];
assert(!hit(0,4,8,0,0,-1),'portal is open under studio, not an opaque building box');
for(const sx of[-1,1])for(const sz of[-1,1])assert(hit(sx*3.9,2,sz*3.9,0,-1,0),'four load-bearing shoes at grade');
assert.equal(gs.filter(g=>g.userData.role==='mast-post').length,4);assert.equal(gs.filter(g=>g.userData.role==='footing').length,4);
for(const y of[35,40,45]){const h=hit(.6,y,8,0,0,-1);assert.equal(h?.object.geometry.userData.palette,'glass','each published suite has visible panoramic glazing');}
for(const x of[8,16,24])assert(hit(x,46.3,6,0,0,-1),'actual long-arm steel has physical support');
assert.equal(spec.spatialSuppression,false);assert.equal(spec.suppressOsmIds.length,2);assert.equal(spec.landmarkId,'extract_landmarks_1759004236');assert(spec.suppressOsmIds.every(id=>/^(w\d+|NL\.IMBAG\.Pand\.\d{16})$/.test(id)));
console.log(JSON.stringify({id:spec.id,triangles,height:bounds.max.y,reach:bounds.max.x-bounds.min.x,openPortal:true,suites:3}));for(const g of gs)g.dispose();material.dispose();
