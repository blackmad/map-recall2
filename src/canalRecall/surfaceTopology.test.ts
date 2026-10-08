import test from 'node:test';import assert from 'node:assert/strict';import {clipLandTriangles} from './surfaceTopology.ts';
test('native terrain preserves a real canal opening while clipping to child tiles',()=>{
 const e=8192;
 // Two strips of land, separated by a wide mapped canal.
 const land=new Float32Array([0,0,3000,0,3000,e,0,0,3000,e,0,e,5000,0,e,0,e,e,5000,0,e,e,5000,e]);
 const result=clipLandTriangles(land,8417,5387,14,8417,5387);
 assert.equal(result.indices.length,12);
 for(let i=0;i<result.indices.length;i+=3){const x=[0,1,2].map(k=>result.vertices[result.indices[i+k]*3]);assert.ok(Math.max(...x)<=3000||Math.min(...x)>=5000);}
 const child=clipLandTriangles(land,8417,5387,15,16834,10774);
 assert.ok(child.indices.length>0);assert.ok([...child.vertices].every(v=>v>=0&&v<=e));
});
test('all-water tiles have no ground triangles and tile-edge slivers are discarded',()=>{
 const result=clipLandTriangles(new Float32Array(),0,0,14,0,0);assert.equal(result.indices.length,0);
 const outside=clipLandTriangles(new Float32Array([-10,0,0,0,0,8192]),0,0,14,0,0);assert.equal(outside.indices.length,0);
});
