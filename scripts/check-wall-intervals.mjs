import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { ShapeUtils,Vector2 } from 'three';
import { wallObservationIntervals,clipWallTriangles,intervalFaceFrame } from '../public/canal-drive/da-costa-block/wall-intervals.js';
const surface={type:'wall',rings:[[[0,0,0],[10,0,0],[10,10,0],[0,10,0]]]};
const make=(id,start,end,extra={})=>({id,buildingId:'b',renderBuildingId:'b',renderSurfaceIndices:[0],localStart:[start,0],localEnd:[end,0],effectiveProposal:{wholeUsable:'yes',wallColour:id==='left'?'red':'grey'},...extra});
const records=[make('left',0,4),make('right',6,10)];
const partition=rs=>wallObservationIntervals(surface,0,'b',rs);
assert.deepEqual(partition(records).intervals.map(i=>[i.startM,i.endM,i.observation?.id||null]),[[0,4,'left'],[4,6,null],[6,10,'right']]);
assert.deepEqual(partition(records.toReversed()),partition(records),'order cannot change ownership');
const ownership=p=>p.intervals.map(i=>[i.startM,i.endM,i.observation?.id,i.status]);
assert.deepEqual(ownership(partition([make('left',4,0),make('right',10,6)])),ownership(partition(records)),'endpoint direction cannot change ownership');
assert.equal(partition([make('a',0,8),make('b',2,10)]).intervals[1].status,'conflict');
assert.equal(partition([make('a',0,8,{review:{placement:'accepted'}}),make('b',2,10)]).intervals[1].observation.id,'a');
assert.equal(partition([make('a',0,8,{review:{placement:'accepted'}}),make('b',2,10,{review:{placement:'accepted'}})]).intervals[1].status,'conflict');
for(const placement of ['crop-repair','uncertain','rejected'])assert.equal(partition([make('a',0,10,{review:{placement}})]).intervals[0].status,'uncovered');
const target=make('target',6,10,{effectiveProposal:null});
assert.equal(partition([make('moved',0,4,{review:{placement:'accepted',targetId:'target'}}),target]).intervals[1].observation.id,'moved');
assert.equal(partition([make('moved',0,4,{review:{placement:'accepted',targetId:'missing'}})]).intervals[0].status,'uncovered');
assert.equal(partition([make('invalid',0,4,{localStart:[NaN,0]})]).intervals[0].status,'uncovered');
const area=ts=>{let sum=0;for(let i=0;i<ts.length;i+=9){const a=ts.slice(i,i+3),u=ts.slice(i+3,i+6).map((v,j)=>v-a[j]),v=ts.slice(i+6,i+9).map((v,j)=>v-a[j]);sum+=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;}return sum;};
function triangles(rings){const flat=rings.flat();return ShapeUtils.triangulateShape(rings[0].map(p=>new Vector2(p[0],p[1])),rings.slice(1).map(r=>r.map(p=>new Vector2(p[0],p[1])))).flatMap(t=>t.flatMap(i=>flat[i]));}
for(const rings of [surface.rings,[...surface.rings,[[3,3,0],[7,3,0],[7,7,0],[3,7,0]]],[[[0,0,0],[10,0,0],[10,4,0],[5,4,0],[5,10,0],[0,10,0]]]]){
  const ts=triangles(rings),p=partition(records),parts=p.intervals.map(i=>clipWallTriangles(ts,p.axis,i.startM,i.endM));
  assert.ok(Math.abs(parts.reduce((n,t)=>n+area(t),0)-area(ts))<1e-8,'triangulated holes/concavities preserve area');
  for(let n=0;n<parts.length;n++)for(let j=0;j<parts[n].length;j+=3)assert.ok(parts[n][j]>=p.intervals[n].startM-1e-8&&parts[n][j]<=p.intervals[n].endM+1e-8);
}
const p=partition(records),f=intervalFaceFrame({a:[10,0],u:[-1,0],width:10,polygon:[[0,0],[10,0],[10,10],[0,10]]},p.axis,p.intervals[0]);
assert.deepEqual(f.a,[4,0]);assert.equal(f.width,4);assert.equal(f.observation.id,'left');
const block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
const neighbourhood=JSON.parse(await fs.readFile('public/data/da-costa-block/neighbourhood.json'));
const amsta=block.buildings.find(b=>b.id==='0363100012237064');
const actual=wallObservationIntervals(amsta.surfaces[46],46,amsta.id,neighbourhood.records);
assert.deepEqual(actual.intervals.filter(i=>i.observation).map(i=>i.observation.id).sort(),['0363100012237064_e_0aws3g3','0363100012237064_e_1hyy18v'].sort());
assert.ok(actual.intervals.some(i=>i.status==='uncovered'&&i.endM-i.startM<.001),'preserve measured sub-millimetre gap');
const byId=new Set(block.buildings.flatMap(b=>b.surfaces.flatMap((s,i)=>s.type==='wall'?wallObservationIntervals(s,i,b.id,neighbourhood.records).intervals.map(p=>p.observation?.id).filter(Boolean):[])));
assert.equal(byId.size,101,'two unusable crops remain withheld; broad Amsta no longer disappears');
console.log('Passed wall intervals: 101 represented frontages, Amsta split/gap, order independence, local human precedence, conflicts, reassignment, holes, concavity and area conservation.');
