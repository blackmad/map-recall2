import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choosePlannedReview, pickReviewRoute, type DuePlace } from './routeSelection.ts';

const poi = (id: string, lat: number, lng: number) => ({ id, name: id, lat, lng });

// 2026-10-13: Avenhornstraat lies beside the line ending at Kazerne Zebra, so
// the pick "covered" it and carried neither a via nor a runner-up; the page
// then never planned the pair, and the router skipped the street. The ride
// rode no due name at all.
const pois = [poi('a', 52.3900, 4.9000), poi('zebra', 52.3900, 4.9500)];
const due: DuePlace[] = [{ name: 'Avenhornstraat', center: [52.3912, 4.9490] }];

test('a name beside the line is also offered as a via of the same pair', () => {
  const pick = pickReviewRoute({ pois, due, chooseIndex: () => 0 });
  assert.ok(pick, 'the line passes the street');
  assert.equal(pick!.via, undefined, 'covered by the line, so no via on the pick itself');
  assert.ok(pick!.alternatives!.length >= 1, 'the page plans a pick with alternatives');
  const [alt] = pick!.alternatives!;
  assert.equal(alt.via?.name, 'Avenhornstraat');
  assert.equal(alt.from.id, pick!.from.id);
  assert.equal(alt.to.id, pick!.to.id);
});

test('the via alternative is ridden when the direct path skips the street', () => {
  const pick = pickReviewRoute({ pois, due, chooseIndex: () => 0 })!;
  const calls: Array<string | undefined> = [];
  const chosen = choosePlannedReview<string, string>(
    pick, p => p.id,
    (_from, _to, via) => {
      calls.push(via);
      return via ? { dueNamesOnPath: ['Avenhornstraat'], viaUsed: true } : { dueNamesOnPath: [] };
    },
    place => [`stretch:${place.name}`],
  );
  assert.deepEqual(chosen?.dueOnPath, ['Avenhornstraat']);
  assert.equal(chosen?.via, 'stretch:Avenhornstraat');
});

test('the via alternative is not planned when the direct path already rides the name', () => {
  const pick = pickReviewRoute({ pois, due, chooseIndex: () => 0 })!;
  const calls: Array<string | undefined> = [];
  const chosen = choosePlannedReview<string, string>(
    pick, p => p.id,
    (_from, _to, via) => { calls.push(via); return { dueNamesOnPath: ['Avenhornstraat'] }; },
    place => [place.name],
  );
  assert.deepEqual(calls, [undefined]);
  assert.equal(chosen?.via, undefined);
});

test('a via the detour cap refuses leaves the direct plan', () => {
  const pick = pickReviewRoute({ pois, due, chooseIndex: () => 0 })!;
  const chosen = choosePlannedReview<string, string>(
    pick, p => p.id,
    (_f, _t, via) => (via ? { dueNamesOnPath: [], viaUsed: false } : { dueNamesOnPath: [] }),
    place => [place.name],
  );
  assert.deepEqual(chosen?.dueOnPath, []);
  assert.equal(chosen?.via, undefined);
});
