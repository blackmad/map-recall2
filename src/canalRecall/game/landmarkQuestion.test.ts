import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bumpSessionCounter, hasBeenNamed, landmarkWithheldNames, inViewCone, landmarkChoices, landmarkQuestionsEnabled, mayAskLandmark,
  noteSighting, pickLandmarkQuestion, questionContext, readSightings, saveSightings, sightingCredit, type QuestionLandmark,
} from './landmarkQuestion.ts';
import { isBuildingLandmark, landmarkKind } from './landmarkKind.ts';
import { gameLabelContext, poiLabelVisible, streetLabelVisible } from '../ownMap/labelPolicy.ts';
import { labelAllowed } from '../labels/labelPlan.ts';

const PX = 3; // pixels per metre
const rider = { x: 0, y: 0, angle: 0, speed: 100 };

// The Westerkerk ahead, its tower inside the complex, and Jordaan neighbours.
const westerkerk: QuestionLandmark = { id: 'wk', name: 'Westerkerk', x: 100 * PX, y: 10 * PX, hood: 'Grachtengordel-West' };
const pool: QuestionLandmark[] = [
  westerkerk,
  { id: 'wt', name: 'Westertoren', x: 100 * PX, y: 25 * PX, hood: 'Grachtengordel-West' },
  { id: 'af', name: 'Anne Frank Huis', x: 60 * PX, y: 90 * PX, hood: 'Grachtengordel-West' },
  { id: 'hm', name: 'Homomonument', x: 140 * PX, y: 40 * PX, hood: 'Grachtengordel-West' },
  { id: 'bh', name: 'Bartolotti House', x: 200 * PX, y: 120 * PX, hood: 'Grachtengordel-West' },
  { id: 'nk', name: 'Noorderkerk', x: -300 * PX, y: -400 * PX, hood: 'Jordaan' },
  { id: 'far', name: 'Rijksmuseum', x: 3000 * PX, y: 0, hood: 'Museumkwartier' },
];

test('view cone: ahead within 150 m yes, behind or too far no, reversing looks back', () => {
  assert.equal(inViewCone(rider, westerkerk, 150 * PX), true);
  assert.equal(inViewCone(rider, { x: -100 * PX, y: 0 }, 150 * PX), false);
  assert.equal(inViewCone(rider, { x: 200 * PX, y: 0 }, 150 * PX), false);
  assert.equal(inViewCone(rider, { x: 10 * PX, y: 100 * PX }, 150 * PX), false, '84° off the heading');
  assert.equal(inViewCone({ ...rider, speed: -20 }, { x: -100 * PX, y: 0 }, 150 * PX), true);
});

test('picks the nearest unasked landmark in view', () => {
  const near = { id: 'n', name: 'Near', x: 50 * PX, y: 0 };
  assert.equal(pickLandmarkQuestion(rider, [westerkerk, near], { radiusPx: 150 * PX })?.id, 'n');
  assert.equal(pickLandmarkQuestion(rider, [westerkerk, near], { radiusPx: 150 * PX, skip: new Set(['n']) })?.id, 'wk');
  assert.equal(pickLandmarkQuestion(rider, [westerkerk], { radiusPx: 150 * PX, skip: new Set(['wk']) }), null);
});

test('four names from the same buurt, never the tower of the same church', () => {
  const choices = landmarkChoices(westerkerk, pool, { sameComplexPx: 40 * PX, fillerMaxPx: 900 * PX });
  assert.deepEqual(choices, ['Westerkerk', 'Homomonument', 'Anne Frank Huis', 'Bartolotti House']);
});

test('a thin buurt fills from the nearest neighbours, never from across the city', () => {
  const thin = pool.filter(l => l.id !== 'bh' && l.id !== 'hm');
  const choices = landmarkChoices(westerkerk, thin, { sameComplexPx: 40 * PX, fillerMaxPx: 900 * PX });
  assert.deepEqual(choices, null, 'only one honest neighbour in the buurt and Noorderkerk alone is not enough');
  const filled = landmarkChoices(westerkerk, [...thin, { id: 'x', name: 'Woonbootmuseum', x: 300 * PX, y: 0, hood: 'Jordaan' }, { id: 'y', name: 'Pianola Museum', x: 0, y: 400 * PX, hood: 'Jordaan' }],
    { sameComplexPx: 40 * PX, fillerMaxPx: 900 * PX });
  assert.ok(filled);
  assert.equal(filled![0], 'Westerkerk');
  assert.ok(!filled!.includes('Rijksmuseum'));
  assert.equal(new Set(filled).size, 4);
});

