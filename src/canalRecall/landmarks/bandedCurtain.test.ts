import assert from 'node:assert/strict';
import test from 'node:test';
import {bandedCurtain, storeyBands, type CurtainPiece} from './bandedCurtain';

const area = (ps: CurtainPiece[]) => ps.reduce((s, p) => s + (p.t1 - p.t0) * (p.y1 - p.y0), 0);
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

test('panes tile the clipped wall exactly once', () => {
  const bands = storeyBands([4.5, 7.95, 11.4], 14.0, 0.85, 0.35);
  const ps = bandedCurtain({length: 12, y0: 4.15, y1: 14.0, bands, module: 1.25});
  const panes = ps.filter(p => p.part === 'vision' || p.part === 'spandrel');
  assert.ok(near(area(panes), 12 * (14.0 - 4.15)));
  for (const p of panes) assert.equal(p.depth, 0);
  assert.equal(panes.filter(p => p.part === 'spandrel').length, 3);
});

test('bands are clipped to the wall range and dropped outside it', () => {
  const ps = bandedCurtain({length: 4, y0: 5, y1: 8, bands: [{y0: 0, y1: 4, kind: 'spandrel'}, {y0: 4, y1: 6, kind: 'vision'}, {y0: 6, y1: 10, kind: 'spandrel'}]});
  const panes = ps.filter(p => p.part !== 'transom' && p.part !== 'mullion');
  assert.deepEqual(panes.map(p => [p.part, p.y0, p.y1]), [['vision', 5, 6], ['spandrel', 6, 8]]);
});

test('clear ranges turn spandrels into vision panes across every band', () => {
  const ps = bandedCurtain({length: 10, y0: 0, y1: 4, bands: [{y0: 0, y1: 2, kind: 'spandrel'}, {y0: 2, y1: 4, kind: 'vision'}], clear: [[3, 5]]});
  const sp = ps.filter(p => p.part === 'spandrel');
  assert.ok(near(area(sp), (10 - 2) * 2));
  assert.ok(ps.some(p => p.part === 'vision' && p.t0 === 3 && p.t1 === 5 && p.y0 === 0));
});

test('mullions on the module, both ends inside the wall; transoms on band edges and floors, proud', () => {
  const ps = bandedCurtain({length: 10, y0: 0, y1: 6, bands: [{y0: 0, y1: 3, kind: 'vision', floor: 1.5}, {y0: 3, y1: 6, kind: 'vision'}], module: 2.5});
  const mu = ps.filter(p => p.part === 'mullion');
  assert.equal(mu.length, 5);
  assert.ok(mu.every(m => m.t0 >= 0 && m.t1 <= 10 && m.depth > 0));
  const tr = ps.filter(p => p.part === 'transom');
  const mids = tr.map(t => (t.y0 + t.y1) / 2), want = [0.0225, 1.5, 3, 5.9775];
  assert.equal(mids.length, want.length);
  mids.forEach((m, i) => assert.ok(near(m, want[i]), `transom ${i} at ${m}`));
  assert.ok(tr.every(t => t.depth > 0 && t.y0 >= 0 && t.y1 <= 6));
});

test('explicit lines replace the module', () => {
  const mu = bandedCurtain({length: 9, y0: 0, y1: 3, bands: [{y0: 0, y1: 3, kind: 'vision'}], lines: [3, 4.5]}).filter(p => p.part === 'mullion');
  assert.deepEqual(mu.map(m => +((m.t0 + m.t1) / 2).toFixed(3)), [0.045, 3, 4.5, 8.955]);
});

test('bad specs throw', () => {
  assert.throws(() => bandedCurtain({length: 0, y0: 0, y1: 1, bands: []}));
  assert.throws(() => bandedCurtain({length: 1, y0: 0, y1: 1, bands: [{y0: 0, y1: 2, kind: 'vision'}, {y0: 1, y1: 3, kind: 'spandrel'}]}));
  assert.throws(() => storeyBands([4, 5], 8, 1.2, 0.2));
});
