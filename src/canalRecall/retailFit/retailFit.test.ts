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

test('historic pui: staged hosts gated by mode and sign; the kit draws no fascia box, a sign host only its name; byte-identical when absent', async () => {
  const { STAGED_PUIS, historicPuiHost } = await import('./historicPui.ts');
  const { retailFrontTris, FRONT } = await import('../retailFront.ts');
  const ids = Object.keys(STAGED_PUIS);
  assert.ok(ids.length >= 14);
  for (const id of ids) {
    const p = STAGED_PUIS[id], drawn = (p.sign === 'band' || p.sign === 'glass' || p.sign === 'neon' || p.sign === 'none') && !!p.front;
    assert.match(p.source, /RCE monument register/);
    assert.ok(p.signSource, `${id} has a sign source`);
    if (p.front) { assert.ok(p.frontSource, `${id} has a front source`); assert.equal(p.front.sign.kind, p.sign); }
    assert.equal(!!historicPuiHost(`NL.IMBAG.Pand.${id}`, false, 'all'), drawn);
    assert.equal(historicPuiHost(id, false, 'off'), undefined);
    assert.equal(!!historicPuiHost(id, false, 'published'), drawn && p.status === 'published');
    if (drawn) { assert.equal(historicPuiHost(id, false, 'all')!.mode, 'kit'); assert.equal(historicPuiHost(id, true, 'all')!.mode, 'sign'); }
  }
  assert.equal(historicPuiHost('0000000000000000', false, 'all'), undefined);
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };
  const input = { template: 'brownBar' as const, word: 'STOOF', seed: 'NL.IMBAG.Pand.x', letters: 0, faces: 10 };
  const plain = retailFrontTris(input, e, 0, 6, 0, 3.2), again = retailFrontTris({ ...input }, e, 0, 6, 0, 3.2);
  assert.equal(JSON.stringify(plain), JSON.stringify(again));
  // No member wider than 1 m stands out as far as the template's fascia board (FRONT.fasciaOutM) over the pui.
  const top = 3.2 - FRONT.fasciaGapM, bottom = top - FRONT.fasciaM;
  const proud = (tris: typeof plain) => tris.filter(t => t.p.every(p => p[2] >= bottom - 1e-6 && p[2] <= top + FRONT.capM + 1e-6) && t.p.some(p => Math.abs(p[1]) >= FRONT.fasciaOutM - 1e-6) && Math.max(...t.p.map(p => p[0])) - Math.min(...t.p.map(p => p[0])) > 1).length;
  assert.ok(proud(plain) > 0, 'the template draws a projecting board');
  const stoof = STAGED_PUIS['0363100012171790'].front!;
  for (const front of [stoof, { ...stoof, sign: { kind: 'glass' as const, ink: '#ffffff' } }, { ...stoof, panes: undefined, sign: { kind: 'band' as const, ink: '#c9a650' } }]) {
    const kit = retailFrontTris({ ...input, host: { mode: 'kit', front } }, e, 0, 6, 0, 3.2);
    assert.ok(kit.length > 20, 'the kit pui draws');
    assert.equal(proud(kit), 0, 'and no fascia board');
    // Inside the front's span, out no further than a pilaster, from the ground to the storey top.
    for (const t of kit) for (const p of t.p) { assert.ok(p[0] >= -1e-6 && p[0] <= 6 + 1e-6); assert.ok(p[2] >= -1e-6 && p[2] <= 3.2 + 1e-6); assert.ok(p[1] <= 0.6); }
    // The glass carries the front's own colours: its frame appears, the template's surround does not.
    assert.ok(kit.some(t => t.hex === front.frame));
  }
  // Small panes: the 3 x 4 grid draws its bars; a sheet front draws none at bar depth.
  const bars = (tris: typeof plain) => tris.filter(t => t.p.every(p => Math.abs(Math.abs(p[1]) - 0.04) < 1e-6)).length;
  assert.ok(bars(retailFrontTris({ ...input, host: { mode: 'kit', front: stoof } }, e, 0, 6, 0, 3.2)) > bars(retailFrontTris({ ...input, host: { mode: 'kit', front: { ...stoof, panes: undefined } } }, e, 0, 6, 0, 3.2)));
  // A pand with its own front: only the name (lettered quads), flush on the wall.
  const sign = retailFrontTris({ ...input, host: { mode: 'sign', front: stoof } }, e, 0, 6, 0, 3.2);
  assert.ok(sign.length > 0 && sign.every(t => t.layer !== undefined), 'only lettering');
  assert.ok(sign.every(t => t.p.every(p => Math.abs(p[1]) <= 0.05)));
});

