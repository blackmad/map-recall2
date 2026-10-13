/**
 * Arched-opening cutter (blockBuilding/arch.ts) on a synthetic 12 x 8 x 9 m box whose south wall is two 3DBAG strips
 * (dissolved into one face): outline shape and area, a closed shell with no open edges, the hole area cut from the
 * wall, reveal area = perimeter x depth, and a golden hash of the composed mesh.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {compose} from '../blockBuilding/compose.ts';
import {archHead, archOutline, insetConvex, polyArea, topAt, ARCH_KINDS, type ArchParams} from '../blockBuilding/arch.ts';
import type {BlockSpec, WinParams} from '../blockBuilding/spec.ts';
import type {P3, SurfaceSet} from '../blockBuilding/types.ts';
import type {MeshBuilder} from '../blockBuilding/mesh.ts';

const W = (rings: P3[][], surface: number) => ({rings, onFootprintEdge: true, surface});
function box(): SurfaceSet {
  return {
    pandId: '0000000000000000', anchor: [0, 0], groundNap: 0, heightMax: 9, constructionYear: 1750,
    walls: [
      W([[[-6, 0, 4], [0, 0, 4], [0, 9, 4], [-6, 9, 4]]], 0),
      W([[[0, 0, 4], [6, 0, 4], [6, 9, 4], [0, 9, 4]]], 1),
      W([[[6, 0, -4], [-6, 0, -4], [-6, 9, -4], [6, 9, -4]]], 2),
      W([[[6, 0, 4], [6, 0, -4], [6, 9, -4], [6, 9, 4]]], 3),
      W([[[-6, 0, -4], [-6, 0, 4], [-6, 9, 4], [-6, 9, -4]]], 4),
    ],
    roofs: [{rings: [[[-6, 9, 4], [0, 9, 4], [6, 9, 4], [6, 9, -4], [-6, 9, -4]]], slopeDeg: 0}],
    ground: [{rings: [[[-6, 0, 4], [6, 0, 4], [6, 0, -4], [-6, 0, -4]]]}],
    neighbours: [],
  };
}

/** South wall, 3 bays of 4 m: arched portals on the ground floor (the middle one straddles the strip seam at u = 6), arched windows above. */
function spec(kind: ArchParams['kind'], bars: boolean, band: boolean): BlockSpec {
  const arch: ArchParams = {kind, springBar: bars, ...(band ? {band: {slot: 'stone', t: 0.22, out: 0.04, imposts: 'stone', keystone: 'stone'}} : {})};
  const win: WinParams = {w: 1.2, h: 0.7, sill: 0.8, arch, frame: 'frame', glass: 'glass', sillSlot: 'stone', sillH: 0.08, sillOut: 0.1, ...(bars ? {mull: 1, rowsAt: [0.3]} : {})};
  const portal: WinParams = {w: 1.6, h: 0.85, sill: 0.06, arch, frame: 'frame', glass: 'door', ...(bars ? {mull: 1} : {})};
  return {
    id: 'arch-test', pandId: '0000000000000000', name: 'arch test', palette: {wall: '#7a4a3a', roof: '#555555', frame: '#eeeeee', glass: '#223344', door: '#222222', stone: '#dddddd'},
    levels: {groundM: 3.6, storeyM: 2.7, lines: [0, 3.6, 6.3, 9]},
    systems: {arched: {pitch: 4, ground: {kind: 'punched', win: portal}, typical: {kind: 'punched', win}}},
    default: 'arched',
  };
}

function build(kind: ArchParams['kind'], bars = false, band = false) {
  return compose(box(), spec(kind, bars, band), {recessM: 0.18, closedBoxes: true, sealSlivers: true, systemFor: p => (p.n[2] > 0.9 ? 'arched' : null)});
}

function triangles(mesh: MeshBuilder) {
  const out: {slot: string; part: number; p: P3[]}[] = [];
  for (const [slot, s] of mesh.slots) for (let i = 0; i < s.parts.length; i++) {
    const v = s.positions.slice(i * 9, i * 9 + 9);
    out.push({slot, part: s.parts[i], p: [[v[0], v[1], v[2]], [v[3], v[4], v[5]], [v[6], v[7], v[8]]]});
  }
  return out;
}
const triArea = (p: P3[]) => {
  const a = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], b = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return {area: Math.hypot(c[0], c[1], c[2]) / 2, n: c};
};
/**
 * Undirected edges used by exactly one triangle (vertices welded at 1 mm), ignoring the open ground ring. Edges are
 * first split at every vertex lying on them (T-junctions: earcut bridges between collinear hole edges, roof/wall seams).
 */
