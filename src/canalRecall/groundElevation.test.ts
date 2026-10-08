import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeTerrainRGB,elevationTile,sampleElevationPixels,footprintGround,groundVehiclePose} from './groundElevation.ts';
function fixture(height:number,quality=255) {
 const code=Math.round((height+10000)*10),rgb=new Uint8ClampedArray(256*256*4),q=new Uint8ClampedArray(rgb.length);
 for(let i=0;i<rgb.length;i+=4){rgb.set([code>>16,(code>>8)&255,code&255,255],i);q.set([quality,quality,quality,255],i);}
 return {rgb,quality:q};
}
test('TerrainRGB preserves negative NAP and real zero',()=>{assert.equal(decodeTerrainRGB(1,134,160),0);const p=sampleElevationPixels(fixture(-3.2),128,128);assert.ok(Math.abs(p.heightM+3.2)<1e-8);assert.equal(p.quality,'measured');assert.equal(sampleElevationPixels(fixture(0),1,1).ready,true);});
test('bridge deck pixels remain a driving surface when detailed meshes are absent',()=>{const value=sampleElevationPixels(fixture(3.2,253),128,128);assert.equal(value.quality,'bridge');assert.ok(Math.abs(value.heightM-3.2)<1e-8);const belowZero=sampleElevationPixels(fixture(-.6,253),128,128);assert.ok(Math.abs(belowZero.heightM+.6)<1e-8);});
test('water and unknown are distinct; ground interpolation excludes water donors',()=>{const tile=fixture(2);tile.quality.fill(254*1, (128*256+128)*4,(128*256+128)*4+3);assert.equal(sampleElevationPixels(tile,128.5,128.5).quality,'water');assert.equal(sampleElevationPixels(tile,128.5,128.5).heightM,0);assert.equal(sampleElevationPixels(fixture(0,0),4,4).quality,'unknown');const at=sampleElevationPixels(tile,128.25,127.75);assert.ok(Math.abs(at.heightM-2)<1e-8);});
test('Amsterdam pixel addressing stays continuous across a slippy boundary',()=>{const a=elevationTile(4.89,52.38);assert.equal(a.x,33658);assert.ok(a.y>20000&&a.y<22000);const boundary=(a.x+1)/65536*360-180;assert.equal(elevationTile(boundary-1e-8,52.38).x,a.x);assert.equal(elevationTile(boundary+1e-8,52.38).x,a.x+1);});
test('footprint placement uses land perimeter samples and excludes courtyard and water',()=>{const geometry={type:'Polygon',coordinates:[[[0,0],[2,0],[2,2],[0,2],[0,0]],[[.5,.5],[1.5,.5],[1.5,1.5],[.5,.5]]]};assert.equal(footprintGround(geometry,p=>({heightM:p[0]===2?99:-2,quality:p[0]===2?'water':'measured',ready:true})),-2);});
test('vehicle pose rests both contacts on flat and sloped negative ground',()=>{assert.deepEqual(groundVehiclePose(()=>-3,[4.89,52.38],0,[-2,2]),{heightM:-3,pitch:0});const center:[number,number]=[4.89,52.38];const slope=(p:readonly[number,number])=>1+(p[0]-center[0])*111320*Math.cos(center[1]*Math.PI/180)*.1;const pose=groundVehiclePose(slope,center,0,[-2,2]);assert.ok(Math.abs(pose.pitch-Math.atan(.1))<.0001);assert.ok(Math.abs(pose.heightM-1)<.0001);});
