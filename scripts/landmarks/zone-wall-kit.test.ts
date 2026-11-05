import assert from 'node:assert/strict';
import test from 'node:test';
import type * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {at, bagFrame, frameFor, inside, onBagEdge, ringArea, ringOut, shift, yaw, ZoneMesh, type C, type P, type Zone} from './zone-wall-kit';

/** A BuildingTools stand-in that records every add(geometry, colour) the batcher flushes. */
function recorder() {
  const added: {c: C; pos: number[]; normals: number[]}[] = [];
  const b = {add(g: T.BufferGeometry, c: C) {
    added.push({c, pos: Array.from(g.getAttribute('position').array as Float32Array), normals: Array.from(g.getAttribute('normal').array as Float32Array)});
  }} as unknown as BuildingTools;
  return {b, added};
}
const close = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const sq = (s: number): P[] => [[0, 0], [s, 0], [s, s], [0, s]];
/** Triangle area sum and summed (area-weighted) normal of a flat position array. */
function triStats(pos: number[]) {
  let area = 0; const n = [0, 0, 0];
  for (let i = 0; i < pos.length; i += 9) {
    const u = [pos[i + 3] - pos[i], pos[i + 4] - pos[i + 1], pos[i + 5] - pos[i + 2]], v = [pos[i + 6] - pos[i], pos[i + 7] - pos[i + 1], pos[i + 8] - pos[i + 2]];
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    area += Math.hypot(...c) / 2; n[0] += c[0] / 2; n[1] += c[1] / 2; n[2] += c[2] / 2;
  }
  return {area, n};
}

test('ringArea is signed by winding and ringOut points outward for either winding', () => {
  assert.equal(ringArea(sq(4)), 16);
  assert.equal(ringArea([...sq(4)].reverse()), -16);
  for (const r of [sq(4), [...sq(4)].reverse()]) for (let i = 0; i < 4; i++) {
    const a = r[i], c = r[(i + 1) % 4], n = ringOut(r, i);
    assert.ok(close(Math.hypot(...n), 1), 'unit normal');
    assert.ok(!inside([(a[0] + c[0]) / 2 + n[0] * .1, (a[1] + c[1]) / 2 + n[1] * .1], r), `edge ${i} normal points inside`);
  }
});

test('frameFor: t runs viewer-left to right seen from outside whichever way the edge is given', () => {
  const n: P = [0, -1]; // wall facing -z, the viewer stands at z < 0 looking +z
  for (const [a, c] of [[[0, 0], [5, 0]], [[5, 0], [0, 0]]] as [P, P][]) {
    const {f, len} = frameFor(a, c, n);
    assert.equal(len, 5);
    assert.deepEqual(f.t, [-1, -0]);
    assert.deepEqual(f.o, [5, 0], 'origin is the viewer-left end');
    assert.deepEqual(at(f, 5), [0, 0]);
  }
  // (t, y, o) right-handed: t x y = o (n), with y = (0,1,0) in (x, y, z)
  const {f} = frameFor([0, 0], [5, 0], n);
  const t3 = [f.t[0], 0, f.t[1]], y3 = [0, 1, 0], cr = [t3[1] * y3[2] - t3[2] * y3[1], t3[2] * y3[0] - t3[0] * y3[2], t3[0] * y3[1] - t3[1] * y3[0]];
  assert.ok(close(cr[0], f.n[0]) && close(cr[2], f.n[1]));
});

test('at, shift and yaw', () => {
  const f = {o: [1, 2] as P, t: [1, 0] as P, n: [0, 1] as P};
  assert.deepEqual(at(f, 3, 0.5), [4, 2.5]);
  assert.deepEqual(at(f, 0), [1, 2]);
  assert.deepEqual(shift(f, 2), {o: [3, 2], t: [1, 0], n: [0, 1]});
  assert.equal(yaw([0, 1]), 0);
  assert.ok(close(yaw([1, 0]), Math.PI / 2));
});

test('bagFrame of every edge of a ring has its origin on the edge and its normal outward', () => {
  const ring: P[] = [[0, 0], [10, 0], [10, 6], [0, 6]];
  for (let i = 0; i < 4; i++) {
    const {f, len} = bagFrame(ring, i), a = ring[i], c = ring[(i + 1) % 4];
    assert.ok(close(len, Math.hypot(c[0] - a[0], c[1] - a[1])));
    assert.ok((close(f.o[0], a[0]) && close(f.o[1], a[1])) || (close(f.o[0], c[0]) && close(f.o[1], c[1])));
    assert.deepEqual(f.n, ringOut(ring, i));
  }
});