function openEdges(tris: {p: P3[]}[]) {
  const k = (q: P3) => q.map(x => Math.round(x * 1000)).join(',');
  const verts = new Map<string, P3>();
  for (const t of tris) for (const q of t.p) verts.set(k(q), q);
  const all = [...verts.values()];
  const count = new Map<string, number>();
  const bump = (a: string, b: string) => { const e = a < b ? `${a}|${b}` : `${b}|${a}`; count.set(e, (count.get(e) ?? 0) + 1); };
  for (const t of tris) for (let i = 0; i < 3; i++) {
    const A = t.p[i], B = t.p[(i + 1) % 3], d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], l2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
    const on = all.map(v => ({v, t: ((v[0] - A[0]) * d[0] + (v[1] - A[1]) * d[1] + (v[2] - A[2]) * d[2]) / l2}))
      .filter(({v, t}) => t > 1e-6 && t < 1 - 1e-6 && Math.hypot(A[0] + d[0] * t - v[0], A[1] + d[1] * t - v[1], A[2] + d[2] * t - v[2]) < 0.001)
      .sort((x, y) => x.t - y.t);
    let prev = k(A);
    for (const o of on) { const kk = k(o.v); if (kk !== prev) { bump(prev, kk); prev = kk; } }
    if (prev !== k(B)) bump(prev, k(B));
  }
  return [...count].filter(([e, c]) => c === 1 && !e.split('|').every(v => Number(v.split(',')[1]) === 0)).map(([e]) => e);
}

test('arch outline: convex CCW, exact springing points and apex, analytic head area', () => {
  const w = 1.2, h = 3;
  for (const kind of ARCH_KINDS) {
    const a: ArchParams = {kind, segments: 16}, o = archOutline(0, w, 0, h, a), head = archHead(0, w, 0, h, a);
    assert.ok(polyArea(o) > 0, kind);
    for (let i = 0; i < o.length; i++) {
      const p = o[i], q = o[(i + 1) % o.length], r = o[(i + 2) % o.length];
      assert.ok((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]) >= -1e-9, `${kind}: convex at ${i}`);
    }
    assert.deepEqual(head[0][0], w); assert.deepEqual(head[head.length - 1][0], 0);
    assert.equal(head[0][1], head[head.length - 1][1]);
    assert.ok(Math.abs(Math.max(...o.map(p => p[1])) - h) < 1e-12, `${kind}: apex at the opening top`);
    const s = head[0][1], exact = kind === 'round' ? Math.PI * w * w / 8 : kind === 'pointed' ? w * w * (Math.PI / 3 - Math.sqrt(3) / 4) : (() => { const r = 0.18 * w, R = (w * w / 4 + r * r) / (2 * r), al = Math.asin(w / 2 / R); return R * R * al - (w / 2) * (R - r); })();
    const headArea = polyArea(o) - w * s;
    assert.ok(headArea <= exact + 1e-9 && headArea > exact * 0.985, `${kind}: head ${headArea.toFixed(4)} vs ${exact.toFixed(4)}`);
  }
  // a head taller than 75 % of the opening is squashed, keeping the springing points and apex exact
  const flat = archOutline(0, 2, 0, 1, {kind: 'round'});
  assert.ok(Math.abs(archHead(0, 2, 0, 1, {kind: 'round'})[0][1] - 0.25) < 1e-12 && Math.max(...flat.map(p => p[1])) === 1);
  // the frame inset keeps a constant width along straight edges, and topAt follows the head
  const o = archOutline(0, 1, 0, 2, {kind: 'round'}), inner = insetConvex(o, 0.07);
  assert.ok(Math.abs(inner[0][0] - 0.07) < 1e-9 && Math.abs(inner[0][1] - 0.07) < 1e-9);
  assert.ok(Math.abs(topAt(o, 0.5) - 2) < 1e-9 && topAt(o, 0.05) < 1.8);
});

