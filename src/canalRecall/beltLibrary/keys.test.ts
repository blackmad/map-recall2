import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boxDims, colourFromHex, crownClass, distinctiveFlags, finishClass, groupKeys, isCorner, keyOf, keysForShares,
  resolveAll, resolveField, sourceOfLabel, type PandFacts, type Readings, type ResolvedPand,
} from './keys.ts';

const facts = (o: Partial<PandFacts> = {}): PandFacts => ({ id: 'p', buurt: 'AB07', year: 1900, widthM: 5, heightM: 12, areaM2: 100, corner: false, backland: false, ...o });

test('crown classes', () => {
  assert.equal(crownClass('cornice'), 'cornice');
  assert.equal(crownClass('cornice', { dormers: true }), 'cornice-dormer');
  assert.equal(crownClass('bell'), 'curved');
  assert.equal(crownClass('raisedNeck'), 'curved');
  assert.equal(crownClass('step'), 'step');
  assert.equal(crownClass('cornice', { roofFront: 'mansard' }), 'mansard');
  assert.equal(crownClass('plain'), 'flat-other');
  assert.equal(crownClass('unknown'), null);
});

test('finish and colour', () => {
  assert.equal(finishClass('ornamentalBrick'), 'brick');
  assert.equal(finishClass('plaster'), 'painted');
  assert.equal(colourFromHex('#f0ece0'), 'light');
  assert.equal(colourFromHex('#8a8a88'), 'grey');
  assert.equal(colourFromHex('#a5502f'), 'red');
  assert.equal(colourFromHex('#4c3d29'), 'brown');
  assert.equal(colourFromHex('#867155'), 'brown');
  assert.equal(colourFromHex('nope'), null);
});

test('source labels and the lane order', () => {
  assert.equal(sourceOfLabel('reviewed'), 'hand');
  assert.equal(sourceOfLabel('vision-judge'), 'd1');
  assert.equal(sourceOfLabel('bag'), null);
  const r = resolveField([{ value: 3, source: 'measured' }, { value: 4, source: 'd1' }, { value: 5, source: 'hand' }]);
  assert.deepEqual(r, { value: 5, source: 'hand' });
  assert.equal(resolveField([]), null);
});

test('priors fill the gaps, from the read houses, and are labelled', () => {
  const read: Readings = { bays: [{ value: 3, source: 'd1' }], storeys: [{ value: 4, source: 'hand' }] };
  const a = { facts: facts({ id: 'a' }), readings: read };
  const b = { facts: facts({ id: 'b' }), readings: {} };
  const { resolved, priors } = resolveAll([a, a, a, b]);
  assert.equal(resolved[3].bays.source, 'prior');
  assert.equal(resolved[3].bays.value, 3);
  assert.equal(resolved[3].storeys.value, 4);
  assert.equal(resolved[0].bays.source, 'd1');
  assert.equal(priors.bays.size, 3);
});

test('sampled priors follow the read distribution and are stable', () => {
  const mk = (id: string, bays?: number) => ({ facts: facts({ id }), readings: bays ? { bays: [{ value: bays, source: 'd1' as const }] } : {} });
  const reads = [...Array.from({ length: 30 }, (_, i) => mk(`r${i}`, i < 20 ? 3 : 5)), ...Array.from({ length: 300 }, (_, i) => mk(`u${i}`))];
  const a = resolveAll(reads, 'sample').resolved, b = resolveAll(reads, 'sample').resolved, m = resolveAll(reads, 'mode').resolved;
  const unread = (r: typeof a) => r.slice(30).map(x => x.bays.value);
  assert.deepEqual(unread(a), unread(b));
  const threes = unread(a).filter(v => v === 3).length;
  assert.ok(threes > 150 && threes < 250, String(threes));
  assert.ok(unread(m).every(v => v === 3));
});

test('keys: fine, coarse and read-only', () => {
  const p = {
    facts: facts(),
    crown: { value: 'curved' as const, source: 'monument' as const }, bays: { value: 2, source: 'hand' as const },
    storeys: { value: 5, source: 'prior' as const }, finish: { value: 'brick' as const, source: 'd1' as const }, colour: { value: 'red' as const, source: 'prior' as const },
  } as ResolvedPand;
  assert.equal(keyOf(p, 'fine'), 'curved|2|5|brick|red');
  assert.equal(keyOf(p, 'coarse'), 'gable|1-2|4-5|brick|red');
  assert.equal(keyOf(p, 'bays-storeys'), 'curved|1-2|4-5|brick|red');
  assert.equal(keyOf(p, 'fine', true), 'curved|2|?|brick|?');
});

test('coverage counts', () => {
  assert.deepEqual(keysForShares([50, 30, 10, 5, 5]), [{ share: 0.5, keys: 1 }, { share: 0.8, keys: 2 }, { share: 0.95, keys: 4 }]);
  assert.deepEqual(keysForShares([]), [{ share: 0.5, keys: 0 }, { share: 0.8, keys: 0 }, { share: 0.95, keys: 0 }]);
  assert.deepEqual(groupKeys([{ id: 'a', key: 'x' }, { id: 'b', key: 'y' }, { id: 'c', key: 'y' }]).map(g => [g.key, g.ids.length]), [['y', 2], ['x', 1]]);
});

test('geometry: oriented box, corner, distinctive flags', () => {
  const rect = [{ x: 0, y: 0 }, { x: 5, y: 1 }, { x: 4.5, y: 11 }, { x: -0.5, y: 10 }, { x: 0, y: 0 }];
  const d = boxDims(rect);
  assert.ok(d.shortM > 4.8 && d.shortM < 5.3 && d.longM > 10);
  assert.equal(isCorner([[10, 0], [0, 6]]), true);
  assert.equal(isCorner([[10, 0], [-10, 0.5]]), false);
  assert.equal(isCorner([[10, 0], [0, 2]]), false);
  assert.deepEqual(distinctiveFlags(facts(), {}), []);
  assert.deepEqual(distinctiveFlags(facts({ corner: true, widthM: 10 }), { elements: ['sculpture', 'gablestone', 'shopfront'] }), ['ornament', 'corner', 'width']);
});
