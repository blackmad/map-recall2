// House rows gable round (2026-11-15, David on #391: "Gables still look pretty bad"): the belt gable's sandstone drawn
// with thickness (RowCrown.stone, or the belt dress), in place of the flat white edges. Named fronts: Herengracht 55
// (0363100012179672, neck with a segmental cap), 37/39 (bells), 27 (step), 71/73 (spouts), all on D's 20e83bae2 records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROW_STONE, ROW_STONE_HOOD, rowCrownAccents, rowCrownProfile, rowCrownRoofRise, rowCrownStone, type RowCrown } from './crownProfile.ts';
import { RoofSink } from '../roofSink.ts';

const W = 6.2, F = 7, TRIM = '#efebe2';
function draw(c: RowCrown) {
  const R = rowCrownRoofRise(c, W), prof = rowCrownProfile(c, W, R);
  const s = new RoofSink({ cx: 0, cy: 0, ux: 1, uy: 0, len: 14, wid: W, coverage: 1, maxDev: 0 }, 0, { bayM: 1, storeyM: 3, cellM: 1 });
  rowCrownAccents(s, c, prof, F, 1, W, R, TRIM);
  return { tris: s.out, prof };
}
const us = (tris: ReturnType<typeof draw>['tris']) => tris.flatMap(t => t.p.map(p => p[0]));

test('crown stone: none unless stated or belt-dressed; never on a raised centre', () => {
  assert.equal(rowCrownStone({ shape: 'neck', riseM: 3 }), undefined);
  assert.deepEqual(rowCrownStone({ shape: 'neck', riseM: 3, dress: 'belt' }), {});
  assert.deepEqual(rowCrownStone({ shape: 'bell', riseM: 3, dress: 'belt' }), { crest: 'crest' });
  assert.deepEqual(rowCrownStone({ shape: 'step', riseM: 3, dress: 'belt' }), { crest: 'crest' });
  assert.deepEqual(rowCrownStone({ shape: 'neck', riseM: 3, stone: { claws: false } }), { claws: false });
  assert.equal(rowCrownStone({ shape: 'raised', riseM: 1.7, bandM: 0.5, stone: {} }), undefined);
});

test('crown stone: an undressed crown keeps its flat decals (byte-identical path)', () => {
  for (const shape of ['neck', 'bell', 'step', 'spout', 'point'] as const) {
    const { tris } = draw({ shape, riseM: 3, attic: 1 });
    assert.ok(tris.every(t => t.part === 'decal'), `${shape}: decals only`);
    assert.ok(Math.max(...us(tris)) < F + 0.035, `${shape}: nothing stands proud`);
  }
});

for (const shape of ['neck', 'bell', 'step', 'spout', 'point'] as const) test(`crown stone: ${shape} copings have thickness`, () => {
  const { tris } = draw({ shape, riseM: 3, attic: 1, dress: 'belt' });
  const trim = tris.filter(t => t.part === 'trim');
  assert.ok(trim.length >= 16, `${shape}: stone blocks drawn`);
  const u = us(trim);
  assert.ok(Math.max(...u) >= F + ROW_STONE.coping - 1e-6, 'its face stands proud');
  assert.ok(Math.min(...u) <= F - ROW_STONE.back + 1e-6, 'its top runs back past the plate');
  // Faces turned up or sideways: the copings' tops and returns, not only a face to the street.
  assert.ok(trim.some(t => Math.abs(t.n[0]) < 0.1), 'side and top faces');
});

test('crown stone: neck klauwstukken, cap moulding over the neck, foot volutes (Herengracht 55)', () => {
  const c: RowCrown = { shape: 'neck', riseM: 3.4, attic: 1, dress: 'belt' };
  const { tris } = draw(c);
  const trim = tris.filter(t => t.part === 'trim');
  const ys = (pred: (v: number, z: number) => boolean) => trim.filter(t => t.p.some(p => pred(p[1], p[2])));
  // Both sides carry a volute near the foot and stone beside the neck.
  for (const sg of [-1, 1]) assert.ok(ys((v, z) => sg * v > W / 2 - 0.9 && z < 0.9).length > 10, `foot volute ${sg}`);
  // The cap's ledge overhangs the neck by ROW_STONE.capOver.
  const xs = trim.flatMap(t => t.p.map(p => Math.abs(p[1])));
  assert.ok(xs.length && Math.max(...xs) >= W / 2 - 0.05);
  // A stated claws: false drops the scroll pieces.
  const n0 = draw({ ...c, stone: { claws: false } }).tris.length;
  assert.ok(n0 < tris.length - 40, 'claws drawn only when not refused');
});

test('crown stone: the neck foot band never crosses the attic light', () => {
  const { tris } = draw({ shape: 'neck', riseM: 3.4, attic: 1, dress: 'belt' });
  const glass = tris.filter(t => t.hex === '#272c33');
  assert.ok(glass.length > 0);
  const gz = glass.flatMap(t => t.p.map(p => p[2])), g0 = Math.min(...gz), g1 = Math.max(...gz);
  // No stone quad spanning the light's width at its height in front of it.
  const across = tris.filter(t => t.part === 'trim' && t.p.every(p => p[2] > g0 + 0.05 && p[2] < g1 - 0.05) && t.p.some(p => p[1] < -0.3) && t.p.some(p => p[1] > 0.3) && t.n[0] > 0.9);
  assert.equal(across.length, 0);
});