test('onBagEdge finds the edge and t range, within 0.25 m, and refuses off-edge or zero-length segments', () => {
  const ring: P[] = [[0, 0], [10, 0], [10, 6], [0, 6]];
  const hit = onBagEdge(ring, [2, 0.1], [7, -0.1]);
  assert.ok(hit);
  assert.equal(hit.i, 0);
  const {f} = bagFrame(ring, 0);
  const tOf = (x: number) => (x - f.o[0]) * f.t[0];
  assert.ok(close(hit.ta, Math.min(tOf(2), tOf(7))) && close(hit.tb, Math.max(tOf(2), tOf(7))));
  assert.equal(onBagEdge(ring, [10, 1], [10, 5])?.i, 1);
  assert.equal(onBagEdge(ring, [2, 1], [7, 1]), null, '1 m inside the ring is not on an edge');
  assert.equal(onBagEdge(ring, [12, 0], [14, 0]), null, 'past the edge end');
  assert.equal(onBagEdge(ring, [3, 0], [3, 0]), null, 'zero-length segment');
});

test('inside: point in polygon, including a concave ring', () => {
  const L: P[] = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]];
  assert.ok(inside([0.5, 3], L));
  assert.ok(!inside([3, 3], L));
  assert.ok(!inside([5, 0.5], L));
});

test('ZoneMesh batches per material: one add per colour at flush, then nothing until more geometry', () => {
  const {b, added} = recorder(), m = new ZoneMesh(b), f = frameFor([0, 0], [4, 0], [0, -1]).f;
  m.flush();
  assert.equal(added.length, 0, 'an empty mesh adds nothing');
  m.rect(f, 0, 4, 0, 3, 0, 'brick');
  m.rect(f, 0, 1, 3, 4, 0, 'stone');
  m.rect(f, 1, 4, 3, 4, 0, 'brick');
  m.flush();
  assert.deepEqual(added.map(a => a.c).sort(), ['brick', 'stone']);
  assert.equal(added.find(a => a.c === 'brick')!.pos.length, 2 * 6 * 3);
  m.flush();
  assert.equal(added.length, 2, 'flush clears the batch');
});

test('rect faces outward along the frame normal with the right area', () => {
  const {b, added} = recorder(), m = new ZoneMesh(b), f = frameFor([0, 0], [4, 0], [0, -1]).f;
  m.rect(f, 0.5, 3.5, 1, 3, 0.2, 'white');
  m.flush();
  const s = triStats(added[0].pos);
  assert.ok(close(s.area, 6));
  assert.ok(close(s.n[0], 0) && close(s.n[1], 0) && close(s.n[2], -6), 'front-facing toward -z');
  for (let i = 2; i < added[0].pos.length; i += 3) assert.ok(close(added[0].pos[i], -0.2), 'offset 0.2 m out of the wall');
});

test('bar: front plus four sides, closed but for its back, every face outward', () => {
  const {b, added} = recorder(), m = new ZoneMesh(b), f = {o: [0, 0] as P, t: [1, 0] as P, n: [0, 1] as P};
  // frame with t = +x, n = +z: (t, y, o) right-handed needs t x y = n: (1,0,0) x (0,1,0) = (0,0,1)
  m.bar(f, 0, 2, 0, 1, 0.3, 'stone');
  m.flush();
  const pos = added[0].pos;
  assert.equal(pos.length, 5 * 6 * 3);
  const s = triStats(pos);
  assert.ok(close(s.area, 2 + 2 * 2 * 0.3 + 2 * 1 * 0.3));
  // a closed box minus its back face sums to the back's outward normal reversed: +z * 2
  assert.ok(close(s.n[0], 0) && close(s.n[1], 0) && close(s.n[2], 2));
});

test('flat: a horizontal polygon faces up or down as asked, for either ring winding', () => {
  for (const ring of [sq(3), [...sq(3)].reverse()]) for (const up of [true, false]) {
    const {b, added} = recorder(), m = new ZoneMesh(b);
    m.flat(ring, 5, 'slate', up);
    m.flush();
    const s = triStats(added[0].pos);
    assert.ok(close(s.area, 9));
    assert.ok(close(s.n[1], up ? 9 : -9), `up=${up}`);
    for (let i = 1; i < added[0].pos.length; i += 3) assert.equal(added[0].pos[i], 5);
  }
});

test('emitZone without cuts is the same triangles as a plain rect (byte-identical when absent)', () => {
  const f = frameFor([0, 0], [8, 0], [0, -1]).f, z: Zone = {t0: 1, t1: 7, y0: 0, y1: 4, face: 'brick', cuts: []};
  const a = recorder(), b = recorder();
  const mb = new ZoneMesh(b.b); mb.rect(f, 1, 7, 0, 4, 0, 'brick');
  const ma = new ZoneMesh(a.b);
  ma.emitZone(f, z, 0, 8, 0, 10); ma.flush(); mb.flush(); // run larger than the zone: the zone limits win
  assert.deepEqual(a.added, b.added);
});

