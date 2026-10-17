// Bridge display names, the extract sidecar and the lede repairs
// (2026-10-17, lane content/bridge-data-finish-20261017).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  acceptedBridgeAnswers, bridgeDisplayNamesOf, bridgeLetterKey, buildBridgeDisplayNames, displayBridgeName,
  isBridgeSpelling, officialBridgeSpelling,
} from './bridgeDisplayNames.ts';
import { mergeSidecar, splitSidecar, updateSidecar } from './extractSidecar.ts';
import { dropUnfinishedSentence, ledeSentences, repairBridgeLede } from './bridgeLedeRepair.ts';
import { submitAnswer } from './answerPath.ts';
import { buildRouteKnowledgeIndex, streetCardText } from './game/routeKnowledge.ts';
import { routePlaqueName } from './game/recallRules.ts';
import { openingSentence } from './facts/factStore.ts';

const score = { attempts: 0, correct: 0, points: 0, streak: 0, bestStreak: 0 };

test('an official spelling is found only for a spelling, not for another name', () => {
  assert.equal(officialBridgeSpelling('Katten brug', ['Kattenbrug', 'Bakkersbrug']), 'Kattenbrug');
  assert.equal(officialBridgeSpelling('Hilletjes Brug', ['Hilletjesbrug']), 'Hilletjesbrug');
  assert.equal(officialBridgeSpelling('Hollandse Iepbrug', ['De Hollandse Iepbrug']), 'De Hollandse Iepbrug');
  assert.equal(officialBridgeSpelling('Zaandijksspoorbrug', ['Zaandijkspoorbrug']), 'Zaandijkspoorbrug');
  // A different name for the same structure is not a spelling.
  assert.equal(officialBridgeSpelling('Kaassluis', ['Kaasmarktsluis']), null);
  // -sluis and -brug are different names here.
  assert.equal(officialBridgeSpelling('Hoge Sluis', ['Hogebrug']), null);
  // OSM already spells it so.
  assert.equal(officialBridgeSpelling('Kattenbrug', ['Kattenbrug']), null);
  // Two spellings qualify: ambiguous.
  assert.equal(officialBridgeSpelling('Odebrug', ['ODEbrug', 'Ode-brug']), null);
  assert.equal(bridgeLetterKey('Mr. J.J. van der Veldebrug'), bridgeLetterKey('Mr. J. J. van der Veldebrug'));
});

test('named regressions: the reviewed table shows the BAG spelling', () => {
  const table = JSON.parse(readFileSync(new URL('../../scripts/data/bridge-display-names.json', import.meta.url), 'utf8')) as {
    rows: Array<{ name: string; displayName: string; source: string }>;
  };
  const shown = new Map(table.rows.map(row => [row.name, row.displayName]));
  assert.equal(shown.get('Katten brug'), 'Kattenbrug');
  assert.equal(shown.get('Hilletjes Brug'), 'Hilletjesbrug');
  assert.equal(shown.get('Zaandijksspoorbrug'), 'Zaandijkspoorbrug');
  // Kept: the register's text would teach a worse spelling.
  assert.equal(shown.has('Maria Skłodowska-Curiebrug'), false);
  assert.equal(shown.has('Drs. P-brug'), false);
  for (const row of table.rows) assert.ok(isBridgeSpelling(row.name, row.displayName), `${row.name} → ${row.displayName}`);
});

test('the game shows the official spelling and keeps the raw name for matching', () => {
  const bridges = [{ name: 'Katten brug', displayName: 'Kattenbrug' }, { name: 'Blauwbrug' }, { name: 'Kaassluis', displayName: 'Kaasmarktsluis' }];
  const names = buildBridgeDisplayNames(bridges);
  assert.equal(displayBridgeName(names, 'Katten brug'), 'Kattenbrug');
  assert.equal(displayBridgeName(names, 'Blauwbrug'), 'Blauwbrug');
  // A display name that is another name is ignored, not shown.
  assert.equal(displayBridgeName(names, 'Kaassluis'), 'Kaassluis');
  assert.deepEqual(acceptedBridgeAnswers(names, 'Katten brug'), ['Kattenbrug', 'Katten brug']);
  assert.equal(bridgeDisplayNamesOf(bridges), bridgeDisplayNamesOf(bridges));
});

