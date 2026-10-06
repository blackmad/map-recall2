import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChunkBuildQueue} from './chunkBuildQueue.js';

test('tile bursts retain only the latest inputs and keep other chunks in order',()=>{
 const queue=new ChunkBuildQueue(),drawn:string[]=[];
 queue.push('coarse',()=>drawn.push('old'));
 queue.push('near',()=>drawn.push('near'));
 for(let n=0;n<20;n++)queue.push('coarse',()=>drawn.push(`latest-${n}`));
 assert.equal(queue.length,2);
 while(queue.length)queue.shift()!();
 assert.deepEqual(drawn,['latest-19','near']);
 queue.push('obsolete-look',()=>drawn.push('wrong look'));queue.clear();
 assert.equal(queue.shift(),undefined);
});