test('a name that reads as the answer is not a distractor', () => {
  const dupes: QuestionLandmark[] = [westerkerk,
    { id: 'd1', name: 'westerkerk', x: 0, y: 300 * PX, hood: 'Grachtengordel-West' },
    { id: 'd2', name: 'Westerkerk (Amsterdam)', x: 0, y: 320 * PX, hood: 'Grachtengordel-West' },
    ...pool.slice(2)];
  const choices = landmarkChoices(westerkerk, dupes, { sameComplexPx: 40 * PX, fillerMaxPx: 900 * PX })!;
  assert.equal(choices.filter(name => /westerkerk/i.test(name)).length, 1);
});

test('one-card rule: only into an empty slot', () => {
  const empty = { questionOpen: false, streetCandidate: false, feedbackVisible: false, utilityOpen: false };
  assert.equal(mayAskLandmark(empty), true);
  assert.equal(mayAskLandmark({ ...empty, questionOpen: true }), false);
  assert.equal(mayAskLandmark({ ...empty, streetCandidate: true }), false);
  assert.equal(mayAskLandmark({ ...empty, feedbackVisible: true }), false);
  assert.equal(mayAskLandmark({ ...empty, utilityOpen: true }), false);
});

test('flag and Free Ride opt-in', () => {
  // Back on by default with the label-draw ledger and approach withholding (#281, L1);
  // the 2026-11-09 hotfix had it off. The flag still works both ways.
  assert.equal(landmarkQuestionsEnabled('', { freeRide: false, freeRideQuiz: false }), true);
  assert.equal(landmarkQuestionsEnabled('', { freeRide: true, freeRideQuiz: false }), false);
  assert.equal(landmarkQuestionsEnabled('', { freeRide: true, freeRideQuiz: true }), true);
  assert.equal(landmarkQuestionsEnabled('?landmarkQuestions=1', { freeRide: false, freeRideQuiz: false }), true);
  assert.equal(landmarkQuestionsEnabled('?a=1&landmarkQuestions=0', { freeRide: false, freeRideQuiz: false }), false);
  assert.equal(landmarkQuestionsEnabled('?landmarkQuestions=1', { freeRide: true, freeRideQuiz: false }), false);
  assert.equal(landmarkQuestionsEnabled('?landmarkQuestions=0', { freeRide: true, freeRideQuiz: true }), false);
});

test('sightings: noticed then named, named never demoted, credit per buurt, storage round trip', () => {
  let s = noteSighting({}, 'wk', 'Grachtengordel-West', 'noticed', 1);
  assert.equal(s.isNew, true);
  assert.equal(noteSighting(s.sightings, 'wk', 'Grachtengordel-West', 'noticed', 2).isNew, false);
  s = noteSighting(s.sightings, 'wk', 'Grachtengordel-West', 'named', 3);
  assert.equal(s.isNew, true);
  assert.equal(noteSighting(s.sightings, 'wk', '', 'noticed', 4).sightings.wk.how, 'named');
  s = noteSighting(s.sightings, 'nk', 'Jordaan', 'noticed', 5);
  assert.equal(sightingCredit(s.sightings), 2);
  assert.equal(sightingCredit(s.sightings, 'Jordaan'), 1);
  assert.equal(hasBeenNamed(s.sightings, 'wk'), true);
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  saveSightings(store, s.sightings);
  assert.deepEqual(readSightings(store), s.sightings);
  mem.set('canalRecall.landmarkSightings.v1', '{bad');
  assert.deepEqual(readSightings(store), {});
});

