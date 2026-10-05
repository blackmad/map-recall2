import assert from 'node:assert/strict';
import * as T from 'three';
import {buildW139} from './landmarks/w139-builder';
import source from './landmarks/w139-footprints.json';
import spec from './landmarks/w139-spec.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const group=new T.Group(),panes:T.Mesh[]=[],roofs:T.Mesh[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData.colour=c;group.add(m);if(c==='glass')panes.push(m);if(g.userData.roofSurface)roofs.push(m);};
const unused=()=>{throw new Error('Unwanted shared primitive or name lettering');};
const tools:BuildingTools={add,box:unused,prism:unused,hip:unused,gableRoof:unused,window:unused,clock:unused,sign:unused};
buildW139(spec.footprint.widthMetres,spec.footprint.lengthMetres,tools);group.updateMatrixWorld(true);
let triangles=0;for(const m of group.children as T.Mesh[]){const p=m.geometry.getAttribute('position');for(const v of p.array)assert.ok(Number.isFinite(v));triangles+=(m.geometry.index?.count??p.count)/3;}
assert.ok(triangles<40000);const bounds=new T.Box3().setFromObject(group);assert.ok(bounds.max.y>20&&bounds.max.y<21);assert.ok(bounds.max.x-bounds.min.x<65);assert.ok(bounds.max.z-bounds.min.z<54);
// All reauthored roof vertices remain at measured height within source millimetre
// rounding. This catches unstable plane fits/unsupported fins independently.
for(const roof of roofs){const p=roof.geometry.getAttribute('position'),region=source.roofRegions[roof.geometry.userData.surveyPart];for(let i=0;i<p.count;i++){const original=region.rings.flat().find(v=>Math.abs(v[0]-p.getX(i))<.001&&Math.abs(v[2]-p.getZ(i))<.001);assert.ok(original);assert.ok(Math.abs(original[1]-p.getY(i))<.002,'roof fit remains source-supported');}}
assert.equal(roofs.length,source.roofRegions.length);for(const roof of roofs){const n=roof.geometry.getAttribute('normal');for(let i=0;i<n.count;i++)assert.ok(n.getY(i)>.05,'upward supported roof normal');}
assert.deepEqual(spec.suppressOsmIds,['NL.IMBAG.Pand.'+source.building.properties.identificatie]);assert.ok(source.building.properties['verblijfsobject.href'].length>0);assert.ok(!source.neighborsToRetain.some(id=>spec.suppressOsmIds.includes(id)));assert.equal(spec.spatialSuppression,false);
const failures:any[]=[];for(const pane of panes){const p=new T.Box3().setFromObject(pane).getCenter(new T.Vector3());p.y+=.17;const n=new T.Vector3(...pane.geometry.userData.facadeOutward as [number,number,number]);const t=new T.Vector3(n.z,0,-n.x);p.addScaledVector(t,.18);const hit=new T.Raycaster(p.clone().addScaledVector(n,1.5),n.clone().negate(),0,2).intersectObject(group,true)[0];if(hit?.object!==pane)failures.push({pane:p.toArray(),hitColour:hit?.object.userData.colour});}
assert.deepEqual(failures,[],'all modeled glazing must remain first-hit visible');
// Independently require a supporting shell immediately behind each opening;
// a first-hit pane alone can pass even when it floats outside the building.
const structure=(group.children as T.Mesh[]).filter(m=>m.geometry.userData.surveyPart!==undefined&&!m.geometry.userData.roofSurface);
for(const pane of panes){const p=new T.Box3().setFromObject(pane).getCenter(new T.Vector3()),n=new T.Vector3(...pane.geometry.userData.facadeOutward as [number,number,number]);const hit=new T.Raycaster(p.clone().addScaledVector(n,.1),n.clone().negate(),0,.65).intersectObjects(structure,false)[0];assert.ok(hit,'glazing needs real supporting survey shell '+JSON.stringify(p.toArray()));}

for(const [x,z]of source.openSpaceProbes)assert.equal(new T.Raycaster(new T.Vector3(x,25,z),new T.Vector3(0,-1,0),0,26).intersectObject(group,true).length,0,'surveyed exterior/court stays open');
// Compare independently selected measured region probes: varying roof volumes
// must not become one high solid slab. Roof profiles own all top-facing hits.
for(const [x,z,maxHeight]of [[25,14,8],[0,2,13.5],[-23,-22,10.5]]){const hit=new T.Raycaster(new T.Vector3(x,25,z),new T.Vector3(0,-1,0),0,26).intersectObject(group,true)[0];assert.ok(hit&&hit.point.y<maxHeight,'low rear/entrance volume preserved');assert.ok(hit.object.geometry.userData.roofSurface,'visible top is owned by explicit roof');}
console.log(JSON.stringify({triangles,panes:panes.length,roofRegions:roofs.length,bounds:bounds.min.toArray().concat(bounds.max.toArray()),status:'CPU-ready; gallery/live acceptance pending'}));
