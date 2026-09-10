import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildFootprintElevations,type FootprintGeometry} from './da-costa-block/footprint-elevations.ts';
import {buildElevations} from '../src/canalRecall/facade/elevations.ts';
import {lngLatToRd,type LngLat} from '../src/canalRecall/facade/rdNew.ts';
const outer=[[0,0],[20,0],[20,20],[0,20],[0,0]],hole=[[5,5],[10,5],[10,10],[5,10],[5,5]],other=[[30,0],[40,0],[40,10],[30,10],[30,0]];
const project=([x,y]:LngLat)=>({x,y}),options={pandId:'fixture',project,minLengthM:3};
const geometry:FootprintGeometry={type:'MultiPolygon',coordinates:[[outer,hole],[other]]};
const walls=buildFootprintElevations(geometry,options);
assert.equal(walls.length,12,'all exterior components and courtyard rings become candidates');
assert.equal(new Set(walls.map(w=>w.elevationId)).size,12);
for(const wall of walls){
  const ring=geometry.coordinates[wall.sourcePolygonIndex][wall.sourceRingIndex],baseline=buildElevations(ring.map(p=>project(p as LngLat)),options).find(w=>w.elevationId===wall.elevationId)!;
  assert.ok(baseline,'original endpoint-derived IDs are unchanged');
  if(wall.sourceRingRole==='courtyard'){
    assert.equal(wall.normal.x,-baseline.normal.x);assert.equal(wall.normal.y,-baseline.normal.y);
    assert.equal(wall.facingDeg,(baseline.facingDeg+180)%360);
    assert.ok(wall.normal.x*(7.5-wall.midpoint.x)+wall.normal.y*(7.5-wall.midpoint.y)>0,'courtyard normal points into open hole');
  }else assert.deepEqual(wall.normal,baseline.normal);
}
const rotated=(ring:number[][])=>{const open=ring.slice(0,-1),shifted=[...open.slice(2),...open.slice(0,2)].reverse();return [...shifted,shifted[0]];};
const reordered=buildFootprintElevations({type:'MultiPolygon',coordinates:[[rotated(other)],[rotated(outer),rotated(hole)]]},options);
const byGeometry=(rows:typeof walls)=>rows.map(({elevationId,normal,facingDeg})=>({elevationId,normal,facingDeg})).sort((a,b)=>a.elevationId.localeCompare(b.elevationId));
assert.deepEqual(byGeometry(reordered),byGeometry(walls),'IDs and world-facing normals ignore component order, ring start and winding');
assert.equal(reordered.find(w=>w.elevationId===walls[0].elevationId)?.sourcePolygonIndex,1,'source indices follow input independently of identity');
assert.throws(()=>buildFootprintElevations({type:'Polygon',coordinates:[[[NaN,0],[10,0],[10,10]]]},options),/Nonfinite/);
assert.throws(()=>buildFootprintElevations({type:'MultiPolygon',coordinates:[[outer],[outer]]},options),/Duplicate physical wall/);
const actual=JSON.parse(fs.readFileSync('.cache/da-costa-block/bag.json','utf8'));
let checked=0;
for(const source of actual){
  if(source.geometry.type!=='Polygon')continue;
  const options={pandId:source.properties.identificatie,minLengthM:3},expected=buildElevations(source.geometry.coordinates[0].map(lngLatToRd),options);
  const generated=buildFootprintElevations(source.geometry,options).filter(w=>w.sourceRingRole==='exterior');
  assert.deepEqual(generated.map(w=>w.elevationId),expected.map(w=>w.elevationId));checked++;
}
console.log(`Passed footprint elevations: multipart/courtyard coverage, inward hole normals, stable IDs/order/winding, source indices, invalid topology, ${checked} cached BAG exterior-ID controls.`);
