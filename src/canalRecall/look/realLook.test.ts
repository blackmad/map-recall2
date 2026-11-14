// The realLook levers (look/realLook.ts, lane default-look-realism 2026-11-14): measured fallbacks for the photo look's
// unmeasured walls, doors and tree crowns; off by default and byte-identical when off.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REAL_DOOR_SWATCHES, REAL_LOOK_DEFAULT, TREE_SPREAD, realDoorSwatch, realFoliageHex, realLookLevers, realLookOn, resetRealLook } from './realLook.ts';
import { measuredPoolDraw, measuredPoolDrawWide, REAL_LOOK_WALL_RADIUS_M } from './measuredWallPool.ts';
import { hexToOklab } from '../houseSpec/wallColour.ts';
import { bayLookFor } from '../bayLook.ts';
import { buurtProfileAt } from '../buurtProfiles/data.ts';
import TABLE from './measured-wall-pool.json' with { type: 'json' };

const withReal = <T>(v: string | undefined, f: () => T): T => {
  const g = globalThis as { __canalRecallRealLook?: string }, prev = g.__canalRecallRealLook;
  if (v === undefined) delete g.__canalRecallRealLook; else g.__canalRecallRealLook = v;
  resetRealLook();
  try { return f(); } finally { if (prev === undefined) delete g.__canalRecallRealLook; else g.__canalRecallRealLook = prev; resetRealLook(); }
};
// Van Hallstraat (Staatsliedenbuurt) and Dapperstraat: no measured wall within the pool's 600 m (pool draw null).
const OUTSIDE: readonly (readonly [number, number])[] = [[4.8745, 52.3820], [4.9275, 52.3628], [4.8855, 52.3690]];
const IDS = Array.from({ length: 40 }, (_, i) => `NL.IMBAG.Pand.03631000121${String(70000 + i * 37).padStart(5, '0')}`);

test('the flag: off by default; 1/all every lever; a list a subset; 0 none', () => {
  assert.deepEqual([...realLookLevers(undefined)], [...REAL_LOOK_DEFAULT]);
  assert.equal(REAL_LOOK_DEFAULT.length, 0);
  assert.deepEqual([...realLookLevers('1')].sort(), ['doors', 'trees', 'walls']);
  assert.deepEqual([...realLookLevers('walls,trees')].sort(), ['trees', 'walls']);
  assert.deepEqual([...realLookLevers('0')], []);
  assert.deepEqual([...realLookLevers('bogus')], []);
  withReal('doors', () => { assert.equal(realLookOn('doors'), true); assert.equal(realLookOn('walls'), false); });
  withReal(undefined, () => assert.equal(realLookOn('walls'), false));
});

test('off: bayLookFor is byte-identical to the levers asked off explicitly, every look', () => {
  for (const at of [...OUTSIDE, [4.8667, 52.3662] as const]) {
    const profile = buurtProfileAt(at[0], at[1]);
    for (const id of IDS.slice(0, 12)) for (const year of [1650, 1900, 1925, null]) for (const look of ['photo', 'storybook', 'cartoon'] as const) {
      const a = withReal(undefined, () => bayLookFor(id, year, 14, look, 'quiet', undefined, undefined, profile, undefined, undefined, at));
      const b = withReal('0', () => bayLookFor(id, year, 14, look, 'quiet', undefined, undefined, profile, undefined, undefined, at));
      assert.deepEqual(a, b, `${id} ${year} ${look}`);
    }
  }
});

test('walls: beyond the 600 m pool an unmeasured pre-1945 pand draws a measured wall, not a profile swatch', () => {
  const pts = (TABLE as any).points as [number, number, string, number, number?][];
  const measured = new Set(pts.map(p => p[2]));
  const C = (hex: string) => { const [, a, b] = hexToOklab(hex); return Math.hypot(a, b); };
  let offC = 0, onC = 0, n = 0;
  for (const at of OUTSIDE) {
    assert.equal(measuredPoolDraw(at[0], at[1], 'c19', 1), null, 'outside the W1 pool');
    assert.ok(measuredPoolDrawWide(at[0], at[1], 'c19', 1), `inside ${REAL_LOOK_WALL_RADIUS_M} m`);
    const profile = buurtProfileAt(at[0], at[1]);
    for (const id of IDS) {
      const off = withReal(undefined, () => bayLookFor(id, 1900, 14, 'photo', 'quiet', undefined, undefined, profile, undefined, undefined, at));
      const on = withReal('walls', () => bayLookFor(id, 1900, 14, 'photo', 'quiet', undefined, undefined, profile, undefined, undefined, at));
      assert.ok(measured.has(on.wallHex), `${on.wallHex} is a measured wall`);
      assert.equal(on.accentHex, off.accentHex, 'walls lever leaves the accent');
      offC += C(off.wallHex); onC += C(on.wallHex); n++;
    }
  }
  assert.ok(onC / n < offC / n, `mean chroma falls: ${(offC / n).toFixed(3)} -> ${(onC / n).toFixed(3)}`);
});