test('typed answers accept both spellings; feedback shows the official one', () => {
  const ask = (answer: string) => submitAnswer({
    correctName: 'Katten brug', displayName: 'Kattenbrug', acceptedAnswers: ['Kattenbrug', 'Katten brug'], answer,
    score, difficultyMultiplier: 1, gameyFeatures: false, revealName: () => {},
  });
  assert.equal(ask('Kattenbrug').wasCorrect, true);
  assert.equal(ask('katten brug').wasCorrect, true);
  assert.equal(ask('Kattenbrug').feedback, 'Correct — Kattenbrug');
  const wrong = ask('Bakkersbrug');
  assert.equal(wrong.wasCorrect, false);
  assert.equal(wrong.feedback, 'Not quite — this is Kattenbrug');
  // Without a display name nothing changes.
  const plain = submitAnswer({ correctName: 'Blauwbrug', answer: 'blauwbrug', score, difficultyMultiplier: 1, gameyFeatures: false, revealName: () => {} });
  assert.equal(plain.wasCorrect, true);
  assert.equal(plain.feedback, 'Correct — Blauwbrug');
});

test('the bridge card is titled with the official spelling and found by the raw name', () => {
  const index = buildRouteKnowledgeIndex([], [], [], (name) => name.toLowerCase(),
    [{ name: 'Katten brug', kind: 'bridge', en: 'Named after the cats.' }], {},
    [{ id: 'b1', name: 'Katten brug', displayName: 'Kattenbrug' }]);
  assert.equal(index.get('bridge:katten brug')?.name, 'Kattenbrug');
  assert.equal(index.get('bridge:katten brug')?.nameOrigin, 'Named after the cats.');
});

test('build-only fields move to the sidecar and come back by id', () => {
  const features = [
    { id: 'a', name: 'A', wikipediaExtract: 'short', wikipediaSourceText: 'long', wikipediaExtractOriginal: 'nl' },
    { id: 'b', name: 'B', wikipediaExtract: 'x' },
  ];
  const { shipped, sidecar } = splitSidecar('bridges.json', features);
  assert.deepEqual(shipped[0], { id: 'a', name: 'A', wikipediaExtract: 'short' });
  assert.deepEqual(sidecar, { a: { wikipediaSourceText: 'long', wikipediaExtractOriginal: 'nl' } });
  assert.deepEqual(mergeSidecar(shipped, sidecar), features);
  // Other partitions are untouched.
  assert.deepEqual(splitSidecar('streets.json', features).shipped, features);
  // A field already on the feature wins over the sidecar.
  assert.equal(mergeSidecar([{ id: 'a', wikipediaSourceText: 'new' }], sidecar)[0].wikipediaSourceText, 'new');
  // A pass that deleted a field over a subset drops it; other ids are kept.
  assert.deepEqual(updateSidecar({ a: { wikipediaSourceText: 'long' }, c: { wikipediaSourceText: 'c' } }, [{ id: 'a' }], {}),
    { c: { wikipediaSourceText: 'c' } });
});

test('lede repairs: fixed Dutch terms, names as written, cut sentences dropped', () => {
  assert.equal(
    repairBridgeLede('The George Madurobrug (bridge 1036) is a structural work of art in Amsterdam-Zuidoost.', 'De George Madurobrug (brug 1036) is een bouwkundig kunstwerk in Amsterdam-Zuidoost.'),
    'The George Madurobrug (bridge 1036) is a structure in Amsterdam-Zuidoost.');
  assert.equal(
    repairBridgeLede('Brug 43 is a permanent bridge in Amsterdam-North. It spans the Zuider Amstel Canal.', 'Brug 43 is een vaste brug in Amsterdam-Noord.'),
    'Brug 43 is a fixed bridge in Amsterdam-Noord. It spans the Zuider Amstelkanaal.');
  assert.equal(
    repairBridgeLede('The Rozenoord Bridge (bridge no. 174P) spans the Amstel. All b', 'De Rozenoordbrug (brug nr. 174P) ...'),
    'The Rozenoordbrug (bridge no. 174P) spans the Amstel.');
  // "permanent" is only "fixed" when the Dutch says vaste.
  assert.equal(repairBridgeLede('A permanent bridge.', 'Een blijvende brug.'), 'A permanent bridge.');
  assert.equal(dropUnfinishedSentence('A bridge. Already on the map by Balthasar Florisz.'), 'A bridge.');
  assert.deepEqual(ledeSentences('It lies in the Th. K. van Lohuizenlaan. It crosses water.'),
    ['It lies in the Th. K. van Lohuizenlaan.', 'It crosses water.']);
});

