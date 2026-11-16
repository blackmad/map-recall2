import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBatch, buildEnvironment, buildNote, pageUrl } from './note.ts';

const env = buildEnvironment({
  location: { href: 'https://x.web.app/canal-drive/shopfronts.html?lat=52.3&kit=a#g', hostname: 'x.web.app', host: 'x.web.app', origin: 'https://x.web.app' },
  userAgent: 'ua', viewport: { width: 390, height: 844, dpr: 3 }, feedbackBuild: { sha: 's' }, build: undefined, capturedAt: '2026-11-16T00:00:00Z',
});
test('environment strips private query values and classifies the host', () => {
  assert.equal(env.kind, 'firebase-hosting');
  assert.equal(env.page, 'https://x.web.app/canal-drive/shopfronts.html?kit=a');
  assert.equal(env.build, null);
  assert.equal(pageUrl('http://localhost:1/a?token=1#h'), 'http://localhost:1/a');
});
test('batch skips empty text, defaults category to building and satisfies the rules shape', () => {
  const out = buildBatch([
    { targetId: 'shopfront:chain:lidl', label: 'Lidl', imageUrl: 'https://img/x.webp', text: '  sign too big ', subject: { kind: 'pand', id: 'P1', lngLat: [4.9, 52.3] }, context: { chain: 'lidl' } },
    { targetId: 'shopfront:template:bike', label: 'Bike', text: '   ' },
  ], env);
  assert.equal(out.length, 1);
  const n = out[0].note as any;
  assert.equal(n.text, 'sign too big'); assert.equal(n.category, 'building'); assert.equal(n.screenshot, '');
  assert.deepEqual(n.target, { id: 'shopfront:chain:lidl', label: 'Lidl', imageUrl: 'https://img/x.webp', anchor: null });
  assert.deepEqual(n.subject, { kind: 'pand', id: 'P1', lngLat: [4.9, 52.3] });
  for (const k of ['text', 'target', 'context', 'environment', 'screenshot', 'category']) assert.ok(k in n, k);
  assert.ok(typeof n.environment.host === 'string' && typeof n.environment.page === 'string');
});
test('non-http image urls are dropped and no subject key appears without one', () => {
  const n = buildNote({ text: 'x', category: 'bug', targetId: 't', label: 'l', imageUrl: 'blob:abc', environment: env });
  assert.equal((n.target as any).imageUrl, ''); assert.ok(!('subject' in n));
});
