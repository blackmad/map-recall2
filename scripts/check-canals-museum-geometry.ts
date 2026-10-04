import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCanalsMuseum} from './landmarks/canals-museum-builder';
import spec from './landmarks/canals-museum-spec.json';
import source from './landmarks/canals-museum-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const group=new T.Group(),panes:T.Mesh[]=[];let roof:T.Mesh|undefined;
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.userData.colour=c;group.add(mesh);if(c==='glass'&&g instanceof T.PlaneGeometry)panes.push(mesh);if(c==='slate'&&g.type==='BufferGeometry')roof=mesh;};
const unused=()=>{throw new Error('Unexpected non-native primitive');};
const tools:BuildingTools={add,box(x,y,z,w,h,d,c,a=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);},prism:unused,hip:unused,gableRoof:unused,window:unused,clock:unused,sign:unused};
buildCanalsMuseum(spec.footprint.lengthMetres,spec.footprint.widthMetres,tools);group.updateMatrixWorld(true);
let triangles=0;for(const m of group.children as T.Mesh[]){const g=m.geometry,p=g.getAttribute('position');for(const x of p.array)assert.ok(Number.isFinite(x));triangles+=(g.index?.count??p.count)/3;}assert.ok(triangles<40000);
const bounds=new T.Box3().setFromObject(group);assert.ok(bounds.max.y<18.2&&bounds.max.y>17.5,'native roof maximum');assert.ok(bounds.max.x-bounds.min.x<16,'double house width, not entire neighboring row');assert.ok(bounds.max.z-bounds.min.z<24,'house excludes open rear garden');
assert.ok(roof);const rp=roof.geometry.getAttribute('position'),rn=roof.geometry.getAttribute('normal');for(let i=0;i<rp.count;i++){assert.ok(rn.getY(i)>.1,'roof normals point upward');assert.ok(rp.getY(i)>=14.1999,'hip supported above wall eave');}
// Actual source perimeter has matching wall base vertices, with no padded plot shell.
const wall=(group.children[0] as T.Mesh).geometry.getAttribute('position');for(const [x,z] of source.localRing)assert.ok(Array.from({length:wall.count},(_,i)=>i).some(i=>Math.abs(wall.getX(i)-x)<1e-4&&Math.abs(wall.getZ(i)-z)<1e-4&&Math.abs(wall.getY(i))<1e-4),'native BAG boundary retained');
for(const [x,z] of source.openGardenProbes)assert.equal(new T.Raycaster(new T.Vector3(x,25,z),new T.Vector3(0,-1,0),0,26).intersectObject(group,true).length,0,'rear garden remains open');
let visible=0;for(const mesh of panes){const box=new T.Box3().setFromObject(mesh),p=box.getCenter(new T.Vector3());p.x+=.24;p.y+=.23;const sign=p.z>0?1:-1;const hit=new T.Raycaster(p.clone().add(new T.Vector3(0,0,sign*1.5)),new T.Vector3(0,0,-sign),0,2).intersectObject(group,true)[0];if(hit?.object===mesh)visible++;}assert.ok(visible/panes.length>.95,'first-hit pane visibility');
assert.equal(spec.spatialSuppression,false);assert.ok(!source.neighborsToRetain.some(id=>(spec.suppressOsmIds as string[]).includes(id)));
console.log(JSON.stringify({triangles,panes:panes.length,visible,bounds:bounds.min.toArray().concat(bounds.max.toArray()),gardenProbes:source.openGardenProbes.length}));
