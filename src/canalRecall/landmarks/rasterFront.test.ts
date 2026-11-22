import assert from 'node:assert/strict';
import test from 'node:test';
import {complement, irregularOpenings, openingsAt, rasterFront, rasterLedges, seeded, type RasterSpec} from './rasterFront';

/** Two storeys of a Spaarbank-like raster: window row over a glazed spandrel row, piers at a 2.8 m pitch. */
const centres = [1.4, 4.2, 7.0];
const spec: RasterSpec = {
  length: 8.4, bottom: 6.0, top: 10.0, pierDepth: 0.3, ledgeDepth: 0.45, ledgeOverhang: [0.2, 0.2],
  rows: [
    {y0: 6.3, y1: 7.0, openings: openingsAt(centres, 2.2), kind: 'spandrel'},
    {y0: 7.2, y1: 9.4, openings: openingsAt(centres, 2.2), kind: 'window'},
  ],
};

test('ledges fill the gaps under, between and over the rows', () => {
  assert.deepEqual(rasterLedges(spec), [[6.0, 6.3], [7.0, 7.2], [9.4, 10.0]]);
  const ledges = rasterFront(spec).filter(p => p.part === 'ledge');
  assert.equal(ledges.length, 3);
  for (const l of ledges) { assert.ok(Math.abs(l.t0 + 0.2) < 1e-9); assert.ok(Math.abs(l.t1 - 8.6) < 1e-9); assert.ok(Math.abs(l.out + l.depth - 0.45) < 1e-9); }
});

test('piers are the complement of each row\'s openings and stand at pierDepth', () => {
  const ps = rasterFront(spec);
  const piers = ps.filter(p => p.part === 'pier' && p.row === 1);
  assert.equal(piers.length, 4);
  assert.ok(Math.abs(piers[0].t0) < 1e-9 && Math.abs(piers[0].t1 - 0.3) < 1e-9);
  for (const p of piers) assert.ok(Math.abs(p.out + p.depth - 0.3) < 1e-9);
  const glass = ps.filter(p => p.part === 'glass');
  assert.equal(glass.length, 6);
  assert.deepEqual([...new Set(glass.map(g => g.kind))], ['spandrel', 'window']);
  for (const g of glass) assert.ok(Math.abs(g.out + g.depth) < 1e-9, 'glass front on the glass plane');
});

test('rows may carry different openings (an irregular grid)', () => {
  const s: RasterSpec = {length: 6, bottom: 0, top: 6, pierDepth: 0.2, ledgeDepth: 0.2, rows: [
    {y0: 0.2, y1: 2.8, openings: [[0.3, 1.8], [2.1, 2.6]]},
    {y0: 3.2, y1: 5.8, openings: [[0.3, 0.8], [1.1, 2.6], [3.0, 5.7]]},
  ]};
  const p = rasterFront(s);
  assert.equal(p.filter(x => x.part === 'pier' && x.row === 0).length, 3);
  assert.equal(p.filter(x => x.part === 'pier' && x.row === 1).length, 4);
});

test('mottle: deterministic, cuts runs, tones about the requested fraction, and leaves the glass alone', () => {
  const m = {...spec, mottle: {seed: 7, fraction: 0.3, minRun: 0.3, maxRun: 0.9}};
  const a = rasterFront(m), b = rasterFront(m);
  assert.deepEqual(a, b);
  const ledges = a.filter(p => p.part === 'ledge');
  assert.ok(ledges.length > 3, 'ledges are cut into runs');
  // the runs of one ledge tile it exactly and adjacent runs differ in tone
  const first = ledges.filter(l => l.y0 === 6.0).sort((x, y) => x.t0 - y.t0);
  assert.ok(Math.abs(first[0].t0 + 0.2) < 1e-9 && Math.abs(first[first.length - 1].t1 - 8.6) < 1e-9);
  for (let i = 1; i < first.length; i++) { assert.ok(Math.abs(first[i].t0 - first[i - 1].t1) < 1e-9); assert.notEqual(first[i].tone, first[i - 1].tone); }
  // over a long ledge the toned length is near the fraction
  const long = rasterFront({...m, length: 400, rows: [], mottle: {...m.mottle, seed: 3}});
  const len = (k: 0 | 1) => long.filter(p => p.tone === k).reduce((s, p) => s + p.t1 - p.t0, 0);
  const f = len(1) / (len(0) + len(1));
  assert.ok(f > 0.2 && f < 0.4, `toned fraction ${f}`);
  assert.deepEqual(a.filter(p => p.part === 'glass'), rasterFront(spec).filter(p => p.part === 'glass'));
});

test('no mottle: every piece tone 0, one ledge per band; the PRNG is seeded', () => {
  assert.ok(rasterFront(spec).every(p => p.tone === 0));
  assert.equal(seeded(1)(), seeded(1)());
});

test('rejects near-coplanar piers and ledges, overlapping rows and openings off the wall', () => {
  assert.throws(() => rasterFront({...spec, ledgeDepth: 0.33}), /8 cm/);
  assert.throws(() => rasterFront({...spec, rows: [spec.rows[1], spec.rows[0]]}), /overlaps/);
  assert.throws(() => rasterFront({...spec, rows: [{y0: 7, y1: 8, openings: [[8, 9]]}]}), /off the wall/);
  assert.throws(() => rasterFront({...spec, top: 9}), /above the top/);
});

test('complement clips, merges and drops slivers', () => {
  assert.deepEqual(complement([[1, 2], [1.5, 3], [5, 7]], 0, 6), [[0, 1], [3, 5]]);
  assert.deepEqual(complement([[0, 6]], 0, 6), []);
  assert.deepEqual(complement([[0.001, 6]], 0, 6, 0.01), []);
});

test('irregular rows: deterministic, within ranges and margins, and different per seed', () => {
  const o = {length: 24.6, seed: 7, margin: 0.4, wide: [1.8, 3.2] as [number, number], narrow: [0.45, 0.7] as [number, number], pier: [0.5, 1.2] as [number, number], narrowShare: 0.4};
  const a = irregularOpenings(o);
  assert.deepEqual(a, irregularOpenings(o));
  assert.ok(a.length >= 6, `${a.length} openings`);
  assert.ok(a[0][0] >= o.margin - 1e-9 && a.at(-1)![1] <= o.length - o.margin + 1e-9);
  for (const [p, q] of a) {
    const w = q - p;
    assert.ok((w >= 1.8 - 1e-9 && w <= 3.2 + 1e-9) || (w >= 0.45 - 1e-9 && w <= 0.7 + 1e-9), `width ${w}`);
  }
  for (let i = 1; i < a.length; i++) { const g = a[i][0] - a[i - 1][1]; assert.ok(g >= 0.5 - 1e-9 && g <= 1.2 + 1e-9, `pier ${g}`); }
  assert.ok(a.some(([p, q]) => q - p < 1) && a.some(([p, q]) => q - p > 1.5), 'both kinds occur');
  assert.notDeepEqual(irregularOpenings({...o, seed: 8}), a);
  // feeds rasterFront as one row
  const pieces = rasterFront({length: o.length, bottom: 0, top: 2.82, pierDepth: 0.25, ledgeDepth: 0.25, rows: [{y0: 0.5, y1: 2.4, openings: a}]});
  assert.equal(pieces.filter(p => p.part === 'glass').length, a.length);
});
