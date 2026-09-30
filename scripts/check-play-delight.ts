import assert from 'node:assert/strict';
import { missionBrief } from '../src/canalRecall/game/missionBrief.ts';
import { COLD_OPEN_ENABLED, pickColdOpenReview } from '../src/canalRecall/game/coldOpenReview.ts';
import { finishStory, knowThisCornerFeedback } from '../src/canalRecall/game/finishStory.ts';
import {
  notePlaceDay,
  placeStreakLabel,
  readPlaceStreak,
  utcDayKey,
} from '../src/canalRecall/game/placeStreak.ts';
import {
  emptyPassport,
  stampNewNeighborhoods,
} from '../src/canalRecall/game/neighborhoodPassport.ts';
import { emptyExploration } from '../src/canalRecall/game/progressStore.ts';

const brief = missionBrief({
  destinationName: 'NEMO',
  travelMode: 'car',
  routePattern: 'surprise',
  cityName: 'Amsterdam',
});
assert.match(brief.line, /NEMO/);
assert.doesNotMatch(brief.line, /Starting on/);
assert.doesNotMatch(brief.tease || '', /Warm up/);

const hereBrief = missionBrief({
  destinationName: 'your destination',
  travelMode: 'car',
  routePattern: 'here',
  cityName: 'Amsterdam',
});
assert.match(hereBrief.line, /where you are|From here/);
assert.doesNotMatch(hereBrief.line, /Starting on/);

const cold = pickColdOpenReview({
  due: [
    {
      name: 'Overtoom',
      type: 'street',
      cityId: 'amsterdam',
      center: [52.36, 4.87],
      dueAt: Date.now() - 1000,
    },
  ],
  cityId: 'amsterdam',
  preferTypes: ['street'],
});
assert.equal(cold?.name, 'Overtoom');
assert.equal(COLD_OPEN_ENABLED, false, 'cold-open stays off until a due name is on the route or shown');
assert.equal(pickColdOpenReview({
  due: [],
  cityId: 'amsterdam',
  preferTypes: ['street'],
}), null);

const story = finishStory({
  gain: { newNames: 2, newNeighborhoods: 1, newLandmarks: 0 },
  destinationName: 'NEMO',
  cityName: 'Amsterdam',
  newPassportStamps: ['Jordaan'],
  placeStreak: { days: [utcDayKey()], current: 3, best: 5 },
  signedIn: false,
  recallAvailable: true,
});
assert.match(story.headline, /NEMO/);
assert.match(story.headline, /2 new names/);
assert.match(story.passport || '', /Jordaan/);
assert.match(story.streak || '', /3-day/);
assert.match(story.guestTease || '', /keep your progress/);

assert.match(knowThisCornerFeedback('Prinsengracht'), /Prinsengracht/);

const memory = new Map<string, string>();
const store = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
  removeItem: (key: string) => { memory.delete(key); },
};
const streak = notePlaceDay(store);
assert.equal(streak.current, 1);
assert.equal(placeStreakLabel(streak), 'First new place today');
assert.equal(readPlaceStreak(store).current, 1);

const exploration = {
  ...emptyExploration(),
  learnedStreets: Array.from({ length: 10 }, (_, i) => `Street ${i}`),
  visitedNeighborhoods: ['Jordaan', 'De Pijp'],
};
const stamped = stampNewNeighborhoods(exploration, ['Jordaan'], emptyPassport());
assert.deepEqual(stamped.fresh, ['Jordaan']);
assert.ok(stamped.passport.stamped.includes('Jordaan'));

console.log('play-delight checks passed');

