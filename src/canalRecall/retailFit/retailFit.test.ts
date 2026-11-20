import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { retailFitEnabled, retailFitModeOf, RETAIL_FIT_DEFAULT } from './flag.ts';
import { glassOpenings, openingAt } from './openings.ts';
import { drawLayers, FitBuilder, FIT_OUT } from './geometry.ts';
import { HAND_FITS, fitsForModel, modelDraws, NODE_FILLS_ENABLED, STAGED_MODELS } from './fits.ts';
import { checkStaged, layersOfRead } from './photoRead.ts';
import { retailFitMesh, surveyedNative } from './overlay.ts';
import { HOST_RULES, expressionAllowed, hostKindOf } from './hosts.ts';
import type { FitLayer, HostOpening } from './types.ts';

test('flag: published reads by default, ?retailFit=1 adds staged ones, ?retailFit=0 draws nothing', () => {
  assert.equal(RETAIL_FIT_DEFAULT, 'published');
  assert.equal(retailFitModeOf(null, null), 'published');
  assert.equal(retailFitModeOf('?a=1&retailFit=1', null), 'all');
  assert.equal(retailFitModeOf('?retailFit=0', '1'), 'off');
  assert.equal(retailFitModeOf(null, '1'), 'all');
  assert.equal(retailFitModeOf(null, '0'), 'off');
  assert.equal(retailFitEnabled('?retailFit=0', null), false);
});

test('staged reads: the file is sound, each read becomes in-opening layers, and only published models draw by default', () => {
  assert.deepEqual(checkStaged(STAGED_MODELS), []);
  for (const [model, m] of Object.entries(STAGED_MODELS)) {
    assert.equal(modelDraws(model, 'off'), false);
    assert.equal(modelDraws(model, 'all'), true);
    assert.equal(modelDraws(model, 'published'), m.status === 'published', model);
  }
  assert.equal(modelDraws('westerkerk', 'all'), false);
  const L = layersOfRead({ glass: '#303c41', goods: { kind: 'shelves', hexes: ['#8c897f'] }, letters: [{ where: 'head', text: 'ALBERT HEIJN', ink: '#7cc6ee' }], frame: { hex: '#1e2124' }, door: { hex: '#1e2124', leaves: 2 } });
  assert.deepEqual(L.map(l => l.k), ['interior', 'goods', 'head-letters', 'frame', 'door']);
  assert.deepEqual(layersOfRead({ glass: '#d3d0c8', panel: { hex: '#d3d0c8', atms: 3 } }).map(l => l.k), ['panel'], 'a panel fills the opening instead of glass');
  assert.equal(NODE_FILLS_ENABLED, false, 'node-only chain fills lost their blind A/B (2026-11-20)');
});

/** A round-arched glass slab facing north (-z): front face at z = -0.07, back face at z = 0, 3.3 m wide, crown 5 m. */
function archSlab(cx: number): number[] {
  const W = 3.3, r = W / 2, S = 5 - r, out: number[] = [];
  const outline: [number, number][] = [[-r, 0], [r, 0], [r, S]];
  for (let i = 1; i < 12; i++) { const a = (i / 12) * Math.PI; outline.push([r * Math.cos(a), S + r * Math.sin(a)]); }
  outline.push([-r, S]);
  for (const [z, flip] of [[-0.07, false], [0, true]] as const) for (let i = 1; i + 1 < outline.length; i++) {
    const [a, b, c] = [outline[0], outline[i], outline[i + 1]].map(([u, v]) => [cx - u, v, z]);
    out.push(...(flip ? [...a, ...c, ...b] : [...a, ...b, ...c]));
  }
  return out;
}

test('openings: one outward round arch per glass slab, its head read off the outline', () => {
  const soups = [{ positions: archSlab(0) }, { positions: archSlab(5) }];
  const ops = glassOpenings(soups, [2.5, 10]);
  assert.equal(ops.length, 2);
  for (const o of ops) {
    assert.equal(o.head, 'round');
    assert.ok(Math.abs(o.widthM - 3.3) < 0.01 && Math.abs(o.crownM - 5) < 0.01 && Math.abs(o.springM - 3.35) < 0.02, JSON.stringify(o));
    assert.ok(Math.abs(o.bearing) < 1 || Math.abs(o.bearing - 360) < 1, `faces north: ${o.bearing}`);
    assert.ok(Math.abs(o.base[2] + 0.07) < 1e-6, 'on the front face, not the back');
  }
  assert.equal(openingAt(ops, 4.6, -1)?.base[0].toFixed(2), '5.00');
  assert.equal(openingAt(ops, 20, -1), null);
});

const ROUND: HostOpening = { id: 't', base: [0, 0, 0], n: [0, -1], t: [-1, 0], widthM: 3.3, sillM: 0, springM: 3.35, crownM: 5, head: 'round', bearing: 0, areaM2: 15 };
const EVERY: FitLayer[] = [
  { k: 'interior', hex: '#999999' }, { k: 'goods', kind: 'shelves', hexes: ['#ff0000', '#00ff00'] }, { k: 'goods', kind: 'tables', hexes: ['#c8a678', '#6b5a45', '#dfe8f0'] }, { k: 'goods', kind: 'curtains', hexes: ['#d9d6cc', '#bdb9ae'] }, { k: 'goods', kind: 'sleeves', hexes: ['#c9c2b0', '#3c5a8a'] },
  { k: 'lamps', hex: '#ffffff' }, { k: 'vinyl', base: '#dfe6ef', ink: '#2b4a8f', pattern: 'delft', window: [0.3, 0.7, 0.8, 2.3] }, { k: 'vinyl', base: '#cdd9e6', ink: '#24427f', pattern: 'landscape', window: [0.36, 0.66, 0.55, 1.35], windowGoods: ['#d9506a'] }, { k: 'posters', hex: '#00a0e2', n: 2 },
  { k: 'panel', hex: '#d3d0c8', atms: 3, text: 'GELDMAAT' }, { k: 'band', hex: '#1d2c5a', v0: 0.15, v1: 0.72, text: 'RIJKS MUSEUM' },
  { k: 'head-letters', text: 'ALBERT HEIJN', ink: '#7cc6ee', bg: '#22313d' }, { k: 'glass-letters', text: 'ABN AMRO', ink: '#fff', v: 3, mark: '#00857a' },
  { k: 'door', hex: '#111111', leaves: 2 }, { k: 'frame', hex: '#111111', transom: true, mullions: 2 },
];

