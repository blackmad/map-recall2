import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ShareHost, shareClient, groundShareFlag, groundShareMainFlag, groundShareMB, type SharePort, type ShareReply } from './groundShare.js';

const enc = (s: string) => new TextEncoder().encode(s);
const tick = () => new Promise(r => setTimeout(r, 0));

function host(cap = 1024) {
  const calls: string[] = [];
  const h = new ShareHost(async path => { calls.push(path); await tick(); if (path.startsWith('missing')) throw new Error(`${path}: 404`); return enc(`raw:${path}`); }, async raw => enc(new TextDecoder().decode(raw).replace('raw:', 'gz:')), cap);
  return { h, calls };
}

test('one fetch per path for requests in flight together and later; hits are counted', async () => {
  const { h, calls } = host();
  const [a, b] = await Promise.all([h.get('x'), h.get('x')]);
  const c = await h.get('x');
  assert.deepEqual(calls, ['x']);
  assert.equal(new TextDecoder().decode(a.bytes), 'gz:x');
  assert.deepEqual([a.hit, b.hit, c.hit], [false, true, true]);
  assert.deepEqual(h.stats, { requests: 3, hits: 2, fetches: 1, errors: 0, hitBytes: 8, cachedBytes: 4, evicted: 0 });
});

test('a failed fetch is not cached: every waiter sees the error and the next request fetches again', async () => {
  const { h, calls } = host();
  const r = await Promise.allSettled([h.get('missing/a'), h.get('missing/a')]);
  assert.deepEqual(r.map(x => x.status), ['rejected', 'rejected']);
  assert.equal((r[0] as PromiseRejectedResult).reason.message, 'missing/a: 404');
  await assert.rejects(h.get('missing/a'));
  assert.equal(calls.length, 2);
});

test('the LRU drops the least recently used file over the cap', async () => {
  const { h, calls } = host(8); // two 4-byte files
  await h.get('a'); await h.get('b'); await h.get('a'); await h.get('c');
  assert.equal(h.stats.evicted, 1);
  await h.get('a'); // kept (used after b)
  await h.get('b'); // evicted: fetched again
  assert.deepEqual(calls, ['a', 'b', 'c', 'b']);
});

test('the client and answer() round-trip bytes, hits and errors over a port pair', async () => {
  const { h } = host();
  const toHost: SharePort = { onmessage: null, postMessage: m => h.answer(m as never, (reply: ShareReply) => setTimeout(() => toWorker.onmessage?.({ data: reply }), 0)) };
  const toWorker: SharePort = { onmessage: null, postMessage: () => {} };
  // The client listens on its end (toWorker) and posts to the host (toHost).
  const port: SharePort = { get onmessage() { return toWorker.onmessage; }, set onmessage(f) { toWorker.onmessage = f; }, postMessage: m => toHost.postMessage(m) };
  const get = shareClient(port);
  const [x1, x2] = await Promise.all([get('x'), get('x')]);
  assert.equal(new TextDecoder().decode(x1.bytes), 'gz:x');
  assert.deepEqual([x1.hit, x2.hit], [false, true]);
  assert.notEqual(x1.bytes.buffer, x2.bytes.buffer, 'each requester gets its own copy');
  await assert.rejects(get('missing/b'), /missing\/b: 404/);
});

test('flags: groundShare off unless =1, groundShareMB bounded', () => {
  assert.equal(groundShareFlag(''), false);
  assert.equal(groundShareFlag('?groundShare=0'), false);
  assert.equal(groundShareFlag('?groundShare=1'), true);
  assert.equal(groundShareMainFlag(''), true);
  assert.equal(groundShareMainFlag('?groundShareMain=0'), false);
  assert.equal(groundShareMB(''), 64);
  assert.equal(groundShareMB('?groundShareMB=16'), 16);
  assert.equal(groundShareMB('?groundShareMB=9999'), 64);
});
