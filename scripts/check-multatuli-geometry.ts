import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {buildMultatuli} from './landmarks/multatuli-builder';
import source from './landmarks/multatuli-footprints.json';
import spec from './landmarks/multatuli-spec.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const group=new T.Group(),panes:T.Mesh[]=[],roofs:T.Mesh[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.userData.colour=c;group.add(mesh);if(c==='glass'&&g instanceof T.PlaneGeometry)panes.push(mesh);if(g.userData.roofSurface)roofs.push(mesh);};
const unused=()=>{throw new Error('Unexpected geometry or painted sign');};
const tools:BuildingTools={add,box(x,y,z,w,h,d,c,a=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);},prism:unused,hip:unused,gableRoof:unused,window:unused,clock:unused,sign:unused};
buildMultatuli(spec.footprint.widthMetres,spec.footprint.lengthMetres,tools);group.updateMatrixWorld(true);
let triangles=0;for(const m of group.children as T.Mesh[]){const p=m.geometry.getAttribute('position');for(const x of p.array)assert.ok(Number.isFinite(x));triangles+=(m.geometry.index?.count??p.count)/3;}assert.ok(triangles<40000);
const bounds=new T.Box3().setFromObject(group);assert.ok(bounds.max.y>13.8&&bounds.max.y<14.6);assert.ok(bounds.max.x-bounds.min.x<5.4,'only one narrow house');assert.ok(bounds.max.z-bounds.min.z<14.4,'native depth plus actual stoop');
for(const roof of roofs){const p=roof.geometry.getAttribute('position'),n=roof.geometry.getAttribute('normal');for(let i=0;i<p.count;i++)assert.ok(n.getY(i)>.1,'all roof planes upward '+JSON.stringify({i,n:n.getY(i),p:[p.getX(i),p.getY(i),p.getZ(i)]}));}
// Source identity comes from actual VBO-to-Pand links, not nearby POI point proximity.
const vbo=JSON.parse(fs.readFileSync('docs/references/multatuli/bag-addresses.json','utf8')).data.features;
const pand=source.building;
assert.ok(vbo.every((f:any)=>f.properties['pand.href'].some((u:string)=>u.endsWith('/'+pand.id))));
assert.ok(!source.neighborsToRetain.some(id=>spec.suppressOsmIds.includes(id)));assert.equal(spec.spatialSuppression,false);
const wall=(group.children[0] as T.Mesh).geometry.getAttribute('position');
// Front native footprint vertices survive independent facade detailing.
for(const [x,z] of source.localRing.filter(p=>p[1]>=-3.75))assert.ok(Array.from({length:wall.count},(_,i)=>i).some(i=>Math.abs(wall.getX(i)-x)<1e-4&&Math.abs(wall.getZ(i)-z)<1e-4&&Math.abs(wall.getY(i))<1e-4));
let visible=0;const visibilityFailures:number[][]=[];for(const mesh of panes){const bb=new T.Box3().setFromObject(mesh),p=bb.getCenter(new T.Vector3());p.x+=.14;p.y+=.19;const sign=p.z>0?1:-1;const hit=new T.Raycaster(p.clone().add(new T.Vector3(0,0,sign*1.5)),new T.Vector3(0,0,-sign),0,2).intersectObject(group,true)[0];if(hit?.object===mesh)visible++;else visibilityFailures.push(p.toArray());}assert.equal(visibilityFailures.length,0,'every pane must be first-hit exposed '+JSON.stringify(visibilityFailures));
// Coherent high roof belongs only to the main front house; rear extension remains low.
for(const [x,z,top]of [[-1.4,-5.15,5.7],[1.1,-5.15,4.2]]){const hit=new T.Raycaster(new T.Vector3(x,20,z),new T.Vector3(0,-1,0),0,21).intersectObject(group,true)[0];assert.ok(hit&&hit.point.y<top,'rear low extension not full-height slab');}
for(const [x,z]of source.openSpaceProbes)assert.equal(new T.Raycaster(new T.Vector3(x,20,z),new T.Vector3(0,-1,0),0,21).intersectObject(group,true).length,0,'neighbor/exterior space retained');
// A genuine concave shoulder: no solid rectangular/stepped cap filling the upper corners.
const F=source.frontZ,cx=source.facadeCenterX;for(const x of [cx-2,cx+2])assert.equal(new T.Raycaster(new T.Vector3(x,12.7,F+2),new T.Vector3(0,0,-1),0,2.1).intersectObject(group,true).length,0,'bell shoulder silhouette stays open');
assert.ok(new T.Raycaster(new T.Vector3(cx+.30,13.85,F+2),new T.Vector3(0,0,-1),0,2.3).intersectObject(group,true).length>0,'rounded crown is present');
console.log(JSON.stringify({triangles,panes:panes.length,visible,roofPlanes:roofs.length,bounds:bounds.min.toArray().concat(bounds.max.toArray()),status:'CPU-ready; gallery/live acceptance pending'}));