test('arched openings are cut into the dissolved wall: closed shell, hole area, reveal area', () => {
  for (const kind of ARCH_KINDS) {
    const res = build(kind), tris = triangles(res.mesh);
    assert.equal(res.stats.recessed, 9, kind);
    assert.equal(res.stats.proud, 0, kind);
    assert.deepEqual(openEdges(tris), [], `${kind}: open edges`);
    // wall area facing south (host part 0) = 12 x 9 minus the cut outlines
    const wallSouth = tris.filter(t => t.part === 0 && t.slot === 'wall').map(t => triArea(t.p)).filter(t => t.n[2] > 0).reduce((s, t) => s + t.area, 0);
    // the openings' outlines, recomputed from the frame rings at the back (frame + glass/door area = outline area)
    const backArea = tris.filter(t => t.part > 0 && (t.slot === 'frame' || t.slot === 'glass' || t.slot === 'door')).map(t => triArea(t.p)).filter(t => t.n[2] > 0.99 * Math.hypot(...t.n)).reduce((s, t) => s + t.area, 0);
    assert.ok(Math.abs(wallSouth + backArea - 108) < 1e-6, `${kind}: wall ${wallSouth.toFixed(4)} + openings ${backArea.toFixed(4)} != 108`);
    // reveals (wall slot, not part 0) = sum of outline perimeters x depth 0.18
    const reveal = tris.filter(t => t.part > 0 && t.slot === 'wall').reduce((s, t) => s + triArea(t.p).area, 0);
    assert.ok(reveal > 0.18 * 2 * Math.sqrt(backArea) && reveal < 0.18 * 4 * backArea, `${kind}: reveal ${reveal.toFixed(3)}`);
  }
});

test('reveal area is perimeter x depth for each arch', () => {
  const res = build('round'), tris = triangles(res.mesh);
  const reveal = tris.filter(t => t.part > 0 && t.slot === 'wall').reduce((s, t) => s + triArea(t.p).area, 0);
  // 3 bays x 3 storeys, cells 4 m x (3.6 | 2.7 | 2.7): portals 1.6 x 3.06 (0.85 of 3.6), windows 1.2 x 1.8 (capped 0.1 under the storey line)
  const per = (w: number, h: number) => { const o = archOutline(0, w, 0, h, {kind: 'round'}); return o.reduce((s, p, i) => { const q = o[(i + 1) % o.length]; return s + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0); };
  const expected = 0.18 * (3 * per(1.6, 0.85 * 3.6) + 6 * per(1.2, 1.8));
  assert.ok(Math.abs(reveal - expected) < 1e-3, `reveal ${reveal.toFixed(4)} vs ${expected.toFixed(4)}`);
});

test('glazing bars stop under the head; arch bands, imposts and keystones are closed solids', () => {
  for (const kind of ARCH_KINDS) {
    const res = build(kind, true, true), tris = triangles(res.mesh);
    // bars are single-sided quads (as for rectangular openings); everything else stays closed
    const bars = new Set(tris.filter(t => t.slot === 'frame').map(t => t.part).filter(p => tris.some(t => t.part === p && t.slot === 'frame') && !tris.some(t => t.part === p && t.slot !== 'frame')));
    assert.deepEqual(openEdges(tris.filter(t => !bars.has(t.part))), [], `${kind}: open edges besides glazing bars`);
    const stone = tris.filter(t => t.slot === 'stone');
    assert.ok(stone.length > 9 * 40, `${kind}: band triangles ${stone.length}`);
    assert.ok(Math.max(...tris.flatMap(t => t.p.map(q => q[1]))) <= 9 + 1e-9);
  }
});

test('golden: the arched synthetic wall is stable', () => {
  const hash = (kind: ArchParams['kind']) => {
    const res = build(kind, true, true), h = crypto.createHash('sha256');
    for (const [slot, s] of [...res.mesh.slots].sort((a, b) => (a[0] < b[0] ? -1 : 1))) h.update(`${slot}:${s.positions.map(v => v.toFixed(4)).join(',')}|${s.parts.join(',')};`);
    return `${res.mesh.triangles}:${h.digest('hex').slice(0, 16)}`;
  };
  assert.deepEqual(ARCH_KINDS.map(hash), GOLDEN);
});
const GOLDEN = ['1541:37f22abe5688e1bb', '1541:fcfceb84356f42c9', '1541:bd3056c7d5cdf738'];
