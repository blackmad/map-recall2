/** Round 2 of the post-1965 kit (lane postwar-kit-r2-20261121): feature reads, siblings, new components, curved runs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExtraSink, type ExtraContext } from '../facadeExtraCore.js';
import { FEATURE_READ_COUNT, SIBLING_COUNT, postwarExtraIds, postwarKitFor, validateFeatures, validateSiblings } from './kit.js';
import { BAND, ERKER, balconyBand, brickErkers, darkErkers, erkerAxes, stairAxes, stairGlazing, whiteErkers } from './components.js';
import { CURVE_EXTRAS, curvedChains, curvedRunEdges } from './curve.js';
import SIBLINGS from './sibling-features.json';

const ctx = (len: number, kit: Partial<NonNullable<ExtraContext['postwarKit']>> = {}, storeys = 4): ExtraContext => ({
  id: 'p', style: 'modern', wallKey: 'w', f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len }, base: 0, top: 3.2 + storeys * 2.9 + 0.6,
  layout: { bays: Math.max(1, Math.round(len / 3.6)), bayWidthM: len / Math.max(1, Math.round(len / 3.6)), groundM: 3.2, storeys, storeyM: 2.9, doorBays: [0] } as ExtraContext['layout'],
  wallHex: '#9a5240', accentHex: '#ffffff', groundLevel: true, streetSide: true, postwarKit: { balconyHex: '#e9e7e1', pierHex: '#9a5240', ...kit },
});
const cost = (fn: (c: ExtraContext, s: ExtraSink) => void, c: ExtraContext) => { const s = new ExtraSink(20_000); fn(c, s); return s; };

test('feature and sibling files validate; bad rows throw', () => {
  assert.ok(FEATURE_READ_COUNT >= 100, `${FEATURE_READ_COUNT}`);
  assert.ok(SIBLING_COUNT >= 20, `${SIBLING_COUNT}`);
  assert.throws(() => validateFeatures({ schemaVersion: 1, features: { '0363100012068068': { stair: 'spiral' as never } } }));
  assert.throws(() => validateFeatures({ schemaVersion: 2, features: {} }));
  assert.throws(() => validateSiblings({ schemaVersion: 1, siblings: { '0363100012068068': { balcony: 'loggia' as never, balconyTone: 'white', from: '0363100012068069' } } }));
});

test('a features-only pand keeps today\'s wall and draws its read (Spitsbergenstraat 82-102: the glazed stair strip)', () => {
  const k = postwarKitFor({ id: '0363100012068068', year: 1988, heightM: 15, use: 'housing' })!;
  assert.equal(k.wallSource, 'features');
  assert.equal(k.wall, null);
  assert.equal(k.painted, null);
  assert.equal(k.stair, 'glazed-strip');
  assert.deepEqual(postwarExtraIds(k), ['postwar-stair-glazing']);
  // Two storeys: no features, no wall evidence: no kit at all.
  assert.equal(postwarKitFor({ id: '0363100012068068', year: 1988, heightM: 7, use: 'housing' }), null);
});

test('a measured pand with a feature read takes both (Wagenaarstraat 485-501: canted white erkers, dark projecting balconies)', () => {
  const k = postwarKitFor({ id: '0363100012067983', year: 1981, heightM: 14, use: 'housing' })!;
  assert.equal(k.wallSource, 'measured');
  assert.equal(k.erker, 'white-glass');
  assert.equal(k.erkerPlan, 'canted');
  assert.equal(k.erkerCount, 3);
  assert.equal(k.balcony, 'projecting');
  assert.deepEqual(postwarExtraIds(k), ['postwar-projecting-balconies', 'postwar-white-erkers']);
});

test('a read pand keeps its own erker; the feature read adds its stairs (Marnixstraat 125-127, Haarlemmer Houttuinen 491-545)', () => {
  const marnix = postwarKitFor({ id: '0363100012173278', year: 1996, heightM: 15, use: 'housing' })!;
  assert.equal(marnix.erker, 'dark-glass');
  assert.equal(marnix.erkerCount, undefined);
  const hh = postwarKitFor({ id: '0363100012185423', year: 1982, heightM: 15, use: 'housing' })!;
  assert.equal(hh.wallSource, 'read');
  assert.equal(hh.stair, 'glazed-tower');
});

test('a sibling inherits its read neighbour\'s balconies, not on a low block', () => {
  const [id, sib] = Object.entries(SIBLINGS.siblings)[0];
  const k = postwarKitFor({ id, year: 1990, heightM: 15, use: 'housing' })!;
  assert.equal(k.balcony, sib.balcony);
  assert.equal(k.balconyFrom, sib.from);
  const low = postwarKitFor({ id, year: 1990, heightM: 6, use: 'housing' });
  assert.ok(!low || low.balcony === 'none');
  assert.equal(postwarKitFor({ id, year: 1990, heightM: 15, use: 'office' }), null);
});

test('erker axes: round 1 placement without a count; a count spreads them, never touching', () => {
  const r1 = ctx(30);
  const before = cost(darkErkers, r1).tris.length;
  assert.ok(before > 0);
  assert.equal(erkerAxes(r1, ERKER.halfW).length, 2);
  const three = erkerAxes(ctx(30, { erkerCount: 3 }), 1.3);
  assert.equal(three.length, 3);
  for (let i = 1; i < three.length; i++) assert.ok(Math.abs(three[i] - three[i - 1]) >= 2 * 1.3 + 0.6);
  assert.equal(erkerAxes(ctx(8, { erkerCount: 4 }), 1.3).length, 1);
});

test('white and brick erkers and glazed stairs: bounded, nothing without the kit context', () => {
  for (const plan of ['box', 'canted', 'round'] as const) {
    const n = cost(whiteErkers, ctx(24, { erkerCount: 2, erkerPlan: plan })).tris.length;
    assert.ok(n > 0 && n < 400, `${plan} ${n}`);
  }
  assert.ok(cost(brickErkers, ctx(24, { erkerCount: 1 })).tris.length > 0);
  const strip = cost(stairGlazing, ctx(24, { stair: 'glazed-strip', stairCount: 1 })).tris.length;
  const tower = cost(stairGlazing, ctx(24, { stair: 'glazed-tower', stairCount: 1 })).tris.length;
  assert.ok(strip > 0 && strip < 120, `${strip}`);
  assert.ok(tower > strip, `${tower}`);
  assert.equal(cost(stairGlazing, ctx(24)).tris.length, 0);
  assert.equal(cost(stairGlazing, { ...ctx(24, { stair: 'glazed-strip' }), postwarKit: undefined }).tris.length, 0);
  // At the entrance: the door bay's axis.
  const [x] = stairAxes(ctx(24, { stair: 'glazed-strip' }));
  assert.ok(x >= 0.85 + 0.2 - 1e-9 && x < 24 / Math.round(24 / 3.6) + 0.01, `${x}`);
});

test('curved runs: an arc of short facets is curved; a straight run with one kink is not', () => {
  const arc = (r: number, n: number, deg: number) => Array.from({ length: n }, (_, i) => {
    const a0 = (i / n) * deg * Math.PI / 180, a1 = ((i + 1) / n) * deg * Math.PI / 180;
    const x0 = r * Math.sin(a0), y0 = r - r * Math.cos(a0), x1 = r * Math.sin(a1), y1 = r - r * Math.cos(a1);
    return { x0, y0, x1, y1, len: Math.hypot(x1 - x0, y1 - y0) };
  });
  assert.deepEqual(curvedRunEdges(arc(20, 8, 60)), new Array(8).fill(true));
  const kink = [{ x0: 0, y0: 0, x1: 6, y1: 0, len: 6 }, { x0: 6, y0: 0, x1: 12, y1: 1, len: Math.hypot(6, 1) }, { x0: 12, y0: 1, x1: 18, y1: 1, len: 6 }];
  assert.deepEqual(curvedRunEdges(kink), [false, false, false]);
  // Closed rings: Tugelaweg 79-84's rounded end (13 facets, 172 deg) is one chain; a rectangle has none.
  const ring = arc(9, 13, 172).map(e => [e.x0, e.y0] as [number, number]);
  ring.push([0, 18], [-20, 18], [-20, 0]);
  assert.equal(curvedChains(ring).length, 1);
  assert.equal(curvedChains([[0, 0], [10, 0], [10, 10], [0, 10]]).length, 0);
  assert.deepEqual([...CURVE_EXTRAS], ['postwar-balcony-band', 'postwar-arcade']);
});

test('a band on a curved facet runs through its joints and draws on a short facet; off the curve it is unchanged', () => {
  const xs = (s: ExtraSink) => s.tris.flatMap(t => t.p.map(p => p[0]));
  const plain = cost(balconyBand, ctx(10));
  assert.ok(Math.min(...xs(plain)) >= BAND.inset - 1e-9);
  const joined = cost(balconyBand, ctx(10, { curved: true, joinStart: true, joinEnd: true }));
  assert.ok(Math.min(...xs(joined)) < 1e-9 && Math.max(...xs(joined)) > 10 - 1e-9);
  assert.equal(cost(balconyBand, ctx(2)).tris.length, 0);
  assert.ok(cost(balconyBand, ctx(2, { curved: true })).tris.length > 0);
});
