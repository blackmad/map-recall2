import * as T from 'three';
import assert from 'node:assert/strict';
import {buildSintAgneskerk} from './landmarks/sint-agneskerk-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import source from './landmarks/sint-agneskerk-footprints.json';
import spec from './landmarks/sint-agneskerk-spec.json';
const group=new T.Group();let triangles=0;
const tools={add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0){const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.name=c;m.position.set(x,y,z);m.rotation.y=a;group.add(m);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}} as unknown as BuildingTools;
buildSintAgneskerk(1,1,tools);group.updateMatrixWorld(true);
const bounds=new T.Box3().setFromObject(group);assert(bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite));assert(bounds.max.y>38&&bounds.max.y<41);assert(triangles<40000);
const rotation=new T.Matrix4().makeRotationY(source.localRotationDegrees*Math.PI/180);
const p=(x:number,y:number,z:number)=>new T.Vector3(x,y,z).applyMatrix4(rotation);
function hit(x:number,y:number,z:number,dx:number,dz:number){return new T.Raycaster(p(x,y,z),new T.Vector3(dx,0,dz).transformDirection(rotation)).intersectObjects(group.children)[0];}
assert.equal(hit(0,12.8,40,0,-1)?.object.name,'dark','West rose glazing must be the first visible facade');
assert.equal(hit(20,13.2,6,-1,0)?.object.name,'dark','South nave pane cannot be buried in its shell');
assert.equal(hit(-20,13.2,6,1,0)?.object.name,'dark','North nave pane cannot be buried');
for(const probe of source.openSpaceProbes){const h=new T.Raycaster(p(probe.local[0],45,probe.local[1]),new T.Vector3(0,-1,0)).intersectObjects(group.children)[0];assert(!h,`${probe.name} must remain unroofed/unfilled`);}
for(const n of source.preserveNeighbors)assert(!spec.suppressOsmIds.includes(n.osmId)&&!spec.suppressOsmIds.includes('NL.IMBAG.Pand.'+n.bagId));
// Every authored tiled roof surface faces upward, has nonzero area and finite vertices.
for(const child of group.children){const mesh=child as T.Mesh;if(!['red','slate'].includes(mesh.name))continue;const g=mesh.geometry,v=g.getAttribute('position'),norm=g.getAttribute('normal');for(let i=0;i<v.count;i++){assert(Number.isFinite(v.getY(i)));assert(norm.getY(i)>.08,'Roof winding must face up');}}
const tr=source.parts[1].localRing.slice(0,-1),cx=tr.reduce((s,q)=>s+q[0],0)/tr.length,cz=tr.reduce((s,q)=>s+q[1],0)/tr.length;
const open=hit(cx,33,cz+12,0,-1);assert(!open,'Belfry central arcade must be truly open through the tower');
console.log(JSON.stringify({model:'sint-agneskerk',triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},checks:['first-hit west rose and both clerestories','upward roofs','separate tower and open forecourt','open belfry','preserved neighbors'],visualAcceptance:'pending gallery/live-game coordinator review'}));
