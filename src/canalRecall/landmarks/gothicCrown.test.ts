import assert from 'node:assert/strict';
import test from 'node:test';
import {circumradius, cornerAngle, crocketedSpireLayout, openworkLanternLayout, openworkParapetLayout, polygonRing} from './gothicCrown';
import {rusticationLayout} from './rustication';

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

test('crockets sit on the arrises of the tapering shaft, every pitch, short of the tip', () => {
  const s = crocketedSpireLayout({y0: 40, y1: 50, apothem: 0.5, sides: 8, yaw: 0.3, crockets: {pitch: 1, size: 0.25}});
  assert.equal(s.shaft.sides, 8);
  assert.ok(near(s.shaft.radius, circumradius(0.5, 8)));
  const ys = [...new Set(s.crockets.map(c => +c.at[1].toFixed(6)))];
  assert.deepEqual(ys, [41, 42, 43, 44, 45, 46, 47, 48, 49]);
  assert.equal(s.crockets.length, 9 * 8);
  for (const c of s.crockets) {
    const r = Math.hypot(c.at[0], c.at[2]), want = s.shaft.radius * (1 - (c.at[1] - 40) / 10);
    assert.ok(near(r, want, 1e-9), 'on the shaft surface');
    // on an arris: the angle is one of the corner angles
    const a = Math.atan2(c.at[0], c.at[2]);
    assert.ok([...Array(8).keys()].some(k => near(Math.cos(a - cornerAngle(k, 8, 0.3)), 1, 1e-9)));
    assert.ok(near(Math.hypot(...c.out), 1));
  }
});

test('a spire without crockets is a plain needle; the finial stands on the tip', () => {
  const s = crocketedSpireLayout({y0: 0, y1: 6, apothem: 0.3, finial: {height: 1.2, ball: 0.1}});
  assert.equal(s.crockets.length, 0);
  assert.ok(s.finial && near(s.finial.y1, 7.2) && s.finial.y0 < 6 && s.finial.ball === 0.1);
  assert.throws(() => crocketedSpireLayout({y0: 5, y1: 5, apothem: 1}), /above/);
  assert.throws(() => crocketedSpireLayout({y0: 0, y1: 5, apothem: 1, crockets: {pitch: 0, size: 0.2}}), /positive/);
});

test('lantern posts stand at every corner inside the stage, between the rings, clear of the core', () => {
  const L = openworkLanternLayout({y0: 37.6, y1: 42, apothem: 1.25, sides: 8, yaw: 0.2, post: 0.22, base: 0.35, top: 0.4, core: 0.7, cap: {kind: 'dome', height: 1.5}});
  assert.equal(L.posts.length, 8);
  for (const p of L.posts) {
    assert.ok(near(p.y0, 37.95) && near(p.y1, 41.6));
    const r = Math.hypot(...p.at);
    assert.ok(r < circumradius(1.25, 8) && r > L.core!.radius + p.w / 2, `post radius ${r}`);
  }
  assert.ok(L.cap && near(L.cap.y0, 42) && near(L.cap.y1, 43.5));
  assert.ok(L.top.radius > circumradius(1.25, 8), 'the top ring overhangs the posts');
  const mid = openworkLanternLayout({y0: 0, y1: 4, apothem: 1.6, post: 0.3, base: 0.3, top: 0.3, midPosts: true});
  assert.equal(mid.posts.length, 16);
  assert.throws(() => openworkLanternLayout({y0: 0, y1: 0.5, apothem: 1, post: 0.2, base: 0.3, top: 0.3}), /open height/);
  assert.throws(() => openworkLanternLayout({y0: 0, y1: 4, apothem: 1, post: 0.2, base: 0.3, top: 0.3, core: 0.95}), /core/);
});

test('parapet: a rail per side, balusters evenly spaced and clear of the corners', () => {
  const ring = polygonRing([10, -5], 2, 4, Math.PI / 4);
  const P = openworkParapetLayout({ring, y0: 31.5, y1: 32.4, pitch: 0.4, baluster: 0.1});
  assert.equal(P.rails.length, 4);
  const side = 4; // a square of apothem 2
  const perSide = P.balusters.length / 4;
  assert.equal(perSide, 10);
  for (const b of P.balusters) for (const c of ring) assert.ok(Math.hypot(b.at[0] - c[0], b.at[1] - c[1]) >= 0.2 - 1e-9, 'no baluster on a corner');
  assert.throws(() => openworkParapetLayout({ring: ring.slice(0, 2), y0: 0, y1: 1, pitch: 0.4, baluster: 0.1}), /3 corners/);
});

test('rustication: running bond, no overlaps, every block clear of the holes', () => {
  const holes: [number, number, number, number][] = [[1.5, 0.4, 2.3, 2.2], [3.0, 0.4, 3.8, 2.2]];
  const B = rusticationLayout({t0: 0, t1: 6, y0: 0, y1: 2.6, course: 0.5, block: 1.1, holes});
  assert.ok(B.length > 10);
  for (const b of B) {
    assert.ok(b.t1 > b.t0 && b.y1 > b.y0);
    for (const h of holes) assert.ok(b.t1 <= h[0] + 1e-9 || b.t0 >= h[2] - 1e-9 || b.y1 <= h[1] + 1e-9 || b.y0 >= h[3] - 1e-9, `block ${JSON.stringify(b)} crosses a hole`);
  }
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], c = B[j];
    const overlap = Math.min(a.t1, c.t1) - Math.max(a.t0, c.t0) > 1e-9 && Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0) > 1e-9;
    assert.ok(!overlap, 'blocks overlap');
  }
  // courses alternate their joints: the bottom course (below the holes) has a joint at 1.1, the next one at 0.55
  const c0 = B.filter(b => near(b.y0, 0)).map(b => b.t1), c1 = B.filter(b => near(b.y0, 0.52)).map(b => b.t1);
  assert.ok(c0.some(t => near(t, 1.1)) && c1.some(t => near(t, 0.55)));
  // no offcut shorter than the minimum
  assert.ok(B.every(b => b.t1 - b.t0 >= 1.1 * 0.3 - 1e-9));
});
