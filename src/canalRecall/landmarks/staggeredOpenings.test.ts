// Staggered punched openings and the Warren truss elevation (Pontsteiger 2026-11-14).
//   node --import tsx --test src/canalRecall/landmarks/staggeredOpenings.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {staggeredOpenings} from './staggeredOpenings';
import {warrenTruss} from './warrenTruss';

const base = {length: 26, module: 1.3, widths: [2, 3], piers: [1, 2], edge: 1, storeys: 26, seed: 7};

test('deterministic: one seed, one wall; another seed, another wall', () => {
  assert.deepEqual(staggeredOpenings(base), staggeredOpenings(base));
  assert.notDeepEqual(staggeredOpenings(base), staggeredOpenings({...base, seed: 8}));
});

test('openings stay inside the end margins, on the module, with at least the smallest pier between them', () => {
  const ops = staggeredOpenings({...base, loggia: 0.3});
  const slots = Math.floor(base.length / base.module), lead = (base.length - slots * base.module) / 2;
  for (const o of ops) {
    assert.ok(o.u0 >= lead + base.edge * base.module - 1e-9 && o.u1 <= base.length - lead - base.edge * base.module + 1e-9, 'inside margins');
    const n = (o.u1 - o.u0) / base.module;
    assert.ok(base.widths.some(w => Math.abs(w - n) < 1e-9), 'a listed width');
    assert.ok(Math.abs(((o.u0 - lead) / base.module) - Math.round((o.u0 - lead) / base.module)) < 1e-9, 'on the module');
  }
  for (let s = 0; s < base.storeys; s++) {
    const row = ops.filter(o => o.storey === s).sort((a, b) => a.u0 - b.u0);
    assert.ok(row.length >= 3, `storey ${s} has openings`);
    for (let i = 1; i < row.length; i++) assert.ok(row[i].u0 - row[i - 1].u1 >= base.module - 1e-9, 'pier >= one module');
  }
  assert.ok(ops.some(o => o.kind === 'loggia') && ops.some(o => o.kind === 'window'));
});

test('storeys are staggered: the openings do not stack into one repeated column pattern', () => {
  const ops = staggeredOpenings(base);
  const sig = (s: number) => ops.filter(o => o.storey === s).map(o => `${o.u0.toFixed(2)}-${o.u1.toFixed(2)}`).join(',');
  const distinct = new Set(Array.from({length: base.storeys}, (_, s) => sig(s)));
  assert.ok(distinct.size > base.storeys * 0.6, `${distinct.size} distinct storeys of ${base.storeys}`);
});

test('widthsFor overrides one storey (the penthouse row)', () => {
  const ops = staggeredOpenings({...base, storeys: 3, widthsFor: s => (s === 2 ? [5] : undefined)});
  assert.ok(ops.filter(o => o.storey === 2).every(o => Math.abs(o.u1 - o.u0 - 6.5) < 1e-9));
});

test('bad input throws', () => {
  assert.throws(() => staggeredOpenings({...base, widths: [1.5]}));
  assert.throws(() => staggeredOpenings({...base, length: 0}));
});

test('warrenTruss: chords, posts and alternating diagonals that meet on the chords', () => {
  const t = warrenTruss({length: 59.7, height: 12.6, diagonals: 9, member: 0.9});
  const d = t.filter(m => m.kind === 'diagonal');
  assert.equal(d.length, 9);
  assert.equal(t.filter(m => m.kind === 'chord').length, 2);
  for (let k = 1; k < d.length; k++) {
    assert.ok(Math.abs(d[k].x0 - d[k - 1].x1) < 1e-9 && Math.abs(d[k].y0 - d[k - 1].y1) < 1e-9, 'continuous web');
    assert.notEqual(d[k].y1 > d[k].y0, d[k - 1].y1 > d[k - 1].y0, 'alternating');
  }
  assert.ok(Math.abs(d[0].x0 - 0.9) < 1e-9 && Math.abs(d[8].x1 - (59.7 - 0.9)) < 1e-9, 'web spans post to post');
  for (const m of t) for (const [x, y] of [[m.x0, m.y0], [m.x1, m.y1]]) assert.ok(x >= 0 && x <= 59.7 && y >= 0 && y <= 12.6);
  assert.throws(() => warrenTruss({length: 10, height: 1, diagonals: 2, member: 0.6}));
});
