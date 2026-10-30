import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAY_LAYER_COUNT, BAY_STYLES, bayLookFor } from './bayLook.js';
import { MODERN_STYLE, MODERN_WALLS, modernEraFor, modernUseFor, modernVocabulary } from './modernFacades.js';
import { buurtProfileAt } from './buurtProfiles/data.js';

const BUURT_PROFILES_FOR_TEST = buurtProfileAt(4.8821, 52.3768);

const ids = Array.from({ length: 1000 }, (_, i) => `NL.IMBAG.Pand.03631000121${String(i).padStart(5, '0')}`);
const setFlag = (v: boolean | undefined) => { (globalThis as { __canalRecallModernFacades?: boolean }).__canalRecallModernFacades = v; };

test('preset indices name the presets they claim', () => {
  const m = BAY_STYLES.modern;
  assert.equal(m[MODERN_STYLE.brick].wallMaterial, 'brick');
  assert.equal(m[MODERN_STYLE.brickDark].wallMaterial, 'brick');
  assert.equal(m[MODERN_STYLE.brickDark].frameTone, 'dark');
  assert.equal(m[MODERN_STYLE.smoothDark].frameTone, 'dark');
  assert.equal(m[MODERN_STYLE.ribbon].family, 'ribbon');
  assert.equal(m[MODERN_STYLE.curtain].family, 'curtain');
  assert.equal(m[MODERN_STYLE.gallery].facadeAssembly, 'stacked-open-balcony');
  // No new texture layers: the vocabulary only selects presets already in the array.
  assert.equal(BAY_LAYER_COUNT, 191);
});

test('pre-1945 and undated buildings never take the modern vocabulary', () => {
  for (const id of ids.slice(0, 200)) for (const year of [null, 1650, 1880, 1930, 1944]) assert.equal(modernVocabulary({ id, year, heightM: 20, footprintM2: 3000 }), null);
  assert.equal(modernEraFor(1944), null);
  assert.equal(modernEraFor(1945), 'reconstruction');
  assert.equal(modernEraFor(1980), 'renewal');
});

test('bayLookFor is byte-identical before 1945, without facts, off the photo look and with the flag off', () => {
  for (const [i, id] of ids.entries()) {
    const year = [1620, 1870, 1905, 1925, 1944, null][i % 6], h = 8 + (i % 30);
    const facts = { footprintM2: 200 + i * 7, buildingType: i % 9 === 0 ? 'office' : null };
    for (const profile of [null, BUURT_PROFILES_FOR_TEST]) assert.deepEqual(bayLookFor(id, year, h, 'photo', undefined, undefined, undefined, profile, facts), bayLookFor(id, year, h, 'photo', undefined, undefined, undefined, profile));
  }
  for (const id of ids.slice(0, 300)) {
    const facts = { footprintM2: 900 };
    assert.deepEqual(bayLookFor(id, 1985, 15, 'cartoon', undefined, undefined, undefined, null, facts), bayLookFor(id, 1985, 15, 'cartoon'));
    setFlag(false);
    const off = bayLookFor(id, 1985, 15, 'photo', undefined, undefined, undefined, null, facts);
    setFlag(undefined);
    assert.deepEqual(off, bayLookFor(id, 1985, 15, 'photo'));
  }
});

test('a recipe and a measured period wall still win', () => {
  const id = ids[3];
  const measured = bayLookFor(id, 1990, 15, 'photo', undefined, undefined, '#123456', null, { footprintM2: 500 });
  assert.equal(measured.wallHex, '#123456');
});

test('era x use picks: renewal housing is brick, late-modern offices are banded, curtain only on tall blocks', () => {
  const share = (year: number, heightM: number, footprintM2: number, buildingType: string | null, pred: (s: string) => boolean) =>
    ids.filter(id => pred(modernVocabulary({ id, year, heightM, footprintM2, buildingType })!.style)).length / ids.length;
  assert.ok(share(1988, 15, 600, null, s => s.startsWith('brick')) >= 0.8, 'renewal housing mostly brick');
  assert.ok(share(1970, 24, 2500, null, s => s === 'ribbon' || s === 'curtain') >= 0.6, 'late-modern office mostly banded');
  assert.ok(share(1972, 14, 600, null, s => s === 'gallery') >= 0.2, 'late-modern housing has gallery stacks');
  assert.equal(share(2010, 12, 3000, 'office', s => s === 'curtain'), 0, 'no curtain below 15 m');
  assert.equal(share(1960, 9, 300, null, s => s === 'gallery'), 0, 'no gallery below 11 m');
  assert.ok(share(2010, 30, 3000, 'office', s => s === 'curtain') >= 0.3);
});

test('use: OSM type first, then the deep post-war footprint proxy', () => {
  assert.equal(modernUseFor({ id: 'a', year: 1990, heightM: 10, buildingType: 'office' }), 'office');
  assert.equal(modernUseFor({ id: 'a', year: 1990, heightM: 10, buildingType: 'retail' }), 'shop');
  assert.equal(modernUseFor({ id: 'a', year: 1968, heightM: 20, footprintM2: 2000 }), 'office');
  assert.equal(modernUseFor({ id: 'a', year: 1990, heightM: 20, footprintM2: 2000 }), 'housing');
  assert.equal(modernUseFor({ id: 'a', year: 1968, heightM: 12, footprintM2: 2000 }), 'housing');
});

test('deterministic, brick walls take brick swatches and smooth walls concrete or render', () => {
  const brick = new Set([...MODERN_WALLS['brick-buff'], ...MODERN_WALLS['brick-red'], ...MODERN_WALLS['brick-dark']]);
  for (const id of ids) {
    const f = { id, year: 1950 + (hash(id) % 75), heightM: 9 + (hash(id) % 25), footprintM2: 300 + (hash(id) % 3000) };
    const v = modernVocabulary(f)!;
    assert.deepEqual(v, modernVocabulary(f));
    const isBrick = BAY_STYLES.modern[v.styleIndex].wallMaterial === 'brick';
    assert.equal(brick.has(v.wall), isBrick, `${id} ${v.style} ${v.wall}`);
    const look = bayLookFor(id, f.year, f.heightM, 'photo', undefined, undefined, undefined, null, f);
    assert.equal(look.wallHex, v.wall);
    assert.equal(look.style, v.styleIndex);
    if (v.style === 'ribbon' || v.style === 'curtain') assert.equal(look.accentHex, v.accent);
  }
});

function hash(s: string): number { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

test('a measured modern era decides the wall and the material; banded offices keep concrete', () => {
  const painted = { n: 20, walls: [['#e8e6e0', 1]] as const };
  const brick = { n: 20, walls: [['#5a463e', 1]] as const };
  for (const id of ids.slice(0, 300)) {
    const f = { id, year: 1986, heightM: 14, footprintM2: 700 };
    const p = modernVocabulary(f, painted)!, b = modernVocabulary(f, brick)!;
    assert.equal(p.wall, '#e8e6e0'); assert.notEqual(BAY_STYLES.modern[p.styleIndex].wallMaterial, 'brick');
    assert.equal(b.wall, '#5a463e'); assert.equal(BAY_STYLES.modern[b.styleIndex].wallMaterial, 'brick');
    assert.deepEqual(modernVocabulary(f, { n: 3 }), modernVocabulary(f));
    const office = { id, year: 1970, heightM: 24, footprintM2: 2500 }, o = modernVocabulary(office)!;
    if (o.style === 'ribbon' || o.style === 'curtain') assert.deepEqual(modernVocabulary(office, brick), o);
  }
});
