import assert from 'node:assert/strict';
import fs from 'node:fs';
import { footprintOcclusion, type FootprintPolygons } from './da-costa-block/neighbourhood-core.ts';
import { lngLatToRd } from '../src/canalRecall/facade/rdNew.ts';

const square=[[[[0,0],[10,0],[10,10],[0,10],[0,0]]]];
const blocked=(a:number[],b:number[],p:FootprintPolygons=square)=>footprintOcclusion(a,b,p).blocked;
assert.equal(blocked([-5,5],[0,5]),false,'target wall at endpoint is visible');
assert.equal(blocked([-5,5],[10,5]),true,'far face is hidden by same building');
assert.equal(blocked([-5,0],[15,0]),false,'boundary tangency is not solid traversal');
assert.equal(blocked([-1,1],[1,-1]),false,'single vertex touch is not occlusion');
assert.equal(blocked([-5,-5],[15,15]),true,'through vertices still crosses interior');
assert.equal(blocked([-5,5],[.1,5]),false,'endpoint tolerance permits survey noise');
assert.equal(blocked([-5,5],[.4,5]),true,'endpoint tolerance cannot hide material traversal');
assert.equal(blocked([5,5],[-5,5]),true,'camera inside building is flagged');
assert.equal(blocked([0,0],[.05,.05]),false,'degenerate near-endpoint segment is safe');
const courtyard=[[[[0,0],[10,0],[10,10],[0,10]],[[3,3],[7,3],[7,7],[3,7]]]];
assert.equal(blocked([5,5],[7,5],courtyard),false,'courtyard inner wall is visible from courtyard');
assert.equal(blocked([5,5],[10,5],courtyard),true,'courtyard ray crosses solid wing');
assert.equal(blocked([3.5,5],[6.5,5],courtyard),false,'ray entirely inside hole stays clear');
const concave=[[[[0,0],[10,0],[10,10],[7,10],[7,3],[3,3],[3,10],[0,10]]]];
assert.equal(blocked([-2,7],[7,7],concave),true,'near wing hides recessed wall');
assert.equal(blocked([5,12],[5,3],concave),false,'open courtyard approach is clear');
assert.equal(blocked([-5,5],[15,5],[...square,[[[20,0],[30,0],[30,10],[20,10]]]]),true,'multipolygon handles either solid');
assert.equal(blocked([-5,5],[15,5],[...square,[[[0,5],[10,5],[10,15],[0,15]]]]),true,'boundary of overlapping component must not hide other solid interior');

const manifestPath='.cache/da-costa-neighbourhood/manifest.json';
if(fs.existsSync(manifestPath)){
  const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const r=m.records.find((r:any)=>r.id==='0363100012237064_e_0tvudm4');
  const bag=JSON.parse(fs.readFileSync('.cache/da-costa-block/bag.json','utf8')).find((b:any)=>b.properties.identificatie===r.buildingId);
  const p=bag.geometry.coordinates.map((ring:any)=>ring.map((p:any)=>{const q=lngLatToRd(p);return [q.x-m.origin.x,m.origin.y-q.y];}));
  // Pin the original bad source camera: the active record may later be repaired.
  const originalPose={x:120000.71294271704,y:487376.54929592024};
  const from=[originalPose.x-m.origin.x,m.origin.y-originalPose.y];
  const result=footprintOcclusion(from,r.mid,[p]);
  assert.equal(result.blocked,true,'Amsta entrance strip cannot validate hidden target edge');
  assert.ok(result.firstInteriorM!<12&&result.interiorM>15,'Amsta has substantial nearer same-building obstruction');
  console.log('Amsta regression',result);
}
console.log('Visibility checks passed: endpoints, concavity, holes, tangency, vertices, multipolygons and Amsta.');
