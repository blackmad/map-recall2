import assert from 'node:assert/strict';
import test from 'node:test';
import {runBoundedPaidWorkers} from './bounded-paid-workers.mjs';

test('an interrupted request stops launches and drains already-started settlements',async()=>{
  const started=[],settled=[],cache=new Map;
  await assert.rejects(runBoundedPaidWorkers(['saved-a','interrupted','saved-b','must-not-start'],{concurrency:3,handle:async item=>{
    started.push(item);cache.set(item,{status:'requesting'});
    if(item==='interrupted'){
      await new Promise(resolve=>setTimeout(resolve,5));cache.set(item,{status:'charge-unresolved',neverRetry:true});throw Error('unknown charge');
    }
    await new Promise(resolve=>setTimeout(resolve,20));cache.set(item,{status:'complete',settled:true});settled.push(item);
  }}),/unknown charge/);
  assert.deepEqual(new Set(started),new Set(['saved-a','interrupted','saved-b']));
  assert.deepEqual(new Set(settled),new Set(['saved-a','saved-b']));
  assert.equal(cache.get('interrupted').neverRetry,true);
  assert.equal(cache.has('must-not-start'),false);
  const retryable=['saved-a','interrupted','saved-b','must-not-start'].filter(item=>!cache.has(item));
  assert.deepEqual(retryable,['must-not-start'],'settled and unresolved keys are not resent after resume');
});
