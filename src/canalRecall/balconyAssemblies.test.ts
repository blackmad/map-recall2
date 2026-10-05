import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExtraSink, openBalconyStack, wallExtras, type ExtraContext } from './facadeExtras.js';

const wall = (over: Partial<ExtraContext> = {}): ExtraContext => ({
  id: 'stack', style: 'modern', period: 'modern', wallKey: 'front',
  f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 4 }, base: 0, top: 16,
  layout: { bays: 1, bayWidthM: 4, groundM: 3.2, storeys: 4, storeyM: 3, doorBays: [0] },
  wallHex: '#d8d2c5', accentHex: '#33403c', groundLevel: true, streetSide: true,
  openings: {
    upper: { axes: [1 / 6, .5, 5 / 6], width: .19, sill: .20, head: .90 },
    ground: null, doorWindow: null,
    door: { axis: .5, width: .28, bottom: 0, top: .7, fanlight: false },
  },
  ...over,
});

test('joint balcony stacks align decks and access leaves on one real opening axis', () => {
  const c = wall(), sink = new ExtraSink(180);
  openBalconyStack(c, sink);
  assert.equal(sink.tris.length, 150, 'three complete levels under the 52-triangle reserve fit the standard wall budget');
  const decks = sink.tris.filter(t => t.hex === '#b9b5ac');
  assert.equal(decks.length, 30);
  for (let k = 0; k < 3; k++) {
    const level = decks.slice(k * 10, (k + 1) * 10), points = level.flatMap(t => t.p);
    const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
    assert.ok(Math.abs((minX + maxX) / 2 - 2) < 1e-9, 'central opening repeated vertically');
    const top = Math.max(...points.map(p => p[2]));
    assert.ok(Math.abs(top - (3.2 + 3 * k + .04)) < 1e-9, 'deck at floor, not floating below window sill');
  }
  const glass = sink.tris.filter(t => t.hex === '#5d6f7c');
  assert.equal(glass.length, 12);
  for (const t of glass) for (const p of t.p) {
    assert.ok(p[0] > 1.62 && p[0] < 2.38, 'access leaf inside original opening width');
    assert.ok(-p[1] <= .013, 'access glazing flush to wall');
  }
  const rail = sink.tris.filter(t => t.hex === '#26282b');
  for (const t of rail) {
    const xs = t.p.map(p => p[0]), zs = t.p.map(p => p[2]);
    assert.ok(Math.max(...xs) - Math.min(...xs) < .05 || Math.max(...zs) - Math.min(...zs) < .05, 'railing contains narrow bars, no opaque parapet plate');
  }
});

test('balcony assembly is atomic per complete level and keeps finite contained geometry', () => {
  const c = wall();
  for (const budget of [0, 20, 51, 52, 103, 104, 180, 230]) {
    const sink = new ExtraSink(budget);
    openBalconyStack(c, sink);
    assert.ok(sink.tris.length <= budget);
    assert.equal(sink.tris.length % 50, 0, 'no deck emitted without its access leaf and rail');
    for (const t of sink.tris) {
      assert.ok(t.p.flat().every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...t.n) - 1) < 1e-8);
      for (const p of t.p) assert.ok(p[0] >= 0 && p[0] <= 4 && -p[1] >= -.02 && -p[1] <= .86 && p[2] <= 16);
    }
  }
  const narrow = new ExtraSink(180);
  openBalconyStack(wall({ f: { ...c.f, len: .8 }, layout: { ...c.layout, bayWidthM: .8 } }), narrow);
  assert.equal(narrow.tris.length, 0, 'no incompatible narrow facade gets a clipped balcony');
});

