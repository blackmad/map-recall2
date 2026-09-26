import assert from 'node:assert/strict';
import {wallBayIntervals} from './da-costa-block/bay-geometry.ts';
for(const length of [31.799190311190518,68.7872853330476]){
  const bays=wallBayIntervals(length);
  assert.equal(bays[0].startM,0);assert.equal(bays.at(-1)!.endM,length);
  for(let i=0;i<bays.length;i++){
    assert.ok(bays[i].endM-bays[i].startM>=8&&bays[i].endM-bays[i].startM<=12);
    if(i)assert.equal(bays[i].startM,bays[i-1].endM);
  }
}
assert.throws(()=>wallBayIntervals(0));assert.throws(()=>wallBayIntervals(10,-1));
console.log('Bay intervals preserve parent-wall bounds, continuous coverage and 8–12m experimental widths.');