test('every layer stays inside the opening outline, in front of the glass and under a 0.07 m archivolt', () => {
  const b = new FitBuilder(ROUND);
  drawLayers(b, EVERY, 3);
  const P = b.pos;
  assert.ok(P.length > 0);
  for (let i = 0; i < P.length; i += 3) {
    const u = -P[i], v = P[i + 1], out = -P[i + 2];
    assert.ok(Math.abs(u) <= ROUND.widthM / 2 + 1e-6, `u ${u}`);
    assert.ok(v >= -1e-6 && v <= b.top(u) + 0.02, `v ${v} over the head at u ${u} (${b.top(u)})`);
    assert.ok(out > 0 && out < 0.07, `out ${out}`);
  }
  // Faces point out (+n): the first triangle's normal.
  const ax = P[3] - P[0], ay = P[4] - P[1], az = P[5] - P[2], bx = P[6] - P[0], by = P[7] - P[1], bz = P[8] - P[2];
  const nz = ax * by - ay * bx;
  assert.ok(nz < 0, 'normal points to -z, the opening\'s outward side');
  assert.ok(Math.max(...Object.values(FIT_OUT)) < 0.07);
});

test('host rule: a designed ground storey never takes a fascia box', () => {
  for (const host of ['landmark-arcade', 'landmark-bays', 'historic-pui'] as const) assert.equal(expressionAllowed(host, 'fascia-box'), false, host);
  assert.equal(expressionAllowed('plain-modern', 'fascia-box'), true);
  assert.equal(expressionAllowed('landmark-arcade', 'head-letters'), true);
  assert.equal(hostKindOf({ model: 'bespoke-landmark', heads: ['round', 'round'] }), 'landmark-arcade');
  assert.equal(hostKindOf({ monumentPui: true }), 'historic-pui');
  assert.equal(hostKindOf({}), 'plain-modern');
  assert.ok(Object.keys(HOST_RULES).length >= 6);
});

test('Hirschgebouw: every hand fit lands in its own arch of the shipped GLB', async () => {
  const file = 'public/canal-drive/models/hirschgebouw.glb';
  if (!fs.existsSync(file)) return;
  const { loadGlb } = await import('../glbRaster/load.ts');
  const g = await loadGlb(new Uint8Array(fs.readFileSync(file)));
  const glass = g.primitives.filter(p => g.materials[p.material].extras.materialSlot === 'glass');
  let sx = 0, sz = 0, n = 0; for (const p of g.primitives) for (let i = 0; i < p.positions.length; i += 3) { sx += p.positions[i]; sz += p.positions[i + 2]; n++; }
  const soups = glass.map(p => ({ positions: p.positions, indices: p.indices }));
  const toNative = surveyedNative([4.8825371, 52.3634123]);
  const ops = glassOpenings(soups, [sx / n, sz / n]);
  const leidseplein = ops.filter(o => Math.abs(o.bearing - 323) < 3);
  assert.equal(leidseplein.length, 8, 'eight Leidseplein arches');
  assert.ok(leidseplein.every(o => o.head !== 'flat' && o.widthM > 3 && o.widthM < 3.35 && Math.abs(o.crownM - 5) < 0.05));
  assert.ok(leidseplein.filter(o => o.head === 'round').length >= 7, 'round arches (one arch\'s glass reads 3.08 m wide with a lower springing: segmental)');
  const fits = fitsForModel('hirschgebouw', ops, toNative, false, 'all');
  assert.equal(fits.length, HAND_FITS.filter(f => f.model === 'hirschgebouw').length);
  assert.equal(new Set(fits.map(f => f.op.id)).size, fits.length, 'one tenant per arch');
  const tenantOf = (lng: number, lat: number) => { const [x, z] = toNative(lng, lat); const op = openingAt(ops, x, z, 2.5)!; return fits.find(f => f.op === op)?.tenant; };
  assert.equal(tenantOf(4.882252, 52.3635), 'Shop at Rijksmuseum');
  assert.equal(tenantOf(4.881977, 52.363371), 'Albert Heijn (entrance)');
  (globalThis as { __canalRecallRetailFit?: string }).__canalRecallRetailFit = 'all';
  const r = retailFitMesh('hirschgebouw', soups, [sx / n, sz / n], toNative)!;
  assert.ok(r.mesh.triangles > 1000 && r.mesh.triangles < 6000, `${r.mesh.triangles} triangles`);
  assert.equal(retailFitMesh('westerkerk', soups, [0, 0], toNative), null, 'a model with no fits gets nothing');
  (globalThis as { __canalRecallRetailFit?: string }).__canalRecallRetailFit = 'off';
  assert.equal(retailFitMesh('hirschgebouw', soups, [sx / n, sz / n], toNative), null, '?retailFit=0 draws nothing');
  delete (globalThis as { __canalRecallRetailFit?: string }).__canalRecallRetailFit;
});
