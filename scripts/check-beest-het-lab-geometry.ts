import assert from 'node:assert/strict';
import * as T from 'three';
import {buildBeestHetLab} from './landmarks/beest-het-lab-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/beest-het-lab-spec.json';
const geometry:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);geometry.push(g)};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const unused=()=>{throw Error('unexpected primitive')};buildBeestHetLab(0,0,{add,box,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
let triangles=0;const bounds=new T.Box3();const meshes=geometry.map(g=>{triangles+=(g.index?.count??g.getAttribute('position').count)/3;g.computeBoundingBox();bounds.union(g.boundingBox!);for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));return new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}))});
const ray=(x:number,y:number,z:number,d:T.Vector3)=>new T.Raycaster(new T.Vector3(x,y,z),d).intersectObjects(meshes)[0];
assert(triangles<40000);assert(bounds.max.y<10.0&&bounds.max.y>9.3);assert(bounds.max.x-bounds.min.x<44);assert(bounds.max.z-bounds.min.z<75);
// Principal front clerestory and real door are physically first-hit panes.
for(const x of[-15,-10,-5,9]){const h=ray(x,4.7,45,new T.Vector3(0,0,-1));assert(h);assert.equal(h.object.geometry.userData.palette,'glass','front clerestory exposed');}
for(const x of[-8,-3,0,4])assert.equal(ray(x,7.1,45,new T.Vector3(0,0,-1))!.object.geometry.userData.palette,'glass','raised office glazing exposed');
assert.equal(ray(3,1.5,45,new T.Vector3(0,0,-1))!.object.geometry.userData.palette,'concrete','front shutter exposed');
for(const [x,z]of[[28,0],[-26,0],[0,41]])assert.equal(ray(x,30,z,new T.Vector3(0,-1,0)),undefined,'neighbor frontage and streets remain open');
for(const g of geometry.filter(g=>g.userData.palette==='slate')){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>.12,'all surveyed roof faces point up');}
assert.deepEqual(spec.suppressOsmIds,['NL.IMBAG.Pand.0363100012123591']);assert.equal(spec.spatialSuppression,false);
console.log(JSON.stringify({id:spec.id,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},status:'CPU passes; gallery/live visual acceptance pending'}));
