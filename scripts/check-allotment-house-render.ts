import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allotmentHouseTriangles, isAllotmentHouse } from '../src/canalRecall/allotmentHouses.ts';
import { buildFeatureChunk, ORIGIN, type Feature } from '../src/canalRecall/threeBuildingFeatures.ts';

const features: Feature[] = JSON.parse(readFileSync('artifacts/sloterdijkermeer-review/mapped-houses.geojson', 'utf8')).features;
assert.equal(features.length, 376);
let triangles = 0, maximum = 0;
const start = performance.now();
for (const f of features) {
  assert.ok(isAllotmentHouse(f), 'native MultiPolygon is admitted');
  const full = allotmentHouseTriangles(f, ORIGIN), coarse = allotmentHouseTriangles(f, ORIGIN, true);
  assert.ok(full.length > 20 && full.length <= 250, `${f.properties.id}: bounded visible house`);
  assert.ok(coarse.some(t => t.hex === '#526b76'), 'coarse LOD retains glazing');
  assert.ok(coarse.some(t => t.hex === '#3e4840'), 'coarse LOD retains an entrance');
  assert.ok(full.some(t => t.hex === '#e6e1d2'), 'white trim survives');
  for (const t of full) {
    assert.ok(t.p.flat().every(Number.isFinite));
    assert.ok(t.p.every(p => p[2] >= 0 && p[2] < 3.6), 'one-storey height envelope');
    const [a,b,c] = t.p, ab = b.map((v,k)=>v-a[k]), ac = c.map((v,k)=>v-a[k]);
    const n = [ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    assert.ok(n.reduce((sum,v,k)=>sum+v*t.n[k],0)>0, 'triangle winding matches outward normal');
  }
  const g = f.geometry as { coordinates: number[][][][] };
  let expectedArea = 0;
  for (const polygon of g.coordinates) {
    const kx = 111320*Math.cos(ORIGIN.lat*Math.PI/180), r=polygon[0].map(p=>[(p[0]-ORIGIN.lng)*kx,(p[1]-ORIGIN.lat)*110540]);
    expectedArea += Math.abs(r.reduce((sum,a,i)=>{const b=r[(i+1)%r.length];return sum+a[0]*b[1]-a[1]*b[0];},0))/2;
  }
  const roofArea=full.filter(t=>t.n[2]>.1).reduce((sum,t)=>{const [a,b,c]=t.p;return sum+Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;},0);
  assert.ok(Math.abs(roofArea-expectedArea)<.0001, 'native roof covers footprint exactly, without a padded box');
  triangles+=full.length;maximum=Math.max(maximum,full.length);
}
for (const look of ['photo','cartoon','storybook','procedural','untextured'] as const) {
  const chunk=buildFeatureChunk(features,look);
  assert.equal(chunk.buildingCount,376);assert.equal(chunk.ranges.filter(r=>!r.id.startsWith('allotment-garden:')).length,376);
  assert.ok(chunk.ranges.every(r=>r.start+r.count<=chunk.vertexCount));
  assert.equal(buildFeatureChunk(features,look,'extras').vertexCount,0,'houses have one mesh owner');
  assert.equal(buildFeatureChunk(features,look,'coarse').buildingCount,376);
}
// Unsupported courtyard shapes use the ordinary renderer instead of vanishing.
const unsupported={...features[0],geometry:{type:'Polygon',coordinates:[[[4.9,52.37],[4.9001,52.37],[4.9001,52.3701],[4.9,52.3701],[4.9,52.37]],[[4.90003,52.37003],[4.90006,52.37003],[4.90006,52.37006],[4.90003,52.37006],[4.90003,52.37003]]]}};
assert.ok(!isAllotmentHouse(unsupported));assert.equal(buildFeatureChunk([unsupported],'photo').buildingCount,1);
console.log(JSON.stringify({houses:features.length,triangles,maxTrianglesPerHouse:maximum,geometryChecksAndFiveLooksMs:Math.round(performance.now()-start)}));