test('emitZone splits a zone to the run, cuts its openings with their own back and reveal materials', () => {
  const {b, added} = recorder(), m = new ZoneMesh(b), f = frameFor([0, 0], [10, 0], [0, -1]).f;
  const z: Zone = {t0: 0, t1: 10, y0: 0, y1: 6, face: 'brick', cuts: [
    {t0: 1, t1: 3, y0: 1, y1: 3, depth: 0.2, back: 'glass', reveal: 'stone'},
    {t0: 6, t1: 8, y0: 1, y1: 3, depth: 0.3, back: 'dark'},
  ]};
  m.emitZone(f, z, 2, 10, 0, 6); // the run starts at t = 2: the first opening is cut in half
  m.flush();
  const by = Object.fromEntries(added.map(a => [a.c, triStats(a.pos)]));
  assert.ok(close(by.glass.area, 1 * 2), 'first opening clipped to the run: 1 m x 2 m');
  assert.ok(close(by.dark.area, 4));
  // face = 8 x 6 minus the two openings; brick also carries the second opening's reveals (no reveal material given)
  const revealDark = 2 * 0.3 * 2 + 2 * 0.3 * 2;
  assert.ok(close(by.brick.area, 48 - 2 - 4 + revealDark, 1e-5), `brick ${by.brick.area}`);
  // the clipped opening touches the run's left end: no left reveal there, right + bottom + top in stone
  assert.ok(close(by.stone.area, 0.2 * 2 + 0.2 * 1 * 2, 1e-5), `stone ${by.stone.area}`);
  // backs sit at their depth into the building (+z here, the wall faces -z)
  for (let i = 2; i < added.find(a => a.c === 'glass')!.pos.length; i += 3) assert.ok(close(added.find(a => a.c === 'glass')!.pos[i], 0.2));
  // world t of the run: t = 2 in this frame is x = 8
  const xs = added.find(a => a.c === 'brick')!.pos.filter((_, i) => i % 3 === 0);
  assert.ok(close(Math.max(...xs), 8) && close(Math.min(...xs), 0));
});

test('emitZone pad keeps openings inside run edges that end the wall, and leaves inner edges alone', () => {
  const f = frameFor([0, 0], [6, 0], [0, -1]).f;
  const z: Zone = {t0: 0, t1: 6, y0: 0, y1: 3, face: 'brick', cuts: [{t0: 0, t1: 6, y0: 0, y1: 3, depth: 0.1, back: 'glass'}]};
  const {b, added} = recorder(), m = new ZoneMesh(b);
  m.emitZone(f, z, 0, 6, 0, 3, {b: 0.2, t: 0.3, ends: 0.4});
  m.flush();
  const glass = triStats(added.find(a => a.c === 'glass')!.pos);
  assert.ok(close(glass.area, (6 - 0.8) * (3 - 0.5), 1e-5), `ribbon padded: ${glass.area}`);
  // the same zone inside a taller run: its top edge is not the run edge, so no top pad
  const r2 = recorder(), m2 = new ZoneMesh(r2.b);
  m2.emitZone(f, z, 0, 6, 0, 5, {b: 0.2, t: 0.3, ends: 0.4});
  m2.flush();
  assert.ok(close(triStats(r2.added.find(a => a.c === 'glass')!.pos).area, 5.2 * 2.8, 1e-5));
});

test('emitZone degenerate inputs: zone outside the run, slivers under 2 cm, openings outside the zone emit nothing extra', () => {
  const f = frameFor([0, 0], [6, 0], [0, -1]).f;
  const z: Zone = {t0: 0, t1: 3, y0: 0, y1: 3, face: 'brick', cuts: [{t0: 5, t1: 6, y0: 1, y1: 2, depth: 0.1, back: 'glass'}, {t0: 1, t1: 1.03, y0: 1, y1: 2, depth: 0.1, back: 'dark'}]};
  const {b, added} = recorder(), m = new ZoneMesh(b);
  m.emitZone(f, z, 4, 6, 0, 3);
  m.emitZone(f, z, 0, 3, 0, 0.01);
  m.emitZone(f, z, 2.99, 3, 0, 3);
  m.flush();
  assert.equal(added.length, 0, 'nothing for an empty intersection or a sliver');
  m.emitZone(f, z, 0, 3, 0, 3);
  m.flush();
  assert.deepEqual(added.map(a => a.c), ['brick'], 'an opening outside the zone and one narrower than 4 cm are dropped');
  assert.ok(close(triStats(added[0].pos).area, 9));
});

test('emitZone throws on overlapping openings (holedWall caller error)', () => {
  const f = frameFor([0, 0], [6, 0], [0, -1]).f;
  const z: Zone = {t0: 0, t1: 6, y0: 0, y1: 3, face: 'brick', cuts: [{t0: 1, t1: 3, y0: 1, y1: 2, depth: 0.1, back: 'glass'}, {t0: 2, t1: 4, y0: 1, y1: 2, depth: 0.1, back: 'glass'}]};
  assert.throws(() => new ZoneMesh(recorder().b).emitZone(f, z, 0, 6, 0, 3), /overlap/);
});
