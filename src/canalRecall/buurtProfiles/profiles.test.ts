import { brickLiftV2ProfileWall } from '../look/brickLift.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BuurtProfileIndex, pruneEras, storeyScaleOf, STOREY_SCALE_ENABLED, STOREY_SCALE_MAX, STOREY_SCALE_MIN, pickWeighted, profileTraits, unitDraw, validateProfileSet, type BuurtProfile, type BuurtProfileSet } from './profiles.ts';
import { bayLookFor } from '../bayLook.ts';
import { PERIOD_WALLS } from '../look/palette.ts';
import PUBLISHED from './buurt-profiles.json' with { type: 'json' };

const profile: BuurtProfile = {
  code: 'T01', name: 'Testbuurt', level: 'buurt', n: 40, confidence: 'medium', yearMix: { c19: 30, modern: 5 }, dominantEra: 'c19', shopShare: 0.5,
  eras: { c19: { n: 30, walls: [['#5a3a30', 3], ['#e8e2d4', 1]], paleAccentShare: 1, darkFrameShare: 0, archShare: 1, tallShare: 1 } },
};
const set = (rle = '3:0,1:1,2:0'): BuurtProfileSet => ({ schemaVersion: 1, revision: 't', profiles: [profile], grid: { west: 4.8, south: 52.3, dLng: 0.01, dLat: 0.01, cols: 3, rows: 2, rle } });

test('validate: grid must cover every cell and walls must be hexes', () => {
  assert.doesNotThrow(() => validateProfileSet(set()));
  assert.throws(() => validateProfileSet(set('3:0,1:1')), /grid covers/);
  assert.throws(() => validateProfileSet(set('3:0,1:2,2:0')), /grid run/);
  assert.throws(() => validateProfileSet({ ...set(), profiles: [{ ...profile, eras: { c19: { n: 3, walls: [['red', 1]] } } }] }), /walls/);
});

test('index: run-length grid, row-major from the south-west', () => {
  const index = new BuurtProfileIndex(set());
  assert.equal(index.at(4.805, 52.305), null);
  assert.equal(index.at(4.805, 52.315)?.code, 'T01'); // row 1, col 0 = cell 3
  assert.equal(index.at(4.815, 52.315), null);
  assert.equal(index.at(4.7, 52.3), null);
});

test('draws are deterministic per pand and follow the weights', () => {
  assert.equal(unitDraw('a', 'wall'), unitDraw('a', 'wall'));
  assert.notEqual(unitDraw('a', 'wall'), unitDraw('a', 'pale'));
  const picks = Array.from({ length: 4000 }, (_, i) => pickWeighted([['#000000', 3], ['#ffffff', 1]], unitDraw(`p${i}`, 'wall')));
  const dark = picks.filter(h => h === '#000000').length / picks.length;
  assert.ok(dark > 0.72 && dark < 0.78, `dark share ${dark}`);
  assert.deepEqual(profileTraits('x', undefined), { wall: null, pale: null, dark: null, arch: null, tall: null });
});

test('bayLookFor: no profile is byte-identical to the city default', () => {
  for (let i = 0; i < 200; i++) for (const [year, h] of [[1890, 14], [1650, 12], [1925, 15], [1970, 20], [null, 12]] as const) {
    assert.deepEqual(bayLookFor(`pand${i}`, year, h, 'photo', 'quiet', undefined, undefined, null), bayLookFor(`pand${i}`, year, h, 'photo', 'quiet'));
  }
});

