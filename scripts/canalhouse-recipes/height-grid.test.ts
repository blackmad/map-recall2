import {test} from 'node:test';import assert from 'node:assert/strict';
import {heightGridSamples,type HeightGrid} from './height-grid.ts';
test('height evidence uses northern pixel centers, rejects nodata and never substitutes neighbor samples for a narrow roof',()=>{
 const grid:HeightGrid={width:2,height:2,origin:[120000,487500],step:[.5,.5],epsg:28992,noData:3.4e38,values:new Float32Array([17,3.4e38,4,NaN])};
 const samples=heightGridSamples(grid,[[120000,487500],[120001,487500],[120001,487499],[120000,487499]]);
 assert.deepEqual(samples[0].rd,[120000.25,487499.75]);assert.equal(samples[0].heightNapM,17);assert.equal(samples.filter(s=>s.valid).length,2);
 assert.equal(samples[1].heightNapM,null);assert.equal(samples[3].heightNapM,null);
 assert.equal(heightGridSamples(grid,[[120000.01,487500],[120000.1,487500],[120000.1,487499],[120000.01,487499]]).length,0);
 assert.equal(heightGridSamples(grid,[[120000,487500],[120001,487500],[120001,487499],[120000,487499]],undefined,[[[120000,487500],[120000.5,487500],[120000.5,487499.5],[120000,487499.5]]]).length,3);
});
