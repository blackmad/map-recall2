import test from 'node:test';
import assert from 'node:assert/strict';
import { CANAL_CITY_IDS } from '../game/cities';
import { QUIZ_PROMPT_KINDS, QUIZ_SUBJECT_NAMES, ROUTE_PATTERNS, ANSWER_MODES } from '../game/modes';
import {
  CITIES, ENTRIES, EVENT_FIELDS, EVENT_TYPES, MAX_EVENTS_PER_BATCH, PROMPTS, QUESTION_KINDS, ANSWER_INPUTS,
  answeredBucket, counterKey, distanceBucket, minutesBucket, parseBatch, parseCounterKey, progressBucket, seqBucket, validateEvent,
  type AnalyticsEvent,
} from './schema';

const sample: AnalyticsEvent[] = [
  { t: 'session', device: 'phone' },
  { t: 'ride_start', mode: 'bike', entry: 'surprise', city: 'amsterdam', seq: '1' },
  { t: 'ride_end', mode: 'boat', outcome: 'abandoned', step: 'riding', progress: '25-50', answered: '1-2' },
  { t: 'ride_length', mode: 'bike', outcome: 'finished', minutes: '3-5min', distance: '1-2km' },
  { t: 'answer', mode: 'bike', kind: 'street', prompt: 'route', input: 'multiple', outcome: 'correct' },
  { t: 'buurt', mode: 'bike', code: 'AA01' },
  { t: 'perf', device: 'desktop', tier: 'smooth' },
  { t: 'graphics_failure', device: 'tablet', kind: 'webgl-context-lost' },
];

test('every event type has a valid sample, and samples round-trip through the counter key', () => {
  assert.deepEqual(new Set(sample.map(e => e.t)), new Set(EVENT_TYPES));
  for (const event of sample) {
    assert.deepEqual(validateEvent(event), event, event.t);
    assert.deepEqual(parseCounterKey(counterKey(event)), event, counterKey(event));
  }
  assert.equal(counterKey(sample[1]), 'ride_start|mode=bike|entry=surprise|city=amsterdam|seq=1');
});

test('rejects any unknown field, on every event type', () => {
  for (const event of sample) {
    for (const extra of ['lat', 'lng', 'uid', 'ip', 'userAgent', 'name', 'street', 'ts', 'sid', '__proto__x']) {
      assert.equal(validateEvent({ ...event, [extra]: 'x' }), null, `${event.t}+${extra}`);
    }
  }
});

test('rejects missing fields, wrong values and non-string values', () => {
  for (const event of sample) {
    for (const key of Object.keys(EVENT_FIELDS[event.t])) {
      const missing: Record<string, unknown> = { ...event };
      delete missing[key];
      assert.equal(validateEvent(missing), null, `${event.t} without ${key}`);
      assert.equal(validateEvent({ ...event, [key]: 'Prinsengracht 263' }), null, `${event.t}.${key} free text`);
      assert.equal(validateEvent({ ...event, [key]: 52.37 }), null, `${event.t}.${key} number`);
      assert.equal(validateEvent({ ...event, [key]: ['bike'] }), null, `${event.t}.${key} array`);
    }
  }
  assert.equal(validateEvent({ t: 'pageview', device: 'phone' }), null, 'unknown type');
  assert.equal(validateEvent({ t: 'toString' }), null, 'prototype key as type');
  assert.equal(validateEvent(null), null);
  assert.equal(validateEvent('session'), null);
  assert.equal(validateEvent([{ t: 'session', device: 'phone' }]), null);
  assert.equal(validateEvent(Object.assign(Object.create({ evil: 1 }), { t: 'session', device: 'phone' })), null, 'class instance');
});

test('the buurt code is a four-character gebieden code, not a name or a coordinate', () => {
  for (const code of ['AA0', 'N73', 'AA01a', 'aa01', 'Jordaan', '52.37,4.89', 'AA011', 'BU0363AA01']) {
    assert.equal(validateEvent({ t: 'buurt', mode: 'bike', code }), null, code);
  }
  assert.ok(validateEvent({ t: 'buurt', mode: 'boat', code: 'K24' + '0' }));
});

