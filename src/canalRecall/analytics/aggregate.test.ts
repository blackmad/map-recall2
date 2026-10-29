import test from 'node:test';
import assert from 'node:assert/strict';
import { META_BATCHES, META_DROPPED, META_REPLAYED, ReplayGuard, SHARD_COUNT, countersForBody, dayKey, sumShards } from './aggregate';

const body = (events: unknown[], o: Record<string, unknown> = {}) =>
  JSON.stringify({ v: 1, sid: 'aaaaaaaaaaaaaaaa', n: 0, events, ...o });

test('day key is the Amsterdam calendar day', () => {
  assert.equal(dayKey(new Date('2026-10-29T22:30:00Z')), '2026-10-29');
  assert.equal(dayKey(new Date('2026-10-29T23:30:00Z')), '2026-10-30', 'after midnight CET');
  assert.equal(dayKey(new Date('2026-07-01T22:30:00Z')), '2026-07-02', 'after midnight CEST');
});

test('a batch becomes counter increments only; dropped events are counted, not kept', () => {
  const write = countersForBody(body([
    { t: 'session', device: 'phone' },
    { t: 'buurt', mode: 'bike', code: 'AA01' },
    { t: 'buurt', mode: 'bike', code: 'AA01' },
    { t: 'buurt', mode: 'bike', code: 'AA01', lat: 52.3 },
    { t: 'nope' },
  ]), { now: new Date('2026-10-29T12:00:00Z'), random: () => 0.99 });
  assert.deepEqual(write, {
    day: '2026-10-29',
    shard: SHARD_COUNT - 1,
    increments: { [META_BATCHES]: 1, [META_DROPPED]: 2, 'session|device=phone': 1, 'buurt|mode=bike|code=AA01': 2 },
  });
  const keys = Object.keys(write!.increments).join(' ');
  for (const forbidden of ['aaaaaaaaaaaaaaaa', 'lat', '52.3']) assert.ok(!keys.includes(forbidden), forbidden);
});

test('not a batch: no write at all', () => {
  assert.equal(countersForBody('hello', { now: new Date() }), null);
  assert.equal(countersForBody(body([], { extra: 1 }), { now: new Date() }), null);
});

test('a replayed batch counts once', () => {
  const replay = new ReplayGuard(2);
  const now = new Date('2026-10-29T12:00:00Z');
  const events = [{ t: 'session', device: 'desktop' }];
  assert.equal(countersForBody(body(events), { now, replay })!.increments['session|device=desktop'], 1);
  assert.deepEqual(countersForBody(body(events), { now, replay })!.increments, { [META_REPLAYED]: 1 });
  assert.ok(countersForBody(body(events, { n: 1 }), { now, replay })!.increments['session|device=desktop']);
  // Bounded memory: the oldest pair is forgotten.
  countersForBody(body(events, { n: 2 }), { now, replay });
  assert.equal(countersForBody(body(events), { now, replay })!.increments['session|device=desktop'], 1);
});

test('sumShards', () => {
  assert.deepEqual(sumShards([{ a: 1, b: 2 }, undefined, { a: 3 }]), { a: 4, b: 2 });
});