test('crown stone: a dark hood over a cornice, carved scrolls above the shoulder, and neck carving (Herengracht 55, 31)', () => {
  const c: RowCrown = { shape: 'neck', riseM: 3.4, attic: 1, dress: 'belt' };
  const plain = draw(c).tris;
  const hood = draw({ ...c, stone: { hood: 'dark' } }).tris;
  assert.ok(hood.some(t => t.hex === ROW_STONE_HOOD) && !plain.some(t => t.hex === ROW_STONE_HOOD));
  const carved = draw({ ...c, stone: { claws: 'carved' } }).tris, topOf = (ts: typeof plain) => Math.max(...ts.filter(t => t.part === 'trim').flatMap(t => t.p.filter(p => Math.abs(p[1]) < 2.2 && Math.abs(p[1]) > 1).map(p => p[2])));
  assert.ok(carved.length > plain.length);
  for (const neck of ['panel', 'cartouche', 'oculus'] as const) {
    const ts = draw({ ...c, riseM: 4.2, stone: { neck } }).tris;
    assert.ok(ts.length > draw({ ...c, riseM: 4.2 }).tris.length, `${neck} drawn`);
  }
  assert.ok(Number.isFinite(topOf(carved)));
});

test('crown stone: where the light fills the neck, a stated oculus still sits small between its head and the cornice (Herengracht 31)', () => {
  const c: RowCrown = { shape: 'neck', riseM: 2.8, attic: 1, cap: 'segmental', dress: 'belt' } as RowCrown;
  const hooded = draw({ ...c, stone: { hood: 'dark' } }).tris, withOculus = draw({ ...c, stone: { hood: 'dark', neck: 'oculus' } }).tris;
  assert.ok(withOculus.length > hooded.length);
  const glass = (ts: typeof hooded) => ts.filter(t => t.hex === '#272c33');
  const capGlass = glass(withOculus).length - glass(hooded).length;
  assert.ok(capGlass > 0);
});

test('crown stone: a stated cap carving fills the tympanum (shell or carved); absent: brick (Herengracht 51, 69)', () => {
  const c: RowCrown = { shape: 'neck', riseM: 3.4, attic: 1, cap: 'segmental', dress: 'belt' } as RowCrown;
  const plain = draw(c).tris;
  for (const cap of ['shell', 'carved'] as const) assert.ok(draw({ ...c, stone: { cap } }).tris.length > plain.length, cap);
});

test('crown stone: a stated festoon and shoulder ovals (Herengracht 0363100012176326) add carving; absent: unchanged', () => {
  const c: RowCrown = { shape: 'neck', riseM: 4.2, attic: 1, dress: 'belt' };
  const base = draw(c).tris, fest = draw({ ...c, stone: { festoon: true } }).tris, ovals = draw({ ...c, stone: { shoulders: 'oval' } }).tris;
  assert.deepEqual(draw({ ...c, stone: {} }).tris, base, 'an empty stone is the belt dress');
  assert.ok(fest.length > base.length + 100, 'the garland, its drops and the pendant');
  // The festoon hangs in the neck, clear of the neck's coping band, over the attic light.
  const extra = fest.slice(0).filter(t => t.part === 'trim' && !base.some(b => JSON.stringify(b) === JSON.stringify(t)));
  const vs = extra.flatMap(t => t.p.map(p => Math.abs(p[1])));
  assert.ok(Math.max(...vs) < 6.12 / 2, 'inside the gable');
  // One oval each side, out on the shoulders.
  const ov = ovals.filter(t => !base.some(b => JSON.stringify(b) === JSON.stringify(t))).flatMap(t => t.p.map(p => p[1]));
  assert.ok(ov.some(v => v < -1.6) && ov.some(v => v > 1.6), 'both shoulders');
  // A festoon takes the neck's carving space: a stated cartouche gives way.
  assert.deepEqual(draw({ ...c, stone: { festoon: true, neck: 'cartouche' } }).tris.length, fest.length);
});

test('belt neck: the attic light stands in the neck over the shoulders (Herengracht 0363100012176326); undressed: as before', () => {
  const glassZ = (c: RowCrown) => draw(c).tris.filter(t => t.hex === '#272c33').flatMap(t => t.p.map(p => p[2]));
  const belt = glassZ({ shape: 'neck', riseM: 4.2, attic: 1, dress: 'belt' }), plain = glassZ({ shape: 'neck', riseM: 4.2, attic: 1 });
  assert.ok(Math.min(...belt) >= 4.2 * 0.22, 'above the belt shoulder band');
  assert.ok(Math.abs(Math.min(...plain) - 0.3) < 1e-6, 'the stock neck keeps its light at the foot');
});
