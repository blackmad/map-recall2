import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choosePlannedReview, pickDestinationNear, pickReviewRoute, kmBetween, SURPRISE_MIN_PAIR_KM, type DuePlace } from './routeSelection.ts';

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

// 2026-11-01 (#129): a surprise ride from Micropia drew Artis, 45 m away; both ends snapped to Plantage Kerklaan and
// the ride stopped at "Start and finish are too close". Coordinates from the Amsterdam landmarks extract.
test('surprise: a destination next to the start is drawn again; a far one is kept as drawn', () => {
  const micropia = poi('micropia', 52.3668906, 4.9126888), artis = poi('artis', 52.367292, 4.912753);
  const rijks = poi('rijksmuseum', 52.36, 4.8852), dam = poi('dam', 52.3731, 4.8926);
  const all = [micropia, artis, rijks, dam];
  for (let i = 0; i < 50; i++) {
    const unit = i / 50, draws: number[] = [];
    const chosen = pickDestinationNear(all, micropia, () => { draws.push(unit); return unit; });
    assert.ok(chosen && chosen.id !== 'artis', `draw ${unit}: not Artis`);
    assert.ok(kmBetween(chosen!, micropia) >= SURPRISE_MIN_PAIR_KM);
    assert.ok(draws.length <= 2, 'one draw, and a second only after the neighbour');
  }
  assert.equal(pickDestinationNear([micropia, artis], micropia, () => 0)?.id, 'artis', 'with nothing else, the neighbour still makes a trip');
});

