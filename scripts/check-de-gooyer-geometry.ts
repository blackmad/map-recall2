import assert from 'node:assert/strict';import * as T from 'three';
import {buildDeGooyer} from './landmarks/de-gooyer-builder';import type {BuildingTools} from './landmarks/cultural-builders';import spec from './landmarks/de-gooyer-spec.json';
const gs:T.BufferGeometry[]=[];const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);gs.push(g)};const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const b:BuildingTools={add,box,prism:()=>{throw Error('unused')},gableRoof:()=>{},hip:()=>{},window:()=>{},clock:()=>{},sign:()=>{throw Error('mill has no invented name signage')}};buildDeGooyer(0,0,b);
const meshes=gs.map(g=>new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));let triangles=0;const bounds=new T.Box3();for(const g of gs){for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}
assert(triangles<40000);assert(bounds.max.y>40&&bounds.max.y<43,'sailtip height must distinguish sailspan from millheight');assert(bounds.min.y>=-.001);assert.equal(gs.filter(g=>g.userData.role==='sail-stock').length,4);
const hit=(x:number,y:number,z:number,dx:number,dy:number,dz:number)=>new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(dx,dy,dz)).intersectObjects(meshes)[0];
assert(!hit(6.2,2,0,0,-1,0),'ground beside narrow base remains open; gallery cannot become parcelbox');assert.equal(hit(0,2,9,0,0,-1)?.object.geometry.userData.palette,'green','front entrance exposed first-hit');
assert.equal(hit(0,11,9,0,0,-1)?.object.geometry.userData.palette,'glass','loweroctagon window exposed');assert.equal(hit(0,23.4,9,0,0,-1)?.object.geometry.userData.palette,'glass','upperoctagon window exposed');
// Source close-up: the apron remains visible around the stock, with an exposed
// green centre, white curved edge and white brackets rather than a plain rectangle.
for(const x of[-1.35,1.35]){
 assert.equal(hit(x,27.85,9,0,0,-1)?.object.geometry.userData.palette,'green','cap cheek panel exposed around sail stock');
 assert.equal(hit(x,27.45,9,0,0,-1)?.object.geometry.userData.palette,'white','curved apron edge exposed');
}
assert.equal(hit(.8,26.8,9,0,0,-1)?.object.geometry.userData.palette,'white','apron relief bracket exposed');
const gallery=gs.find(g=>g.userData.role==='gallery-deck')!;const normals=gallery.getAttribute('normal');for(let i=0;i<normals.count;i++)assert(normals.getY(i)>.99,'annulus rooffaces upward');
const galleryMesh=new T.Mesh(gallery,new T.MeshBasicMaterial());assert.equal(new T.Raycaster(new T.Vector3(0,20,0),new T.Vector3(0,-1,0)).intersectObject(galleryMesh).length,0,'gallery retains centralhole');assert(new T.Raycaster(new T.Vector3(6,20,0),new T.Vector3(0,-1,0)).intersectObject(galleryMesh).length>0,'annulus supportswalkway');
// Uncovered sail lattice stays porous rather than forming four photo-textured opaque panels.
for(const g of gs.filter(g=>['sail-stock','sail-lattice'].includes(g.userData.role))){const pos=g.getAttribute('position'),indices=g.index;for(let i=0;i<(indices?.count??pos.count);i+=3){const vs=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(pos,indices?indices.getX(i+k):i+k));for(let k=0;k<3;k++){const a=vs[k],q=vs[(k+1)%3];if((a.y-18.9)*(q.y-18.9)<0){const t=(18.9-a.y)/(q.y-a.y),v=a.clone().lerp(q,t);assert(Math.hypot(v.x,v.z)>7.45,'sailassembly must clear galleryrail rather than slice through it')}}}}
assert(gs.filter(g=>g.userData.role==='sail-lattice').length>=88);assert(gs.filter(g=>g.userData.role==='gallery-brace').length===32);
assert.equal(spec.spatialSuppression,false);assert.deepEqual(spec.suppressOsmIds,['w269052487','NL.IMBAG.Pand.0363100012169758']);assert(!spec.suppressOsmIds.includes('NL.IMBAG.Pand.0363100012169757'));
console.log(JSON.stringify({id:spec.id,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},exactSuppression:true,openGallery:true,exposedWindows:true}));
