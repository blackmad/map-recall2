import test from 'node:test';
import assert from 'node:assert/strict';
import { plotPlan, defaultStoreys, fillRoofPattern, ERA_GROUND_M, ROOF_ON_TOP_RISE_M, ROOF_INSIDE_MAX_M, ROOF_INSIDE_MIN_M, plotWhite, WHITE_HEAD_DRESSING, type PlotFacts } from './plotPlan.ts';

test('the count is never the top over a short storey: 4 storeys from a 12.4 m to a 19.7 m top by default', () => {
  for (const top of [12.4, 14.9, 16.7, 17.8, 19.7]) assert.equal(defaultStoreys(top, ERA_GROUND_M), 4, `${top}`);
  assert.equal(defaultStoreys(10.5, ERA_GROUND_M), 3, 'a 10.5 m top is 3 storeys');
  assert.equal(defaultStoreys(24, ERA_GROUND_M), 5, 'a 24 m top is 5');
});

test('Tweede Jacob van Campenstraat 9051 (12.37 m, 4 storeys read): the top is the cornice, the roof storey stands on it', () => {
  const p = plotPlan(12.37, { storeys: 4, ground: 'shop', roof: 'dormers', src: 'photo' }, { storey: true });
  assert.equal(p.rule, 'onTop');
  assert.equal(p.wallM, 12.37);
  assert.equal(p.riseM, ROOF_ON_TOP_RISE_M);
  assert.equal(p.storeys, 4);
  assert.equal(p.ground, 'shop');
});

test('Admiraal De Ruijterweg (16.7 m, 4 storeys): a 3 m roof storey inside the top; Rustenburgerstraat (14.9 m): 1.2 m', () => {
  const a = plotPlan(16.7, { storeys: 4, src: 'photo' }, { storey: true });
  assert.equal(a.rule, 'inside');
  assert.equal(a.riseM, ROOF_INSIDE_MAX_M);
  assert.ok(Math.abs(a.wallM - 13.7) < 1e-6);
  const r = plotPlan(14.9, { storeys: 4, src: 'photo' }, { storey: true });
  assert.equal(r.rule, 'inside');
  assert.ok(Math.abs(r.riseM - ROOF_INSIDE_MIN_M) < 0.01, `${r.riseM}`);
});

test('a gable plot stands on the same cornice line as its dormer neighbours; a flat plot keeps the top', () => {
  const d = plotPlan(16.7, { storeys: 4, roof: 'dormers', src: 'photo' }, {}), g = plotPlan(16.7, { storeys: 4, roof: 'pointedGable', src: 'photo' }, {});
  assert.equal(g.wallM, d.wallM);
  assert.equal(g.rule, 'none');
  assert.equal(plotPlan(16.7, { roof: 'flat', src: 'reads' }, {}).wallM, 16.7);
});

test('an AHN roof storey (rise >= 1.8 m) stands on top at its measured rise; the segment says no roof storey: flat', () => {
  const p = plotPlan(16.7, undefined, { storey: true, ahnRiseM: 3.1 });
  assert.equal(p.rule, 'onTop');
  assert.equal(p.riseM, 3.1);
  assert.equal(plotPlan(15, undefined, { storey: false }).roof, 'flat');
  assert.equal(plotPlan(15, undefined, { storey: true, roofSource: 'default' }).roofSrc, 'default');
});

test('a souterrain raises the ground storey', () => {
  assert.equal(plotPlan(19.6, { storeys: 4, souterrain: true, src: 'photo' }, {}).groundM, ERA_GROUND_M + 1.2);
});

test('the roof sequence: letters per plot, an unread plot filled from its mirror', () => {
  const plots: Record<string, PlotFacts> = { a: { roof: 'dormers', src: 'photo' }, b: { roof: 'pointedGable', src: 'photo' }, c: { src: 'reads' }, d: { roof: 'dormers', src: 'photo' }, f: { roof: 'dormers', src: 'photo' } };
  const { filled, pattern } = fillRoofPattern(['a', 'b', 'c', 'd', 'e', 'f'], plots);
  assert.deepEqual(filled, ['c', 'e']);
  assert.equal(plots.e.roof, 'pointedGable');
  assert.equal(plots.e.roofSrc, 'pattern');
  assert.equal(pattern, 'ABAABA');
});

test('white detailing: frames by era (1860-1915), heads and string courses only as read', () => {
  assert.deepEqual(plotWhite(1885, undefined), { frames: true, heads: 'none', courses: false });
  assert.deepEqual(plotWhite(1920, { src: 'photo', whiteHeads: 'blocks', stringCourses: true }), { frames: false, heads: 'blocks', courses: true });
  assert.equal(plotWhite(null, undefined).frames, false);
  assert.equal(WHITE_HEAD_DRESSING.blocks.dressing, 'voussoirs');
});