test('historic pui round 6: read doors, sheet glass, two-line signs, legible bars, lit top lights', async () => {
  const { STAGED_PUIS } = await import('./historicPui.ts');
  const { retailFrontTris } = await import('../retailFront.ts');
  const { puiDoors, PUI_KIT } = await import('./historicPuiFront.ts');
  const e = { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1 };
  const input = { template: 'brownBar' as const, word: 'STOOF', seed: 'NL.IMBAG.Pand.x', letters: 0, faces: 10 };
  const stoof = STAGED_PUIS['0363100012171790'].front!;
  const kit = (front: typeof stoof, w = 6, h = 3.6) => retailFrontTris({ ...input, host: { mode: 'kit', front } }, e, 0, w, 0, h);
  // Doors: clamped inside, sorted, apart by a mullion; a side door hugs its pilaster.
  assert.deepEqual(puiDoors([{ at: 0 }], 0, 5), [[0, PUI_KIT.doorM]]);
  const two = puiDoors([{ at: 0.6 }, { at: 0.5 }], 0, 5);
  assert.equal(two.length, 2); assert.ok(two[1][0] >= two[0][1] + PUI_KIT.mullionM - 1e-9);
  assert.ok(puiDoors([{ at: 0.5, w: 9 }], 0, 5).every(([a, b]) => a >= 0 && b <= 5));
  // A read door stands flush (leaf at glass depth, nothing behind the wall line) where the photo has it.
  const side = kit({ ...stoof, doors: [{ at: 0 }] }), leaf = stoof.door!;
  const leaves = side.filter(t => t.hex === leaf);
  assert.ok(leaves.length > 0 && leaves.every(t => t.p.every(p => p[1] <= 0 + 1e-9 && p[0] <= 0.2 + PUI_KIT.doorM + 1e-6)));
  // Sheet glass: fewer mullions than the bay grid.
  const posts = (tris: typeof side, hex: string) => tris.filter(t => t.hex === hex && Math.max(...t.p.map(p => p[0])) - Math.min(...t.p.map(p => p[0])) <= PUI_KIT.mullionM + 1e-6).length;
  const plain = { ...stoof, panes: undefined };
  assert.ok(posts(kit({ ...plain, sheet: true }, 8), stoof.frame) < posts(kit(plain, 8), stoof.frame));
  // Two-line sign: more lettering than the name alone.
  const lettered = (tris: typeof side) => tris.filter(t => t.layer !== undefined).length;
  assert.ok(lettered(kit({ ...stoof, sign: { ...stoof.sign, above: 'COFFEESHOP' } })) > lettered(kit(stoof)));
  // 'none': the kit front, no lettering at all.
  assert.equal(lettered(kit({ ...stoof, sign: { kind: 'none', ink: '#000000' } })), 0);
  assert.ok(kit({ ...stoof, sign: { kind: 'none', ink: '#000000' } }).length > 20);
  // Bars: never thinner than 6 cm; none when panes would be smaller than minPaneM.
  const barTris = (tris: typeof side) => tris.filter(t => t.hex === stoof.frame && t.p.every(p => Math.abs(Math.abs(p[1]) - PUI_KIT.barOutM) < 1e-6));
  for (const t of barTris(kit(stoof))) { const xs = t.p.map(p => p[0]), zs = t.p.map(p => p[2]); assert.ok(Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) >= 0.06 - 1e-6); }
  // A grid too fine for its bay keeps as many panes as fit at minPaneM, never none.
  const fine = barTris(kit({ ...stoof, panes: [12, 12] }));
  assert.ok(fine.length > 0 && fine.length < barTris(kit({ ...stoof, panes: [40, 40] })).length + 1);
  for (const t of fine) { const zs = t.p.map(p => p[2]), xs = t.p.map(p => p[0]); assert.ok(Math.max(...zs) - Math.min(...zs) < 0.1 || Math.max(...xs) - Math.min(...xs) < 0.1); }
  // Top lights: lighter than the glass under them (no black slab).
  const lum = (h: string) => [1, 3, 5].reduce((s, i) => s + parseInt(h.slice(i, i + 2), 16), 0);
  const tl = kit(stoof).filter(t => t.p.every(p => p[2] > 2.3 + PUI_KIT.transomM - 1e-6) && t.p.every(p => Math.abs(Math.abs(p[1]) - PUI_KIT.glassOutM) < 1e-6));
  assert.ok(tl.length > 0 && tl.every(t => lum(t.hex) > lum('#2a2420')));
});
