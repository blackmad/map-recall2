import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeVertices, partIds, sharedWalls, shellSurfaces, type BagFeature} from './bag-shell-parts';

/** A box solid as a 3DBAG part: ground, four walls, roof; vertex indices from `o`. */
function boxPart(o: number): number[][][] {
  const g = [o, o + 3, o + 2, o + 1], r = [o + 4, o + 5, o + 6, o + 7];
  const walls = [0, 1, 2, 3].map(k => [o + k, o + (k + 1) % 4, o + 4 + (k + 1) % 4, o + 4 + k]);
  return [[g], ...walls.map(w => [w]), [r]];
}
const sem = {surfaces: [{type: 'GroundSurface'}, {type: 'WallSurface'}, {type: 'RoofSurface'}], values: [[0, 1, 1, 1, 1, 2]]};
/** Box vertices x0..x1, y (north) 0..4, height h (RD-ish, z up). */
const boxVerts = (x0: number, x1: number, h: number) => [[x0, 0, 0], [x1, 0, 0], [x1, 4, 0], [x0, 4, 0], [x0, 0, h], [x1, 0, h], [x1, 4, h], [x0, 4, h]];
const tr = {scale: [1, 1, 1], translate: [0, 0, 0]};

function feature(parts: {verts: number[][]}[], listChildren = true): BagFeature {
  const verts: number[][] = [], co: BagFeature['CityObjects'] = {};
  const ids = parts.map((_, k) => `NL.IMBAG.Pand.X-${k}`);
  parts.forEach((p, k) => { co[ids[k]] = {geometry: [{lod: '2.2', boundaries: [boxPart(verts.length)], semantics: sem}]}; verts.push(...p.verts); });
  co['NL.IMBAG.Pand.X'] = listChildren ? {children: [...ids].reverse()} : {};
  return {CityObjects: co, vertices: verts};
}

test('a single-part pand reads part -0 exactly as the old reader did', () => {
  const f = feature([{verts: boxVerts(0, 10, 6)}]);
  const v = nativeVertices(f, tr, [5, 2], 0);
  const s = shellSurfaces(f, 'X', v);
  const g = f.CityObjects['NL.IMBAG.Pand.X-0'].geometry![0];
  const old = g.boundaries[0].map((b, i) => ({type: g.semantics.surfaces[g.semantics.values[0][i]].type, rings: b.map(r => r.map(k => v[k]))}));
  assert.deepEqual(s, old);
  assert.deepEqual(partIds(feature([{verts: boxVerts(0, 1, 1)}], false), 'X'), ['NL.IMBAG.Pand.X-0']);
});

test('parts are read in numeric order, all of them', () => {
  const f = feature([{verts: boxVerts(0, 10, 6)}, {verts: boxVerts(20, 30, 9)}, {verts: boxVerts(40, 45, 3)}]);
  assert.deepEqual(partIds(f, 'X'), ['NL.IMBAG.Pand.X-0', 'NL.IMBAG.Pand.X-1', 'NL.IMBAG.Pand.X-2']);
  const s = shellSurfaces(f, 'X', nativeVertices(f, tr, [0, 0], 0));
  assert.equal(s.length, 18);
  const xs = s.filter(x => x.type === 'RoofSurface').map(x => Math.max(...x.rings[0].map(p => p[0])));
  assert.deepEqual(xs, [10, 30, 45]);
});

test('a lower part abutting a taller one loses its shared wall; the taller keeps its own', () => {
  const f = feature([{verts: boxVerts(0, 10, 6)}, {verts: boxVerts(10, 20, 12)}]);
  const v = nativeVertices(f, tr, [0, 0], 0);
  const s = shellSurfaces(f, 'X', v);
  assert.equal(s.length, 11);
  const atX10 = s.filter(x => x.type === 'WallSurface' && x.rings[0].every(p => Math.abs(p[0] - 10) < 1e-6));
  assert.equal(atX10.length, 1);
  assert.equal(Math.max(...atX10[0].rings[0].map(p => p[1])), 12);
});

test('walls of the same part, or facing the same way, are never dropped', () => {
  const f = feature([{verts: boxVerts(0, 10, 6)}]);
  const s = shellSurfaces(f, 'X', nativeVertices(f, tr, [0, 0], 0));
  assert.equal(sharedWalls(s, s.map(() => 0)).size, 0);
  // two parts 5 cm apart: not coplanar within 3 cm
  const g = feature([{verts: boxVerts(0, 10, 6)}, {verts: boxVerts(10.05, 20, 6)}]);
  assert.equal(shellSurfaces(g, 'X', nativeVertices(g, tr, [0, 0], 0)).length, 12);
});
