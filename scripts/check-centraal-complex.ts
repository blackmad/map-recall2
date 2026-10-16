import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCentraalComplex,clipRoofPanel} from './landmarks/centraal-complex-builder';
import source from './landmarks/centraal-complex-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
import {MANUAL_LANDMARKS} from '../src/canalRecall/landmarks/manualModels';
import {loadMaterialSoup} from './landmarks/material-soup';

const group=new T.Group(),geometries:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,_c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);geometries.push(g);group.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));};
const unused=()=>{throw Error('unexpected detail helper');};
const tools:BuildingTools={add,box(x,y,z,w,h,d,c,a=0){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);},hip:unused,prism:unused,gableRoof:unused,window:unused,clock:unused,sign:unused};
buildCentraalComplex(tools);group.updateMatrixWorld(true);
let triangles=0;
for(const g of geometries){const p=g.getAttribute('position');assert.ok(Array.from(p.array).every(Number.isFinite));triangles+=(g.index?.count||p.count)/3;}
// 10.9k until 2026-10-13; the arches became a material split of the roof sheet (no floating strips to z-fight), +7.3k triangles.
assert.ok(triangles<18000,'complex stays within the Cuypers asset budget (whole GLB under 50k)');
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
// The AMSTERDAM lettering on the IJ canopy is real (user, 2026-10-16): dark maroon glass panels, measured on the PDOK 2023
// orthophoto at x -127.5..123.9 and z -164.9..-146.5 of the model frame. Keep it, in its own measured colour, on the canopy.
{
 const letters:number[][]=[];
 const colourOf=new Map<T.BufferGeometry,string>();
 const probe:BuildingTools={...tools,add(g,c,x=0,y=0,z=0,a=0){g.rotateY(a);g.translate(x,y,z);colourOf.set(g,c);}};
 buildCentraalComplex(probe);
 for(const [g,c] of colourOf)if(c==='pink'){g.computeBoundingBox();const b=g.boundingBox!;letters.push([b.min.x,b.max.x,b.min.z,b.max.z,b.max.y]);}
 assert.ok(letters.length>=40,`AMSTERDAM letter panels on the IJ canopy (${letters.length})`);
 const x0=Math.min(...letters.map(l=>l[0])),x1=Math.max(...letters.map(l=>l[1])),z0=Math.min(...letters.map(l=>l[2])),z1=Math.max(...letters.map(l=>l[3]));
 assert.ok(Math.abs(x0+127.5)<0.5&&Math.abs(x1-123.9)<0.5,`lettering spans the measured x -127.5..123.9 (${x0.toFixed(1)}..${x1.toFixed(1)})`);
 assert.ok(Math.abs(z0+164.9)<0.5&&Math.abs(z1+146.5)<0.5,`lettering spans the measured band z -164.9..-146.5 (${z0.toFixed(1)}..${z1.toFixed(1)})`);
 assert.ok(letters.every(l=>l[4]>12),'letters lie on the curved canopy roof (14.8 m at the north edge of the band), not the 6.5 m bus deck');
 assert.equal(spec.materialOverrides?.pink,'#7a4850','lettering keeps its measured maroon, not the bright orange of other sources');
}
// The lod1 east wing stays a solid wall (integrator review 2026-10-16: at the default simplifier error its 1.4 m brick bands
// between the window rows collapsed and the sky showed through, measured 96-211 of 233 samples open per storey).
// Seen square-on, the front (walls, glass, frames within 0.5 m of z 0) must cover x 129..245 in all three storeys.
for(const file of ['public/canal-drive/models/centraal-station.glb','public/canal-drive/models/centraal-station.lod1.glb']){
 const soup=await loadMaterialSoup(file),P=soup.positions,I=soup.indices,front:number[][]=[];
 for(let t=0;t<I.length/3;t++){
  const v=[0,1,2].map(k=>[P[I[t*3+k]*3],P[I[t*3+k]*3+1],P[I[t*3+k]*3+2]]);
  if(v.some(p=>p[2]<-0.5||p[2]>0.5||p[0]<127))continue;
  const nz=(v[1][0]-v[0][0])*(v[2][1]-v[0][1])-(v[1][1]-v[0][1])*(v[2][0]-v[0][0]);
  if(Math.abs(nz)>1e-6)front.push(v.flatMap(p=>[p[0],p[1]]));
 }
 const inside=(x:number,y:number)=>front.some(([ax,ay,bx,by,cx,cy])=>{const d1=(x-bx)*(ay-by)-(ax-bx)*(y-by),d2=(x-cx)*(by-cy)-(bx-cx)*(y-cy),d3=(x-ax)*(cy-ay)-(cx-ax)*(y-ay);return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));});
 const missing:number[]=[];
 for(const y of [3.5,8,12.5])for(let x=129;x<=245;x+=0.5)if(!inside(x,y))missing.push(x);
 assert.ok(missing.length<=4,`${file}: east-wing front is see-through at x ${missing.slice(0,8).join(", ")} (${missing.length} of 699 samples)`);
}
console.log({triangles,bounds,roofCount:source.parts.length,groundClearance:hits[0].point.y});
