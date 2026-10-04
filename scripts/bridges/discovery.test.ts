import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lngLatToRd, rdToLngLat } from '../../src/canalRecall/rdCoordinates.ts';
import { discoverBridges, type RegisterRow, type Road } from './discovery.ts';
const origin=lngLatToRd(4.885,52.375);
const ll=(x:number,y:number)=>rdToLngLat(origin[0]+x,origin[1]+y);
const row=(id='BRU9999',name='Test bridge'):RegisterRow=>[id,name,'Vaste brug','Staal',1900,'','',[[0,-2],[10,-2],[10,2],[0,2],[0,-2]].map(p=>ll(...p as [number,number]))];
const road=(id:string,points:number[][],name='Test bridge'):Road=>({id,name,highway:'residential',bridge:true,path:points.map(([x,y])=>{const p=ll(x,y);return[p[1],p[0]];})});

test('spatial matching rejects a namesake elsewhere and rejoins split bridge ways',()=>{
  const result=discoverBridges([row()],[road('remote',[[100,0],[110,0]]),road('left',[[0,0],[5,0]]),road('right',[[5,0],[10,0]])]);
  assert.equal(result.candidates.length,1);
  assert.deepEqual(result.candidates[0].roadIds.sort(),['left','right']);
  assert.equal(result.candidates[0].deck.length,3);
  const grouped=road('group',[[0,0],[5,0]]);grouped.paths=[grouped.path,road('other',[[5,0],[10,0]]).path];
  assert.equal(discoverBridges([row()],[grouped]).candidates[0].deck.length,3,'parts grouped under one routing ID still join');
});
test('unnamed bridges match by geography and duplicate area rings are excluded',()=>{
  const result=discoverBridges([row('BRU9999','')],[road('lane',[[0,0],[10,0]],''),road('area',[[0,0],[10,0],[10,1],[0,0]],'')]);
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].match,'footprint-and-alignment');
  assert.deepEqual(result.candidates[0].roadIds,['lane']);
});
test('missing identities, absent alignments and conflicting crossing directions remain reviewable',()=>{
  assert.equal(discoverBridges([row('')],[road('lane',[[0,0],[10,0]])]).entries[0].status,'review');
  assert.equal(discoverBridges([row()],[]).entries[0].status,'unmatched');
  const result=discoverBridges([row()],[road('east',[[0,0],[10,0]]),road('north',[[5,-6],[5,6]])]);
  // A shorter transverse path is correctly outranked by the full crossing.
  assert.equal(result.candidates.length,1);
  const square=row();square[7]=[[0,0],[10,0],[10,10],[0,10],[0,0]].map(p=>ll(...p as [number,number]));
  assert.equal(discoverBridges([square],[road('east',[[0,5],[10,5]]),road('north',[[5,0],[5,10]])]).entries[0].status,'review');
});

test('catalogue centrelines recover bridges omitted from cycling routing',()=>{
  const catalog=road('footbridge',[[0,0],[10,0]]);catalog.highway='footway';
  const result=discoverBridges([row()],[],'canal-belt',[catalog]);
  assert.equal(result.candidates[0].match,'catalogue-footprint-and-alignment');
  assert.equal(result.candidates[0].road.source,'bridge-catalogue');
});

test('unflagged roads require a canal crossing inside the footprint',()=>{
  const crossing=road('untagged',[[-200,0],[200,0]]);crossing.bridge=false;
  const water=road('water',[[5,-20],[5,20]]).path;
  assert.equal(discoverBridges([row()],[crossing]).candidates.length,0);
  const result=discoverBridges([row()],[crossing],'canal-belt',[],[water]);
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].match,'footprint-and-water-crossing');
  const deck=result.candidates[0].deck;
  assert.ok(Math.abs(Math.hypot(deck[1][0]-deck[0][0],deck[1][1]-deck[0][1])-10)<.01,'clip long roads to the surveyed crossing');
  const elsewhere=road('water',[[50,-20],[50,20]]).path;
  assert.equal(discoverBridges([row()],[crossing],'canal-belt',[],[elsewhere]).candidates.length,0);
});
