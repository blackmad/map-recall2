import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CanalhousePreviewModelCache} from './canalhousePreviewModelCache.ts';
test('a selected row shares in-flight models and does not request unrelated houses',async()=>{
 const calls:string[]=[];
 const cache=new CanalhousePreviewModelCache(async(id:string)=>{calls.push(id);return {id};});
 const first=cache.get('495'),second=cache.get('495');
 assert.equal(first,second);
 await Promise.all([first,second,cache.get('497'),cache.get('499')]);
 await cache.get('497');
 assert.deepEqual(calls,['495','497','499']);
});
test('a failed model can be retried without discarding already loaded neighbors',async()=>{
 let attempts=0;
 const cache=new CanalhousePreviewModelCache(async(id:string)=>{
  if(id==='495'&&++attempts===1)throw Error('temporary load failure');
  return {id};
 });
 const neighbor=await cache.get('497');
 await assert.rejects(cache.get('495'),/temporary load failure/);
 assert.deepEqual(await cache.get('495'),{id:'495'});
 assert.equal(await cache.get('497'),neighbor);
 assert.equal(attempts,2);
});
