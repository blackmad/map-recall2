import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsClient, randomSessionId } from './client';
import { parseBatch, SESSION_ID, MAX_EVENTS_PER_BATCH, type AnalyticsEvent } from './schema';

function harness(accept: (n: number) => boolean = () => true, autoFlushAt?: number) {
  const sent: string[] = [];
  let calls = 0;
  const client = new AnalyticsClient({
    endpoint: '/api/analytics',
    sessionId: '00112233445566ff',
    autoFlushAt,
    send: (url, body) => {
      assert.equal(url, '/api/analytics');
      calls += 1;
      if (!accept(calls)) return false;
      sent.push(body);
      return true;
    },
  });
  return { client, sent };
}

const answer: AnalyticsEvent = { t: 'answer', mode: 'bike', kind: 'street', prompt: 'route', input: 'typing', outcome: 'wrong' };

test('session ids are 16 hex chars and differ', () => {
  const a = randomSessionId(), b = randomSessionId();
  assert.match(a, SESSION_ID);
  assert.notEqual(a, b);
});

test('queues until flush, then sends one exact batch', () => {
  const { client, sent } = harness();
  client.track({ t: 'session', device: 'desktop' });
  client.track(answer);
  assert.equal(sent.length, 0);
  assert.equal(client.pending, 2);
  assert.ok(client.flush());
  assert.equal(sent.length, 1);
  assert.deepEqual(JSON.parse(sent[0]), { v: 1, sid: '00112233445566ff', n: 0, events: [{ t: 'session', device: 'desktop' }, answer] });
  assert.equal(client.pending, 0);
  assert.ok(client.flush(), 'empty flush is a no-op');
  assert.equal(sent.length, 1);
});

test('drops events outside the allow-list before they are queued', () => {
  const { client, sent } = harness();
  assert.equal(client.track({ ...answer, street: 'Prinsengracht' } as unknown as AnalyticsEvent), false);
  assert.equal(client.track({ t: 'buurt', mode: 'bike', code: '52.37,4.89' }), false);
  assert.equal(client.rejected, 2);
  client.flush();
  assert.equal(sent.length, 0);
});

test('batch numbers increase, and a refused beacon keeps the queue for the next flush', () => {
  const { client, sent } = harness(n => n !== 2);
  client.track(answer);
  client.flush();
  client.track(answer);
  assert.equal(client.flush(), false);
  assert.equal(client.pending, 1);
  assert.ok(client.flush());
  assert.deepEqual(sent.map(b => JSON.parse(b).n), [0, 1]);
});

test('auto-flushes at the threshold and splits large queues within server limits', () => {
  const { client, sent } = harness(() => true, 5);
  for (let i = 0; i < 5; i++) client.track(answer);
  assert.equal(sent.length, 1);

  const big = harness(() => true, 1000);
  for (let i = 0; i < 250; i++) big.client.track(answer);
  big.client.flush();
  assert.ok(big.sent.length >= 3);
  for (const body of big.sent) {
    const parsed = parseBatch(body);
    assert.ok(parsed, 'server accepts every batch');
    assert.ok(parsed.batch.events.length <= MAX_EVENTS_PER_BATCH);
  }
  assert.equal(big.sent.reduce((n, b) => n + JSON.parse(b).events.length, 0), 250);
});

test('a throwing transport is treated as a refusal', () => {
  const client = new AnalyticsClient({ endpoint: '/x', sessionId: '00112233445566ff', send: () => { throw new Error('nope'); } });
  client.track(answer);
  assert.equal(client.flush(), false);
  assert.equal(client.pending, 1);
});
