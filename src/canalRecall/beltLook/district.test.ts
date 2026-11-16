// District looks (centrum-looks lane, 2026-11-15): the belt look's donor method under another district's config. The
// default (BELT_LOOK) is the belt's own, so belt output is unchanged; a district's canals, pitch band and foreign-donor cost
// change only that district's match and fit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BELT_LOOK, BELT_CANALS, PITCH_M, donorDistance, donorFor, fittedRead, segmentOf, type BeltDonor, type BeltTarget, type LookDistrict } from './donors.ts';
import type { DescriberAnswer } from '../houseSpec/describer.ts';

const read = (pandId: string, over: Partial<DescriberAnswer> = {}): DescriberAnswer => ({
  v: 1, pandId, image: { ref: `cuts/${pandId}.jpg`, kind: 'pose-photo' }, reader: 'test', prompt: 'v4.3', readable: true, extent: 'single',
  storeys: 4, bays: 3, windows: 'sash-small-panes', heads: ['flat', 'flat', 'flat', 'flat'], whiteFrames: true, sills: 'stone', doorBay: 'left', doorIndex: 0, groundBays: 3,
  ground: 'dwelling', basement: 'none', crown: 'cornice', cornice: 'simple', finish: 'brick', doorSurround: false, gaps: [], notes: '', ...over,
} as unknown as DescriberAnswer);
const donor = (id: string, street: string, year: number, widthM: number, heightM: number, district?: string): BeltDonor =>
  ({ pandId: id, street, year, widthM, heightM, answer: read(id), ...(district ? { district } : {}) });
const JORDAAN: LookDistrict = { id: 'jordaan', canals: ['Prinsengracht'], pitchM: { min: 3.0, max: 3.8 }, foreignDonor: 1 };
const target = (over: Partial<BeltTarget> = {}): BeltTarget => ({ pandId: '0363100012800001', street: 'Westerstraat', year: 1880, widthM: 5.5, eavesM: 12, ridgeM: null, roofCode: 1, ...over });

test('BELT_LOOK is the belt\'s own config: the defaults are unchanged', () => {
  assert.deepEqual(BELT_LOOK.canals, BELT_CANALS);
  assert.equal(BELT_LOOK.pitchM, PITCH_M);
  assert.equal(BELT_LOOK.foreignDonor, 0);
  assert.equal(segmentOf('Keizersgracht'), 'Keizersgracht');
  assert.equal(segmentOf('Bloemgracht'), 'cross');
  const t = target(), d = donor('0363100012900001', 'Kerkstraat', 1700, 6, 13, 'belt');
  assert.equal(donorDistance(t, d), donorDistance(t, d, BELT_LOOK));
  assert.equal(donorDistance({ ...t, district: 'jordaan' }, d), donorDistance(t, d), 'the belt look never charges a foreign donor');
});

test('a district\'s canals are its segments', () => {
  assert.equal(segmentOf('Prinsengracht', JORDAAN.canals), 'Prinsengracht');
  assert.equal(segmentOf('Keizersgracht', JORDAAN.canals), 'cross');
});

test('a donor of another district costs foreignDonor; untagged donors and targets cost nothing', () => {
  const t = target({ district: 'jordaan' });
  const local = donor('0363100012900002', 'Westerstraat', 1880, 5.5, 12, 'jordaan'), belt = { ...local, pandId: '0363100012900003', district: 'belt' };
  assert.equal(+(donorDistance(t, belt, JORDAAN) - donorDistance(t, local, JORDAAN)).toFixed(6), 1);
  assert.equal(donorDistance(target(), belt, JORDAAN), donorDistance(target(), local, JORDAAN));
  // The same read in both pools: the district's own is the nearer.
  assert.equal(donorFor(t, [belt, local], JORDAAN)?.of, 2);
  const near = [belt, local].map(d => ({ id: d.pandId, s: donorDistance(t, d, JORDAAN) })).sort((a, b) => a.s - b.s);
  assert.equal(near[0].id, local.pandId);
});

test('the fitted storeys follow the district\'s pitch band', () => {
  // A donor whose own pitch is 2.9 m (11.6 m over 4 storeys): the belt holds it to 3.2 m, the Jordaan band to 3.0 m.
  // A 10.5 m front: belt 10.5 / 3.2 = 3.3 -> 3 storeys, Jordaan 10.5 / 3.0 = 3.5 -> 4.
  const d = donor('0363100012900004', 'Westerstraat', 1880, 5.5, 11.6, 'jordaan');
  assert.equal(fittedRead(target({ eavesM: 10.5 }), d).storeys, 3);
  assert.equal(fittedRead(target({ eavesM: 10.5 }), d, JORDAAN).storeys, 4);
});

test('the Jordaan config: its buurten are the AB wijk, its pitch band sits inside the measured quartiles', () => {
  const j = JSON.parse(fs.readFileSync(new URL('./districts/jordaan.json', import.meta.url), 'utf8'));
  assert.equal(j.id, 'jordaan');
  assert.ok(j.buurten.length === 11 && j.buurten.every((b: string) => /^AB\d\d$/.test(b)));
  assert.ok(j.pitchM.min < j.pitchM.max);
  if (j.measured?.pitch) { assert.ok(j.pitchM.min <= j.measured.pitch.p25 && j.pitchM.max >= j.measured.pitch.p75 - 0.05); }
});
