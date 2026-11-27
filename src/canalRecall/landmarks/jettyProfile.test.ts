import assert from 'node:assert/strict';
import test from 'node:test';
import {clapboards, faceAt, jettyProfile, jettySections, type JettyStorey, type SectionPoint} from './jettyProfile';

// In 't Aepjen's front (lane landmarks-r19-e): shopfront, tarred storey on a sloped apron, blue-grey storey on a bigger apron, top.
const AEPJEN: JettyStorey[] = [
  {y0: 0, y1: 4.9, out: 0},
  {y0: 4.9, y1: 8.7, out: 0.4, apron: 0.9},
  {y0: 8.7, y1: 12.0, out: 0.8, apron: 1.3},
  {y0: 12.0, y1: 13.7, out: 1.0},
];
const area = (p: SectionPoint[]) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;

test('the section is closed counter-clockwise and spans the whole front', () => {
  const p = jettyProfile(AEPJEN);
  assert.ok(area(p) > 0, 'counter-clockwise');
  assert.deepEqual(p[0], [-0.1, 0]);
  assert.deepEqual(p[p.length - 1], [-0.1, 13.7]);
  for (let i = 1; i < p.length; i++) assert.notDeepEqual(p[i], p[i - 1], 'no repeated points');
});

test('aprons slope, square jetties step, and the area is the sum of the storeys and the apron wedges', () => {
  const p = jettyProfile(AEPJEN);
  assert.ok(p.some(([x, y]) => x === 0.4 && Math.abs(y - 5.8) < 1e-9), 'first apron tops out 0.9 m up at the new face');
  assert.ok(p.some(([x, y]) => x === 0.8 && y === 12.0) && p.some(([x, y]) => x === 1.0 && y === 12.0), 'the top storey steps square');
  const back = 0.1;
  const expect = (4.9) * back + (3.8) * (0.4 + back) - 0.9 * 0.4 / 2 + (3.3) * (0.8 + back) - 1.3 * 0.4 / 2 + 1.7 * (1.0 + back);
  assert.ok(Math.abs(area(p) - expect) < 1e-9, `${area(p)} vs ${expect}`);
});

test('faceAt follows faces and aprons', () => {
  assert.equal(faceAt(AEPJEN, 2), 0);
  assert.ok(Math.abs(faceAt(AEPJEN, 4.9 + 0.45) - 0.2) < 1e-9);
  assert.equal(faceAt(AEPJEN, 7), 0.4);
  assert.equal(faceAt(AEPJEN, 13), 1.0);
  assert.throws(() => faceAt(AEPJEN, 14));
});

test('bad fronts are refused: gaps, storeys stepping back, aprons as tall as the storey', () => {
  assert.throws(() => jettyProfile([{y0: 0, y1: 3, out: 0}, {y0: 3.2, y1: 6, out: 0.2}]));
  assert.throws(() => jettyProfile([{y0: 0, y1: 3, out: 0.3}, {y0: 3, y1: 6, out: 0.2}]));
  assert.throws(() => jettyProfile([{y0: 0, y1: 3, out: 0}, {y0: 3, y1: 6, out: 0.2, apron: 3}]));
  assert.throws(() => jettyProfile([]));
});

test('clapboards: whole boards, each a counter-clockwise wedge kicked out at its foot, none touching the next', () => {
  const boards = clapboards(0.8, 9.6, 12.0, {board: 0.24, lap: 0.04});
  assert.equal(boards.length, 10);
  for (const w of boards) {
    assert.ok(area(w) > 0);
    assert.ok(Math.abs(Math.max(...w.map(q => q[0])) - 0.84) < 1e-9);
  }
  for (let i = 1; i < boards.length; i++) assert.ok(Math.min(...boards[i].map(q => q[1])) - Math.max(...boards[i - 1].map(q => q[1])) >= 0.01 - 1e-9);
});

test('jettySections tile the whole section, one counter-clockwise polygon per storey', () => {
  const parts = jettySections(AEPJEN);
  assert.equal(parts.length, 4);
  for (const p of parts) assert.ok(area(p) > 0);
  assert.ok(Math.abs(parts.reduce((s, p) => s + area(p), 0) - area(jettyProfile(AEPJEN))) < 1e-9);
});
