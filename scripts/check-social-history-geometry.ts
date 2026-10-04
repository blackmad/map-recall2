import assert from 'node:assert/strict';
import * as T from 'three';
import {buildSocialHistory} from './landmarks/social-history-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/social-history-spec.json';
const geometry:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);geometry.push(g)};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const unused=()=>{throw Error('unexpected primitive')};buildSocialHistory(0,0,{add,box,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
let triangles=0;const bounds=new T.Box3();const meshes=geometry.map(g=>{triangles+=(g.index?.count??g.getAttribute('position').count)/3;g.computeBoundingBox();bounds.union(g.boundingBox!);for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));return new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}))});
const ray=(x:number,y:number,z:number,d:T.Vector3)=>new T.Raycaster(new T.Vector3(x,y,z),d).intersectObjects(meshes)[0];
assert(triangles<40000);assert(bounds.max.y>25.4&&bounds.max.y<25.73);assert(bounds.max.x-bounds.min.x>76&&bounds.max.x-bounds.min.x<78);
// First-hit facade evidence from south must expose panes and entry columns.
for(const x of[-29.8,-22.3,-14.8,-7.3])for(const y of[6,10]){const h=ray(x+.4,y,30,new T.Vector3(0,0,-1));assert(h);assert.equal(h.object.geometry.userData.palette,'glass','paired south bays stay exposed');}
for(const x of[-32,-24.5,-17,-9.5]){const h=ray(x,2.6,30,new T.Vector3(0,0,-1));assert(h);assert.equal(h.object.geometry.userData.palette,'concrete');assert(h.point.z>18,'entry columns proud of recessed backing');}
const entry=ray(-27,2.3,30,new T.Vector3(0,0,-1));assert(entry);assert.equal(entry.object.geometry.userData.palette,'glass');assert(entry.point.z<16,'entry truly recessed under raised block');
for(const x of[5.8,12.8,20.8,28]){const h=ray(x,8,-28,new T.Vector3(0,0,1));assert(h);assert.equal(h.object.geometry.userData.palette,'glass');assert(h.point.z< -18,'north library ribbon is first hit');}
assert.equal(ray(-32,6,-28,new T.Vector3(0,0,1))!.object.geometry.userData.palette,'glass','tall harbour atrium exposed');
const pavilion=ray(-8,2,-28,new T.Vector3(0,0,1));assert(pavilion);assert.equal(pavilion.object.geometry.userData.palette,'glass');assert(pavilion.point.z< -18,'rounded pavilion follows BAG arc');
for(const x of[-26.3,-20.3])assert.equal(ray(x,2.2,-28,new T.Vector3(0,0,1))!.object.geometry.userData.palette,'glass','western ground windows remain exposed beneath library');
// Aggregate footprint must not create a tall slab above low pavilion/library parts.
for(const x of[-8,10,22]){const h=ray(x,40,-17.7,new T.Vector3(0,-1,0));assert(h);assert(h.point.y<10.2,'mapped north extensions stay low');}
assert(ray(5,40,0,new T.Vector3(0,-1,0))!.point.y<24,'center roof remains lower than south band');assert(ray(5,40,14,new T.Vector3(0,-1,0))!.point.y>25,'south roof band retained');
for(const [x,z]of[[44,4],[0,-25]])assert.equal(ray(x,40,z,new T.Vector3(0,-1,0)),undefined,'neighbor passage and harbour stay empty');
for(const g of geometry.filter(g=>g.userData.palette==='slate')){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>.9,'explicit roofs all face up');}
assert.deepEqual(spec.suppressOsmIds,['w57859743','NL.IMBAG.Pand.0363100012164130']);assert.equal(spec.spatialSuppression,false);
console.log(JSON.stringify({id:spec.id,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},status:'CPU passes; gallery/live visual acceptance pending'}));
