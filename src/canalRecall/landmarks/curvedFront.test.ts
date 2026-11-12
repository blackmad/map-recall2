import assert from 'node:assert/strict';
import test from 'node:test';
import {chordJunctions, curvedFront, sweepProfile, type XZ} from './curvedFront.ts';

// a quarter of a 60 m circle, centre (0, 60), drawn as 5.8 m chords: the shape of the Raadhuisstraat gallery front
const R = 60, arc: XZ[] = [];
for (let a = 0; a <= 1.2; a += 5.8 / R) arc.push([R * Math.sin(a), R - R * Math.cos(a)]);

test('chordJunctions collapses pier jogs and keeps the chord ends', () => {
  const jogged: XZ[] = [];
  arc.forEach((p, i) => { if (i > 0 && i < arc.length - 1) jogged.push([p[0] - 0.12, p[1] + 0.05], [p[0] + 0.12, p[1] - 0.05]); else jogged.push(p); });
  const j = chordJunctions(jogged);
  assert.equal(j.length, arc.length);
  for (const [i, p] of j.entries()) assert.ok(Math.hypot(p[0] - arc[i][0], p[1] - arc[i][1]) < 1e-9, `junction ${i}`);
});

test('curvedFront passes through the junctions and follows the circle between them', () => {
  const f = curvedFront(arc);
  for (const s of f.junctionS.map((s, i) => [s, i] as const)) {
    const p = f.at(s[0]).p, q = arc[s[1]];
    assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6);
  }
  // between junctions: within 1 cm of the true circle (chords sit 7 cm inside it)
  for (let s = 6; s < f.length - 6; s += 0.37) {
    const p = f.at(s).p, r = Math.hypot(p[0], p[1] - R);
    assert.ok(Math.abs(r - R) < 0.01, `s=${s} r=${r}`);
  }
  // tangent unit and continuous, normal on the street side (side +1: (tz, -tx), towards the circle's outside here)
  let prev = f.at(0).t;
  for (let s = 0.5; s < f.length; s += 0.5) {
    const {t} = f.at(s);
    assert.ok(Math.abs(Math.hypot(...t) - 1) < 1e-9);
    assert.ok(Math.acos(Math.min(1, t[0] * prev[0] + t[1] * prev[1])) < 0.02, 'no kink');
    prev = t;
  }
  const mid = f.at(f.length / 2);
  assert.ok(mid.n[0] * mid.p[0] + mid.n[1] * (mid.p[1] - R) > 0, 'side +1 normal (tz, -tx) faces away from the centre here');
  const g = curvedFront(arc, {side: -1}), m2 = g.at(g.length / 2);
  assert.ok(m2.n[0] * m2.p[0] + m2.n[1] * (m2.p[1] - R) < 0);
});

test('project inverts at, stations include ends and breaks', () => {
  const f = curvedFront(arc);
  for (const s of [0, 3.3, 17.9, f.length]) assert.ok(Math.abs(f.project(f.at(s).p) - s) < 0.02);
  const st = f.stations(2, 9, 2, [4.4]);
  assert.equal(st[0], 2); assert.equal(st.at(-1), 9); assert.ok(st.includes(4.4));
  assert.ok(st.every((s, i) => i === 0 || s > st[i - 1]));
});

test('sweepProfile makes outward quads for a CCW profile', () => {
  const f = curvedFront(arc, {side: -1});
  const box: [number, number][] = [[0, 0], [0.3, 0], [0.3, 0.2], [0, 0.2]];
  const tris = sweepProfile(f, 10, 20, box, {closed: true, maxStep: 1});
  assert.equal(tris.length % 9, 0);
  // the front face (o = 0.3) must face outward (+n), the top face up
  let outward = 0, up = 0;
  for (let i = 0; i < tris.length; i += 9) {
    const a = tris.slice(i, i + 3), b = tris.slice(i + 3, i + 6), c = tris.slice(i + 6, i + 9);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const cx = (a[0] + b[0] + c[0]) / 3, cz = (a[2] + b[2] + c[2]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
    const s = f.project([cx, cz]), fr = f.at(s);
    const o = (cx - fr.p[0]) * fr.n[0] + (cz - fr.p[1]) * fr.n[1];
    if (Math.abs(o - 0.3) < 0.02 && cy > 0.01 && cy < 0.19) { outward++; assert.ok(nrm[0] * fr.n[0] + nrm[2] * fr.n[1] > 0, 'front quad faces out'); }
    if (Math.abs(cy - 0.2) < 1e-6) { up++; assert.ok(nrm[1] > 0, 'top faces up'); }
  }
  assert.ok(outward > 0 && up > 0);
});
