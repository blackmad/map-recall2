import assert from 'node:assert/strict';
import * as T from 'three';
import {buildConcertgebouw} from './landmarks/concertgebouw-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/concertgebouw-spec.json';
import source from './landmarks/concertgebouw-footprints.json';
const gs:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,a=0)=>{g.userData.palette=_c;g.rotateY(a);g.translate(x,y,z);gs.push(g)};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const b:BuildingTools={add,box,prism:()=>{throw Error('unused')},gableRoof:()=>{},hip:()=>{},window:()=>{},clock:()=>{},sign:(text,x,y,z,pixel,c='dark')=>{for(let j=0;j<text.length*35;j++)box(x+(j%35)*pixel,y+Math.floor(j/35)*pixel,z,pixel,pixel,pixel*.4,c)}};
buildConcertgebouw(0,0,b);
let triangles=0;const bounds=new T.Box3(),material=new T.MeshBasicMaterial({side:T.DoubleSide});
const meshes=gs.map(g=>{triangles+=(g.index?.count??g.getAttribute('position').count)/3;g.computeBoundingBox();bounds.union(g.boundingBox!);for(const x of g.getAttribute('position').array)assert(Number.isFinite(x));return new T.Mesh(g,material)});
const hit=(x:number,y:number,z:number,dir:T.Vector3)=>new T.Raycaster(new T.Vector3(x,y,z),dir).intersectObjects(meshes,false)[0]?.point;
assert(triangles<40000);assert(bounds.max.y<29&&bounds.max.y>27,'roof and thin gilt ornament envelope');
assert.equal(spec.spatialSuppression,false);assert.equal(source.mappedParts.length,12);assert.equal(source.geometry.coordinates.length,3,'two current BAG inner courts');
for(const [x,z] of [[-1.7,-17.5],[16.2,-17.5]])assert(!hit(x,40,z,new T.Vector3(0,-1,0)),'actual roof/body must not fill BAG court '+[x,z]);
assert(hit(8.1,40,10,new T.Vector3(0,-1,0))!.y>25,'surveyed main hall roof');
for(const x of[-2,1.2,4.4,7.6,10.8,14]){const first=new T.Raycaster(new T.Vector3(x,10,50),new T.Vector3(0,0,-1)).intersectObjects(meshes)[0];assert.equal(first.object.geometry.userData.palette,'stone','visible portico column must be first material');assert(first.point.z>40.5&&first.point.z<40.8,'columns proud of the loggia');}
const bay=new T.Raycaster(new T.Vector3(6.3,10,50),new T.Vector3(0,0,-1)).intersectObjects(meshes)[0];assert.equal(bay.object.geometry.userData.palette,'glass');assert(bay.point.z<38,'open column bay reveals recessed glazing');
// Surveyed crown centers have a supported mansard below open ironwork;
// an AHN outline of its thin crest must not become a floating solid slab.
for(const [x,z] of[[-12.55,33.906],[-12.781,-12.316],[29.026,32.545],[28.395,-13.061]]){
 const top=hit(x,40,z,new T.Vector3(0,-1,0));assert(top&&top.y>19.7&&top.y<20.4,'open crown over supported slate roof');
 const slope=new T.Raycaster(new T.Vector3(x+3,40,z),new T.Vector3(0,-1,0)).intersectObjects(meshes)[0];assert(slope&&slope.point.y>17&&slope.point.y<21,'pavilion mansard spans cornice to crown');
}
// Transparent promenade has glazing, but no opaque wall/whole-building box
// across its interior west of the original masonry body.
assert(hit(-18,7,15,new T.Vector3(1,0,0))!.x>-10.5,'glass promenade has no opaque prism before historical inner wall');
assert(spec.suppressOsmIds.every(id=>/^(?:[nwr]\d+|NL\.IMBAG\.Pand\.\d{16})$/.test(id)));
assert(source.mappedParts.every(p=>spec.suppressOsmIds.includes(p.id)));
console.log(JSON.stringify({id:spec.id,triangles,height:bounds.max.y,width:bounds.max.x-bounds.min.x,depth:bounds.max.z-bounds.min.z,courts:2}));
gs.forEach(g=>g.dispose());material.dispose();
