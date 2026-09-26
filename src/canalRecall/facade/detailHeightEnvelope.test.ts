import assert from 'node:assert/strict';
import {detailsWithinRenderedMass} from './detailHeightEnvelope.ts';

const triangle=(top:number)=>[0,top,0,1,top,0,0,top-.2,0];
const patches=[
  {featureId:'upper-window',triangles:triangle(5.8)},
  {featureId:'upper-window',triangles:triangle(6.3)},
  {featureId:'lower-window',triangles:triangle(5.7)},
  {featureId:'physical-sign',triangles:triangle(8),sign:{source:'observed'}},
];
// Legacy source Y is NAP minus .65 m. Ground NAP .26 makes source Y 5.7
// render at 6.09 m; a 6 m mass allows only .25 m of numeric tolerance.
const result=detailsWithinRenderedMass(patches,6,'legacy-block-NAP-minus-0.65m',.26);
assert.deepEqual(result.patches.map(patch=>patch.featureId),['lower-window','physical-sign']);
assert.deepEqual(result.withheld.map(item=>item.featureId),['upper-window']);
assert(result.withheld.every(item=>item.reason==='above-rendered-mass'));
const valid=detailsWithinRenderedMass([{featureId:'lower',triangles:triangle(5.8)}],6,'legacy-block-NAP-minus-0.65m',.65);
assert.equal(valid.patches.length,1,'detail below the rendered mass remains');
const invalid=detailsWithinRenderedMass([{featureId:'bad',triangles:[0,NaN,0,1,0,0,0,0,0]}],6,'NAP',0);
assert.equal(invalid.patches.length,0);assert.equal(invalid.withheld[0].reason,'invalid-height');
console.log('Contextual detail height envelope: whole opening withheld; lower detail retained');
