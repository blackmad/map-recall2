import * as T from 'three';
import assert from 'node:assert/strict';
import {buildPetruskerk} from './landmarks/petruskerk-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import source from './landmarks/petruskerk-footprints.json';
import spec from './landmarks/petruskerk-spec.json';
const group=new T.Group();let triangles=0;
const tools={add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0){const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.name=c;m.position.set(x,y,z);m.rotation.y=a;group.add(m);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}} as unknown as BuildingTools;
buildPetruskerk(1,1,tools);group.updateMatrixWorld(true);
const bounds=new T.Box3().setFromObject(group);assert(bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite));assert(bounds.max.y>24&&bounds.max.y<26);assert(bounds.max.x-bounds.min.x<30);assert(bounds.max.z-bounds.min.z<16);assert(triangles<40000);
const rotation=new T.Matrix4().makeRotationY(source.localRotationDegrees*Math.PI/180);
const p=(x:number,y:number,z:number)=>new T.Vector3(x,y,z).applyMatrix4(rotation);
function hit(x:number,y:number,z:number,dx:number,dz:number){return new T.Raycaster(p(x,y,z),new T.Vector3(dx,0,dz).transformDirection(rotation)).intersectObjects(group.children)[0];}
assert.equal(hit(-9.71,3.03,12,0,-1)?.object.name,'glass','South arched panes must be exposed');
assert.equal(hit(-9.71,3.03,-12,0,1)?.object.name,'glass','North arched panes must be exposed');
assert.equal(hit(-20,3.03,4.20,1,0)?.object.name,'glass','West sash glazing must be the first facade');
assert.equal(hit(-20,1.1,.50,1,0)?.object.name,'dark','Door leaf must be exposed at actual west approach');
for(const probe of source.openSpaceProbes){const h=new T.Raycaster(p(probe.local[0],30,probe.local[1]),new T.Vector3(0,-1,0)).intersectObjects(group.children)[0];assert(!h,`${probe.name} must remain unfilled`);}
for(const n of source.preserveNeighbors)assert(!spec.suppressOsmIds.includes(n.osmId)&&!spec.suppressOsmIds.includes('NL.IMBAG.Pand.'+n.bagId));
for(const child of group.children){const mesh=child as T.Mesh;if(mesh.name!=='slate')continue;const g=mesh.geometry,v=g.getAttribute('position'),norm=g.getAttribute('normal');for(let i=0;i<v.count;i++){assert(Number.isFinite(v.getY(i)));assert(norm.getY(i)>.05,'All explicit roofs must face upward');}}
const roof=new T.Raycaster(p(0,30,3),new T.Vector3(0,-1,0)).intersectObjects(group.children)[0];assert.equal(roof?.object.name,'slate');assert(roof!.point.y>10.5&&roof!.point.y<11.1,'Nave slope must sit on documented eave/ridge profile');
assert.deepEqual(spec.suppressOsmIds,['w8891046','NL.IMBAG.Pand.0363100012163298']);
console.log(JSON.stringify({model:'petruskerk',triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},checks:['exposed north south and west glazing','door approach','supported upward roof planes','native bounds','open churchyard','exact replacement identity and neighbors'],visualAcceptance:'pending coordinator gallery/live-game review'}));