test('bayLookFor: a profile picks its measured walls and matching presets, photo look only', () => {
  const walls = new Set<string>(), seen = new Set<string>();
  for (let i = 0; i < 300; i++) {
    const b = bayLookFor(`pand${i}`, 1890, 14, 'photo', 'quiet', undefined, undefined, profile);
    walls.add(b.wallHex); seen.add(JSON.stringify([b.variant.paleAccents, b.variant.lintel, b.variant.shape]));
    assert.ok(b.variant.paleAccents, 'pale accent share 1');
    assert.ok(b.variant.lintel === 'arch' || b.variant.shape === 'segmental', 'arch share 1');
    assert.equal(b.variant.openingGroup, undefined);
    const other = bayLookFor(`pand${i}`, 1890, 14, 'storybook', 'quiet', undefined, undefined, profile);
    assert.deepEqual(other, bayLookFor(`pand${i}`, 1890, 14, 'storybook', 'quiet'));
  }
  // brickLift is off by default since 2026-11-12 (v1 draws the raw pair); under v2 a profile's dark brick takes the linear-light gain, its pale render does not.
  assert.deepEqual([...walls].sort(), ['#5a3a30', '#e8e2d4'].sort());
  assert.equal(brickLiftV2ProfileWall('#e8e2d4'), '#e8e2d4');
  // An era without a profile keeps the city's period walls.
  assert.ok(PERIOD_WALLS.photo.modern!.includes(bayLookFor('m1', 1970, 15, 'photo', 'quiet', undefined, undefined, profile).wallHex));
  // No year: the buurt's dominant era.
  assert.equal(bayLookFor('n1', null, 12, 'photo', 'quiet', undefined, undefined, { ...profile, dominantEra: 'canal' }).archetype, 'canal');
});

test('published set validates, and the 12-spot buurten resolve to their own profiles', () => {
  const published = validateProfileSet(PUBLISHED as unknown as BuurtProfileSet);
  const index = new BuurtProfileIndex(published);
  // The generic-uplift sheet's spots (tests/e2e/generic-gap-strip.spec.ts): neighbouring buurten must differ.
  const spots: [string, number, number][] = [
    ['Tweede Egelantiersdwarsstraat', 4.882064, 52.376806], ['Tichelstraat', 4.880705, 52.379193], ['Eerste Looiersdwarsstraat', 4.881144, 52.368856],
    ['Bellamystraat', 4.865742, 52.367016], ['Ten Katestraat', 4.866931, 52.366855], ['Nicolaas Beetsstraat', 4.866072, 52.364679],
    ['Tweede Jan Steenstraat', 4.901409, 52.356425], ['Saenredamstraat', 4.889496, 52.355698], ['Daniël Stalpertstraat', 4.891577, 52.356126],
    ['Van Breestraat', 4.869844, 52.355087], ['Kerkstraat', 4.886966, 52.364464], ['Runstraat', 4.883577, 52.368888],
  ];
  const codes = spots.map(([name, lng, lat]) => { const p = index.at(lng, lat); assert.ok(p, `${name} has a profile`); return p!.code; });
  assert.ok(new Set(codes).size >= 6, `distinct profiles over the 12 spots: ${codes.join(' ')}`);
});

test('a profile wall replaces a material-family prior only within its family', async () => {
  const { profileWallBeatsMaterial } = await import('./profiles.ts');
  assert.equal(profileWallBeatsMaterial('brick', '#7a4535'), true);
  assert.equal(profileWallBeatsMaterial('brick', '#efe7d8'), false);
  assert.equal(profileWallBeatsMaterial('plaster', '#efe7d8'), true);
  assert.equal(profileWallBeatsMaterial('plaster', '#7a4535'), false);
  assert.equal(profileWallBeatsMaterial('concrete', '#7a4535'), false);
  assert.equal(profileWallBeatsMaterial(undefined, '#7a4535'), false);
});

