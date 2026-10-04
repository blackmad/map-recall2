import assert from 'node:assert/strict';
import * as T from 'three';
import {buildMuiderpoort} from './landmarks/muiderpoort-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import source from './landmarks/muiderpoort-footprints.json';
import spec from './landmarks/muiderpoort-spec.json';
const gs:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);gs.push(g);};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const b:BuildingTools={add,box,prism:()=>{throw Error('unused')},gableRoof:()=>{},hip:()=>{},window:()=>{},clock:()=>{},sign:()=>{throw Error('gate has no invented name sign');}};
buildMuiderpoort(0,0,b);
const material=new T.MeshBasicMaterial({side:T.DoubleSide}),meshes=gs.map(g=>new T.Mesh(g,material)),bounds=new T.Box3();let triangles=0;
for(const g of gs){for(const n of g.getAttribute('position').array)assert(Number.isFinite(n));g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}
assert(triangles<40000);assert(bounds.max.y>28&&bounds.max.y<=28.3);assert(bounds.min.y>=-.001);
const a=source.authorAngleRadians;
const native=(x:number,y:number,z:number)=>new T.Vector3(x*Math.cos(a)+z*Math.sin(a),y,-x*Math.sin(a)+z*Math.cos(a));
const hit=(x:number,y:number,z:number,dx:number,dy:number,dz:number)=>new T.Raycaster(native(x,y,z),native(dx,dy,dz).normalize()).intersectObjects(meshes)[0];
for(const x of [-1,0,1])for(const y of [1,3,5.5])assert(!hit(x,y,14,0,0,-1),`through-passage at ${x},${y} must remain open`);
assert(hit(0,7,14,0,0,-1),'load-bearing arch crowns the opening');
for(const x of [-9.65,9.65])for(const y of [2.35,5.65])for(const side of [-1,1])assert.equal(hit(x,y,side*14,0,0,-side)?.object.geometry.userData.palette,'glass','round wing windows are actually exposed');
for(const side of [-1,1])for(const z of [-4.4,0,4.4])assert.equal(hit(side*16,1.85,z+.3,-side,0,0)?.object.geometry.userData.palette,'glass','short-wall panes first-hit rather than buried');
for(const x of [-6.35,-3.35,3.35,6.35])assert.equal(hit(x,3.0,14,0,0,-1)?.object.geometry.userData.palette,'stone','Doric column shaft is visible ahead of stone facade');
for(const g of gs.filter(g=>['dome','lantern-roof'].includes(g.userData.role))){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>0,'loft roof normals face up');}
assert(hit(0,20,5,0,0,-1),'clock lantern has actual solid/recessed enclosure below the clock, not an empty cage');
assert.equal(spec.spatialSuppression,false);assert.deepEqual(spec.suppressOsmIds,['w45038672','NL.IMBAG.Pand.0363100012169095']);assert.equal(spec.landmarkId,'extract_landmarks_1639856562');
console.log(JSON.stringify({id:spec.id,triangles,bounds:bounds.getSize(new T.Vector3()).toArray(),openArch:true,exposedWindows:true,roofNormals:true}));
for(const g of gs)g.dispose();material.dispose();
