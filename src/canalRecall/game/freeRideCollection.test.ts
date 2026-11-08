import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChecklists, CHECKLIST_MAX_PLACES, checklistLine, checklistProgress, collectionEnabled, corridorAhead,
  distanceAlpha, FADE_FLOOR, noteOpened, overCorridor, pickTokenPlace, readCollection, ridesThrough,
  saveCollection, stampIfComplete, TOKEN_MAX_PX, tokenSizePx, emptyCollection, type CollectionPlace,
} from './freeRideCollection.ts';

const place = (key: string, x: number, y: number, prominence = 0): CollectionPlace => ({ key, name: key, x, y, prominence });

test('checklists group by neighbourhood, most prominent first, capped, and skip single-place neighbourhoods', () => {
  const places = [
    ...Array.from({ length: 14 }, (_, i) => place(`m${i}`, i, 0, i)),
    place('lonely', 0, 100),
    place('m3', 3, 0, 3), // duplicate key: counted once
  ];
  const lists = buildChecklists(places, p => (p.y === 100 ? 'Elsewhere' : 'Marineterrein'));
  assert.equal(lists.has('Elsewhere'), false);
  const list = lists.get('Marineterrein')!;
  assert.equal(list.places.length, CHECKLIST_MAX_PLACES);
  assert.equal(list.places[0].key, 'm13');
  assert.ok(list.places.every((p, i, all) => i === 0 || (all[i - 1].prominence ?? 0) >= (p.prominence ?? 0)));
  // Places outside every neighbourhood are dropped.
  assert.equal(buildChecklists([place('a', 0, 0), place('b', 1, 1)], () => null).size, 0);
});

test('progress counts opened places and finishes when none remain', () => {
  const list = { hood: 'Marineterrein', places: ['a', 'b', 'c'].map(k => place(k, 0, 0)) };
  const p = checklistProgress(list, new Set(['a', 'x']))!;
  assert.deepEqual(p, { opened: 1, total: 3, done: false, remaining: ['b', 'c'] });
  assert.equal(checklistProgress(list, new Set(['a', 'b', 'c']))!.done, true);
  assert.equal(checklistProgress(null, new Set()), null);
});

test('the line reads "Marineterrein · 3 of 9 places" and never names the name under question', () => {
  const progress = { opened: 3, total: 9, done: false, remaining: [] };
  assert.equal(checklistLine('Marineterrein', progress).text, 'Marineterrein · 3 of 9 places');
  assert.equal(checklistLine('Marineterrein', { ...progress, opened: 9, done: true }).text, 'Marineterrein · all 9 places');
  const guarded = checklistLine('Jordaan', progress, { underQuestion: 'jordaan ' });
  assert.equal(guarded.hood, '');
  assert.equal(guarded.text, '3 of 9 places');
  assert.ok(!/!/.test(checklistLine('Marineterrein', { ...progress, done: true }).text));
});

test('the collection survives a reload and a broken store', () => {
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  let state = noteOpened(emptyCollection(), 'a');
  assert.equal(noteOpened(state, 'a'), state);
  saveCollection(store, state);
  assert.deepEqual(readCollection(store).opened, ['a']);
  mem.set('canalRecall.freeRideCollection.v1', '{nope');
  assert.deepEqual(readCollection(store), emptyCollection());
  assert.deepEqual(readCollection(null), emptyCollection());
  state = emptyCollection();
  saveCollection({ setItem: () => { throw new Error('quota'); } }, state);
});

test('a completed list stamps the neighbourhood once, in the collection and the passport', () => {
  const done = { opened: 2, total: 2, done: true, remaining: [] };
  const first = stampIfComplete(emptyCollection(), { stamped: ['Jordaan'] }, 'Marineterrein', done, '2026-11-09');
  assert.equal(first.fresh, true);
  assert.deepEqual(first.passport.stamped, ['Jordaan', 'Marineterrein']);
  assert.deepEqual(first.state.stamps, [{ hood: 'Marineterrein', at: '2026-11-09' }]);
  const again = stampIfComplete(first.state, first.passport, 'Marineterrein', done, '2026-11-10');
  assert.equal(again.fresh, false);
  assert.equal(stampIfComplete(emptyCollection(), { stamped: [] }, 'X', { ...done, done: false }, 'd').fresh, false);
  // Already in the passport from a quiz ride: still a collection stamp, not a duplicate.
  const quizStamped = stampIfComplete(emptyCollection(), { stamped: ['Marineterrein'] }, 'Marineterrein', done, 'd');
  assert.deepEqual(quizStamped.passport.stamped, ['Marineterrein']);
});

test('the token goes to the nearest unopened place, preferring the checklist', () => {
  const rider = { x: 0, y: 0 };
  const places = [place('near', 50, 0), place('listed', 80, 0), place('opened', 10, 0), place('far', 900, 0)];
  assert.equal(pickTokenPlace(rider, places, new Set(['opened']), { radius: 500 })!.key, 'near');
  assert.equal(pickTokenPlace(rider, places, new Set(['opened']), { radius: 500, prefer: new Set(['listed']) })!.key, 'listed');
  assert.equal(pickTokenPlace(rider, places, new Set(['opened', 'near', 'listed']), { radius: 500 }), null);
  assert.ok(ridesThrough(rider, { x: 10, y: 0 }, 12));
  assert.ok(!ridesThrough(rider, { x: 30, y: 0 }, 12));
  assert.ok(!ridesThrough(rider, null, 12));
});

test('markers fade and the token shrinks with distance; the token is never over 24 px', () => {
  assert.equal(distanceAlpha(0), 1);
  assert.equal(distanceAlpha(100), 1);
  assert.ok(Math.abs(distanceAlpha(320) - FADE_FLOOR) < 1e-9);
  assert.ok(distanceAlpha(200) < 1 && distanceAlpha(200) > FADE_FLOOR);
  let prev = Infinity;
  for (let d = 0; d <= 400; d += 10) {
    const size = tokenSizePx(d);
    assert.ok(size <= TOKEN_MAX_PX && size <= prev + 1e-9, `size ${size} at ${d} m`);
    prev = size;
  }
  assert.ok(tokenSizePx(300) <= 13);
  assert.ok(tokenSizePx(Number.NaN) <= TOKEN_MAX_PX);
});

test('the corridor: a coin on the road ahead is over it, one beside it is not', () => {
  const corridor = { path: [{ x: 500, y: 600 }, { x: 500, y: 300 }], halfWidth: 30 };
  assert.ok(overCorridor({ x: 505, y: 400 }, 10, corridor));
  assert.ok(overCorridor({ x: 535, y: 450 }, 10, corridor));
  assert.ok(!overCorridor({ x: 560, y: 450 }, 10, corridor));
  assert.ok(!overCorridor({ x: 500, y: 200 }, 10, corridor)); // beyond the reach ahead
  assert.ok(!overCorridor({ x: 0, y: 0 }, 10, null));
  const ahead = corridorAhead({ x: 0, y: 0, angle: 0 }, 100, 4);
  assert.equal(ahead.length, 5);
  assert.deepEqual(ahead[4], { x: 100, y: 0 });
});

test('?collection=0 turns the collection off', () => {
  assert.equal(collectionEnabled(''), true);
  assert.equal(collectionEnabled('?ride=free'), true);
  assert.equal(collectionEnabled('?ride=free&collection=0'), false);
});
