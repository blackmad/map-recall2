import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aerialRoofRequest} from './aerial-roof-request.ts';
const owner=(x:number,y:number)=>[[[[x,y],[x+5,y],[x+5,y+15],[x,y+15]]]];
test('aerial request uses explicit dated layer and one RD context for adjacent owners',()=>{
 const r=aerialRoofRequest([owner(120400,487500),owner(120405,487500)],2023,4);
 assert.deepEqual(r.bbox,[120396,487496,120414,487519]);assert.equal(r.width,225);assert.equal(r.height,288);
 const u=new URL(r.url);assert.equal(u.searchParams.get('crs'),'EPSG:28992');assert.equal(u.searchParams.get('layers'),'2023_orthoHR');
});
test('aerial request refuses geographic-coordinate confusion and unbounded collection downloads',()=>{
 assert.throws(()=>aerialRoofRequest([owner(4.8,52.3)],2023),/EPSG28992/);
 assert.throws(()=>aerialRoofRequest([owner(120000,487500),owner(121000,487500)],2023),/bounded/);
 assert.throws(()=>aerialRoofRequest([],2023),/polygons/);
 assert.throws(()=>aerialRoofRequest([owner(120000,487500)],2023,20),/padding/);
});
