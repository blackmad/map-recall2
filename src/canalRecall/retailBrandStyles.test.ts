// Round 7 (lane retail-real, David 2026-11-16 "FEBO still bad", Korte Niezel): the measured brand table, the kit parts
// it drives (letters on the wall, a blade's glyph, plate glass), the postcard racks and chalkboards, and byte-identity
// with `?retailBrand` off. `node --import tsx --test src/canalRecall/retailBrandStyles.test.ts`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCEPTED_BRANDS, BRAND_MIN_CONF, BRAND_STYLES, brandAccepted, brandLook, type BrandStyle } from './retailBrandStyles.js';
import { retailBrandOn } from './retailPages.js';
import { FRONT, retailFrontTris, type RetailFrontInput } from './retailFront.js';

const g = globalThis as { __canalRecallRetailBrand?: boolean };
const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: 1 };
const run = (input: RetailFrontInput, on: boolean) => { g.__canalRecallRetailBrand = on; try { return retailFrontTris(input, e, 0.3, 6.3, 0, 3.6); } finally { delete g.__canalRecallRetailBrand; } };

test('every brand has a source URL, a fetch date and its panoramas', () => {
  assert.ok(Object.keys(BRAND_STYLES).length >= 25);
  for (const [k, s] of Object.entries(BRAND_STYLES)) {
    assert.match(s.source.url, /^https:\/\//, k);
    assert.match(s.source.fetched, /^\d{4}-\d{2}-\d{2}$/, k);
    assert.ok(s.panoramas.length >= 2, `${k}: ${s.panoramas.length} panoramas`);
  }
});

test('named regression: FEBO Korte Niezel (pand 0363100012177960; shot ui/2026-11-16-user-shots/febo-korte-niezel.png)', () => {
  // Red channel letters straight on the pale stone, no band; a white blade with a red F; dark plate glass.
  const f = brandLook('febo')!;
  assert.equal(f.mount, 'wall');
  assert.equal(f.fascia, undefined);
  assert.equal(f.bladeGlyph, 'F');
  assert.equal(f.window, 'plate');
  const red = (h: string) => { const n = parseInt(h.slice(1), 16); return ((n >> 16) & 255) > 180 && ((n >> 8) & 255) < 90; };
  assert.ok(red(f.letters!) && red(f.bladeInk!));
  const white = parseInt(f.blade!.slice(1, 3), 16) > 220;
  assert.ok(white, f.blade);
});

test('thin measurements do not act', () => {
  const s: BrandStyle = { ...BRAND_STYLES.febo, seenIn: 1 };
  assert.equal(brandLook('x', { x: s }), undefined);
  assert.equal(brandLook('x', { x: { ...BRAND_STYLES.febo, conf: BRAND_MIN_CONF - 0.01 } }), undefined);
  // A blade whose mark is not one letter stays a plain box.
  const m = brandLook('x', { x: { ...BRAND_STYLES.febo, blade: { box: '#ffffff', glyph: 'swirl', ink: '#000000', shape: 'square' } } })!;
  assert.equal(m.blade, '#ffffff');
  assert.equal(m.bladeGlyph, undefined);
});

test('byte-identical with ?retailBrand off, and with no brand', () => {
  const input: RetailFrontInput = { template: 'febo', seed: 'k', letters: 9, goods: 20, brand: 'febo', wallHex: '#d9d2c3' };
  const { brand: _b, wallHex: _w, ...plain } = input;
  assert.deepEqual(run(input, false), run(plain, false));
  assert.deepEqual(run(plain, true), run(plain, false));
  assert.notDeepEqual(run(input, true), run(input, false));
});

test('FEBO on: no board, letters on the wall, a blade glyph on both faces, plate glass with no goods', () => {
  const input: RetailFrontInput = { template: 'febo', seed: 'k', letters: 9, goods: 20, brand: 'febo', wallHex: '#d9d2c3' };
  const on = run(input, true), off = run(input, false);
  const out = (t: { p: number[][] }) => Math.max(...t.p.map(p => p[1]));
  // The board stood FRONT.fasciaOutM out in the fascia colour; on the wall nothing in the yellow stands that far.
  assert.ok(off.some(t => t.hex === '#f6d300'));
  assert.ok(!on.some(t => t.hex === '#f6d300'));
  const letters = on.filter(t => t.layer === 9 && Math.abs(t.n[2]) < 1e-9 && Math.abs(t.n[1]) > 0.9);
  assert.ok(letters.length >= 8 && letters.every(t => out(t) < 0.05 && t.accentHex === '#d9d2c3'));
  // The blade's F: a quad on each face across the wall (normal along u), reading the right way round on both.
  const side = on.filter(t => t.layer === 9 && Math.abs(t.n[0]) > 0.9);
  assert.equal(side.length, 4);
  assert.deepEqual(new Set(side.map(t => Math.sign(t.n[0]))), new Set([1, -1]));
  for (const s of [1, -1]) {
    const tris = side.filter(t => Math.sign(t.n[0]) === s), pts = tris.flatMap(t => t.p.map((p, i) => [p, t.uv![i]] as const));
    // u grows toward the viewer's right: for the +x face (viewer looking -x) that is +y (out), for -x it is -y.
    const near = pts.reduce((a, b) => (b[0][1] < a[0][1] ? b : a)), far = pts.reduce((a, b) => (b[0][1] > a[0][1] ? b : a));
    assert.equal(Math.sign(far[1][0] - near[1][0]), s);
  }
  assert.equal(on.filter(t => t.layer !== undefined && t.layer >= 20).length, 0);
  assert.ok(on.some(t => t.hex === '#20272c'));
});

test('racks are postcard stands and boards chalkboards, with no slab face', () => {
  for (const tpl of ['souvenir', 'books'] as const) {
    const on = run({ template: tpl, seed: 's' }, true), off = run({ template: tpl, seed: 's' }, false);
    assert.ok(off.some(t => t.hex === (tpl === 'souvenir' ? '#2f6fb0' : '#c9a227')));
    // No face out on the pavement (o > 0.3) larger than a card or the board's face.
    const area = (t: { p: number[][] }) => { const [a, b, c] = t.p, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2; };
    const props = on.filter(t => t.p.every(p => p[1] > 0.3) && Math.abs(t.n[1]) > 0.9);
    assert.ok(props.length > 0);
    if (tpl === 'souvenir') assert.ok(props.every(t => area(t) < 0.03), 'cards only');
    else assert.ok(props.some(t => t.hex === '#2b2f2c') && props.filter(t => t.hex === '#e8e4da').length >= 6);
    assert.ok(!on.some(t => t.hex === '#2f6fb0' && area(t) > 0.05));
  }
  assert.equal(FRONT.fasciaM, 0.6);
});

test('round t: only the blind-accepted brands (FEBO, HEMA) draw their style by default; the losers keep today', () => {
  assert.deepEqual([...ACCEPTED_BRANDS].sort(), ['febo', 'hema']);
  for (const k of ['febo', 'hema']) assert.ok(brandAccepted(k, false));
  for (const k of ['kruidvat', 'dirk', 'mcdonalds', 'starbucks', 'ah']) {
    assert.ok(!brandAccepted(k, false));
    assert.ok(brandAccepted(k, true));
  }
  // A losing brand under the default draws exactly as with no brand at all.
  const ga = globalThis as { __canalRecallRetailBrandAll?: boolean };
  ga.__canalRecallRetailBrandAll = false;
  try {
    const input: RetailFrontInput = { template: 'kruidvat', seed: 'k', letters: 9, goods: 20, brand: 'kruidvat', wallHex: '#d9d2c3' };
    const { brand: _b, ...plain } = input;
    assert.deepEqual(run(input, true), run(plain, true));
  } finally { delete ga.__canalRecallRetailBrandAll; }
});

test('round t: ?retailBrand is on by default (no query, no env)', () => {
  const g2 = globalThis as { __canalRecallRetailBrand?: boolean };
  delete g2.__canalRecallRetailBrand;
  assert.equal(retailBrandOn(), process.env.RETAIL_BRAND !== '0');
});
