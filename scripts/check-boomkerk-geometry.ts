import * as T from 'three';
import assert from 'node:assert/strict';
import {buildBoomkerk} from './landmarks/boomkerk-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import source from './landmarks/boomkerk-footprints.json';
import spec from './landmarks/boomkerk-spec.json';
const group=new T.Group();let triangles=0;
const b={add(g:T.BufferGeometry,c:string){const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.name=c;group.add(m);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}} as BuildingTools;
buildBoomkerk(1,1,b);group.updateMatrixWorld(true);
const bounds=new T.Box3().setFromObject(group);assert(bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite));assert(bounds.max.y>42&&bounds.max.y<45);assert(triangles<40000);
const r=new T.Matrix4().makeRotationY(source.localRotationDegrees*Math.PI/180),p=(x:number,y:number,z:number)=>new T.Vector3(x,y,z).applyMatrix4(r);
function hit(x:number,y:number,z:number,dx:number,dz:number){return new T.Raycaster(p(x,y,z),new T.Vector3(dx,0,dz).transformDirection(r)).intersectObjects(group.children)[0];}
assert.equal(hit(2.4,11.9,40,0,-1)?.object.name,'glass','Wheel glazing first hit');assert.equal(hit(2.1,1.1,40,0,-1)?.object.name,'dark','Central entrance first hit');assert.equal(hit(20,5.8,12.5,-1,0)?.object.name,'glass','East aisle window first hit');assert.equal(hit(-20,5.8,12.5,1,0)?.object.name,'glass','West aisle window first hit');
for(const probe of source.openSpaceProbes)assert(!new T.Raycaster(p(probe.local[0],60,probe.local[1]),new T.Vector3(0,-1,0)).intersectObjects(group.children)[0],probe.name+' must stay open');
const roof=new T.Raycaster(p(4,50,16),new T.Vector3(0,-1,0)).intersectObjects(group.children)[0];assert.equal(roof?.object.name,'slate');assert(roof!.point.y>19&&roof!.point.y<23,'Nave roof on eave/ridge profile');
for(const mesh of group.children as T.Mesh[])if(mesh.name==='slate'){const n=mesh.geometry.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>-.01,'Downward roof or overlapping bottom cap');}
for(const n of source.preserveNeighbors)assert(!spec.suppressOsmIds.includes(n.osmId)&&!spec.suppressOsmIds.includes('NL.IMBAG.Pand.'+n.bagId));
console.log(JSON.stringify({model:'boomkerk',triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},checks:['exposed rose/door/side glazing','open neighboring gaps','native height profile','upward supported roofs','exact church-only suppression'],visualAcceptance:'pending coordinator gallery/native scene'}));
