import { test } from 'node:test';
import assert from 'node:assert/strict';
import { builtYear, chooseGuessedHeight, LOW_MIN_M } from './guessedHeights';
import { SMALL_HEIGHT_M } from './newBuildGaps';

const ahn = (height: number, ridge = height + 1) => ({ groundNap: 0, height, eaves: height - 1, ridge, samples: 400 });
const pick = (tags: Record<string, unknown>, ahn4: ReturnType<typeof ahn> | null, ahn5: ReturnType<typeof ahn> | null, areaM2 = 120, bag: { bouwjaar?: number; status?: string } | null = null) => chooseGuessedHeight({ tags, built: builtYear(tags, bag), areaM2, ahn4, ahn5, ahn5Year: 2023 });

test('an old building keeps its AHN4 height', () => {
  assert.deepEqual(pick({ building: 'yes' }, ahn(29), ahn(29.5)), { height: 29, eaves: 28, ridge: 30, source: 'ahn4' });
});

test('a building site in 2020, a roof in 2023', () => {
  assert.equal(pick({ building: 'apartments' }, ahn(0.4), ahn(18.25))?.source, 'ahn5');
  assert.equal(pick({ building: 'yes', start_date: '2021' }, ahn(14), ahn(17))?.height, 17, 'built after AHN4: AHN5 even when AHN4 saw something');
});

test('built in or after the AHN5 year: keep the guess', () => {
  assert.equal(pick({ building: 'kiosk', start_date: '2024' }, ahn(7), ahn(7)), null);
  assert.equal(pick({ building: 'yes', start_date: '2023' }, null, ahn(6)), null, 'a shell in the flight');
});

test('a new build AHN5 sees flat was a site: keep the guess, no low slab', () => {
  assert.equal(pick({ building: 'apartments', start_date: '2022' }, null, ahn(0.3)), null);
});

test('a houseboat is a small building, whatever AHN reads off the quay', () => {
  assert.deepEqual(pick({ building: 'houseboat' }, ahn(0.9), null), { height: SMALL_HEIGHT_M, source: 'houseboat' });
});

test('flat in both flights: a low slab, not a 9 m box', () => {
  assert.deepEqual(pick({ building: 'yes', name: 'Voorbezinktank' }, ahn(-0.2, 0.3), ahn(-0.1, 0.2)), { height: LOW_MIN_M, source: 'low' });
  assert.equal(pick({ building: 'yes' }, ahn(1.99, 2.2), ahn(1.9, 2.1))?.height, 2, 'a 2 m switch cabinet');
  assert.equal(pick({ building: 'yes' }, null, null), null, 'no samples: the guess stays');
});

test('a small outline under a tall roof keeps its guess, not a thin column', () => {
  assert.equal(pick({ building: 'shed', start_date: '2017' }, ahn(0.5), ahn(45.3), 16), null, 'a 2017 shed under a 2022 tower');
  assert.equal(pick({ building: 'yes' }, ahn(3), null, 12)?.height, 3, 'a small shed of its own height');
});

test('The Martin: no OSM date, BAG 2022, a site in both flights keeps its guess', () => {
  const bag = { bouwjaar: 2022, status: 'Pand in gebruik' };
  assert.equal(pick({ building: 'apartments', name: 'The Martin' }, ahn(0.5, 3), ahn(1.1, 2), 1265, bag), null);
  assert.equal(pick({ building: 'yes' }, ahn(0.2), ahn(0.3), 80, { bouwjaar: 2026, status: 'Bouw gestart' }), null, 'going up');
  assert.equal(pick({ building: 'yes' }, ahn(0.2, 0.4), ahn(0.3, 0.5), 600, null)?.source, 'low', 'no BAG pand, no date: a tank');
});

test('a mixed AHN5 reading is a building going up: keep the guess', () => {
  assert.equal(pick({ building: 'apartments', name: 'The Robin' }, ahn(0.4), ahn(2.07, 19.83), 1422), null);
});
