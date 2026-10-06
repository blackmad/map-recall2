import assert from 'node:assert/strict';
import * as T from 'three';
import {buildBeestBoulders} from './landmarks/beest-boulders-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import data from './landmarks/beest-boulders-footprints.json';
import spec from './landmarks/beest-boulders-spec.json';
const geometry:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);geometry.push(g)};
const unused=()=>{throw Error('unexpected primitive')};buildBeestBoulders(0,0,{add,box:unused,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
let triangles=0;const bounds=new T.Box3();const meshes=geometry.map(g=>{triangles+=(g.index?.count??g.getAttribute('position').count)/3;g.computeBoundingBox();bounds.union(g.boundingBox!);for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.userData.palette=g.userData.palette;return mesh});
const axes=data.nativeAxes;
function position(x:number,y:number,z:number){return new T.Vector3(x*axes.xEast+z*axes.zEast,y,x*axes.xSouth+z*axes.zSouth);}
function westRay(x:number,y:number,z:number){return new T.Raycaster(position(x,y,z),position(1,0,0).normalize()).intersectObjects(meshes)[0];}
assert(triangles<40000);assert(bounds.max.y>26&&bounds.max.y<28);assert(bounds.min.y>=-.001);
for(const v of[6,18,41,63])for(const dz of[-.3,0,.3]){const h=westRay(-25,1.5,v+dz);assert.equal(h?.object.userData.palette,'glass','ground pane visible across actual width');}
for(const v of[30,52])for(const y of[3.4,4.5,5.6,6.7])for(const dz of[-.6,.6])assert.equal(westRay(-25,y,v+dz)?.object.userData.palette,'glass','tall pane exposed');
for(const z of[84,104,154])for(const dz of[-1.3,-.6,.6,1.3])assert.equal(westRay(-25,5,z+dz)?.object.userData.palette,'glass','central workshop glazing exposed either side of mullion');
for(const [x,z]of[[-27,25],[26,110],[0,-5],[0,229]])assert.equal(new T.Raycaster(position(x,40,z),new T.Vector3(0,-1,0)).intersectObjects(meshes)[0],undefined,'street/canal/outside host stays open');
// Actual failure: the south host must present narrow recessed upper glass,
// projecting broad spandrels and a tall structural/shopfront base.
for(const z of[173.2,175.0,187.8,189.6]){
 for(const y of[10.8,14.1,17.4,20.7])assert.equal(westRay(-26,y,z)?.object.userData.palette,'glass','narrow office ribbons remain exposed');
 for(const y of[9.1,12.5,15.8,19.1,22.4])assert.equal(westRay(-26,y,z)?.object.userData.palette,'greyBrick','broad office spandrel first-hit');
 const pane=westRay(-26,10.8,z)!,band=westRay(-26,9.1,z)!;assert(pane.distance-band.distance>.30,'band physically projects ahead of recessed glass');
}
for(const y of[1.6,4.5,7.4,14.1,20.7])for(const z of[180.8,181.4,182.6,183.1])assert.equal(westRay(-26,y,z)?.object.userData.palette,'glass','full-height stair pane clear of base panels and ribbons');
for(const z of[203.0,208.2,216.0])for(const y of[10.8,14.1])assert.equal(westRay(-25,y,z)?.object.userData.palette,'glass','lower office uses same recessed ribbon assembly');
// The corrected source183 terrace patch is the actual exposed south face;
// roof196-only details were initially buried behind its parent wall.
const e=data.roofs.find(r=>r.sourceSurface===183)!.rings[0],p=e[2],q=e[3],length=Math.hypot(q[0]-p[0],q[1]-p[1]),nx=-(q[1]-p[1])/length,nz=(q[0]-p[0])/length;
for(const t of[.2,.4,.6,.8])for(const y of[17.4,20.7]){const x=p[0]+t*(q[0]-p[0]),z=p[1]+t*(q[1]-p[1]);const hit=new T.Raycaster(position(x+5*nx,y,z+5*nz),position(-nx,0,-nz).normalize()).intersectObjects(meshes)[0];assert.equal(hit?.object.userData.palette,'glass','corrected upper terrace glazing exposed across face');}
// Every triangulated surveyed roof and photovoltaic cell remains upward.
for(const g of geometry.filter(g=>['slate','dark'].includes(g.userData.palette))){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>.001,'roof/panel normal points upward');}
assert.deepEqual(spec.suppressOsmIds,['NL.IMBAG.Pand.0363100012151240']);assert.equal(spec.landmarkId,'n8805218642');assert.equal(spec.spatialSuppression,false);
console.log(JSON.stringify({id:spec.id,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},status:'CPU passes; gallery/live visual acceptance pending'}));