test('pruneEras: drops thin and undrawable eras, leaves good profiles byte-identical', () => {
  const good = { c19: { n: 30, walls: [['#5a3a30', 3], ['#e8e2d4', 1]] as const, tallShare: 1 } };
  const same = pruneEras(good, 8);
  assert.equal(JSON.stringify(same.eras), JSON.stringify(good));
  assert.deepEqual(same.dropped, []);
  const bad = pruneEras({ canal: { n: 3, tallShare: 1 }, school: { n: 20, walls: [['#NaNNaN', 2]] }, c19: good.c19 }, 8);
  assert.deepEqual(Object.keys(bad.eras), ['c19']);
  assert.deepEqual(bad.dropped.sort(), ['canal', 'school']);
  assert.doesNotThrow(() => validateProfileSet({ ...set(), profiles: [{ ...profile, eras: bad.eras }] }));
});

test('storeyHeightM: held (scale 1 by default), validated, bounded when enabled, absent = scale 1', () => {
  assert.equal(STOREY_SCALE_ENABLED, false);
  assert.equal(storeyScaleOf({ n: 10, storeyHeightM: 3.6 }, 3), 1);
  assert.equal(storeyScaleOf(undefined, 3), 1);
  assert.equal(storeyScaleOf({ n: 10 }, 3), 1);
  assert.ok(Math.abs(storeyScaleOf({ n: 10, storeyHeightM: 3.15 }, 3, true) - 1.05) < 1e-9);
  assert.equal(storeyScaleOf({ n: 10, storeyHeightM: 5 }, 3, true), STOREY_SCALE_MAX);
  assert.equal(storeyScaleOf({ n: 10, storeyHeightM: 2.2 }, 3, true), STOREY_SCALE_MIN);
  const withKnob = (e: object, extra: object = {}) => ({ ...set(), profiles: [{ ...profile, ...extra, eras: { c19: { n: 9, ...e } } }] });
  assert.doesNotThrow(() => validateProfileSet(withKnob({ storeyHeightM: 3.1 }, { shopfrontShare: 0.4 })));
  assert.throws(() => validateProfileSet(withKnob({ storeyHeightM: 9 })), /storeyHeightM/);
  assert.throws(() => validateProfileSet(withKnob({}, { shopfrontShare: 1.4 })), /shopfrontShare/);
});

test('bayLookFor: shopfrontShare 0 / 1 decides the shop draw without the extract, absent keeps the old pick', () => {
  const base = { ...profile, shopShare: undefined };
  const none = { ...base, shopfrontShare: 0 }, all = { ...base, shopfrontShare: 1 };
  for (let i = 0; i < 40; i++) {
    const hasShop = (pr: BuurtProfile) => bayLookFor(`pand${i}`, 1890, 14, 'photo', undefined, undefined, undefined, pr).layers.ground !== bayLookFor(`pand${i}`, 1890, 14, 'photo', 'quiet', undefined, undefined, pr).layers.ground;
    assert.equal(hasShop(none), false);
    assert.equal(hasShop(all), true);
  }
  for (let i = 0; i < 40; i++) assert.deepEqual(bayLookFor(`p${i}`, 1890, 14, 'photo', undefined, undefined, undefined, base), bayLookFor(`p${i}`, 1890, 14, 'photo', undefined, undefined, undefined, { ...base, shopfrontShare: undefined }));
});

test('pruneEras: per-era minimum (pre-1945 20, modern 8) and the `from` marker validates', () => {
  const walls = [['#5a3a30', 3]] as const;
  const r = pruneEras({ canal: { n: 12, walls }, c19: { n: 20, walls }, modern: { n: 9, walls } }, { canal: 20, c19: 20, school: 20, modern: 8 });
  assert.deepEqual(Object.keys(r.eras).sort(), ['c19', 'modern']);
  assert.deepEqual(r.dropped, ['canal']);
  const withFrom = (from: unknown) => ({ ...set(), profiles: [{ ...profile, eras: { c19: { n: 30, walls, from } } }] }) as unknown as BuurtProfileSet;
  assert.doesNotThrow(() => validateProfileSet(withFrom('wijk')));
  assert.doesNotThrow(() => validateProfileSet(withFrom('stadsdeel')));
  assert.throws(() => validateProfileSet(withFrom('city')), /from/);
});
