import assert from 'node:assert/strict';
import { missionBrief } from '../src/canalRecall/game/missionBrief.ts';
import { pickColdOpenReview } from '../src/canalRecall/game/coldOpenReview.ts';
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
assert.match(story.guestTease || '', /fog map/);

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