test('named regression: the garbled Zaandijkspoorbrug lede', () => {
  const cache = JSON.parse(readFileSync(new URL('../../scripts/english-translations.json', import.meta.url), 'utf8')) as Array<{ name: string; en: string; machine?: string }>;
  const entry = cache.find(row => row.name === 'Zaandijksspoorbrug');
  assert.ok(entry?.machine, 'the machine text is kept beside the edit');
  assert.doesNotMatch(entry.en, /artwork|The tunnel has a$/);
  assert.equal(cache.filter(row => /structural work of art/.test(row.en) && row.machine).length, 0);
});

test('the HUD road title prints the official spelling, and still withholds it before the answer', () => {
  const names = buildBridgeDisplayNames([{ name: 'Mr. J.J. van der Veldebrug', displayName: 'Mr. J. J. van der Veldebrug' }]);
  const roadName = 'Mr. J.J. van der Veldebrug';
  const shownName = displayBridgeName(names, roadName);
  const base = { roadName, shownName, currentName: '', promptName: '', candidateName: '', revealed: false, learned: false };
  // Asked: withheld, under either spelling.
  assert.deepEqual(routePlaqueName({ ...base, promptName: roadName }), { routeName: '', answerHidden: true });
  // Not yet answered or shown: withheld.
  assert.equal(routePlaqueName(base).routeName, '');
  // Answered: the official spelling, not OSM's.
  assert.equal(routePlaqueName({ ...base, learned: true }).routeName, 'Mr. J. J. van der Veldebrug');
  assert.equal(routePlaqueName({ ...base, currentName: roadName }).routeName, 'Mr. J. J. van der Veldebrug');
  // An ordinary street prints as before.
  assert.equal(routePlaqueName({ ...base, roadName: 'Herenstraat', shownName: 'Herenstraat', currentName: 'Herenstraat' }).routeName, 'Herenstraat');
});

test('named regression: the card does not cut a name at its patronymic', () => {
  const card = streetCardText({
    wikipediaExtract: 'The Hendrick Jacobsz. Staetsbrug (bridge 35) is a fixed bridge in Amsterdam-Centrum. The bridge spans the Herengracht.',
    structureFact: 'Stone markers on the Amstel side date the current structure to the year 1728.',
  });
  assert.ok(card.detail.startsWith('The Hendrick Jacobsz. Staetsbrug (bridge 35) is a fixed bridge'), card.detail);
  assert.doesNotMatch(card.longDetail, /Jacobsz\. Stone/);
});

test('named regression: the trivia opening keeps a patronymic whole', () => {
  assert.equal(openingSentence('The Hendrick Jacobsz. Staetsbrug (bridge 35) is a fixed bridge in Amsterdam-Centrum. It spans the Herengracht.'),
    'The Hendrick Jacobsz. Staetsbrug (bridge 35) is a fixed bridge in Amsterdam-Centrum.');
  assert.equal(openingSentence('The Frans Hendricksz. Oetgensbrug (bridge 76) is a fixed bridge. More.'),
    'The Frans Hendricksz. Oetgensbrug (bridge 76) is a fixed bridge.');
  // A sentence that ends on an ordinary word ending in -sz is not a name.
  assert.equal(openingSentence('It was built in Gdańsk. Later moved.'), 'It was built in Gdańsk.');
});
