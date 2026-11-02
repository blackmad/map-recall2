import assert from 'node:assert/strict';
import test from 'node:test';
import {pressedMetalGrid} from './pressedMetalGrid';

const spec = {length: 10, y0: 4, y1: 10, pitch: 0.7, width: {h: 0.12, v: 0.08}};
const overlaps = (a: {t0: number; t1: number; y0: number; y1: number}, b: {t0: number; t1: number; y0: number; y1: number}) =>
  a.t0 < b.t1 && a.t1 > b.t0 && a.y0 < b.y1 && a.y1 > b.y0;

test('a plain field: whole rows and columns at the pitch, all inside the field', () => {
  const g = pressedMetalGrid(spec);
  const h = g.filter(l => l.dir === 'h'), v = g.filter(l => l.dir === 'v');
  assert.equal(h.length, Math.floor(6 / 0.7));
  assert.equal(v.length, Math.floor(10 / 0.7));
  for (const l of g) assert.ok(l.t0 >= -1e-9 && l.t1 <= 10 + 1e-9 && l.y0 >= 4 - 1e-9 && l.y1 <= 10 + 1e-9);
  for (const l of h) assert.ok(Math.abs(l.y1 - l.y0 - 0.12) < 1e-9 && l.t0 === 0 && l.t1 === 10);
});

test('lines stop short of openings by the margin and never cross them', () => {
  const op = {t0: 2, t1: 7, y0: 6, y1: 7.2};
  const g = pressedMetalGrid({...spec, openings: [op], margin: 0.05});
  const grown = {t0: op.t0 - 0.05 + 1e-9, t1: op.t1 + 0.05 - 1e-9, y0: op.y0 - 0.05 + 1e-9, y1: op.y1 + 0.05 - 1e-9};
  for (const l of g) assert.ok(!overlaps(l, grown), `${l.dir} line ${l.t0}..${l.t1} x ${l.y0}..${l.y1} crosses the opening`);
  // a row through the opening is split in two; a column through it in two
  const plain = pressedMetalGrid(spec);
  assert.ok(g.filter(l => l.dir === 'h').length > plain.filter(l => l.dir === 'h').length);
  assert.ok(g.filter(l => l.dir === 'v').length > plain.filter(l => l.dir === 'v').length);
});

test('an opening at the wall end leaves no sliver', () => {
  const g = pressedMetalGrid({...spec, openings: [{t0: 0, t1: 3, y0: 4, y1: 5.5}]});
  for (const l of g) assert.ok(l.t1 - l.t0 >= 0.05 - 1e-9 && l.y1 - l.y0 >= 0.05 - 1e-9);
});

test('separate pitches along t and y; bad specs throw', () => {
  const g = pressedMetalGrid({...spec, pitch: {t: 1, y: 0.5}});
  assert.equal(g.filter(l => l.dir === 'h').length, 12);
  assert.equal(g.filter(l => l.dir === 'v').length, 10);
  assert.throws(() => pressedMetalGrid({...spec, length: 0}));
  assert.throws(() => pressedMetalGrid({...spec, width: {h: 0.8, v: 0.08}}));
  assert.throws(() => pressedMetalGrid({...spec, pitch: 0}));
});
