import assert from 'node:assert/strict';
import * as T from 'three';
import {buildIngHouse} from './landmarks/ing-house-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/ing-house-spec.json';
const gs:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);gs.push(g)};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const b:BuildingTools={add,box,prism:()=>{throw Error('unused')},gableRoof:()=>{},hip:()=>{},window:()=>{},clock:()=>{},sign:()=>{throw Error('No invented name signage')}};buildIngHouse(138,28,b);
const material=new T.MeshBasicMaterial({side:T.DoubleSide}),meshes=gs.map(g=>new T.Mesh(g,material)),bounds=new T.Box3();let triangles=0;
for(const g of gs){for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}
const hit=(x:number,y:number,z:number,dx:number,dy:number,dz:number)=>new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(dx,dy,dz)).intersectObjects(meshes)[0];
assert(triangles<40000);assert(bounds.min.y>=-.001);assert(bounds.max.y>=48&&bounds.max.y<50,'Equipment maxima must not become building height');assert(bounds.max.x-bounds.min.x>137&&bounds.max.x-bounds.min.x<139,'survey native longitudinal size');
assert.equal(gs.filter(g=>g.userData.role==='inclined-support').length,16);assert.equal(gs.filter(g=>g.userData.role==='individual-footing').length,16);
// A primary-photo recognition risk: broad upper steel plates taper to pin feet,
// rather than reading as constant-width sticks. Probe exposed fields in situ.
for(const side of[-1,1]){
 const upperCentre=-49+3.6*(10.9-8)/10.4,lowerCentre=-49+3.6*(10.9-1)/10.4;
 for(const offset of[-.9,.9]){
  assert.equal(hit(upperCentre+offset,8,side*25,0,0,-side)?.object.geometry.userData.role,'inclined-support','Broad upper support plate must be physically exposed');
  assert.notEqual(hit(lowerCentre+offset,1,side*25,0,0,-side)?.object.geometry.userData.role,'inclined-support','Support foot must taper rather than widening to a full column');
 }
}
for(const x of[-20,0,30])assert(!hit(x,4,0,0,0,1),'Undercroft through lane stays open');
for(const x of[-30,0,30])for(const side of[-1,1]){const h=hit(x,20,side*30,0,0,-side);assert(h,'facade present');assert.equal(h.object.geometry.userData.palette,'glass','First-hit glass shell stays exposed between mullions/floor bands')}
assert.equal(hit(56,2,12,0,0,-1)?.object.geometry.userData.palette,'glass','Mapped main entrance has exposed door-height glazing');
for(const y of[5,9])assert.equal(hit(61.5,y,12,0,0,-1)?.object.geometry.userData.palette,'glass','Ground lobby exposes tall upper glazing between real inclined supports');
assert(!hit(41,4,8.5,1,0,0),'Covered pedestrian lane beside eastern lobby remains open');
// Source-derived recognition probes: broad opaque silver cheeks at the first
// western notch, panoramic glazing only on the rounded front, panel margins.
for(const side of[-1,1]){
 const cheek=hit(-55,20,side*30,0,0,-side);
 assert.equal(cheek?.object.geometry.userData.palette,'white','Broad silver nose cheek must be exposed, not covered in generic glazing');
 assert.equal(cheek?.object.geometry.userData.role,'nose-panel');
}
assert.equal(hit(-80,19,0,1,0,0)?.object.geometry.userData.palette,'glass','Rounded western panoramic glass stays exposed');
for(const y of[15.4,22.8])assert.equal(hit(-80,y,0,1,0,0)?.object.geometry.userData.palette,'white','Panoramic nose retains real silver panel margins above and below');
const bevelLevels=[11,12,14].map(y=>hit(-55,y,30,0,0,-1));
assert(bevelLevels.every(h=>h?.object.geometry.userData.role==='silver-belly'),'Silver belly has an actual exposed bounded bevel');
assert(bevelLevels[0]!.point.z<bevelLevels[1]!.point.z&&bevelLevels[1]!.point.z<bevelLevels[2]!.point.z,'Faceted rounded belly edge expands outward towards the surveyed skin');
const west=hit(-65,60,0,0,-1,0),east=hit(60,60,0,0,-1,0);assert(west&&east);assert(east.point.y-west.point.y>20,'Rising wedge must face high eastern city end');
for(const g of gs.filter(g=>g.userData.role==='roof')){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>.5,'Roof faces up and follows supported bounded profile')}
const garden=hit(19,60,0,0,-1,0);assert(garden&&garden.point.y<44,'Roof garden patio remains open below upper roof');
assert.equal(spec.spatialSuppression,false);assert.deepEqual(spec.suppressOsmIds,['w57856367','NL.IMBAG.Pand.0363100012068127']);assert.equal(spec.landmarkId,'osm-way-57856367');
console.log(JSON.stringify({id:spec.id,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},openSupports:16,firstHitGlazing:true,risingWedge:true,roofGarden:true}));
for(const g of gs)g.dispose();material.dispose();