test('validateEvent copies: the result carries only allow-listed keys', () => {
  const input = { t: 'session', device: 'desktop' } as const;
  const out = validateEvent(input);
  assert.notEqual(out, input);
  assert.deepEqual(Object.keys(out!), ['t', 'device']);
});

test('parseBatch: exact envelope, events dropped one by one', () => {
  const body = (o: Record<string, unknown>) => JSON.stringify({ v: 1, sid: '0123456789abcdef', n: 0, events: sample, ...o });
  const ok = parseBatch(body({}));
  assert.ok(ok);
  assert.equal(ok.batch.events.length, sample.length);
  assert.equal(ok.dropped, 0);

  const mixed = parseBatch(body({ events: [sample[0], { ...sample[1], lat: 52.37 }, { t: 'x' }] }));
  assert.equal(mixed!.batch.events.length, 1);
  assert.equal(mixed!.dropped, 2);

  assert.equal(parseBatch(body({ ip: '1.2.3.4' })), null, 'unknown envelope key');
  assert.equal(parseBatch(body({ v: 2 })), null, 'version');
  assert.equal(parseBatch(body({ sid: 'user@example.com' })), null, 'sid shape');
  assert.equal(parseBatch(body({ n: -1 })), null, 'n');
  assert.equal(parseBatch(body({ n: 1.5 })), null, 'n integer');
  assert.equal(parseBatch(body({ events: Array(MAX_EVENTS_PER_BATCH + 1).fill(sample[0]) })), null, 'too many events');
  assert.equal(parseBatch('{not json'), null);
  assert.equal(parseBatch('x'.repeat(20000)), null, 'too big');
  assert.equal(parseBatch(42), null);
  // The parsed object form (a JSON body parser upstream) is accepted too.
  assert.ok(parseBatch({ v: 1, sid: '0123456789abcdef', n: 3, events: [] }));
});

test('parseCounterKey rejects malformed and unknown keys', () => {
  assert.equal(parseCounterKey('_meta|batches'), null);
  assert.equal(parseCounterKey('session|device=phone|extra=1'), null);
  assert.equal(parseCounterKey('session|devicephone'), null);
});

test('allow-lists match the game value lists they mirror', () => {
  assert.deepEqual([...CITIES], [...CANAL_CITY_IDS]);
  assert.deepEqual([...QUESTION_KINDS], [...QUIZ_SUBJECT_NAMES]);
  assert.deepEqual([...PROMPTS], [...QUIZ_PROMPT_KINDS]);
  assert.deepEqual([...ANSWER_INPUTS], [...ANSWER_MODES]);
  for (const pattern of ROUTE_PATTERNS) assert.ok((ENTRIES as readonly string[]).includes(pattern), pattern);
});

test('buckets', () => {
  assert.equal(minutesBucket(10), 'lt1min');
  assert.equal(minutesBucket(60), '1-3min');
  assert.equal(minutesBucket(299), '3-5min');
  assert.equal(minutesBucket(3600), '20min+');
  assert.equal(minutesBucket(-5), 'lt1min');
  assert.equal(distanceBucket(0), 'lt500m');
  assert.equal(distanceBucket(999), '500m-1km');
  assert.equal(distanceBucket(1000), '1-2km');
  assert.equal(distanceBucket(9000), '8km+');
  assert.equal(progressBucket(null), 'none');
  assert.equal(progressBucket(Number.NaN), 'none');
  assert.equal(progressBucket(0.1), '0-25');
  assert.equal(progressBucket(0.6), '50-75');
  assert.equal(progressBucket(1.4), '75-100');
  assert.equal(answeredBucket(0), '0');
  assert.equal(answeredBucket(2), '1-2');
  assert.equal(answeredBucket(11), '11+');
  assert.equal(seqBucket(1), '1');
  assert.equal(seqBucket(9), '4+');
});
