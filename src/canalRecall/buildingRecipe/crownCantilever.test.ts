import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {MeshBuilder} from '../blockBuilding/mesh.ts';
import type {Panel} from '../blockBuilding/panels.ts';
import {applyCrownCantilever, addCrownWall, clipTriangleAtHeight, crownGroup, crownWindow, resolveCrown, SOFFIT_RIB_M, CROWN_DECK_M} from './crownCantilever.ts';
import {validateLargeIntent} from './largeIntent.ts';
import type {LargeBuildingRecipe, LargeGroupFit} from './fitLarge.ts';

/** A 20 m (u, along the south wall) x 30 m (v, depth) shell, 10 storeys of 3 m, south wall plane z = 15. */
function fixture() {
  const panel = {index: 0, o: [-10, 0, 15], r: [1, 0, 0], n: [0, 0, 1], uMin: 0, uMax: 20, vMin: 0, vMax: 30} as unknown as Panel;
  const lines = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
  const group: LargeGroupFit = {
    index: 0, system: 'brick-bay-grid', specSystem: 'g0', panels: [0], surfaces: [1], mainPanel: 0, bearingDeg: 179,
    widthM: 20, eavesM: 30, flatTop: true, storeys: 10, storeyHeightsM: [3, ...Array(9).fill(3)], lines,
    bays: 10, pitchM: 2, ground: 'glazed', cornice: false, entrance: null, garage: null, signage: null, police: null,
    slots: {wall: 'wall', frame: 'frame', stone: 'stone', glass: 'glass', door: 'door', curtain: 'frame', sign: 'sign'},
  } as unknown as LargeGroupFit;
  const recipe = {
    id: 'fixture', pandId: '0363100000000000', anchorRD: [0, 0] as [number, number],
    set: {pandId: '0363100000000000', anchor: [0, 0], groundNap: 0, heightMax: 30, constructionYear: 2020,
      walls: [], roofs: [], ground: [{rings: [[[-10, 0, -15], [10, 0, -15], [10, 0, 15], [-10, 0, 15]]]}], neighbours: []},
    spec: {id: 'fixture', pandId: '0363100000000000', name: 'fixture', palette: {wall: '#dededa', frame: '#3a4046', stone: '#cfcfca', glass: '#2a3a42', roof: '#555555'},
      levels: {groundM: 3, storeyM: 3},
      systems: {g0: {pitch: 2, ground: {kind: 'glazed'}, typical: {kind: 'wall', cycle: [{kind: 'punched', win: {w: 0.9, h: 0.5, sill: 0.8, sillSlot: 'stone'}}, {kind: 'punched', win: {w: 0.45, h: 0.5, sill: 0.8, sillSlot: 'stone'}}]}}, other: {pitch: 6, ground: {kind: 'wall'}, typical: {kind: 'wall'}}},
      default: 'other'},
    groups: [group], other: {system: 'blank', specSystem: 'other'}, panelGroup: [0], wallGroup: [0],
    roofPlant: [], recessM: 0.18, roof: {material: 'bitumen'}, wallMaterial: 'render',
  } as unknown as LargeBuildingRecipe;
  return {recipe, panel, group};
}

const triCount = (m: MeshBuilder) => m.triangles;
const slotTris = (m: MeshBuilder, slot: string) => (m.slots.get(slot)?.parts.length ?? 0);

test('clipTriangleAtHeight splits a triangle at the plane and keeps the area', () => {
  const {below, above} = clipTriangleAtHeight([0, 0, 0], [2, 0, 0], [0, 2, 0], 1);
  assert.equal(below.length, 2);
  assert.equal(above.length, 1);
  const area = (ts: number[][][]) => ts.reduce((s, t) => s + Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1])) / 2, 0);
  assert.ok(Math.abs(area(below) + area(above) - 2) < 1e-9);
  assert.ok(above.every(t => t.every(p => p[1] >= 1 - 1e-9)));
});

test('the crown takes the dominant pair front and its soffit sits on the right storey line', () => {
  const {recipe, group} = fixture();
  assert.equal(crownGroup(recipe).index, 0);
  const w = crownWindow(recipe, group);
  assert.deepEqual(w.widths, [0.9, 0.45]);
  assert.equal(w.sillM, 0.8);
  const plan = resolveCrown(recipe, {storeys: 3, overhang: {S: 2}}, [panelOf(recipe)]);
  assert.equal(plan.soffitM, 21, '3 crown storeys of 3 m under a 30 m eaves start at the 21 m line');
  assert.equal(plan.cutM, 21 + SOFFIT_RIB_M);
  assert.deepEqual(plan.frame.u, [1, 0, 0]);
  assert.equal(plan.sMin, 0);
  assert.equal(plan.sMax, 20);
});

function panelOf(recipe: LargeBuildingRecipe): Panel {
  return {index: 0, o: [-10, 0, 15], r: [1, 0, 0], n: [0, 0, 1], uMin: 0, uMax: 20, vMin: 0, vMax: 30} as unknown as Panel;
}

