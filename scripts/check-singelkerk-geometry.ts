import assert from 'node:assert/strict';
import * as T from 'three';
import {buildSingelkerk} from './landmarks/singelkerk-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import source from './landmarks/singelkerk-footprints.json';
import spec from './landmarks/singelkerk-spec.json';
const gs:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);gs.push(g);};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const b:BuildingTools={add,box,prism:()=>{throw Error('unused')},gableRoof:()=>{},hip:()=>{},window:()=>{},clock:()=>{},sign:()=>{throw Error('No inventednamelettering');}};
buildSingelkerk(0,0,b);
const material=new T.MeshBasicMaterial({side:T.DoubleSide}),meshes=gs.map(g=>new T.Mesh(g,material)),bounds=new T.Box3();let triangles=0;
for(const g of gs){for(const n of g.getAttribute('position').array)assert(Number.isFinite(n));g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}
assert(triangles<40000);assert(bounds.max.y>19&&bounds.max.y<21);assert(bounds.min.y>=-.001);
const a=source.authorAngleRadians,native=(x:number,y:number,z:number)=>new T.Vector3(x*Math.cos(a)+z*Math.sin(a),y,-x*Math.sin(a)+z*Math.cos(a));
const hit=(x:number,y:number,z:number,dx:number,dy:number,dz:number)=>new T.Raycaster(native(x,y,z),native(dx,dy,dz).normalize()).intersectObjects(meshes)[0];
for(const [x,z] of [[-10,-26],[-3.3,-25],[2,-27]])assert(!hit(x,5,z,0,-1,0),'Herengracht forecourt stays open to sky and grade');
assert(!hit(-4.7,1.5,-32,0,0,1)||hit(-4.7,1.5,-32,0,0,1)!.distance>9,'iron entrance gap remains open before genuine door');
for(const x of [-10.15,-3.25,3.65])for(const y of [6.1,11.4])assert.equal(hit(x+.10,y,-35,0,0,1)?.object.geometry.userData.palette,'glass','Herengracht tracery pane exposed ahead of parent mass');
for(const x of [-1.63,2.08])for(const y of [2.0,6.8,11.5,14.5])assert.equal(hit(x+.15,y,36,0,0,-1)?.object.geometry.userData.palette,'glass','Singel452 panes are on exposed wall plane');
for(const g of gs.filter(g=>g.userData.role==='roof')){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>0,'bounded original survey roof planes face up');}
// Independently derive the actual generated plane from its largest projected
// triangle, then compare every original survey observation (including holes).
// This catches metre-scale fins even when roof normals and global bounds pass.
let roofVertexMaxResidual=0,roofInteriorProbes=0;
for(const roof of gs.filter(g=>g.userData.role==='roof')){
 const pos=roof.getAttribute('position'),idx=roof.index!;let largest=0,generated:T.Plane|undefined;
 for(let i=0;i<idx.count;i+=3){const p=new T.Vector3().fromBufferAttribute(pos,idx.getX(i)),q=new T.Vector3().fromBufferAttribute(pos,idx.getX(i+1)),r=new T.Vector3().fromBufferAttribute(pos,idx.getX(i+2)),area=Math.abs(q.clone().sub(p).cross(r.clone().sub(p)).y);if(area>largest){largest=area;generated=new T.Plane().setFromCoplanarPoints(p,q,r);}}
 assert.ok(generated&&largest>1e-7,'Every bounded roof has a stable generated triangle');
 const plane=generated!;const height=(x:number,z:number)=>-(plane.normal.x*x+plane.normal.z*z+plane.constant)/plane.normal.y;
 for(const ring of roof.userData.sourceRings as number[][][])for(const observation of ring){const p=native(observation[0],observation[1],observation[2]),error=Math.abs(height(p.x,p.z)-p.y);roofVertexMaxResidual=Math.max(roofVertexMaxResidual,error);assert.ok(error<=.01,'Every generated roof agrees with original ring height within1cm');}
 for(let i=0;i<pos.count;i++)assert.ok(Math.abs(height(pos.getX(i),pos.getZ(i))-pos.getY(i))<.001,'Generated roof is one coherent bounded plane');
 const mesh=meshes[gs.indexOf(roof)],shell=meshes[gs.indexOf(roof)-1];assert.equal(shell.geometry.userData.role,'survey-shell');
 for(let i=0;i<idx.count;i+=3){const centroid=new T.Vector3();for(let k=0;k<3;k++)centroid.add(new T.Vector3().fromBufferAttribute(pos,idx.getX(i+k)));centroid.multiplyScalar(1/3);
  const upper=new T.Raycaster(centroid.clone().add(new T.Vector3(0,.05,0)),new T.Vector3(0,-1,0)).intersectObject(mesh)[0];assert.ok(upper&&Math.abs(upper.point.y-height(centroid.x,centroid.z))<.001,'Roof interior ray hits its supported source plane');
  const below=new T.Raycaster(centroid.clone().add(new T.Vector3(0,-.05,0)),new T.Vector3(0,-1,0)).intersectObject(shell)[0];assert.ok(below&&Math.abs(below.point.y)<.001,'Roof triangle interior lies above its own footprint shell floor, excluding holes');roofInteriorProbes++;
 }
}
assert.equal(hit(-18,14.5,-3.1,1,0,0)?.object.geometry.userData.palette,'glass','roof dormer glazing is exposed above its supported slope');
assert.equal(spec.spatialSuppression,false);assert.equal(spec.suppressOsmIds.length,4);assert(!spec.suppressOsmIds.includes('NL.IMBAG.Pand.0363100012171749'),'Singel454 remains separate neighbor');
assert.equal(source.parts[0].currentStatus,'Pand in gebruik');assert.equal(source.parts[1].currentStatus,'Pand in gebruik');
console.log(JSON.stringify({id:spec.id,triangles,bounds:bounds.getSize(new T.Vector3()).toArray(),openForecourt:true,exposedWindows:true,roofNormals:true,roofVertexMaxResidual,roofInteriorProbes,rawSources:source.rawSources.length}));
for(const g of gs)g.dispose();material.dispose();
