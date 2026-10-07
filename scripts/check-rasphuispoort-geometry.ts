import assert from 'node:assert/strict';
import * as T from 'three';
import {openTopPrism} from './landmarks/house-geometry';
import {buildRasphuispoort} from './landmarks/rasphuispoort-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import source from './landmarks/rasphuispoort-footprints.json';
import spec from './landmarks/rasphuispoort-spec.json';
const gs:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);gs.push(g);};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const b:BuildingTools={add,box,prism:()=>{throw Error('unexpected primitive')},gableRoof:()=>{throw Error('no hostroof')},hip:()=>{throw Error('no hostroof')},window:()=>{},clock:()=>{},sign:()=>{throw Error('no invented identification text')}};
buildRasphuispoort(0,0,b);
const a=source.authorAngleRadians;
const native=(x:number,y:number,z:number)=>new T.Vector3(x*Math.cos(a)+z*Math.sin(a),y,-x*Math.sin(a)+z*Math.cos(a));
const material=new T.MeshBasicMaterial({side:T.DoubleSide}),meshes=gs.map(g=>new T.Mesh(g,material));
const hit=(x:number,y:number,z:number,dx:number,dy:number,dz:number,objects=meshes)=>new T.Raycaster(native(x,y,z),native(dx,dy,dz).normalize()).intersectObjects(objects)[0];
let triangles=0;const bounds=new T.Box3(),authorBounds=new T.Box3();
for(const g of gs){for(const n of g.getAttribute('position').array)assert(Number.isFinite(n));g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??g.getAttribute('position').count)/3;const copy=g.clone().rotateY(-a);copy.computeBoundingBox();authorBounds.union(copy.boundingBox!);copy.dispose();}
assert(triangles<40000);assert(authorBounds.max.x-authorBounds.min.x<=source.segmentLengthMetres+.01,'portal stays inside measured attachment frontage');
assert(authorBounds.max.z-authorBounds.min.z<1.1,'additive geometry never models shoppingcomplex');assert(authorBounds.min.y>=-.001);assert(authorBounds.max.y>7&&authorBounds.max.y<7.5);
for(const x of [-.7,0,.7])for(const y of [.3,1.5,2.5,3.1])assert(!hit(x,y,4,0,0,-1),`openportal ray ${x},${y}`);
assert(hit(0,3.9,4,0,0,-1),'arch crown supports relief above');
for(const x of [-1.6,1.6])assert.equal(hit(x,2.0,4,0,0,-1)?.object.geometry.userData.role,'half-column','columns firsthit ahead of the portal piers');
for(const x of [-1.06,-.52])assert.equal(hit(x,4.50,4,0,0,-1)?.object.geometry.userData.role,'cart-wheel','wheel upperrim physically exposed ahead of cart and panel');
assert.equal(hit(.38,6.7,4,0,0,-1)?.object.geometry.userData.role,'shield-bar','white shield details visible on redshield');
assert.equal(gs.filter(g=>g.userData.role==='central-head').length,1);assert.equal(gs.filter(g=>g.userData.role==='captive-head').length,2);
assert.deepEqual(spec.suppressOsmIds,[]);assert.equal(spec.spatialSuppression,false);
// Demonstrate the integration failure with the installed sourcehost's full-height edge shell.
// This must remain a documented blocker, never be reported as live passage acceptance.
const edge=source.facadeSegment;const [p,q]=edge;
const ring=source.installedHostFeature.geometry.coordinates[0];
const hostShape=new T.Shape();
for(let i=0;i<ring.length;i++){const east=(ring[i][0]-source.anchor[0])*111320*Math.cos(source.anchor[1]*Math.PI/180),south=-(ring[i][1]-source.anchor[1])*111320;if(i===0)hostShape.moveTo(east,south);else hostShape.lineTo(east,south);}
hostShape.closePath();
const host=new T.Mesh(openTopPrism(hostShape,0,source.installedHostFeature.properties.height),material);host.updateMatrixWorld();
assert(!hit(0,1.5,4,0,0,-1),'portal is open before host integration');assert(hit(0,1.5,4,0,0,-1,[...meshes,host]),'installed host fullheight edge blocks portal: explicit expected limitation');
assert(p[1]>q[1],'currentBAG gateedge orientation retained');
console.log(JSON.stringify({id:spec.id,triangles,nativeBounds:bounds.getSize(new T.Vector3()).toArray(),authorBounds:authorBounds.getSize(new T.Vector3()).toArray(),portalOpen:true,firstHitColumns:true,firstHitRelief:true,integration:'BASELINE FAILURE PRESERVED: installed host without scoped opening covers gate. Active installed passage checked separately; gallery/live acceptance pending'}));
for(const g of gs)g.dispose();host.geometry.dispose();material.dispose();
