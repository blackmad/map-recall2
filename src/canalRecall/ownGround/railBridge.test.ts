// railBridge.ts: piers, girders and railings under the rail decks (lane rail-look round 3, 2026-10-31: "rail decks have
// no piers, girders or parapets").
import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_CLEAR_M, PIER, placePiers, pierSites, RAIL_PIER_SPAN_M, railBridgeMesh, underTest, type RailDeckStation, type UnderKind } from './railBridge.ts';
import { railMeshes, type RailWay } from './railTracks.ts';

/** A straight deck along x from 0 to `len`, top at `top`, stations every 2 m. */
const deck = (len: number, top = 6, shared = false): RailDeckStation[] => {
  const out: RailDeckStation[] = [];
  for (let s = 0; s <= len + 1e-9; s += 2) out.push({ p: [s, 0], n: [0, 1], k: 1, s, top, soffit: top - 1.1, left: 2.45, right: 2.45, sharedL: shared, sharedR: false });
  return out;
};
const pierXs = (m: { positions: number[]; colors?: number[] }, colour: number[]) => {
  const xs = new Set<number>();
  for (let i = 0; i < m.positions.length; i += 3) if (m.colors && Math.abs(m.colors[i] - colour[0]) < 1e-6 && Math.abs(m.colors[i + 1] - colour[1]) < 1e-6 && m.positions[i + 2] < 2) xs.add(Math.round(m.positions[i]));
  return [...xs].sort((a, b) => a - b);
};

test('rail bridge: a viaduct over land and a road gets column piers within its span, none on the road', async () => {
  const { RAIL_BRIDGE_COLOURS } = await import('./railBridge.ts');
  // 60 m over land, a 10 m wide road at x 25..35, ground at 0.
  const under = (x: number): UnderKind => (x > 25 && x < 35 ? 'road' : 'land');
  const st = deck(60);
  const r = railBridgeMesh({ stations: st, own: st.slice(1).map(() => true), ground: () => 0, under, far: false });
  assert.ok(r.stats.piers >= 3, `piers ${r.stats.piers}`);
  assert.equal(r.stats.girderMetres, 0);
  assert.equal(r.stats.viaductMetres, 60);
  const xs = pierXs(r.mesh, RAIL_BRIDGE_COLOURS.pier);
  for (const x of xs) assert.ok(x < 25 - PIER.halfLen || x > 35 + PIER.halfLen, `pier foot at x = ${x} on the road`);
  // Spacing: no gap over the span except where the road forces it.
  const sites = pierSites({ stations: st, own: [], ground: () => 0, under, far: false });
  assert.ok(sites.every(q => q.s < 25 - PIER.halfLen || q.s > 35 + PIER.halfLen));
});

test('rail bridge: over water a through girder spans bank to bank, never a pier in the water', async () => {
  const { RAIL_BRIDGE_COLOURS, GIRDER } = await import('./railBridge.ts');
  const under = (x: number): UnderKind => (x > 8 && x < 52 ? 'water' : 'land');
  const st = deck(60);
  const r = railBridgeMesh({ stations: st, own: st.slice(1).map(() => true), ground: () => 0, under, far: false });
  assert.ok(r.stats.girderMetres > 0 && r.stats.railingMetres === 0);
  for (const x of pierXs(r.mesh, RAIL_BRIDGE_COLOURS.pier)) assert.ok(x <= 8 || x >= 52, `pier at x = ${x} in the water`);
  const zs = r.mesh.positions.filter((_, i) => i % 3 === 2);
  assert.ok(Math.abs(Math.max(...zs) - (6 + GIRDER.rise)) < 1e-6, 'the girder top stands over the ballast');
});

test('rail bridge: no pier where the deck sits on its embankment, and placement spans the gaps', () => {
  const st = deck(40);
  const sites = pierSites({ stations: st, own: [], ground: x => (x < 10 ? 5.5 : 0), under: () => 'land', far: false });
  assert.ok(sites.every(q => q.s >= 10 - PIER.halfLen - PIER.margin), 'no pier over the embankment');
  assert.ok(6 - 1.1 - 5.5 < MIN_CLEAR_M);
  // Greedy: every gap at most the span where sites allow; a long gap without sites is spanned once.
  const p = placePiers([{ s: 5 }, { s: 12 }, { s: 20 }, { s: 60 }, { s: 70 }], 0, 80, RAIL_PIER_SPAN_M.viaduct);
  assert.deepEqual(p, [12, 20, 60, 70]);
});

test('rail bridge: a side shared with a neighbouring track has no railing; far ring has no posts', () => {
  const st = deck(30), own = st.slice(1).map(() => true), under = () => 'land' as const;
  const both = railBridgeMesh({ stations: st, own, ground: () => 0, under, far: false });
  const one = railBridgeMesh({ stations: deck(30, 6, true), own, ground: () => 0, under, far: false });
  assert.equal(both.stats.railingMetres, 60);
  assert.equal(one.stats.railingMetres, 30);
  const far = railBridgeMesh({ stations: st, own, ground: () => 0, under, far: true });
  assert.ok(far.stats.triangles < both.stats.triangles / 2, `far ${far.stats.triangles} vs near ${both.stats.triangles}`);
  // Not the cell's own: nothing.
  assert.equal(railBridgeMesh({ stations: st, own: own.map(() => false), ground: () => 0, under, far: false }).stats.triangles, 0);
});

test('rail bridge: underTest finds water, streets by their half width and tracks at grade', () => {
  const u = underTest((x) => x > 100, [{ points: [[0, 0], [0, 50]], half: 4 }], [[[20, 0], [20, 50]]]);
  assert.equal(u(150, 10), 'water');
  assert.equal(u(4.2, 10), 'road');
  assert.equal(u(5.0, 10), 'land');
  assert.equal(u(21.5, 10), 'rail');
  assert.equal(u(60, 10), 'land');
});

test('railMeshes: the structure is drawn only with `under`, and only under a bridge', () => {
  const way: RailWay = { kind: 'rail', bridge: true, service: false, points: [[0, 0], [60, 0]] };
  // Banks at +6 at both ends (the deck rides the line between them), a street level 0 between.
  const base = { ways: [way], inCell: () => true, height: (x: number) => (x < 1 || x > 59 ? 6 : 0) };
  assert.equal(railMeshes(base).structure.indices.length, 0, 'byte-identical without under');
  const r = railMeshes({ ...base, under: () => 'land' });
  assert.ok(r.structure.indices.length > 0 && (r.stats.structure?.piers ?? 0) > 0);
  const ground = railMeshes({ ...base, ways: [{ ...way, bridge: false }], under: () => 'land' });
  assert.equal(ground.structure.indices.length, 0);
});
