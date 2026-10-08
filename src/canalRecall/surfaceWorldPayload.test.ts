import test from 'node:test';import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';import {decodeSurfacePayload} from './surfaceWorldBrowser.ts';
test('surface payload handles both raw gzip delivery and browser HTTP decompression',async()=>{
 const input=new Float32Array([0,8192,13.25,-.4,3000,9]).buffer;
 const compressed=Uint8Array.from(gzipSync(Buffer.from(input))).buffer;
 assert.deepEqual(new Uint8Array(await decodeSurfacePayload(compressed)),new Uint8Array(input));
 assert.equal(await decodeSurfacePayload(input),input);
});
