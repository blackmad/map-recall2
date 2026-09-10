import assert from 'node:assert/strict';
import { roofGeometry } from './da-costa-block/roof-geometry.mjs';
const b=(rings)=>({surfaces:rings.map(r=>({type:'roof',rings:[r]}))});
assert.equal(roofGeometry(b([[[0,10,0],[10,10,0],[10,10,10],[0,10,10]]])).shape,'flat');
assert.equal(roofGeometry(b([[[0,5,0],[10,5,0],[10,10,5],[0,10,5]],[[0,10,5],[10,10,5],[10,5,10],[0,5,10]]])).shape,'pitched-gable');
assert.equal(roofGeometry(b([])).shape,'unknown');
assert.equal(roofGeometry(b([[[0,5,0],[10,5,0],[5,10,5]],[[10,5,0],[10,5,10],[5,10,5]],[[10,5,10],[0,5,10],[5,10,5]],[[0,5,10],[0,5,0],[5,10,5]]])).shape,'hipped-or-complex');
console.log('Roof geometry: flat, opposing pitches, four hip planes and missing mesh passed.');
