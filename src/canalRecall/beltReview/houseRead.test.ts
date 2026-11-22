// Belt review lane C: the per-house photo read (houseRead.ts) and its place in the description ladder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { candidatesFromHouseRead, houseReadPrompt, likenessProblems, readExtras, readProblems, type HouseRead } from './houseRead.ts';
import { pickFields, type FieldCandidate } from './description.ts';

const READ: HouseRead = {
  readable: true, storeys: 3, bays: 3, crown: 'pitched-eaves', cornice: 'simple', roofStorey: 'dormers', dormers: { count: 1, style: 'pointed' },
  roofMaterial: 'red-tile', heads: 'flat', windows: 'sash-small-panes', windowSurround: 'none', wallFinish: 'brick',
  wallColour: { hex: '#4e4a4c', family: 'dark' }, whiteFrames: true, whiteHeads: 'none', stringCourses: true, speklagen: 'none',
  ground: 'dwelling', door: { bay: 3, surround: false }, stoop: 'none', stoopFlight: 'none', balconies: 'none', facadeYear: 1780,
  ornaments: ['hoist beam'], kitCannotSay: ['hipped roof'], low: ['door'],
};

test('a valid read has no problems and the prompt lists the kit values', () => {
  assert.deepEqual(readProblems(READ), []);
  assert.match(houseReadPrompt('Herengracht 2'), /"red-tile"/);
  assert.match(houseReadPrompt('Herengracht 2'), /"sash-small-panes"/);
});

test('fields outside the kit enums are dropped, the rest kept at photo-read', () => {
  const bad = { ...READ, crown: 'hipped', wallColour: { hex: 'brown', family: 'brown' } };
  assert.deepEqual(readProblems(bad).sort(), ['crown', 'wallColour']);
  const c = candidatesFromHouseRead(bad, 'test');
  assert.ok(!c.some(x => x.field === 'crown' || x.field === 'wallColour'));
  assert.ok(c.every(x => x.source === 'photo-read'));
  assert.equal(c.find(x => x.field === 'door')!.confidence, 0.5, 'a low field is held at 0.5');
  assert.deepEqual(c.find(x => x.field === 'dormers')!.value, { count: 1, kind: 'gabled' });
  assert.deepEqual(c.find(x => x.field === 'door')!.value, { bay: 3 });
  assert.equal(readExtras(bad)!.roofMaterial, 'red-tile');
});

test('photo-read beats own-read, loses to reviewed and face-intent', () => {
  const read = candidatesFromHouseRead(READ, 'read');
  const own: FieldCandidate = { field: 'storeys', value: 4, source: 'own-read', confidence: 0.6, ref: 'D1' };
  assert.equal(pickFields([own, ...read]).storeys!.value, 3);
  assert.equal(pickFields([own, ...read]).storeys!.others![0].source, 'own-read');
  const reviewed: FieldCandidate = { field: 'storeys', value: 4, source: 'reviewed', confidence: 0.95, ref: 'row review' };
  assert.equal(pickFields([reviewed, ...read]).storeys!.value, 4);
  const face: FieldCandidate = { field: 'crown', value: 'neck', source: 'face-intent', confidence: 0.85, ref: 'intent' };
  assert.equal(pickFields([face, ...read]).crown!.value, 'neck');
});

test('an unreadable read states nothing', () => {
  assert.deepEqual(candidatesFromHouseRead({ readable: false }, 'x'), []);
  assert.equal(readExtras({ readable: false }), null);
});

test('likeness answers are checked', () => {
  assert.deepEqual(likenessProblems({ score: 0.4, differences: [{ tag: 'roof', what: 'x' }] }), []);
  assert.deepEqual(likenessProblems({ score: 1.4, differences: [{ tag: 'gable' as never, what: 'x' }] }), ['score', 'differences']);
});

test('a storey count its measured profile confirms outranks the face intent, not a review (belt fixes 2026-11-22: Herengracht 84)', () => {
  const face: FieldCandidate = { field: 'storeys', value: 2, source: 'face-intent', confidence: 0.85, ref: 'intent' };
  const reviewed: FieldCandidate = { field: 'storeys', value: 4, source: 'reviewed', confidence: 0.95, ref: 'row review' };
  const measured = candidatesFromHouseRead({ ...READ, storeyShares: [0.4, 0.3, 0.3], measured: { fields: ['storeyShares'] } } as HouseRead, 'read');
  const s = measured.find(c => c.field === 'storeys')!;
  assert.equal(s.outranks, 'face-intent'); assert.match(s.ref, /measured storey profile/);
  assert.equal(pickFields([face, ...measured]).storeys!.value, 3);
  assert.equal(pickFields([reviewed, ...measured]).storeys!.value, 4);
  // Shares that disagree with the count, or shares nobody measured, keep the old ladder.
  for (const a of [{ storeyShares: [0.5, 0.5], measured: { fields: ['storeyShares'] } }, { storeyShares: [0.4, 0.3, 0.3] }]) {
    const c = candidatesFromHouseRead({ ...READ, ...a } as HouseRead, 'read');
    assert.equal(c.find(x => x.field === 'storeys')!.outranks, undefined);
    assert.equal(pickFields([face, ...c]).storeys!.value, 2);
  }
});
