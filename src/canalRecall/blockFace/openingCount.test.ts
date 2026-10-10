/**
 * Openings per storey band (openingCount.ts) over frozen opening profiles of compiled block faces
 * (fixtures/opening-profiles.json, written by scripts/block-face/opening-fixtures.ts from review.ts output).
 *
 * The expected counts below were verified by hand on 2026-10-10 by looking at each pand's rectified photo strip
 * (strip.jpg, 40 px/m) next to its orthographic model render. Ground = ground-band bays (glass only / every opening);
 * upper = glazed bays per upper storey; attic = gable windows and dormers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {columns, compareBands, countBands, photoBands, type FrontBands} from './openingCount.ts';
import type {Opening} from '../landmarks/facadeCompare.ts';

type Profile = {photoRows: number[]; photoGroundRows?: number; fronts: FrontBands[]; glazed: Opening[]; all: Opening[]};
const profiles: Record<string, Profile> = JSON.parse(readFileSync(new URL('./fixtures/opening-profiles.json', import.meta.url), 'utf8'));
const count = (key: string) => { const p = profiles[key]; assert.ok(p, key); return countBands(p.glazed, p.all, p.fronts); };
const verdict = (key: string, photoRows = profiles[key].photoRows) => compareBands(key, photoRows, count(key), {groundRows: profiles[key].photoGroundRows});
const passes = (key: string, photoRows?: number[]) => verdict(key, photoRows).every(c => c.pass);

// [ground glazed, ground all, upper storeys, attic rows] as seen on the strip and the model render.
const TRUTH: Record<string, [number, number, number[], number[], string]> = {
  'wallen-oza-41-57/177916': [2, 2, [2, 3], [1], 'no. 41: cream pui, glazed door + display window under two upper lights; 2 windows; 3-light group; neck-gable window'],
  'wallen-oza-41-57/177915': [3, 3, [2, 2], [1], 'no. 43: 18th-c. pui of 3 glazed bays; 2; 2; pedimented dormer on the mansard'],
  'wallen-oza-41-57/177922': [1, 3, [3, 3, 3], [], 'no. 47: door with fanlight + 2 roller shutters (only the fanlight is glass); 3 French windows x 3'],
  'wallen-oza-41-57/177923': [1, 3, [3, 3, 3], [], 'no. 49: door with fanlight + 2 shutters; 3 x 3; the rooftop spike is ornament, not a window'],
  'wallen-oza-41-57/177920': [3, 3, [3, 3], [1], 'no. 51: column arcade of 3 glazed doors with transoms; 3; 3; gable window under the hoist'],
  'wallen-oza-41-57/177943': [8, 8, [6, 6, 3], [2], 'nos. 53-55: arcades 3 + 5; a 3,3 and b 3,3,3; a gable hatch + b pedimented dormer'],
  'wallen-oza-41-57/177946': [3, 3, [3, 3, 3], [1], 'no. 57: raised ground of 3 sashes over basement windows (one bay each); 3 x 3; gable window'],
  // No. 45 as the photo shows it: a 4-bay pilaster arcade with transom lights, THREE storeys of 3 cross windows above it,
  // a heavy cornice with a carved crest and no windows above it. The installed intent (storeys 5) has four.
  'wallen-45-four-storeys/177924': [4, 4, [3, 3, 3], [], 'no. 45 compiled with storeys 4: matches the photo'],
  'marnix-124-138/174914': [3, 3, [3, 3, 3], [1], 'Marnixstraat 124: 2 windows + door with transom; 3 x 3; stepped-gable window'],
  'marnix-c/169033': [3, 3, [3, 3, 3], [1], 'marnix-c first house: same type as 124'],
  'bilder-161259-236206/161259': [2, 2, [2, 2, 2], [1], 'Bilderdijkstraat: shop glass + door fanlight; 3-light + single x 3; gable window'],
  'bilder-161259-236206/161260': [2, 2, [3, 3, 3], [1], 'shop + door fanlight; 3 x 3; dormer'],
  'bilder-157757-164549/157757': [2, 2, [3, 3, 3], [1], 'shop + door fanlight; 3 x 3; gable window'],
};

test('band counts match the hand-verified photo/model counts', () => {
  for (const [key, [gg, ga, upper, attic, what]] of Object.entries(TRUTH)) {
    const m = count(key);
    assert.deepEqual([m.groundGlazed, m.groundAll, m.upper, m.attic], [gg, ga, upper, attic], `${key} (${what})`);
  }
});

test('like with like: pands the old row counter failed now pass against their photo rows', () => {
  // Old counter: 177922/177923 "2,3,3,3 vs 1,3,3,3" (the door fanlight was the whole ground row), 177943
  // "8,6,6,3,2 vs 8,6,6,1,3,1" (two fronts, two storey grids), 177946 "3,3,3,3,1 vs 3,3,3,3,3,1" (basement row).
  for (const p of ['177922', '177923', '177943', '177946', '177916', '177915', '177920']) assert.ok(passes(`wallen-oza-41-57/${p}`), p);
  for (const k of ['marnix-124-138/174914', 'marnix-c/169033', 'bilder-161259-236206/161259', 'bilder-161259-236206/161260', 'bilder-157757-164549/157757']) assert.ok(passes(k), k);
  // No. 45 with three storeys over the arcade passes; the old counter read its arcade transoms as a second row.
  assert.ok(passes('wallen-45-four-storeys/177924'));
});

test('it still catches a wrong storey count over the arcade (Oudezijds Achterburgwal 45)', () => {
  // The installed model (storeys 5) puts four rows of windows over the arcade; the photo shows three.
  const installed = verdict('wallen-oza-41-57/177924');
  assert.deepEqual(count('wallen-oza-41-57/177924').upper, [3, 3, 3, 3]);
  assert.equal(installed.find(c => c.what.startsWith('rows above'))!.pass, false);
  assert.equal(installed.find(c => c.what.startsWith('ground bays'))!.pass, true);
  // And the converse: had the photo shown four rows above the arcade, the three-storey model must fail.
  assert.equal(passes('wallen-45-four-storeys/177924', [4, 3, 3, 3, 3]), false);
  assert.equal(passes('wallen-oza-41-57/177924', [4, 3, 3, 3, 3]), true);
});

test('it still catches real differences elsewhere', () => {
  // Bilderdijkstraat 157154: the photo's gable has three small windows (square, arched, square); the model one.
  assert.equal(passes('bilder-161259-236206/157154'), false);
  // 236206: shop + door + door + shop on the photo (4), the model has shop + door + window (3); gable row too.
  assert.equal(passes('bilder-161259-236206/236206'), false);
  // A missing storey and a missing ground bay are both caught.
  assert.equal(passes('wallen-oza-41-57/177922', [2, 3, 3]), false);
  assert.equal(passes('wallen-oza-41-57/177920', [5, 3, 3, 1]), false);
  // A photo ground count below the model's glazed bays fails (Marnix: 2 windows + a glazed door transom = 3).
  assert.equal(passes('marnix-124-138/174914', [2, 3, 3, 3, 1]), false, 'photo ground 2 < model glazed 3: the door transom is glass');
});

test('photo ground band: one leading row, two when the second is a lone transom/mezzanine row', () => {
  assert.deepEqual(photoBands([2, 1, 3, 3, 3, 1]), {ground: [2, 1], above: [3, 3, 3, 1]});
  assert.deepEqual(photoBands([4, 3, 3, 3]), {ground: [4], above: [3, 3, 3]});
  assert.deepEqual(photoBands([2, 2, 3, 1]), {ground: [2], above: [2, 3, 1]});
  assert.deepEqual(photoBands([3, 2, 2, 1], 1), {ground: [3], above: [2, 2, 1]});
  assert.deepEqual(photoBands([3, 3, 3, 3, 1], 2), {ground: [3, 3], above: [3, 3, 1]});
});

test('columns merge stacked openings (transom over door) but not neighbours', () => {
  const o = (t0: number, t1: number, y0: number, y1: number): Opening => ({t0, t1, y0, y1, area: (t1 - t0) * (y1 - y0)});
  assert.equal(columns([o(0, 1, 0, 2.2), o(0, 1, 2.3, 2.9), o(1.5, 2.5, 0.5, 2.5)]), 2);
  assert.equal(columns([o(0, 1, 0, 1), o(1.05, 2, 0, 1)]), 2);
});
