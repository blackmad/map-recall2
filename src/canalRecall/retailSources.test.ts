// Round 7 (lane retail-look-20261114): second-source matching. `node --import tsx --test src/canalRecall/retailSources.test.ts`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLOSED_CONFIRM, MATCH_M, closedByOverture, compareSources, sameName } from './retailSources.js';

test('business names: generic words, glued spellings, accents', () => {
  assert.ok(sameName('Café De Kroon', 'De Kroon'));
  assert.ok(sameName('Bar Blij', 'BarBlij'));
  assert.ok(sameName('PQNL Beethoven/Le Pain Quotidien', 'Le Pain Quotidien'));
  assert.ok(sameName("O'Donnells Irish Pub", 'ODonnells Irish Pub'));
  assert.ok(!sameName('Café', 'Eetcafé'));
  assert.ok(!sameName('De Kroon', 'De Klok'));
  assert.ok(!sameName('Bar', 'Bar Blij'));
});

test('confirm, move and add', () => {
  const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const osm = [{ id: 'n1', name: 'De Kroon', at: [0, 0] as [number, number], pand: 'p1' }, { id: 'n2', name: 'Blij', at: [10, 0] as [number, number], pand: 'p2' }, { id: 'n3', name: 'Gone', at: [20, 0] as [number, number], pand: 'p3' }];
  const src = [
    { id: 's1', name: 'Café De Kroon', at: [1, 0] as [number, number], pand: 'p1' },
    { id: 's2', name: 'Bar Blij', at: [12, 0] as [number, number], pand: 'p4' },
    { id: 's3', name: 'Nieuw', at: [30, 0] as [number, number], pand: 'p5' },
    { id: 's4', name: 'De Kroon', at: [500, 0] as [number, number], pand: 'p6' },
  ];
  const { verdicts, unmatched } = compareSources(src, osm, dist);
  assert.deepEqual(verdicts.map(v => v.kind), ['confirm', 'move', 'add', 'add']);
  assert.deepEqual(unmatched.map(o => o.id), ['n3']);
});

import { signVerdict } from './signRead.js';
test('sign read: match within one edit, confident other word flags, nothing read is none', () => {
  assert.equal(signVerdict('Het Zwarte Fietsenplan', [{ text: 'ZWARTE', conf: 90 }, { text: 'FIETSENPLAN', conf: 70 }]).verdict, 'match');
  assert.equal(signVerdict('Kruidvat', [{ text: 'KRUIDVAI', conf: 60 }]).verdict, 'match');
  assert.equal(signVerdict('Arjan bloemen', [{ text: 'Slagerij', conf: 92 }]).verdict, 'mismatch');
  assert.equal(signVerdict('Arjan bloemen', [{ text: 'xx', conf: 92 }, { text: 'Open', conf: 95 }]).verdict, 'none');
});

test('round 5 (retail-real): a business Overture lists only as permanently closed drops, unless re-checked or a brand', () => {
  const closed = { name: 'Kenza Hair', status: 'permanently_closed', d: 4 };
  assert.equal(closedByOverture('Kenza Hair', [closed]), true);
  assert.equal(closedByOverture('Kenza Hair', [closed, { name: 'Kenza Hair Salon', status: 'open', d: 9 }]), false);
  assert.equal(closedByOverture('Kenza Hair', [{ ...closed, d: MATCH_M + 1 }]), false);
  assert.equal(closedByOverture('Kenza Hair', []), false);
  assert.equal(closedByOverture('Kenza Hair', [closed], CLOSED_CONFIRM), false);
  assert.equal(closedByOverture('Kenza Hair', [closed], '2023-04-24'), true);
  assert.equal(closedByOverture('Etos', [{ name: 'Etos', status: 'permanently_closed', d: 3 }], undefined, 'Etos'), false);
  assert.equal(closedByOverture(undefined, [closed]), false);
});
