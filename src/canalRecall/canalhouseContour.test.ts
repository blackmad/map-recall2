import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compactContour} from './canalhouseContour.ts';
test('coarse envelope sampling compacts without changing boundary area or genuine turns',()=>{
 const original:[number,number][]=[[0,0],[1,1],[2,2],[3,2],[4,2],[4,1],[4,0],[0,0]];
 const compact=compactContour(original);
 assert.deepEqual(compact,[[0,0],[2,2],[4,2],[4,0]]);
 const area=(p:[number,number][])=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;
 assert.equal(area(compact),area(original));
 assert.deepEqual(compactContour([[0,0],[1,0],[1,1],[2,1],[2,0]]),[[0,0],[1,0],[1,1],[2,1],[2,0]]);
});
