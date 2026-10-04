import assert from 'node:assert/strict';
import * as T from 'three';
import {buildIdfaPavilion} from './landmarks/idfa-pavilion-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/idfa-pavilion-spec.json';
const geometry:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);geometry.push(g)};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const unused=()=>{throw Error('unexpected primitive')};
buildIdfaPavilion(0,0,{add,box,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
let triangles=0;const bounds=new T.Box3(),material=new T.MeshBasicMaterial({side:T.DoubleSide});
const meshes=geometry.map(g=>{triangles+=(g.index?.count??g.getAttribute('position').count)/3;g.computeBoundingBox();bounds.union(g.boundingBox!);for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));return new T.Mesh(g,material)});
const ray=(x:number,y:number,z:number,d:T.Vector3)=>new T.Raycaster(new T.Vector3(x,y,z),d).intersectObjects(meshes)[0];
assert(triangles<40000);assert(bounds.max.y>21&&bounds.max.y<22.5);assert(bounds.max.x-bounds.min.x>43&&bounds.max.x-bounds.min.x<46);
// Actual first-hit evidence: arcade gaps must reveal recessed glass, columns stay proud.
for(const x of[-12.18,-9.65,-7.12,6.42,9.05,11.68]){const h=ray(x+.3,5.5,18,new T.Vector3(0,0,-1));assert(h);assert.equal(h.object.geometry.userData.palette,'glass');assert(h.point.z>6.1&&h.point.z<6.2,'current infill glass lies within arcade plane and remains exposed')}
for(const x of[-13.45,-10.92,-8.38,-5.85,5.1,7.73,10.37,13]){const h=ray(x,5.5,18,new T.Vector3(0,0,-1));assert(h);assert.equal(h.object.geometry.userData.palette,'stone');assert(h.point.z>6.35,'columns proud of actual backing')}
for(const x of[-4.1,-.6,2.9]){const h=ray(x+.35,5.5,18,new T.Vector3(0,0,-1));assert(h);assert.equal(h.object.geometry.userData.palette,'glass','central arched glazing exposed')}
// Distinct silhouette: main roof higher than side wings; terrace beyond body stays low.
assert(ray(0,35,-3,new T.Vector3(0,-1,0))!.point.y>20);
assert(ray(-10,35,0,new T.Vector3(0,-1,0))!.point.y<14);
for(const z of[4.6,1.8,-1.0,-3.8,-6.6,-9.4]){const h=ray(25,5.5,z,new T.Vector3(-1,0,0));assert(h);assert.equal(h.object.geometry.userData.palette,'glass','east-side arched bays exposed')}
assert(ray(-.6,35,14.5,new T.Vector3(0,-1,0))!.point.y>1,'current broad central stair occupies front entrance');
assert(ray(-12,35,9,new T.Vector3(0,-1,0))!.point.y<4,'terrace is not full-height shell');
for(const m of meshes.filter(m=>m.geometry.userData.palette==='slate')){const n=m.geometry.getAttribute('normal');let up=0,down=0;for(let i=0;i<n.count;i++){if(n.getY(i)>.05)up++;if(n.getY(i)<-.05)down++}assert(up>down,'roof plane winding must face upward')}
assert.equal(spec.spatialSuppression,false);assert.deepEqual(spec.suppressOsmIds,['w57857054','NL.IMBAG.Pand.0363100012237216']);
console.log(JSON.stringify({id:spec.id,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},arcades:'current near-plane glass first hit; proud columns first hit',status:'CPU only; gallery/live acceptance pending'}));
