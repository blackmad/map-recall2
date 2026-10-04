import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCentraalComplex,clipRoofPanel} from './landmarks/centraal-complex-builder';
import source from './landmarks/centraal-complex-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
import {MANUAL_LANDMARKS} from '../src/canalRecall/landmarks/manualModels';

const group=new T.Group(),geometries:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);geometries.push(g);group.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));};
const unused=()=>{throw Error('unexpected detail helper');};
const tools:BuildingTools={add,box(x,y,z,w,h,d,c,a=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);},hip:unused,prism:unused,gableRoof:unused,window:unused,clock:unused,sign:unused};
buildCentraalComplex(tools);group.updateMatrixWorld(true);
let triangles=0;
for(const g of geometries){const p=g.getAttribute('position');assert.ok(Array.from(p.array).every(Number.isFinite));triangles+=(g.index?.count||p.count)/3;}
assert.ok(triangles<10900,'complex stays within combined 40k Cuypers asset budget');
const bounds=new T.Box3().setFromObject(group);assert.ok(bounds.max.y>=23&&bounds.max.y<23.1,'published 23 m Zuidkap roof with thin outer steel strips');
assert.equal(source.parts.find(p=>p.name==='Zuidkap')!.frames,50,'published 50 steel frames');
assert.equal(source.parts.length,4);
const bus=source.parts.find(p=>p.glass)!;
const [x0,z0,x1,z1]=bus.bounds,z=(z0+z1)/2;
// The bus road is elevated. An open grade sample sees no filled station block,
// but does see its real raised deck and roof above.
const ray=new T.Raycaster(new T.Vector3((x0+x1)/2,0.2,z),new T.Vector3(0,1,0));
const hits=ray.intersectObject(group,true);
assert.ok(hits.length>0&&hits[0].point.y>6,'pedestrian/cycle space remains clear below bus deck');
assert.ok(hits.some(h=>h.point.y>21.8),'IJ roof retained above deck');
// At the angled IJ east end the patch must not leak into the adjoining street.
const ring=clipRoofPanel(bus.localPolygons[0][0],x1-2,z0,x1+10,z1);
assert.ok(ring.length>=3&&ring.every(p=>p[0]<=x1+1e-7));
const spec=MANUAL_LANDMARKS.find(p=>p.id==='centraal-station')!;
assert.equal(spec.spatialSuppression,false);
for(const roof of source.parts)assert.ok(spec.suppressOsmIds.includes(roof.osmId));
for(const neighbor of ['w26726075','w139016081','NL.IMBAG.Pand.0363100012178504','NL.IMBAG.Pand.0363100012185599','NL.IMBAG.Pand.0363100012240311'])assert.ok(!spec.suppressOsmIds.includes(neighbor),'ferry/metro/hotel/postal neighbors remain');
console.log({triangles,bounds,roofCount:source.parts.length,groundClearance:hits[0].point.y});