test('session counters live beside other lanes\' keys', () => {
  const win: { __canalRecallSession?: Record<string, unknown> } = { __canalRecallSession: { ridesPerSession: 2 } };
  assert.equal(bumpSessionCounter(win, 'landmarksNamed'), 1);
  assert.equal(bumpSessionCounter(win, 'landmarksNamed'), 2);
  assert.deepEqual(win.__canalRecallSession, { ridesPerSession: 2, landmarksNamed: 2 });
});

test('an open landmark question withholds all four choice names on every label policy', () => {
  const choices = landmarkChoices(westerkerk, pool, { sameComplexPx: 40 * PX, fillerMaxPx: 900 * PX })!;
  const withheld = landmarkWithheldNames('Westerkerk', choices);
  assert.equal(withheld.length, 4);
  assert.deepEqual(new Set(withheld), new Set(choices));
  const base = {
    mapLabelNames: new Set(choices), knownPlaces: new Map(), knownRadius: 1, spoilerNames: [], quizQuiet: false,
    toWorld: (x: number, y: number) => ({ x, y }),
  };
  const open = gameLabelContext({ ...base, quizPromptName: 'Westerkerk', quizWithheldNames: withheld });
  assert.equal(open.hiddenNames?.length, 4);
  for (const name of choices) {
    assert.equal(poiLabelVisible(open, name), false, name);
    assert.equal(streetLabelVisible(open, name, 0, 0), false, name);
    assert.equal(labelAllowed({ ...open, labelsOff: false }, 'landmark', name), false, name);
  }
  assert.equal(poiLabelVisible(open, 'Noorderkerk'), true, 'a name off the card still shows');
  // Answered (or ?landmarkQuestions=0, which never sets the set): everything is back.
  const closed = gameLabelContext({ ...base, quizPromptName: '', quizWithheldNames: withheld });
  for (const name of choices) assert.equal(poiLabelVisible(closed, name), true, name);
});

test('kind: statues, sculptures and memorials are not buildings; a memorial museum is', () => {
  const k = (name: string, type: string, ids: string[] = []) => landmarkKind({ name, type, wikidataInstanceOf: ids });
  assert.equal(k('Equestrian statue of Queen Wilhelmina', 'landmark', ['Q179700']), 'memorial');
  assert.equal(k('Waterdraagster', 'landmark', ['Q860861']), 'memorial');
  assert.equal(k('Homomonument', 'landmark', ['Q575759']), 'memorial');
  assert.equal(k('Spanjemonument', 'landmark'), 'memorial', 'no Wikidata: the name decides');
  assert.equal(k('Anne Frank House', 'museum', ['Q2087181', 'Q575759']), 'building');
  assert.equal(k('Hollandsche Schouwburg', 'museum', ['Q24354', 'Q33506', 'Q575759']), 'building');
  assert.equal(k('Museum of the Canals', 'museum'), 'building');
  assert.equal(k('Church of England', 'landmark'), 'building');
  assert.equal(isBuildingLandmark({ name: 'Paradiso', type: 'landmark', wikidataInstanceOf: ['Q24354'] }), true);
});

test('distractors: a pool filtered to buildings never offers a memorial, and short pools ask nothing', () => {
  const kinds: Record<string, string[]> = { hm: ['Q575759'] };
  const buildings = pool.filter(l => isBuildingLandmark({ name: l.name, type: 'landmark', wikidataInstanceOf: kinds[l.id] }));
  assert.equal(buildings.some(l => l.id === 'hm'), false);
  const choices = landmarkChoices(westerkerk, buildings, { sameComplexPx: 40 * PX, fillerMaxPx: 900 * PX })!;
  assert.equal(choices.includes('Homomonument'), false);
  assert.equal(choices.length, 4);
  // Without the memorial only three honest names remain around a distant answer.
  assert.equal(landmarkChoices(westerkerk, buildings.filter(l => l.id !== 'nk' && l.id !== 'bh'), { sameComplexPx: 40 * PX, fillerMaxPx: 900 * PX }), null);
});

test('question context names the plaque buurt, not a second rule', () => {
  assert.equal(questionContext('On the right', 'Museumkwartier'), 'On the right · Museumkwartier');
  assert.equal(questionContext('Ahead', ''), 'Ahead');
  assert.equal(questionContext('Ahead', null), 'Ahead');
});
