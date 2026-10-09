import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {archiveHttpSource} from './source-fetch.ts';
test('failed HTTP source remains archived and is retried before any cache reuse',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'canalhouse-source-fetch-'));let calls=0;
 const fetcher=(async()=>{calls++;return calls===1?new Response('temporarily unavailable',{status:503}):new Response('{"source":true}',{status:200});}) as typeof fetch;
 try{
  await assert.rejects(archiveHttpSource(root,'https://example.test/source',{fetcher}),/HTTP 503/);
  const result=await archiveHttpSource(root,'https://example.test/source',{fetcher});
  assert.equal(result.bytes.toString(),'{"source":true}');assert.equal(calls,2);
  assert.equal((await archiveHttpSource(root,'https://example.test/source',{fetcher})).cached,true);assert.equal(calls,2);
  const records=await Promise.all((await fs.readdir(path.join(root,'attempts'))).map(f=>fs.readFile(path.join(root,'attempts',f),'utf8').then(JSON.parse)));
  const failed=records.find(r=>r.status===503);assert(failed);
  assert.equal(await fs.readFile(path.join(root,failed.rawPath),'utf8'),'temporarily unavailable');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('corrupted cached bytes cannot become an admitted original source',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'canalhouse-source-fetch-'));let calls=0;
 const fetcher=(async()=>{calls++;return new Response('original source',{status:200});}) as typeof fetch;
 try{
  const first=await archiveHttpSource(root,'https://example.test/source',{fetcher});
  await fs.writeFile(path.join(root,first.meta.rawPath!),'corrupted');
  const next=await archiveHttpSource(root,'https://example.test/source',{fetcher});
  assert.equal(calls,2);assert.equal(next.cached,false);assert.equal(next.bytes.toString(),'original source');assert.notEqual(next.meta.rawPath,first.meta.rawPath);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
