// node --import tsx --test src/canalRecall/look/lookAtlas.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { loadLookAtlas, lookAtlasArraysOf, lookAtlasByteLength, lookAtlasBytesOf, lookAtlasEnabled, lookAtlasFile, lookAtlasStamp } from './lookAtlas.ts';

const atlasBytes = (size: number, total: number) => Uint8Array.from({ length: lookAtlasByteLength(size, total) }, (_, i) => (i * 7 + 3) & 255);

test('a file is the colour bytes then the mask bytes, split and joined without loss', () => {
  const bytes = atlasBytes(4, 3), atlas = lookAtlasArraysOf(bytes, 4, 2, 3)!;
  assert.equal(atlas.colour.byteLength, 4 * 4 * 4 * 3);
  assert.equal(atlas.mask.byteLength, 4 * 4 * 2 * 3);
  assert.equal(atlas.layers, 2);
  assert.deepEqual(lookAtlasBytesOf(atlas), bytes);
  assert.equal(lookAtlasArraysOf(bytes.subarray(1), 4, 2, 3), null, 'a short file is refused');
  assert.equal(lookAtlasFile('photo', 256, true), 'photo-256-slots.bin.gz');
  assert.equal(lookAtlasFile('cartoon', 128, false), 'cartoon-128.bin.gz');
});

test('the shipped extract is opt-in; the stored copy follows the deploy stamp and skips local servers', () => {
  assert.equal(lookAtlasEnabled(''), false);
  assert.equal(lookAtlasEnabled('?lookAtlas=extract'), true);
  assert.equal(lookAtlasEnabled('?lookAtlas=paint'), false);
  assert.equal(lookAtlasStamp('https://rideamsterdam.example/canal-drive/js/three-buildings.bundle.js?v=3f9a12', ''), '3f9a12');
  assert.equal(lookAtlasStamp('https://rideamsterdam.example/canal-drive/js/three-buildings.bundle.js', ''), null, 'no stamp, no key');
  assert.equal(lookAtlasStamp('http://127.0.0.1:4545/canal-drive/js/three-buildings.bundle.js?v=20261030-walls2', ''), null, 'local stamps do not track content');
  assert.equal(lookAtlasStamp('http://127.0.0.1:4545/canal-drive/js/three-buildings.bundle.js?v=20261030-walls2', '?lookAtlas=cache'), '20261030-walls2');
  assert.equal(lookAtlasStamp('https://rideamsterdam.example/canal-drive/js/three-buildings.bundle.js?v=3f9a12', '?lookAtlas=paint'), null);
  assert.equal(lookAtlasStamp(''), null);
});

test('loadLookAtlas inflates gzip, passes decoded bytes through and refuses anything not exact', async () => {
  const bytes = atlasBytes(4, 3);
  const g = globalThis as { __canalRecallLookAtlas?: unknown };
  const serve = (body: Uint8Array | null, status = 200) => (async () => new Response(body as BodyInit | null, { status })) as unknown as typeof fetch;
  assert.equal((await loadLookAtlas('x', 'photo', 4, false, 2, 3, serve(gzipSync(bytes)))).reason, 'disabled', 'off by default');
  g.__canalRecallLookAtlas = 'extract';
  try {
    const gz = await loadLookAtlas('x', 'photo', 4, false, 2, 3, serve(gzipSync(bytes)));
    assert.equal(gz.reason, 'loaded');
    assert.deepEqual(lookAtlasBytesOf(gz.atlas!), bytes);
    assert.equal((await loadLookAtlas('x', 'photo', 4, false, 2, 3, serve(bytes))).reason, 'loaded', 'a server that decoded the gzip');
    assert.equal((await loadLookAtlas('x', 'photo', 4, false, 2, 4, serve(gzipSync(bytes)))).reason, 'size', 'another layer count');
    assert.equal((await loadLookAtlas('x', 'photo', 4, false, 2, 3, serve(new TextEncoder().encode('<!doctype html>')))).reason, 'size', 'an SPA fallback page');
    assert.equal((await loadLookAtlas('x', 'photo', 4, false, 2, 3, serve(null, 404))).reason, 'missing');
    assert.equal((await loadLookAtlas('x', 'photo', 4, false, 2, 3, (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).reason, 'error');
  } finally { delete g.__canalRecallLookAtlas; }
});