test('an explicit supported assembly gets priority without probability or competing fins', () => {
  const c = wall({ recipe: { family: 'punched', period: 'modern', confidence: .8, facadeAssembly: 'stacked-open-balcony', trimDensity: 'restrained', trim: { frames: 1, lintels: 1, cornice: 1, courses: 1, quoins: 0, arches: 0 } } });
  for (let i = 0; i < 20; i++) {
    const sink = new ExtraSink(230), used = wallExtras({ ...c, id: `stack${i}` }, sink);
    assert.equal(used[0], 'glass-balconies');
    assert.ok(!used.includes('vertical-fins') && !used.includes('gallery-walkway'));
    assert.ok(sink.tris.length <= 180);
  }
});

test('supported pale stack retains three complete levels, fine bars and continuous structural sides', () => {
  const pale = '#e6e1d4';
  const c = wall({ recipe: { family: 'punched', period: 'modern', confidence: .8, facadeAssembly: 'stacked-open-balcony', sash: 'paired-transom', frameHex: pale } });
  const sink = new ExtraSink(180);
  openBalconyStack(c, sink);
  assert.equal(sink.tris.length, 170, 'eight structural-side triangles plus three complete divided-access levels');
  assert.equal(sink.tris.filter(t => t.hex === '#b9b5ac').length, 30, 'all three thin floors retained');
  assert.ok(!sink.tris.some(t => t.hex === '#26282b'), 'supported stack uses observed pale rail palette');
  const bands = sink.tris.filter(t => t.hex === pale && Math.max(...t.p.map(p => p[2])) - Math.min(...t.p.map(p => p[2])) > 10);
  assert.equal(bands.length, 4, 'two continuous vertical faces span from ground ceiling to facade crown');
  for (const t of bands) {
    assert.ok(Math.abs(Math.min(...t.p.map(p => p[2])) - 3.2) < 1e-9);
    assert.ok(Math.max(...t.p.map(p => p[0])) - Math.min(...t.p.map(p => p[0])) < .1);
  }
  const frontBars = sink.tris.filter(t => t.hex === pale && t.p.every(p => Math.abs(-p[1] - .83) < 1e-9) &&
    Math.max(...t.p.map(p => p[0])) - Math.min(...t.p.map(p => p[0])) < .021 &&
    Math.max(...t.p.map(p => p[2])) - Math.min(...t.p.map(p => p[2])) > .9);
  assert.equal(frontBars.length, 48, 'eight fine two-triangle front bars per level');
});

test('a multi-bay joint stack follows the wide central access opening above its ground entrance', () => {
  const base = wall();
  const openings = { ...base.openings!, upper: { axes: [.17, .5, .83], width: .145, widths: [.145, .28, .145], sill: .20, head: .90 }, door: { ...base.openings!.door, axis: .5, width: .28 } };
  const c = wall({ f: { ...base.f, len: 12 }, layout: { ...base.layout, bays: 3, doorBays: [0] }, openings,
    recipe: { family: 'punched', period: 'modern', confidence: .8, facadeAssembly: 'stacked-open-balcony' } });
  const sink = new ExtraSink(180);
  openBalconyStack(c, sink);
  const decks = sink.tris.filter(t => t.hex === '#b9b5ac');
  assert.ok(decks.length > 0);
  for (let i = 0; i < decks.length; i += 10) {
    const points = decks.slice(i, i + 10).flatMap(t => t.p), lo = Math.min(...points.map(p => p[0])), hi = Math.max(...points.map(p => p[0]));
    assert.ok(Math.abs((lo + hi) / 2 - 2) < 1e-9, 'stack axis matches ground door in first allowed entrance bay');
  }
  const alternative = new ExtraSink(180);
  openBalconyStack({ ...c, layout: { ...c.layout, doorBays: [] } }, alternative);
  const points = alternative.tris.filter(t => t.hex === '#b9b5ac').slice(0, 10).flatMap(t => t.p);
  assert.ok(Math.abs((Math.min(...points.map(p => p[0])) + Math.max(...points.map(p => p[0]))) / 2 - 6) < 1e-9, 'without an entrance use a central access slot, never an arbitrary side window');
});
