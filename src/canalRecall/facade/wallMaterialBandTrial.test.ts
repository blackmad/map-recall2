import assert from 'node:assert/strict';
import {resolveWallBandTrial,WALL_BAND_TRIAL} from './wallMaterialBandTrial.ts';
assert.equal(resolveWallBandTrial([],false),null);
const trial=resolveWallBandTrial([WALL_BAND_TRIAL],true)!;
assert.ok(trial.heightM>2.85&&trial.heightM<3.0);
assert.throws(()=>resolveWallBandTrial([{...WALL_BAND_TRIAL,sourceSha256:'stale'}],true),/binding/);
assert.throws(()=>resolveWallBandTrial([{...WALL_BAND_TRIAL,geometryRevision:'changed'}],true),/binding/);
console.log('source-band trial: opt-in, source/geometry binding and approximate datum checks pass');