test('a crown wall is segmented on the bay grid: no wall edge spans an opening', () => {
  const m = new MeshBuilder();
  addCrownWall(m, {o: [-10, 0, 15], u: [1, 0, 0], n: [0, 0, 1]}, {where: 'front', at: 5, outward: 1}, 0, 8, 0,
    [0, 3], [{u0: 0, u1: 2, index: 0}, {u0: 2, u1: 4, index: 1}, {u0: 4, u1: 6, index: 0}, {u0: 6, u1: 8, index: 1}],
    {widths: [0.9, 0.45], hFrac: 0.5, sillM: 0.8}, {wall: 'wall', glass: 'glass', stone: 'stone', frame: 'frame'});
  assert.ok(slotTris(m, 'glass') === 8, 'one glass pane per bay');
  assert.equal(slotTris(m, 'stone'), 8, 'one stone sill face per opening');
  // every wall quad's bottom/top edges are per bay: no single 8 m edge on the wall field
  const pos = m.slots.get('wall')!.positions;
  const edges = new Map<string, number>();
  for (let i = 0; i < pos.length; i += 9) {
    const v = [0, 1, 2].map(k => [pos[i + k * 3], pos[i + k * 3 + 1], pos[i + k * 3 + 2]].map(x => +x.toFixed(3)).join(','));
    for (let k = 0; k < 3; k++) { const a = v[k], b = v[(k + 1) % 3]; const key = a < b ? `${a}|${b}` : `${b}|${a}`; edges.set(key, (edges.get(key) ?? 0) + 1); }
  }
  const long = [...edges.entries()].filter(([k, n]) => n === 1 && Math.abs(+k.split('|')[0].split(',')[1] - +k.split('|')[1].split(',')[1]) < 1e-9 && Math.abs(+k.split('|')[0].split(',')[0] - +k.split('|')[1].split(',')[0]) > 2.1);
  assert.deepEqual(long, [], 'no horizontal once-used wall edge longer than one bay');
});

test('applyCrownCantilever keeps the shell, moves the crown south and closes it', () => {
  const {recipe} = fixture();
  const m = new MeshBuilder();
  // the shell: a south wall panel at z=15 and a roof at 30
  m.quad('wall', [-10, 0, 15], [10, 0, 15], [10, 30, 15], [-10, 30, 15], 0, [0, 0, 1]);
  m.quad('roof', [-10, 30, -15], [10, 30, -15], [10, 30, 15], [-10, 30, 15], 0, [0, 1, 0]);
  const before = triCount(m);
  const r = applyCrownCantilever(m, recipe, {storeys: 3, overhang: {S: 2}}, [panelOf(recipe)]);
  assert.equal(r.overhangM.S, 4, '2 bays of the 2 m pitch');
  assert.equal(r.soffitM, 21);
  assert.equal(r.crownStoreys, 3);
  assert.ok(triCount(m) > before, 'the crown adds geometry');
  assert.equal(slotTris(m, 'roof'), 2 + 12, 'the shell roof stays and one closed deck slab is added');
  // the crown's south wall stands 4 m south of the shell plane
  const wall = m.slots.get('wall')!.positions;
  const maxZ = Math.max(...Array.from({length: wall.length / 3}, (_, i) => wall[i * 3 + 2]));
  assert.ok(Math.abs(maxZ - 19) < 1e-6, `crown wall at v=d (z=19), got ${maxZ}`);
  const minZ = Math.min(...Array.from({length: wall.length / 3}, (_, i) => wall[i * 3 + 2]));
  assert.ok(Math.abs(minZ - 15) < 1e-6, 'the shell wall is untouched at z=15');
  // the deck sits CROWN_DECK_M under the parapet
  const roof = m.slots.get('roof')!.positions;
  const deckYs = Array.from({length: roof.length / 3}, (_, i) => roof[i * 3 + 1]).filter(y => y < 29.9);
  assert.ok(deckYs.every(y => Math.abs(y - (30 - CROWN_DECK_M)) < 1e-6 || Math.abs(y - (30 - CROWN_DECK_M + 0.2)) < 1e-6));
});

test('the intent takes crown {storeys, overhang, coffers} in bays and rejects metres or bad sides', () => {
  const base = {
    schemaVersion: 1, kind: 'large', id: 'x', pandId: '0363100000000000', address: 'x',
    sources: [{id: 's', kind: 'street-panorama', capturedAt: '2025-01-01', url: 'https://example.org/p', license: 'CC BY 4.0'}],
    palette: {brick: '#dededa', frame: '#3a4046', door: '#2a2c2c'},
    walls: [{wallSurfaces: [1], system: 'brick-bay-grid', storeys: 4, baysPerStorey: 4, ground: 'glazed'}],
  };
  assert.doesNotThrow(() => validateLargeIntent({...base, crown: {storeys: 2, overhang: {S: 4}, coffers: true}}));
  assert.throws(() => validateLargeIntent({...base, crown: {storeys: 2, overhang: {S: 4.5}}}), /whole bays/);
  assert.throws(() => validateLargeIntent({...base, crown: {storeys: 2, overhang: {X: 2}}}), /N, E, S or W/);
  assert.throws(() => validateLargeIntent({...base, crown: {storeys: 0, overhang: {S: 2}}}), /storeys/);
  assert.throws(() => validateLargeIntent({...base, crown: {storeys: 2, overhang: {S: 2}, soffitM: 20}}), /unknown field/);
});
