import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {sharedWallCuts,subtractWallCuts,subtractConvex,polygonArea} from '../src/canalRecall/coplanarSurfaces.ts';
import {buildChunk,type MeshBuilding} from '../src/canalRecall/threeBuildingMesh.ts';
import {auditChunk} from './audit-building-coplanar.ts';
import {auditNearCoplanar} from './audit-near-coplanar-walls.ts';
import {dropNestedDuplicates} from '../src/canalRecall/buildingNesting.ts';
import {buildFeatureChunk,ORIGIN} from '../src/canalRecall/threeBuildingFeatures.ts';
const e={x0:0,y0:0,x1:10,y1:0,len:10,nx:0,ny:-1};
const cut=sharedWallCuts([{b:{id:'podium',heightM:20,minHeightM:0},edges:[e]},{b:{id:'tower',heightM:90,minHeightM:0},edges:[{...e,x0:2,x1:8,len:6}]}]);
assert.deepEqual(cut.get(e)?.map(c=>[c.a0,c.a1,c.z0,c.z1]),[[.2,.8,0,20]]);
const q={along0:0,along1:1,z0:0,z1:20};
assert.ok(Math.abs(subtractWallCuts(q,cut.get(e)!,(_,r)=>r).reduce((s,p)=>s+(p.along1-p.along0)*(p.z1-p.z0),0)-8)<1e-9);
// Near-coplanar same-facing walls stripe (Oosterdokseiland, issue #123): the wall behind is cut, whichever is taller.
// e faces -y, so a wall at y=+0.1 stands 0.1 m behind it, inside e's building.
{const back={...e,y0:.1,y1:.1};const near=sharedWallCuts([{b:{id:'a',heightM:20,minHeightM:0},edges:[e]},{b:{id:'b',heightM:30,minHeightM:0},edges:[back]}]);
assert.equal(near.has(e),false,'the front facade stays even when shorter');
assert.deepEqual(near.get(back)?.map(c=>[c.a0,c.a1,c.z0,c.z1,c.other]),[[0,1,0,20,'a']],'the wall 0.1 m behind is cut over the shared height');}
{const tilted={...e,y0:.05,y1:-.05};const near=sharedWallCuts([{b:{id:'a',heightM:20,minHeightM:0},edges:[e]},{b:{id:'b',heightM:20,minHeightM:0},edges:[tilted]}]);
assert.equal(near.size,1,'walls crossing at a sliver angle: exactly one is cut (tie-break)');}
assert.equal(sharedWallCuts([{b:{id:'a',heightM:20,minHeightM:0},edges:[e]},{b:{id:'b',heightM:20,minHeightM:0},edges:[{...e,y0:.8,y1:.8}]}]).size,0,'a real 0.8 m setback keeps both walls');
assert.equal(sharedWallCuts([{b:{id:'a',heightM:20,minHeightM:0},edges:[e]},{b:{id:'b',heightM:20,minHeightM:0},edges:[{x0:10,y0:.1,x1:0,y1:.1,len:10,nx:0,ny:1}]}]).size,0,'back-to-back walls 0.1 m apart: near rule is same-facing only');
assert.equal(sharedWallCuts([{b:{id:'a',heightM:10,minHeightM:0},edges:[e]},{b:{id:'b',heightM:20,minHeightM:12},edges:[e]}]).size,0,'non-overlapping height stays');
const remainder=subtractConvex([[0,0],[10,0],[10,10],[0,10]],[[5,0],[15,0],[15,10],[5,10]]);
assert.equal(remainder.reduce((s,p)=>s+polygonArea(p),0),50);
const origin={lng:4.9,lat:52.37};
const box=(id:string,x:number):MeshBuilding=>({id,polygons:[[[[4.9+x,52.37],[4.9002+x,52.37],[4.9002+x,52.3702],[4.9+x,52.3702],[4.9+x,52.37]]]],minHeightM:0,heightM:10,style:'school',wallHex:'#aaaabb',bare:true,plainLayer:1,lid:{hex:'#555555',flatLayer:2}});
const a=box('a',0),b=box('b',.0001),chunk=buildChunk([a,b],origin);
let topArea=0;
for(let i=0;i<chunk.indices.length;i+=3){const p=[0,1,2].map(k=>{const v=chunk.indices[i+k];return [chunk.positions[v*3],chunk.positions[v*3+1],chunk.positions[v*3+2]];});if(p.every(v=>Math.abs(v[2]-10)<1e-6))topArea+=polygonArea(p.map(v=>[v[0],v[1]]));}
const one=111320*Math.cos(origin.lat*Math.PI/180)*.0002*110540*.0002;
assert.ok(Math.abs(topArea-one*1.5)<.01,`flat roofs cover their union exactly once: ${topArea} vs ${one*1.5}`);
assert.deepEqual(Array.from(buildChunk([b,a],origin).positions).filter(Number.isNaN),[]);
// Real Sloterdijk source, retaining every tower/podium/neighbor identity.
const source=JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8412/5382.geojson.gz')).toString());
const fs=source.features.filter((f:any)=>['w364317348','w375490816'].includes(f.properties.id));
for(const mode of ['walls','coarse'] as const){const c=buildFeatureChunk(fs,'photo',mode);assert.equal(c.ranges.length,2);assert.ok(c.positions.every(Number.isFinite));}
// A detail batch and its coarse neighbor must use the same ownership. Context
// is read-only and must not leak extra building identities into the drawn batch.
const separate=buildChunk([b],origin,'walls',undefined,[a]);
const together=buildChunk([a,b],origin);
assert.equal(separate.ranges.length,1);
assert.equal(separate.ranges[0].id,'b');
const area=(c:any)=>{let sum=0;for(let i=0;i<c.indices.length;i+=3){const p=[0,1,2].map(k=>{const v=c.indices[i+k];return [c.positions[v*3],c.positions[v*3+1],c.positions[v*3+2]];});if(p.every(v=>Math.abs(v[2]-10)<1e-6))sum+=polygonArea(p.map(v=>[v[0],v[1]]));}return sum;};
assert.ok(Math.abs(area(separate)-one*.5)<.01,'separate batch roof retains only its exposed half');
for(const tile of ['8412/5382','8415/5383','8413/5383']){
 const raw=JSON.parse(gunzipSync(readFileSync(`public/data/extracts/amsterdam/building-tiles/14/${tile}.geojson.gz`)).toString());
 const c=buildFeatureChunk(raw.features,'photo','coarse');
 assert.deepEqual(auditChunk(c),[],`${tile}: reported wall/roof overlaps are gone`);
}
// Named regression, issue #123 (user report 2026-10-30, "texture fighting" on Oosterdokseiland by Oosterdokskade):
// OSM building:parts whose same-facing walls run 5 mm to 0.2 m apart over shared heights. Before the
// near-coplanar rule tile 8415/5383 had 76 such pairs (110 buildings, 3,679 m2 of striping wall).
{const raw=JSON.parse(gunzipSync(readFileSync('public/data/extracts/amsterdam/building-tiles/14/8415/5383.geojson.gz')).toString());
 const pinned=[['w1486076093','w1486076105'],['w1487642114','w1487642117'],['NL.IMBAG.Pand.0363100012251108','w1204842025']];
 const ids=new Set(pinned.flat());assert.equal(raw.features.filter((f:any)=>ids.has(f.properties.id)).length,ids.size,'pinned Oosterdok pands still in the tile');
 const hits=auditNearCoplanar(buildFeatureChunk(dropNestedDuplicates(raw.features),'photo','coarse'));
 for(const pair of pinned)assert.ok(!hits.some(h=>h.ids.join('|')===[...pair].sort().join('|')),`Oosterdok ${pair.join(' / ')}: near-coplanar walls still stripe`);
 assert.deepEqual(hits.map(h=>h.ids.join('|')),[],'8415/5383: no near-coplanar same-facing walls left');}
console.log('coplanar surface checks: passed');