test('walls: a stamped measured wall and a recipe wall still win; other looks and modern pands are untouched', () => {
  const at = OUTSIDE[0], profile = buurtProfileAt(at[0], at[1]);
  withReal('1', () => {
    assert.equal(bayLookFor(IDS[0], 1900, 14, 'photo', 'quiet', undefined, '#123456', profile, undefined, undefined, at).wallHex, '#123456');
    assert.equal(bayLookFor(IDS[0], 1900, 14, 'photo', 'quiet', { family: 'masonry', period: 'c19', wallHex: '#654321' } as any, undefined, profile, undefined, undefined, at).wallHex, '#654321');
  });
  for (const look of ['storybook', 'cartoon'] as const) assert.deepEqual(
    withReal('1', () => bayLookFor(IDS[1], 1900, 14, look, 'quiet', undefined, undefined, profile, undefined, undefined, at)),
    withReal('0', () => bayLookFor(IDS[1], 1900, 14, look, 'quiet', undefined, undefined, profile, undefined, undefined, at)), look);
  assert.equal(withReal('walls', () => bayLookFor(IDS[2], 1980, 30, 'photo', 'quiet', undefined, undefined, profile, undefined, undefined, at)).wallHex,
    withReal('0', () => bayLookFor(IDS[2], 1980, 30, 'photo', 'quiet', undefined, undefined, profile, undefined, undefined, at)).wallHex, 'modern');
});

test('doors: the measured shares, mostly black; photo look only', () => {
  assert.equal(REAL_DOOR_SWATCHES.length, 40);
  const black = REAL_DOOR_SWATCHES.filter(h => hexToOklab(h)[0] < 0.3 && Math.hypot(hexToOklab(h)[1], hexToOklab(h)[2]) < 0.02).length / 40;
  assert.ok(black > 0.55 && black < 0.65, `black share ${black}`);
  const counts = new Map<string, number>();
  for (let i = 0; i < 4000; i++) { const h = realDoorSwatch(Math.imul(i, 2654435761)); counts.set(h, (counts.get(h) ?? 0) + 1); }
  assert.ok((counts.get('#1f2b45') ?? 0) < 200, 'navy is rare');
  const at = OUTSIDE[1], profile = buurtProfileAt(at[0], at[1]);
  const on = withReal('doors', () => bayLookFor(IDS[3], 1900, 14, 'photo', 'quiet', undefined, undefined, profile, undefined, undefined, at));
  assert.ok(REAL_DOOR_SWATCHES.includes(on.accentHex));
  assert.deepEqual(withReal('doors', () => bayLookFor(IDS[3], 1900, 14, 'storybook', 'quiet', undefined, undefined, profile)),
    withReal('0', () => bayLookFor(IDS[3], 1900, 14, 'storybook', 'quiet', undefined, undefined, profile)));
});

test('trees: the sampled prior with a bounded per-tree spread, deterministic', () => {
  const prior = '#78945a', [L0] = hexToOklab(prior);
  const hexes = Array.from({ length: 200 }, (_, i) => realFoliageHex(prior, `tree-${i}`));
  assert.equal(realFoliageHex(prior, 'tree-7'), hexes[7]);
  assert.ok(new Set(hexes).size > 20, 'trees differ');
  for (const h of hexes) {
    const [L, a, b] = hexToOklab(h);
    assert.ok(Math.abs(L - L0) < 0.05, `${h} lightness within the spread`);
    assert.ok(Math.atan2(b, a) > 1.5 && Math.atan2(b, a) < 2.6, `${h} stays green`);
  }
  assert.ok(TREE_SPREAD.light <= 0.1);
});
