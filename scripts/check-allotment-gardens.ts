import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allotmentGardenTriangles} from '../src/canalRecall/allotmentGardens.ts';
import {ORIGIN,buildFeatureChunk} from '../src/canalRecall/threeBuildingFeatures.ts';
const houses=JSON.parse(readFileSync('artifacts/sloterdijkermeer-review/mapped-houses.geojson','utf8')).features;
let triangles=0,maximum=0;
for(const f of houses){const full=allotmentGardenTriangles(f.properties.id,ORIGIN),coarse=allotmentGardenTriangles(f.properties.id,ORIGIN,true);triangles+=full.length;maximum=Math.max(maximum,full.length);assert.ok(full.length<1500,'bounded planting per house');assert.ok(coarse.length<=full.length);for(const t of full){assert.ok(t.p.flat().every(Number.isFinite));assert.ok(t.p.every(p=>p[2]>=.03&&p[2]<2.3));const a=t.p[1].map((v,k)=>v-t.p[0][k]),b=t.p[2].map((v,k)=>v-t.p[0][k]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];assert.ok(n.reduce((s,v,k)=>s+v*t.n[k],0)>0,'outward winding');assert.ok(Math.abs(Math.hypot(...t.n)-1)<1e-6,'unit normal');}}
assert.ok(triangles>10000&&triangles<100000);assert.equal(allotmentGardenTriangles('unrelated-building',ORIGIN).length,0,'scope stays inside admitted houses');
const chunk=buildFeatureChunk(houses,'photo');assert.equal(chunk.buildingCount,376);const houseRanges=chunk.ranges.filter(r=>!r.id.startsWith('allotment-garden:')),gardenRanges=chunk.ranges.filter(r=>r.id.startsWith('allotment-garden:'));assert.equal(houseRanges.length,376);assert.ok(gardenRanges.length>350,'gardens have independent render ownership');assert.ok(gardenRanges.every(r=>!houses.some((f:any)=>f.properties.id===r.id)),'garden ranges never resolve to pickable source houses');assert.equal(chunk.ranges.reduce((n,r)=>n+r.count,0),chunk.vertexCount,'every garden vertex participates in LOD hiding');
console.log(JSON.stringify({gardens:houses.length,triangles,maxTrianglesPerGarden:maximum}));