// Review rides (TODO item 6): Plan review picks the landmark pair whose line
// passes the most due names, inside the usual pairing range, and says only
// how many are on the way.
{
  const { pickReviewRoute, choosePlannedReview, REVIEW_CORRIDOR_KM, REVIEW_PLANNED_CANDIDATES } = await import('../src/canalRecall/game/routeSelection.ts');
  const poi = (id: string, lat: number, lng: number) => ({ id, name: id, lat, lng });
  // Three landmarks on an east-west line through the Jordaan, one far south.
  const pois = [poi('west', 52.3760, 4.8750), poi('east', 52.3760, 4.8950), poi('south', 52.3560, 4.8850), poi('far', 52.3000, 4.9900)];
  const due = [
    { name: 'Rozengracht', center: [52.3762, 4.8800] as [number, number] },
    { name: 'Bloemgracht', center: [52.3758, 4.8900] as [number, number] },
    { name: 'Ferdinand Bolstraat', center: [52.3560, 4.8800] as [number, number] },
  ];
  const first = (count: number) => 0 * count;
  const pick = pickReviewRoute({ pois, due, chooseIndex: first });
  assert.ok(pick, 'a pair passing due names is found');
  assert.deepEqual(new Set([pick!.from.id, pick!.to.id]), new Set(['west', 'east']), 'the pair whose line passes two due names wins');
  assert.deepEqual(pick!.dueNear, ['Bloemgracht', 'Rozengracht']);
  const fixed = pickReviewRoute({ pois, due, from: poi('home', 52.3560, 4.8700), chooseIndex: first, maxKm: 2 });
  assert.equal(fixed?.from.id, 'home', 'a home or GPS start is kept');
  assert.ok(fixed!.dueNear.includes('Ferdinand Bolstraat'), 'and the destination is chosen for the names on its way');
  assert.equal(pickReviewRoute({ pois, due: [{ name: 'Nowhere', center: [52.2, 5.2] }], chooseIndex: first }), null,
    'no due name near any pair falls back to the ordinary pickers');
  assert.ok(REVIEW_CORRIDOR_KM <= 0.25, 'the corridor stays tight enough to be location-honest');
  // The line only guesses what the router rides; runners-up are planned too.
  assert.ok(pick!.alternatives!.length >= 1 && pick!.alternatives!.length < REVIEW_PLANNED_CANDIDATES, 'runners-up travel with the pick');
  assert.ok(pick!.alternatives!.every(alt => alt.to.id !== pick!.to.id && alt.dueNear.length >= 1), 'each runner-up passes a due name and ends elsewhere');
  const counts = pick!.alternatives!.map(alt => alt.dueNear.length);
  assert.deepEqual(counts, [...counts].sort((a, b) => b - a), 'runners-up by count');
  const synthetic = {
    from: poi('west', 52.3760, 4.8750), to: poi('east', 52.3760, 4.8950), dueNear: ['Bloemgracht', 'Rozengracht'],
    alternatives: [
      { from: poi('west', 52.3760, 4.8750), to: poi('south', 52.3560, 4.8850), dueNear: ['Rozengracht'] },
      { from: poi('far', 52.3000, 4.9900), to: poi('south', 52.3560, 4.8850), dueNear: ['Rozengracht'] },
    ],
  };
  const riding: Record<string, string[]> = { 'west>east': [], 'west>south': ['Rozengracht', 'Ferdinand Bolstraat'] };
  const planned = choosePlannedReview(synthetic, p => p.id === 'far' ? null : p.id,
    (s, f) => ({ dueNamesOnPath: riding[`${s}>${f}`] ?? ['Everything'] }));
  assert.equal(planned?.pick.to.id, 'south', 'a runner-up whose planned path rides due names beats a pick that rides none');
  assert.deepEqual(planned!.dueOnPath, ['Rozengracht', 'Ferdinand Bolstraat']);
  assert.equal('alternatives' in planned!.pick, false);
  const tie = choosePlannedReview(synthetic, p => p.id, () => ({ dueNamesOnPath: ['Rozengracht'] }));
  assert.equal(tie!.pick.to.id, 'east', 'on a tie the random pick is kept');
  assert.equal(choosePlannedReview(pick!, () => null, () => ({ dueNamesOnPath: [] })), null, 'nothing snaps, nothing chosen');
  // A due street no line passes (440 m north of west→east) is ridden as a via.
  const north = { name: 'Noordstraat', center: [52.3800, 4.8850] as [number, number] };
  const viaPick = pickReviewRoute({ pois, due: [...due, north], chooseIndex: first });
  assert.equal(viaPick?.via?.name, 'Noordstraat', 'the uncovered name becomes the via');
  assert.deepEqual(new Set([viaPick!.from.id, viaPick!.to.id]), new Set(['west', 'east']), 'on the pair whose line it detours least');
  assert.deepEqual(viaPick!.dueNear, ['Bloemgracht', 'Noordstraat', 'Rozengracht'], 'the via counts with the line names');
  const lineOnly = pickReviewRoute({ pois, due: [{ name: 'Rozengracht', center: [52.3762, 4.8800] }], chooseIndex: first });
  assert.equal(lineOnly?.via, undefined, 'a name on a line needs no via');
  const viaPlans: Array<string | undefined> = [];
  const viaPlanned = choosePlannedReview({ ...viaPick!, alternatives: [] }, p => p.id === 'review-via' ? `via:${p.name}` : p.id,
    (s, f, v) => { viaPlans.push(v); return { dueNamesOnPath: v ? ['Noordstraat'] : [], viaUsed: !!v }; });
  assert.deepEqual(viaPlans, ['via:'], 'the via is snapped and planned under a blank name');
  assert.equal(viaPlanned?.via, 'via:', 'the planned via travels with the choice');
  const refused = choosePlannedReview({ ...viaPick!, alternatives: [] }, p => p.id, () => ({ dueNamesOnPath: [], viaUsed: false }));
  assert.equal(refused?.via, undefined, 'a via the planner refused is not ridden');
  const briefWith = missionBrief({ destinationName: 'Westerkerk', travelMode: 'car', routePattern: 'surprise', cityName: 'Amsterdam', reviewDueNearRoute: 2 });
  assert.equal(briefWith.tease, 'Review ride: 2 overdue names on the way', 'the briefing counts, never names');
}
