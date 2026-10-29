import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BuurtProfileIndex, pickWeighted, profileTraits, unitDraw, validateProfileSet, type BuurtProfile, type BuurtProfileSet } from './profiles.ts';
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
  assert.deepEqual([...walls].sort(), ['#5a3a30', '#e8e2d4']);
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
