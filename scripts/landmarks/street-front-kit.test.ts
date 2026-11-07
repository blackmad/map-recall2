import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {archFillOutline, archRingOutline, cutHole, frameAt, makeFrontKit, type FrontFace} from './street-front-kit';
import type {BuildingTools} from './cultural-builders';

const face = (): FrontFace => ({f: {origin: [0, 0], tangent: [1, 0], n: [0, 1]}, len: 10, y0: 0, y1: 8, c: 'brick', holes: []});

test('frameAt puts s along the chord and off along its outward normal', () => {
  const f = frameAt({a: [0, 0], b: [0, 10]}, 4, 0.3);
  assert.deepEqual(f.tangent, [0, 1]);
  assert.deepEqual(f.n, [-1, 0]);
  assert.ok(Math.abs(f.origin[0] + 0.3) < 1e-9 && Math.abs(f.origin[1] - 4) < 1e-9);
});

test('cutHole refuses openings outside the face, overlapping ones and impossible arch rises', () => {
  const F = face();
  assert.equal(cutHole(F, {t0: 1, t1: 2, y0: 1, y1: 3, depth: 0.15, back: 'glass', arch: 0}), true);
  assert.equal(cutHole(F, {t0: 1.5, t1: 2.5, y0: 2, y1: 4, depth: 0.15, back: 'glass', arch: 0}), false, 'overlap');
  assert.equal(cutHole(F, {t0: 9.5, t1: 10.2, y0: 1, y1: 3, depth: 0.15, back: 'glass', arch: 0}), false, 'past the end');
  assert.equal(cutHole(F, {t0: 4, t1: 5, y0: 1, y1: 3, depth: 0.15, back: 'glass', rise: 0.8}), false, 'rise above half the width');
  assert.equal(cutHole(F, {t0: 4, t1: 5, y0: 1, y1: 3, depth: 0.15, back: 'glass', rise: 0.5}), true, 'round head');
  assert.equal(F.holes.length, 2);
});

test('arch ring outline is a closed band whose feet sit on the springing line', () => {
  for (const [w, rise] of [[1.2, 0.6], [1.6, 0.3]] as const) {
    const r = archRingOutline(w, rise, 0.25);
    const ys = r.map(p => p[1]);
    assert.ok(Math.min(...ys) >= -1e-9, 'nothing below the springing line');
    assert.ok(Math.abs(Math.max(...ys) - (rise + 0.25)) < 1e-6, 'crown is rise + ring thickness');
    const fill = archFillOutline(w, rise);
    assert.ok(Math.abs(Math.max(...fill.map(p => p[1])) - rise) < 1e-6);
    assert.ok(Math.abs(fill[0][0] - w / 2) < 1e-6 && Math.abs(fill.at(-1)![0] + w / 2) < 1e-6);
  }
});

test('flush emits one face mesh with an arched opening cut and its back', () => {
  const added: {c: string; g: T.BufferGeometry}[] = [];
  const b = {add: (g: T.BufferGeometry, c: string) => added.push({g, c})} as unknown as BuildingTools;
  const k = makeFrontKit(b);
  const S = k.sec({a: [0, 0], b: [10, 0]}, 0, 10, 0, 8, 'brick');
  k.opening(S, 5, 2, 1.2, 2.4, {rise: 0.6, back: 'glass', cols: 2});
  const before = added.length;
  k.flush();
  const cols = added.slice(before).map(a => a.c).sort();
  assert.deepEqual(cols, ['brick', 'glass']);
  const glass = added.slice(before).find(a => a.c === 'glass')!.g;
  const p = glass.getAttribute('position');
  let top = -Infinity;
  for (let i = 0; i < p.count; i++) top = Math.max(top, p.getY(i));
  assert.ok(Math.abs(top - 4.4) < 1e-6, 'back reaches the crown of the arch');
  assert.equal(k.faces.length, 0);
});
