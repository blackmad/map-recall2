import assert from 'node:assert/strict';
import test from 'node:test';
import {brickLattice, latticeBays, latticeOpenings, type LatticePiece, type LatticeSpec} from './brickLattice';

const base: LatticeSpec = {
  length: 12, floors: [0, 3, 6, 9],
  bays: [{kind: 'window', width: 3}, {kind: 'balcony', width: 6}, {kind: 'window', width: 3}],
  window: {width: 1.7, sill: 0.75, head: 2.75, bars: {vertical: 1, transoms: 1}},
  bayPier: 0.6, doorHead: 2.75, pierDepth: 0.3, bandDepth: 0.3,
  balcony: {depth: 1.5, slab: 0.22, balustrade: 1.05}, doorBarPitch: 1.3,
};
const front = (p: LatticePiece) => p.out + p.depth;
const overlaps = (a: LatticePiece, b: LatticePiece) => Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0) > 1e-6 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1e-6;

test('bays are scaled to the wall length', () => {
  const bays = latticeBays({...base, length: 24});
  assert.deepEqual(bays.map(b => [b.t0, b.t1]), [[0, 6], [6, 18], [18, 24]]);
});

test('one opening per bay per storey, windows centred with their sill and head, balcony doors full height', () => {
  const o = latticeOpenings(base);
  assert.equal(o.length, 9);
  const w = o.find(x => x.kind === 'window')!;
  assert.deepEqual([+(w.t0).toFixed(3), +(w.t1).toFixed(3), w.y0, w.y1], [0.65, 2.35, 0.75, 2.75]);
  const d = o.find(x => x.kind === 'balcony')!;
  assert.deepEqual([d.t0, d.t1, +d.y0.toFixed(3), d.y1], [3.3, 8.7, 0.1, 2.75]);
});

test('piers and bands are flush or clear of the near-coplanar band (no z-fighting)', () => {
  for (const bandDepth of [0.3, 0.2]) {
    const ps = brickLattice({...base, bandDepth});
    const brick = ps.filter(p => p.part === 'pier' || p.part === 'band');
    for (const a of brick) for (const b of brick) if (a !== b && overlaps(a, b)) {
      const gap = Math.abs(front(a) - front(b));
      assert.ok(gap < 1e-9 || gap >= 0.08 - 1e-9, `${a.part}/${b.part} fronts ${front(a)} ${front(b)}`);
    }
    // and every piece on the glass plane starts behind it
    for (const p of brick) assert.ok(p.out < 0);
  }
  assert.throws(() => brickLattice({...base, bandDepth: 0.25}), /8 cm/);
  assert.throws(() => brickLattice({...base, bandDepth: 0.35}), /8 cm/);
});

test('a storey without openings is pier only (no band doubling the pier front)', () => {
  const ps = brickLattice({...base, bays: [{kind: 'window', width: 3}], length: 3, floors: [0, 0.5]});
  assert.deepEqual(ps.map(p => p.part), ['pier']);
});

test('brick fills the wall except the openings', () => {
  const ps = brickLattice(base);
  const o = latticeOpenings(base);
  // sample a grid: a point is brick (some pier or band covers it) exactly when it is in no opening
  for (let t = 0.031; t < 12; t += 0.29) for (let y = 0.033; y < 9; y += 0.29) {
    const inOpening = o.some(q => t > q.t0 && t < q.t1 && y > q.y0 && y < q.y1);
    const brick = ps.some(p => (p.part === 'pier' || p.part === 'band') && t > p.t0 && t < p.t1 && y > p.y0 && y < p.y1);
    assert.equal(brick, !inOpening, `t ${t.toFixed(2)} y ${y.toFixed(2)}`);
  }
});

test('balconies carry a slab and a balustrade per storey; windows a cross of bars', () => {
  const ps = brickLattice(base);
  assert.equal(ps.filter(p => p.part === 'balconySlab').length, 3);
  assert.equal(ps.filter(p => p.part === 'balustrade').length, 3);
  const slab = ps.find(p => p.part === 'balconySlab')!;
  assert.ok(front(slab) > 1.6);
  // 2 windows x 3 storeys x (1 vertical + a transom in 2 pieces), plus 3 storeys x 3 door bars (5.4 m at 1.3 m pitch -> 4 leaves)
  const bars = ps.filter(p => p.part === 'bar');
  assert.equal(bars.length, 2 * 3 * 3 + 3 * 3);
  // no two bars overlap (their fronts are level, so an overlap would be coplanar)
  for (const a of bars) for (const c of bars) if (a !== c) assert.ok(!overlaps(a, c));
  // and every bar stands clear of the near-coplanar band (8 cm)
  for (const a of bars) assert.ok(front(a) >= 0.1 - 1e-9);
});

test('through transoms: one piece per transom across the window, level with the vertical bars', () => {
  const ps = brickLattice({...base, window: {...base.window, bars: {vertical: 1, transoms: 1, through: true}}});
  const bars = ps.filter(p => p.part === 'bar');
  assert.equal(bars.length, 2 * 3 * 2 + 3 * 3);
  const o = latticeOpenings(base).find(x => x.kind === 'window')!;
  const transom = bars.find(p => p.t1 - p.t0 > p.y1 - p.y0 && Math.abs(p.t0 - o.t0) < 1e-6)!;
  assert.ok(Math.abs(transom.t1 - o.t1) < 1e-6);
  for (const p of bars) assert.ok(Math.abs(front(p) - front(bars[0])) < 1e-9, 'one front plane for all bars');
});

test('a loggia is a deep recess: its piers stand as deep as the loggia, with a floor slab and a railing', () => {
  const spec: LatticeSpec = {...base, bays: [{kind: 'window', width: 3}, {kind: 'loggia', width: 3}, {kind: 'window', width: 3}], length: 9, loggia: {depth: 0.9, railing: 1.1}};
  const ps = brickLattice(spec);
  const loggia = latticeOpenings(spec).find(o => o.kind === 'loggia')!;
  const deep = ps.filter(p => p.part === 'pier' && front(p) > 0.85);
  assert.equal(deep.length, 2);
  assert.ok(deep.some(p => Math.abs(p.t1 - loggia.t0) < 1e-6) && deep.some(p => Math.abs(p.t0 - loggia.t1) < 1e-6));
  assert.equal(ps.filter(p => p.part === 'railing').length, 3);
  const rail = ps.find(p => p.part === 'railing')!;
  assert.ok(front(rail) < 0.9, 'railing sits inside the recess');
  // the loggia floor slab top is not level with the band top under it (coplanar faces would z-fight)
  const slab = ps.find(p => p.part === 'loggiaSlab')!;
  for (const b of ps.filter(p => p.part === 'band' && overlaps(p, slab))) assert.ok(Math.abs(b.y1 - slab.y1) > 0.01);
});

test('a parapet storey stays brick', () => {
  const o = latticeOpenings({...base, floors: [0, 3, 3.8]});
  assert.equal(o.length, 3);
  assert.ok(o.every(x => x.y1 <= 2.75));
});

test('rejects an empty wall and falling floors', () => {
  assert.throws(() => brickLattice({...base, length: 0}), /empty/);
  assert.throws(() => brickLattice({...base, floors: [0, 3, 2]}), /rise/);
});
