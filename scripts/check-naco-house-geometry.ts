import assert from 'node:assert/strict';
import * as T from 'three';
import {buildNacoHouse} from './landmarks/naco-house-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/naco-house-spec.json';
const gs:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);gs.push(g)};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const unused=()=>{throw Error('Unexpected unsupported primitive')};
const b:BuildingTools={add,box,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused};
buildNacoHouse(7.5,19.3,b);
const mat=new T.MeshBasicMaterial({side:T.DoubleSide});const meshes=gs.map(g=>new T.Mesh(g,mat));for(const m of meshes)m.updateMatrixWorld();
const bounds=new T.Box3();let triangles=0;
for(const g of gs){for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??g.getAttribute('position').count)/3;
 if(g.userData.role==='roof'){const p=g.getAttribute('position');for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),q=new T.Vector3().fromBufferAttribute(p,i+1),r=new T.Vector3().fromBufferAttribute(p,i+2);assert(q.sub(a).cross(r.sub(a)).y>0,'all roof triangles wind upward');}}
}
const hit=(p:[number,number,number],q:[number,number,number])=>new T.Raycaster(new T.Vector3(...p),new T.Vector3(...q)).intersectObjects(meshes)[0];
assert(!hit([-1.5,1.5,15],[0,0,-1]),'native west passage stays open along entire ground floor');
assert.equal(gs.filter(g=>g.userData.role==='pier').length,5);
for(const z of[-8.6,-4.3,0,4.3,8.6])assert.equal(hit([-3,1.5,z],[0,-1,0])?.object.geometry.userData.role,'pier','every west support reaches grade');
for(const s of[-1,1])for(const z of[-6.9,-1.25,1,3.1,7]){const h=hit([s*9,5.1,z+.16],[-s,0,0]);assert.equal(h?.object.geometry.userData.palette,'glass','long elevations glazing exposed on first hit');}
for(const s of[-1,1])assert.equal(hit([.2,5.1,s*15],[0,0,-s])?.object.geometry.userData.palette,'glass','both end windows exposed');
for(const x of[-2,2])for(const z of[-4,4])assert.equal(hit([x,20,z],[0,-1,0])?.object.geometry.userData.role,'roof','roof owns top rather than a wall cap');
assert(triangles<40000);assert(bounds.min.y>=-.001);assert(bounds.max.x-bounds.min.x<8.5);assert(bounds.max.z-bounds.min.z<23);assert(bounds.max.y<14);
assert.equal(spec.spatialSuppression,false);assert.deepEqual(spec.suppressOsmIds,['w1535749695','NL.IMBAG.Pand.0363100012570001']);assert.equal(spec.landmarkId,'extract_landmarks_1769455774');assert(!spec.suppressOsmIds.includes('w1060147929'));
console.log(JSON.stringify({id:spec.id,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},openWestPassage:true,roofUpward:true,firstHitGlazing:true}));
for(const g of gs)g.dispose();mat.dispose();
