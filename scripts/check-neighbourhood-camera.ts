import assert from 'node:assert/strict';
import { AMSTERDAM_WORLD_ALIGNED, worldToEquirectangularPixel, rectifyFacade } from '../src/canalRecall/facade/rectify.ts';
import { lensFor } from './da-costa-block/neighbourhood-core.ts';
const image={width:80,height:40,data:Uint8ClampedArray.from({length:80*40*4},(_,i)=>i%251)};
const pose={x:0,y:0,z:2,headingDeg:0,pitchDeg:0,rollDeg:0};
const turned={...pose,headingDeg:137,pitchDeg:7,rollDeg:-11};
for(const p of [{x:4,y:9,z:4},{x:-8,y:-2,z:13}]){
  assert.deepEqual(worldToEquirectangularPixel(p,pose,image,AMSTERDAM_WORLD_ALIGNED),worldToEquirectangularPixel(p,turned,image,AMSTERDAM_WORLD_ALIGNED));
  assert.notDeepEqual(worldToEquirectangularPixel(p,pose,image,'centre'),worldToEquirectangularPixel(p,turned,image,'centre'));
}
const plane={start:{x:-3,y:8},end:{x:3,y:8},baseZ:0,topZ:12};
assert.deepEqual(rectifyFacade(image,pose,plane,{camera:AMSTERDAM_WORLD_ALIGNED}).data,rectifyFacade(image,turned,plane,{camera:AMSTERDAM_WORLD_ALIGNED}).data);
const p=(height:number)=>({geometry:{coordinates:[4.87,52.37,height]},heading:0,pitch:0,roll:0});
assert.equal(lensFor(p(0),.7)?.pose.z,3.1399999999999997);
assert.equal(lensFor(p(0),.7)?.inferred,true);
assert.equal(lensFor(p(106),.7)?.inferred,true);
assert.equal(lensFor(p(46),.7)?.inferred,false);
assert.equal(lensFor(p(0),undefined),null);
console.log('World-aligned projection, attitude invariance, crop consistency and missing/corrupt height checks passed.');
