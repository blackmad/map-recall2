import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleEquirectangular} from '../../src/canalRecall/facade/rectify.ts';
const image={width:2,height:2,data:new Uint8Array([0,20,40,255,100,120,140,255,200,180,160,255,240,220,200,255])};
test('subpixel sampling interpolates the four colors rather than choosing one pixel',()=>{
 const rgb:number[]=[];sampleEquirectangular(image,.5,.5,rgb);assert.deepEqual(rgb,[135,135,135]);
});
test('panorama seam wraps while samples beyond either pole clamp to the edge row',()=>{
 const rgb:number[]=[];sampleEquirectangular(image,1.5,0,rgb);assert.deepEqual(rgb,[50,70,90]);
 sampleEquirectangular(image,-.5,0,rgb);assert.deepEqual(rgb,[50,70,90]);
 sampleEquirectangular(image,.5,-1,rgb);assert.deepEqual(rgb,[50,70,90]);
 sampleEquirectangular(image,.5,2,rgb);assert.deepEqual(rgb,[220,200,180]);
});
