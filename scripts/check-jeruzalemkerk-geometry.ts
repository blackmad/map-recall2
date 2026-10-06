import assert from 'node:assert/strict';
import * as T from 'three';
import {buildJeruzalemkerk} from './landmarks/jeruzalemkerk-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import source from './landmarks/jeruzalemkerk-footprints.json';
import spec from './landmarks/jeruzalemkerk-spec.json';
const gs:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);gs.push(g);};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const tools:BuildingTools={add,box,prism:()=>{throw Error('unused')},gableRoof:()=>{throw Error('unexpected pitch')},hip:()=>{},window:()=>{},clock:()=>{},sign:()=>{throw Error('No identifying painted lettering') }};
buildJeruzalemkerk(0,0,tools);
const mat=new T.MeshBasicMaterial({side:T.DoubleSide}),meshes=gs.map(g=>new T.Mesh(g,mat));let triangles=0;const bounds=new T.Box3();
for(const g of gs){for(const n of g.getAttribute('position').array)assert(Number.isFinite(n));g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}
assert(triangles<40000);assert(bounds.min.y>=-.001);assert(bounds.max.y>17.8&&bounds.max.y<18.1);
const a=source.authorAngleRadians,native=(x:number,y:number,z:number)=>new T.Vector3(x*Math.cos(a)+z*Math.sin(a),y,-x*Math.sin(a)+z*Math.cos(a));
const hit=(x:number,y:number,z:number,dx:number,dy:number,dz:number)=>new T.Raycaster(native(x,y,z),native(dx,dy,dz).normalize()).intersectObjects(meshes)[0];
for(const x of [-.97,.06,1.08])assert.equal(hit(x,6.13,20,0,0,-1)?.object.geometry.userData.palette,'glass','Central tall glazing must be first hit, exposed ahead of brick bay');
for(const s of [-1,1])for(let i=0;i<7;i++)assert.equal(hit(s*20,6.13,-6.45+i*1.64,s*-1,0,0)?.object.geometry.userData.palette,'glass','All seven side lights first-hit glass rather than buried glazing');
for(const x of [-3.05,.28,3.61])assert.equal(hit(x,1.3,20,0,0,-1)?.object.geometry.userData.palette,'dark','Each door exposed ahead of plinth');
for(const x of [-5,0,5])assert(!hit(x,20,17,0,-1,0),'Unroofed south forecourt stays clear');
// A louver chamber must have a genuine opening between bars, without solid filler.
const tower=hit(.85,16.25,20,0,0,-1);assert(tower&&tower.distance>8.4,'Tower louver opening penetrates front wall to rear wall');
let roofs=0;for(const g of gs.filter(g=>g.userData.role==='roof')){roofs++;const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>.99,'All explicit roof surfaces face up');}
assert(roofs>=8);assert.equal(spec.spatialSuppression,false);assert.equal(spec.suppressOsmIds.length,3);for(const id of source.preserveNeighbors)assert(!spec.suppressOsmIds.includes('NL.IMBAG.Pand.'+id));
assert(source.parts.every(p=>p.status==='Pand in gebruik'));assert(source.parts.every(p=>p.surveyRoofPlanes.length>0));
console.log(JSON.stringify({id:spec.id,triangles,bounds:bounds.getSize(new T.Vector3()).toArray(),firstHitFrontAnd14SideWindows:true,openForecourt:true,openLouverTower:true,upwardRoofs:roofs,exactParentMasks:3}));
for(const g of gs)g.dispose();mat.dispose();
