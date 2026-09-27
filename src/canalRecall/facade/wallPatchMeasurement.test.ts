import assert from 'node:assert/strict';
import {measureWallPatch} from './wallPatchMeasurement.ts';
// White joinery and blue glazing must not leak into the lower-left brick patch.
const image={width:3,height:2,data:new Uint8Array([255,255,255, 255,255,255, 0,80,200, 100,50,30, 120,60,40, 0,80,200])};
const patch=measureWallPatch(image,[0,1,2,2],{wall:new Uint8Array([0,0,0,1,1,0])});
assert.deepEqual(patch.medianRGB,[110,55,35]);assert.equal(patch.pixels,2);assert.equal(patch.maskCoverage.wall,1);
const glass=measureWallPatch(image,[2,0,3,2],{wall:new Uint8Array([0,0,1,1,1,0])});
assert.equal(glass.maskCoverage.wall,.5);assert.deepEqual(glass.medianRGB,[0,80,200]);
assert.throws(()=>measureWallPatch(image,[-1,0,2,1]),/outside/);
assert.throws(()=>measureWallPatch(image,[0,0,0,1]),/empty/);
assert.throws(()=>measureWallPatch(image,[0,0,1,1],{bad:[1]}),/dimensions/);
assert.throws(()=>measureWallPatch({...image,data:[1,2,3]},[0,0,1,1]),/RGB/);
console.log('wall patch: source-coordinate isolation, leakage and invalid-input checks pass');
