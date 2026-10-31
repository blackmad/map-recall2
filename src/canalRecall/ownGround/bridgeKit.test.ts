// Bridge kit tests (lane bridge-kit 2026-10-13); imported by ownGround.test.ts so `npm run test:own-ground` runs them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCH_BRACE_RISE_M, BRIDGE_TOWER, PORTAL_FIT, PORTAL_PIER, TRUSS_FAR_TRIS, type RGB, basculeColour, basculeStyle, basculeUnit, BASCULE_TRIM, LATTICE_FRAME, SWING, SWING_PIER, swingPivot, swingTriangles, TRUSS_SHAPE, KIT_COLOURS, TRUSS, trussTriangles, basementEnd, MAST, bridgeFacts, buildKit, buildKitAtLevel, decodeFacts, encodeFacts, FAMILY_PALETTE, flatHintAt, flatKind, measuredKind, registerHint, KIT_BUDGET, COPE_M, FRAME, type BridgeFacts, type BridgeKind, type KitRow } from './bridgeKit';
import { FLAT_HINTS } from './bridgeHints';
import { ABUTMENT_DEPTH_M, deckReach, flatDeckBody, floatingEnds, measuredDeckTop, movableFrame, underDeck } from './decks';
import { decodeProfile, sideWidths } from '../elevation/bridgeDeck';
import type { DeckSurface, Vec2 } from './surface';

/** A 24 m humped deck along +x, 8 m wide, over `water` metres of canal centred at x = 20. */
function rows(water = 16, crown = 1.2, halfWidth = 4): KitRow[] {
  const out: KitRow[] = [];
  for (let i = 0; i <= 50; i++) {
    const s = 7.5 + i * 0.5, z = s < 8 || s > 32 ? 1 : 1.3 + crown * Math.sin(Math.PI * (s - 8) / 24), w = s > 20 - water / 2 && s < 20 + water / 2;
    out.push({ s, c: [s, 0], n: [0, 1], L: [s, halfWidth], R: [s, -halfWidth], z, zL: z, zR: z, water: w, wL: w, wR: w, gL: 1, gR: 1 });
  }
  return out;
}
const surface = (r: KitRow[], x: number) => { let k = 0; while (k < r.length - 2 && r[k + 1].s < x) k++; const a = r[k], b = r[k + 1], t = Math.max(0, Math.min(1, (x - a.s) / (b.s - a.s))); return a.z + (b.z - a.z) * t; };
const input = (kind: BridgeKind, lod: 0 | 1, water = 16, halfWidth = 4) => ({ id: 'T', kind, material: kind === 'arch' ? 'masonry' as const : 'steel' as const, rows: rows(water, 1.2, halfWidth), parapet: [8, 32] as [number, number], spans: [[20 - water / 2, 20 + water / 2]] as [number, number][], waterZ: -1.77, lod });

test('bridge kit: the type follows the register and the measured shape', () => {
  assert.deepEqual(registerHint('BRU0242'), { material: 'wood', classic: false, light: false, movable: true }, 'Magere Brug: timber, movable');
  assert.equal(registerHint('BRU0009')?.material, 'masonry', 'Torensluis: masonry');
  assert.ok(registerHint('BRU0064')?.classic, 'Reesluis (1778) is canal-belt era');
  assert.ok(registerHint('BRU0016')?.light, 'Melkmeisjesbrug carries pedestrians');
  assert.equal(registerHint('nope'), null);
  // A pre-1940 humped steel deck in the belt is drawn as an arch bridge; a post-war one as a girder.
  assert.equal(measuredKind('steel-deck', 7.4, 1.57, 19, registerHint('BRU0064')), 'arch');
  assert.equal(measuredKind('steel-deck', 7.4, 1.57, 19, { material: 'steel', classic: false, light: false, movable: false }), 'girder');
  assert.equal(measuredKind('steel-deck', 2.8, 0.6, 10, registerHint('BRU0016')), 'footbridge');
  assert.equal(measuredKind('masonry-arch', 7, 2, 19, null), 'arch');
  assert.equal(measuredKind('steel-deck', 9, 0.2, 19, registerHint('BRU0064')), 'girder', 'no hump, no arch');
  assert.equal(flatKind(false, 9, registerHint('BRU0242')), 'bascule');
  assert.equal(flatKind(false, 40, registerHint('BRU0009')), 'arch');
  assert.equal(flatKind(false, 2.5, null), 'footbridge');
  // Unmeasured footprints are found by their centroid.
  const [n, x, y] = FLAT_HINTS;
  assert.equal(flatHintAt(x / 10 + 0.5, y / 10 - 0.5)?.id, `BRU${String(n).padStart(4, '0')}`);
  assert.equal(flatHintAt(x / 10 + 5, y / 10), null);
});

test('bridge kit: every type fits the budget at both rings, coarsening as it must', () => {
  for (const kind of ['arch', 'girder', 'footbridge', 'bascule'] as const) for (const water of [9, 16, 23]) {
    const near = buildKit(input(kind, 0, water)).info, far = buildKit(input(kind, 1, water)).info;
    assert.ok(near.triangles <= KIT_BUDGET.near && near.triangles > 60, `${kind} ${water} m near ${near.triangles}`);
    assert.ok(far.triangles <= KIT_BUDGET.far && far.triangles > 8, `${kind} ${water} m far ${far.triangles}`);
    assert.equal(far.railingPosts, 0, 'no railings in the far ring');
  }
  // A coarser level never has more triangles.
  let prev = Infinity;
  for (let lv = 0; lv < 5; lv++) { const t = buildKitAtLevel(input('arch', 0), lv).info.triangles; assert.ok(t <= prev, `level ${lv}: ${t}`); prev = t; }
});

test('bridge kit: nothing stands on the carriageway, the arch stays under the deck, the vault faces down', () => {
  for (const kind of ['arch', 'girder', 'footbridge'] as const) {
    const inp = input(kind, 0), { mesh } = buildKit(inp), p = mesh.positions;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i], y = p[i + 1], z = p[i + 2];
      if (Math.abs(y) < 4 - 0.45) assert.ok(z <= surface(inp.rows, x) + 1e-6, `${kind}: vertex (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) over the road`);
    }
  }
  const inp = input('arch', 0, 9), { mesh, info } = buildKit(inp), p = mesh.positions, idx = mesh.indices;
  assert.equal(info.arches, 1);
  let vault = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nz = ux * vy - uy * vx, nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3, cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
    // Underside triangles spanning the width are the vault: under the deck by the ring and the coping, facing down.
    if (Math.abs(cy) < 3 && cz < surface(inp.rows, cx) - COPE_M && Math.abs(nz) > Math.hypot(nx, ny)) { assert.ok(nz < 0, 'vault faces down'); vault++; }
  }
  assert.ok(vault >= 8, `vault triangles ${vault}`);
  // A 9 m arch's crown clears the water by more than a metre (boats pass).
  const zs: number[] = []; for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i] - 20) < 0.3 && Math.abs(p[i + 1]) < 3) zs.push(p[i + 2]);
  assert.ok(Math.min(...zs.filter(z => z > -1.7)) > -1.77 + 1, 'crown well over the water');
});

test('bridge kit: footbridge posts are fixed to the deck edge (one piece, not two plates)', () => {
  const inp = input('footbridge', 0, 9, 1.5), { mesh, info } = buildKit(inp), p = mesh.positions;
  assert.ok(info.railingPosts >= 8, `posts ${info.railingPosts}`);
  // Railing parts reach below the deck top at the edge (the posts hang on the edge beam).
  let below = 0;
  for (let i = 0; i < p.length; i += 3) if (Math.abs(Math.abs(p[i + 1]) - 1.5) < 0.12 && p[i + 2] < surface(inp.rows, p[i]) - 0.1 && p[i] > 9 && p[i] < 31) below++;
  assert.ok(below > 10, `post feet under the deck edge: ${below}`);
});

test('bascule: two portals with a gap between their beam heads; leaf joints on the flat deck', () => {
  const ring: [number, number][] = [[0, -4], [40, -4], [40, 4], [0, 4]];
  const dbl = movableFrame(ring, () => 0.5);
  assert.equal(dbl.units, 2);
  // Nothing of the frames above the deck within half the tip gap of the middle: two units, not one gantry.
  const p = dbl.mesh.positions;
  for (let i = 0; i < p.length; i += 3) if (p[i + 2] > 2.5) assert.ok(Math.abs(p[i] - 20) > FRAME.tipGap / 2 - 0.2, `frame part at x=${p[i].toFixed(2)} over the middle`);
  // The flat body: a girder-like body whose fascia has joints at the leaves (Magere Brug is in the register).
  const flat = flatDeckBody(ring, () => 0.5, x => x > 5 && x < 35);
  assert.ok(flat.kind === 'girder' || flat.kind === 'bascule');
  assert.ok(flat.triangles <= KIT_BUDGET.near, `flat ${flat.triangles}`);
});

// Lane bridge-fidelity 2026-10-14: per-bridge facts from the boat panoramas (hand readings for the named bridges).
test('bridge facts: named bridges carry their measured arches, family and parapet', () => {
  const f: BridgeFacts = { arches: 3, shapes: ['segmental', 'flat', 'segmental'], family: 'stone', parapet: 'stone-balustrade', openings: [[0.05, 0.3, 0.8], [0.35, 0.65, 0.7], [0.7, 0.95, 0.8]], named: true };
  assert.deepEqual(decodeFacts(encodeFacts(f)), f);
  const blauw = bridgeFacts('BRU0236');
  assert.equal(blauw?.arches, 3, 'Blauwbrug: three openings');
  assert.deepEqual(blauw?.shapes, ['segmental', 'flat', 'segmental'], 'Blauwbrug: segmental side arches, a flat middle span');
  assert.equal(blauw?.family, 'stone'); assert.equal(blauw?.parapet, 'stone-balustrade'); assert.ok(blauw?.named);
  for (const id of ['BRU0031', 'BRU0032', 'BRU0038', 'BRU0039', 'BRU0074', 'BRU0073', 'BRU0071', 'BRU0072']) assert.equal(bridgeFacts(id)?.family, 'brick-red', `${id}: Seven Bridges brick`);
  assert.equal(bridgeFacts('BRU0038')?.arches, 3, 'Keizersgracht at the Reguliersgracht: three arches');
  assert.equal(bridgeFacts('BRU0009')?.arches, 3, 'Torensluis: three arches');
  assert.equal(bridgeFacts('BRU0063')?.shapes?.[0], 'flat', 'Nieuwe-Wercksbrug: girder spans on piers');
  assert.equal(measuredKind('steel-deck', 9, 0.2, 19, registerHint('BRU0063'), bridgeFacts('BRU0063')), 'arch', 'measured openings draw opening by opening');
});

test('bridge facts: the kit honours count, shape, family and the named budget', () => {
  const base = input('arch', 0, 18, 8);
  const plain = buildKit(base).info;
  const facts: BridgeFacts = { arches: 3, shapes: ['segmental', 'flat', 'segmental'], family: 'stone', parapet: 'stone-balustrade', named: true };
  const { mesh, info } = buildKit({ ...base, facts });
  assert.equal(info.arches, 3);
  assert.ok(info.triangles <= KIT_BUDGET.named && info.triangles > plain.triangles, `named ${info.triangles} vs ${plain.triangles}`);
  assert.ok(info.lamps >= 2, 'named: lamps back');
  const stone = FAMILY_PALETTE.stone.spandrel, c = mesh.colors!;
  let hits = 0;
  for (let i = 0; i < c.length; i += 3) if (Math.abs(c[i] - stone[0]) < 1e-6 && Math.abs(c[i + 1] - stone[1]) < 1e-6) hits++;
  assert.ok(hits > 20, 'stone spandrels');
  const one = buildKit({ ...base, facts: { arches: 1, shapes: ['round'], family: 'brick-red', parapet: 'iron-rail', named: false } }).info;
  assert.equal(one.arches, 1);
  assert.ok(one.triangles <= KIT_BUDGET.near);
});

// User 2026-10-14 (the Haarlemmerpoort and Zoutkeetsgracht bascules "look bad"): their aimed panoramas show basement
// bascules, no portal: signal masts and barrier boxes. The Magere Brug keeps its portals.
test('bascules: portal or basement by the panoramas, then the register', () => {
  assert.equal(basculeStyle('BRU0242', registerHint('BRU0242')), 'portal', 'Magere Brug');
  for (const id of ['BRU0151', 'BRU0149', 'BRU0345', 'BRU0272']) assert.equal(basculeStyle(id, registerHint(id)), 'basement', id);
  // User 2026-10-30: the Mariniersbrug (Dijksgracht) is registered as timber, so the rule drew a white portal; the
  // panorama shows a green steel basement bascule with red-and-white masts.
  assert.deepEqual(basculeColour(registerHint('BRU0272'), 'BRU0272'), KIT_COLOURS.green, 'Mariniersbrug green');
  // Audit 2026-10-30 (artifacts/bridge-audit, aimed panoramas): Omvalbrug basement, Pelikaanbrug portal; the Oranjebrug's
  // steel lattice portal is green; a Weesp portal with no register material (Lange Vechtbrug) is white.
  assert.equal(basculeStyle('BRU0429', registerHint('BRU0429')), 'basement', 'Omvalbrug');
  assert.equal(basculeStyle('BRU0277', registerHint('BRU0277')), 'portal', 'Pelikaanbrug');
  assert.deepEqual(basculeColour(registerHint('BRU0146'), 'BRU0146'), KIT_COLOURS.green, 'Oranjebrug green');
  assert.deepEqual(basculeColour(registerHint('BRU5043'), 'BRU5043'), KIT_COLOURS.white, 'Lange Vechtbrug white');
  assert.equal(basculeStyle(null, null), 'portal');
  const m = { positions: [] as number[], uvs: [] as number[], indices: [] as number[], colors: [] as number[] };
  basementEnd(m, (a, b) => [a, b], [1, 0], 0, [3, -3], () => 1);
  const zs = m.positions.filter((_, i) => i % 3 === 2);
  assert.ok(Math.max(...zs) >= 1 + MAST.height - 1e-6 && Math.min(...zs) <= 1 - 0.1, 'masts stand on the deck and reach their height');
});

// User 2026-10-30 (the Mariniersbrug's sides are green lattice trusses, not a railing): the hand-listed truss parapet
// stands TRUSS.height over the plinth, in the bridge's colour, and every other bridge's mesh is untouched.
test('truss parapet: the Mariniersbrug carries lattice trusses, other bridges are unchanged', () => {
  const green = KIT_COLOURS.green, plain = { ...input('bascule', 0, 23), colour: green };
  const t = buildKit({ ...plain, id: 'BRU0272' }), p = buildKit(plain);
  const top = (m: typeof t.mesh) => Math.max(...m.positions.filter((_, i) => i % 3 === 2));
  assert.ok(top(t.mesh) > top(p.mesh) + 0.4, 'the truss stands over a railing');
  // Round 2 (2026-10-31): its sides arch (TRUSS_SHAPE end 0.7 m, crown 2.4 m), one span over the water.
  assert.ok(Math.abs(top(t.mesh) - (1.3 + 1.2 + 0.14 + TRUSS_SHAPE.BRU0272.crown + TRUSS.chord)) < 0.3, `truss crown over the plinth (${top(t.mesh).toFixed(2)})`);
  assert.equal(t.info.level, p.info.level, 'the truss allowance keeps the railing level');
  assert.ok(t.info.triangles <= KIT_BUDGET.near + trussTriangles(24), `near budget plus the truss (${t.info.triangles})`);
  assert.deepEqual(buildKit({ ...plain, id: 'BRU0151' }).mesh, buildKit({ ...plain, id: 'BRU0151' }).mesh);
  assert.deepEqual(buildKit({ ...plain, id: 'T' }).mesh.positions, p.mesh.positions, 'no truss off the list');
});

// User 2026-10-14 ("disconnected bridge", a Houthavens footbridge, BRU2433-2435): the water mask ran past the measured
// deck span, so the deck hung short of both banks. The drawn deck reaches on to the bank by the abutment depth.
test('deck ends: a deck whose measured span stops over water reaches on to both banks', () => {
  const n = 81, s = Float64Array.from({ length: n }, (_, i) => i * 0.5), x = s.slice(), y = new Float64Array(n), hw = new Float64Array(n).fill(1.7);
  const h = Float64Array.from(s, v => (v > 12 && v < 28 ? 1.2 * Math.sin(Math.PI * (v - 12) / 16) : 0));
  const deck = { profile: { id: 'T', x, y, s, h, halfWidth: hw, deck: [14, 26], water: null, family: 'concrete-deck' }, z: Float64Array.from(h, v => 1 + v), ends: [1, 1], span: [0, n - 1], ease: [2, 2] } as unknown as DeckSurface;
  const water = (px: number) => px > 11.5 && px < 28.5; // the canal runs 2.5 m past each measured deck end
  const { reach, landed } = deckReach(deck, px => water(px));
  assert.deepEqual(landed, [true, true]);
  assert.ok(reach[0] <= 11.5 - ABUTMENT_DEPTH_M + 0.51 && reach[1] >= 28.5 + ABUTMENT_DEPTH_M - 0.51, `reach ${reach}`);
  assert.deepEqual(floatingEnds(deck, px => water(px), () => 1, () => 1), []);
  // A canal wider than the reach: still floating, and the check says so.
  assert.equal(floatingEnds(deck, px => px > 0 && px < 39, () => 1, () => 1).length, 2);
});

// Bridge-fidelity e2e 2026-10-14: the Torensluis is a 22 m road over a 44 m wide, off-centre bridge; the deck took the
// road's width and the quay walls at the water polygon's edge across the canal filled two of its three arches.
test('deck sides from the outline cross-section; no quay under a deck', () => {
  const p: number[] = [];
  for (let s = 0; s <= 30; s += 1) p.push(s * 10, 0, s * 100, s >= 8 && s <= 22 ? 150 : 0);
  // Outline 30 m to the left of the road line, 4 m to its right; the road is 8 m wide.
  const bridge = { id: 'T2', name: 'Test', roadIds: [], family: 'masonry-arch', width: 8, approachHalfWidth: 3, deck: [8, 22] as [number, number], water: [9, 21] as [number, number], outline: [80, -40, 220, -40, 220, 300, 80, 300], endpointNAP: [1, 1] as [number, number], p };
  const prof = decodeProfile(bridge, 0.1);
  assert.deepEqual(prof.sides, [29, 4], 'left capped at the half-width plus 25 m, right at the half-width');
  const mid = prof.s.findIndex(s => s >= 15);
  assert.deepEqual(sideWidths(prof, mid), [29, 4]);
  assert.deepEqual(sideWidths(prof, 0), [prof.halfWidth[0], prof.halfWidth[0]], 'the approaches keep their own width');
  const deck = { profile: prof, z: new Float64Array(prof.s.length).fill(1.5), ends: [0, 0] as [number, number], span: prof.deck, ease: [1, 1] as [number, number] };
  const under = underDeck([deck]);
  assert.ok(under(15, 20), 'a shore across the canal under the wide side is under the deck');
  assert.ok(!under(15, -8), 'past the narrow side it is not');
  assert.ok(!under(9.5, 20), 'the banks (the water extent ends) keep their quays');
  const top = measuredDeckTop(deck, () => 1.5);
  const ys = top.positions.filter((_, i) => i % 3 === 1);
  assert.ok(Math.max(...ys) > 28 && Math.min(...ys) < -3.9, 'the top spans the outline');
  // No outline wider than the road: unchanged.
  assert.equal(decodeProfile({ ...bridge, outline: [80, -40, 220, -40, 220, 40, 80, 40] }, 0.1).sides, undefined);
});

// User 2026-10-16, the Berensluis BRU0065 over the Prinsengracht (screenshots: "a brick-red skirt hanging into the water
// with a sawtooth lower edge", "small grey slivers at both ends", "two thin bridges with the road floating between").
test('Berensluis: side faces end level at the abutments, the steel girder is one dark band, covered tops sink past the span', () => {
  // Every side-face quad (4 own vertices on one deck edge) has a level bottom: a face half over the water used to
  // drop from the land bottom (0.6 here) to the water bottom (-2.07) across one segment, a wedge into the canal.
  for (const kind of ['arch', 'girder'] as const) {
    // The measured water span (the openings) narrower than the mask's water, as at the Berensluis ends.
    const { mesh } = buildKit({ ...input(kind, 0), spans: [[14, 26]], facts: { arches: 3, shapes: ['flat'], family: 'steel', parapet: 'iron-rail', named: true } }), p = mesh.positions;
    let quads = 0;
    for (let v = 0; v + 3 < p.length / 3; v += 4) {
      const vs = [0, 1, 2, 3].map(k => [p[(v + k) * 3], p[(v + k) * 3 + 1], p[(v + k) * 3 + 2]]);
      if (!vs.every(q => Math.abs(Math.abs(q[1]) - 4) < 1e-6)) continue;
      const xs = [...new Set(vs.map(q => q[0].toFixed(3)))];
      if (xs.length !== 2) continue;
      const bottom = (x: string) => Math.min(...vs.filter(q => q[0].toFixed(3) === x).map(q => q[2]));
      quads++;
      assert.ok(Math.abs(bottom(xs[0]) - bottom(xs[1])) < 1.5, `${kind}: face at x ${xs.join('..')} slants from ${bottom(xs[0]).toFixed(2)} to ${bottom(xs[1]).toFixed(2)}`);
    }
    assert.ok(quads > 10, `${kind}: ${quads} side faces read`);
  }
  // The steel family's parapet face (the coping band over the girder) is the girder's steel, not a pale stone band.
  assert.deepEqual(FAMILY_PALETTE.steel.coping, FAMILY_PALETTE.steel.spandrel);
  // A deck top past its span sinks under the survey's ground polygons when they cover the deck; inside it, it stays.
  const pts: number[] = [];
  for (let s = 0; s <= 30; s += 1) pts.push(s * 10, 0, s * 100, 0);
  const prof = decodeProfile({ id: 'T3', name: 'T', roadIds: [], family: 'steel-deck', width: 8, approachHalfWidth: 4, deck: [8, 22] as [number, number], water: [9, 21] as [number, number], endpointNAP: [1, 1] as [number, number], outline: [80, -40, 220, -40, 220, 40, 80, 40], p: pts }, 0.1);
  const deck: DeckSurface = { profile: prof, z: new Float64Array(prof.s.length).fill(1), ends: [0, 0], span: prof.deck, ease: [1, 1] };
  const zs = (m: { positions: ArrayLike<number> }, inside: boolean) => {
    const out: number[] = [];
    for (let i = 0; i < m.positions.length; i += 3) { const x = m.positions[i]; if ((x >= 8 && x <= 22) === inside) out.push(m.positions[i + 2]); }
    return out;
  };
  const plain = measuredDeckTop(deck, () => 1, 4, 2, [5, 25]), sunk = measuredDeckTop(deck, () => 1, 4, 2, [5, 25], undefined, 0.06);
  assert.ok(zs(sunk, false).length > 0 && zs(sunk, false).every(z => Math.abs(z - 0.94) < 1e-9), 'past the span: 6 cm under the riding surface');
  assert.deepEqual(zs(sunk, true), zs(plain, true), 'over the span: unchanged');
});

// ------------------------------------------------------------------ swing bridges and lattice portals (lane bridge-kit, 2026-10-30)
// Named regressions from the aimed panoramas (artifacts/bridge-audit): a ring centred on each bridge's register point
// (FLAT_HINTS) builds the way the photo reads.
const hintAt = (id: string): Vec2 => {
  for (let i = 0; i + 2 < FLAT_HINTS.length; i += 3) if (`BRU${String(FLAT_HINTS[i]).padStart(4, '0')}` === id) return [FLAT_HINTS[i + 1] / 10, FLAT_HINTS[i + 2] / 10];
  throw new Error(`${id} not in FLAT_HINTS`);
};
/** A footprint `len` m along +x (8 m wide) centred on `c`, over water in its middle `water` m. */
const ringAt = (c: Vec2, len = 24): Vec2[] => [[c[0] - len / 2, c[1] - 4], [c[0] + len / 2, c[1] - 4], [c[0] + len / 2, c[1] + 4], [c[0] - len / 2, c[1] + 4]];
const waterAt = (c: Vec2, water = 16) => (x: number) => Math.abs(x - c[0]) < water / 2;
const tris = (m: { indices: ArrayLike<number> }) => m.indices.length / 3;

test('swing bridges: the Buiksloter-, Commandants- and Oosterdoksdraaibrug turn on a pivot, no portal, no bay piers', () => {
  for (const id of ['BRU2205', 'BRU2361', 'BRU2270']) assert.equal(basculeStyle(id, registerHint(id)), 'swing', id);
  assert.deepEqual(basculeColour(registerHint('BRU2361'), 'BRU2361'), KIT_COLOURS.slate, 'Commandantsbrug dark blue-grey');
  assert.deepEqual(basculeColour(registerHint('BRU2205'), 'BRU2205'), KIT_COLOURS.greyGreen, 'Buiksloterdraaibrug grey-green');
  // Pivots: the Commandantsbrug midstream, the others at their heel on the bank the photo shows (compass end).
  assert.equal(swingPivot(SWING.BRU2361, [0, 20], [1, 0]), 10);
  assert.equal(swingPivot(SWING.BRU2205, [0, 20], [1, 0]), 20, 'east end along +x');
  assert.equal(swingPivot(SWING.BRU2205, [0, 20], [-1, 0]), 0, 'east end along -x');
  assert.equal(swingPivot(SWING.BRU2270, [0, 20], [1, 0]), 0, 'west end');
  // The kit: one leaf, the drum at the pivot under the deck, no bay piers over 16 m of water, within budget + allowance.
  const base = { ...input('bascule', 0), colour: KIT_COLOURS.slate, leaves: [[11.7, 28.3]] as [number, number][] };
  const plain = buildKit(base), sw = buildKit({ ...base, swing: { pivot: 20, leafLen: 16.6, fenders: true } });
  assert.ok(plain.info.piers > 0, 'a girder over 16 m has bay piers');
  assert.equal(sw.info.piers, 0, 'a swing leaf has none');
  assert.ok(sw.info.triangles <= KIT_BUDGET.near + swingTriangles(16.6, true, 0), `${sw.info.triangles}`);
  const p = sw.mesh.positions;
  let drum = 0, piles = 0;
  for (let i = 0; i < p.length; i += 3) {
    const d = Math.hypot(p[i] - 20, p[i + 1]);
    if (Math.abs(d - SWING_PIER.radius) < 0.02 && p[i + 2] < 0) drum++;
    if (Math.abs(p[i + 1]) > 5 && Math.abs(Math.abs(p[i] - 20) - SWING_PIER.fenderOff) < 0.3) piles++;
  }
  assert.ok(drum >= 16, `drum faces (${drum})`);
  assert.ok(piles > 0, 'fender rows along the canal past the deck');
  // Far ring: the drum as one box.
  const far = buildKit({ ...base, lod: 1, swing: { pivot: 20, leafLen: 16.6, fenders: true } });
  assert.ok(far.info.triangles <= KIT_BUDGET.far + swingTriangles(16.6, true, 1));
  // The game path: no portal units; masts only where the photo has them (Commandantsbrug yes, Buiksloter no).
  for (const [id, masts] of [['BRU2361', true], ['BRU2205', false], ['BRU2270', false]] as const) {
    const c = hintAt(id), f = movableFrame(ringAt(c), () => 0.5);
    assert.equal(f.units, 0, id);
    assert.equal(tris(f.mesh) > 0, masts, `${id} masts`);
    const body = flatDeckBody(ringAt(c), () => 0.5, waterAt(c), 0.02, 0.45);
    assert.equal(body.kind, 'bascule', id);
  }
});

test('truss shapes: the Commandantsbrug sides rise to the middle, the Oosterdoksdraaibrug is an arched through truss', () => {
  const plain = { ...input('bascule', 0), colour: KIT_COLOURS.slate };
  const RAILING_TOP = 1.2;
  const zMax = (m: { positions: ArrayLike<number> }, x0: number, x1: number) => { let z = -Infinity; for (let i = 0; i < m.positions.length; i += 3) if (m.positions[i] >= x0 && m.positions[i] <= x1) z = Math.max(z, m.positions[i + 2]); return z; };
  for (const id of ['BRU2361', 'BRU2270'] as const) {
    const { mesh, info } = buildKit({ ...plain, id }), s = TRUSS_SHAPE[id];
    const deck = 1.3 + 1.2 + 0.14;
    assert.ok(Math.abs(zMax(mesh, 0, 40) - (deck + s.crown + TRUSS.chord + (s.archBrace ? ARCH_BRACE_RISE_M : 0))) < 0.3, `${id} crown ${zMax(mesh, 0, 40).toFixed(2)}`);
    assert.ok(zMax(mesh, 7.5, 9) < deck + s.end + 0.6, `${id} ends low`);
    assert.ok(info.triangles <= KIT_BUDGET.near + trussTriangles(24, s), `${id} ${info.triangles}`);
  }
  // Overhead braces only on the through truss: a vertex at the crown height on the centre line.
  const onAxis = (m: { positions: ArrayLike<number>; indices: ArrayLike<number> }) => {
    const P = m.positions, I = m.indices;
    for (let t = 0; t < I.length; t += 3) { const ys = [0, 1, 2].map(k => P[I[t + k] * 3 + 1]), zs = [0, 1, 2].map(k => P[I[t + k] * 3 + 2]); if (Math.min(...zs) > 5 && Math.max(...ys) > 1 && Math.min(...ys) < -1) return true; }
    return false;
  };
  assert.ok(onAxis(buildKit({ ...plain, id: 'BRU2270' }).mesh), 'Oosterdoksdraaibrug braced overhead');
  // On a swing bridge the shaped truss stands over its turning leaf only; the fixed approaches keep a railing.
  const leafOnly = buildKit({ ...plain, id: 'BRU2270', leaves: [[14, 26]], swing: { pivot: 14, leafLen: 12, fenders: false } }).mesh;
  assert.ok(zMax(leafOnly, 7.5, 12.5) < 1.3 + 1.2 + 0.14 + RAILING_TOP, 'no truss over the approach');
  assert.ok(zMax(leafOnly, 14, 26) > 1.3 + 1.2 + 4, 'the arch over the leaf');
  assert.ok(!onAxis(buildKit({ ...plain, id: 'BRU2361' }).mesh), 'Commandantsbrug open');
});

test('lattice portals: the Oranjebrug, Peperbrug, Westergasbrug, BRU0148, Ezelsbrug and Aluminiumbrug frames are open lattice', () => {
  const solid = movableFrame(ringAt([0, 0]), () => 0.5); // nothing listed at the origin: the timber frame
  for (const id of ['BRU0146', 'BRU0148', 'BRU0193', 'BRU0281', 'BRU1904', 'BRU0222']) {
    assert.ok(LATTICE_FRAME[id], id);
    const c = hintAt(id), f = movableFrame(ringAt(c), () => 0.5), shifted = movableFrame(ringAt([c[0] + 400, c[1] + 400]), () => 0.5);
    assert.ok(f.units >= 1, `${id} still a portal`);
    assert.ok(tris(f.mesh) > tris(shifted.mesh) + 30, `${id} lattice ${tris(f.mesh)} vs solid ${tris(shifted.mesh)}`);
    // Lattice stays within the frame's own envelope: nothing above the solid frame's top by more than a chord.
    const zTop = (m: { positions: ArrayLike<number> }) => Math.max(...Array.from(m.positions).filter((_, i) => i % 3 === 2));
    assert.ok(zTop(f.mesh) <= zTop(shifted.mesh) + 0.4 + ((PORTAL_FIT[id]?.height ?? FRAME.postHeight) - FRAME.postHeight), `${id} height`);
  }
  // Westergasbrug and BRU0148: one portal in the photos, where the footprint length guessed a double bascule.
  for (const id of ['BRU0193', 'BRU0148']) assert.equal(movableFrame(ringAt(hintAt(id), 30), () => 0.5).units, 1, `${id} one portal`);
  assert.equal(movableFrame(ringAt([0, 0], 30), () => 0.5).units, 2, 'an unlisted 30 m footprint stays double');
  // The Westergasbrug's portal stands at its north heel: along +y its posts are on the +y half of the footprint.
  const c193 = hintAt('BRU0193'), nRing: Vec2[] = [[c193[0] - 4, c193[1] - 15], [c193[0] + 4, c193[1] - 15], [c193[0] + 4, c193[1] + 15], [c193[0] - 4, c193[1] + 15]];
  const wg = movableFrame(nRing, () => 0.5).mesh.positions;
  let posts = 0;
  for (let i = 0; i < wg.length; i += 3) if (wg[i + 2] > 3 && wg[i + 2] < 5) posts += Math.sign(wg[i + 1] - c193[1]);
  assert.ok(posts > 0, `Westergasbrug heel north (${posts})`);
  // Ezelsbrug: blue-grey frame, red leaf, red rods.
  assert.deepEqual(basculeColour(registerHint('BRU1904'), 'BRU1904'), KIT_COLOURS.blueGrey);
  assert.equal(BASCULE_TRIM.BRU1904.leaf, 'red');
  const ez = movableFrame(ringAt(hintAt('BRU1904')), () => 0.5).mesh, cols = ez.colors!;
  let red = 0;
  for (let i = 0; i < cols.length; i += 3) if (Math.abs(cols[i] - KIT_COLOURS.red[0]) < 1e-6 && Math.abs(cols[i + 1] - KIT_COLOURS.red[1]) < 1e-6) red++;
  assert.ok(red > 0, 'Ezelsbrug red pull rods');
  // The timber frame without a look is unchanged by the lattice code: same mesh as a unit built with an empty look.
  const a = { positions: [] as number[], uvs: [] as number[], indices: [] as number[], colors: [] as number[] }, b = { positions: [] as number[], uvs: [] as number[], indices: [] as number[], colors: [] as number[] };
  basculeUnit(a, (x, y) => [x, y], [1, 0], 0, 1, 7, [4.5, -4.5], 0.5, () => 0.5, KIT_COLOURS.white);
  basculeUnit(b, (x, y) => [x, y], [1, 0], 0, 1, 7, [4.5, -4.5], 0.5, () => 0.5, KIT_COLOURS.white, false, {});
  assert.deepEqual(a, b);
  assert.ok(tris(solid.mesh) > 0);
});

// ------------------------------------------------------------------ round 2 (lane bridge-kit, 2026-10-31): named regressions from the aimed sheets
const colourCount = (m: { colors?: ArrayLike<number> }, c: RGB) => { let n = 0; const k = m.colors!; for (let i = 0; i < k.length; i += 3) if (Math.abs(k[i] - c[0]) < 1e-6 && Math.abs(k[i + 1] - c[1]) < 1e-6 && Math.abs(k[i + 2] - c[2]) < 1e-6) n++; return n; };
const zOf = (m: { positions: ArrayLike<number> }) => Array.from(m.positions).filter((_, i) => i % 3 === 2);

test('round 2 portals: Ezelsbrug stays and piers, Peperbrug box, Aluminiumbrug arches, Westergasbrug height, Berlagebrug tower, plain footbridges', () => {
  // Ezelsbrug: red stays beside the red rods, light concrete piers reaching under the deck.
  const ez = movableFrame(ringAt(hintAt('BRU1904'), 30), () => 0.5).mesh;
  const rodsOnly = 2 * 2 * 6 * 3;
  assert.ok(colourCount(ez, KIT_COLOURS.red) > rodsOnly, `red rods and stays (${colourCount(ez, KIT_COLOURS.red)})`);
  assert.ok(colourCount(ez, KIT_COLOURS.pierLight) > 0, 'piers under the posts');
  assert.ok(Math.min(...zOf(ez)) < 0.5 - PORTAL_PIER.below + 0.05, 'piers reach under the deck');
  // Peperbrug: the closed box adds lattice end frames (more than the open lattice frame of the Oranjebrug).
  const pep = movableFrame(ringAt(hintAt('BRU0281')), () => 0.5), ora = movableFrame(ringAt(hintAt('BRU0146')), () => 0.5);
  assert.ok(tris(pep.mesh) > tris(ora.mesh) + 40, `Peperbrug box (${tris(pep.mesh)} vs ${tris(ora.mesh)})`);
  // Aluminiumbrug: arched braces and the solid girder replace the straight knees.
  const alu = movableFrame(ringAt(hintAt('BRU0222')), () => 0.5), plainPortal = movableFrame(ringAt([0, 0]), () => 0.5);
  assert.ok(tris(alu.mesh) > tris(plainPortal.mesh) + 40, `Aluminiumbrug ornate (${tris(alu.mesh)})`);
  // Westergasbrug: posts PORTAL_FIT.height tall.
  assert.ok(Math.max(...zOf(movableFrame(ringAt(hintAt('BRU0193'), 30), () => 0.5).mesh)) > 0.5 + (PORTAL_FIT.BRU0193.height ?? 0), 'Westergasbrug taller');
  // Berlagebrug: a brick tower rising BRIDGE_TOWER.top over the deck beside the leaf heel.
  const ber = movableFrame(ringAt(hintAt('BRU0423'), 40), () => 0.5).mesh;
  assert.ok(colourCount(ber, KIT_COLOURS.brick) > 0 && Math.max(...zOf(ber)) > 0.5 + BRIDGE_TOWER.BRU0423.top, 'Berlagebrug tower');
  // Timber lift footbridges: neither portal nor masts.
  for (const id of ['BRU0379', 'BRU0380', 'BRU0483', 'BRU0850']) {
    assert.equal(basculeStyle(id, registerHint(id)), 'plain', id);
    const f = movableFrame(ringAt(hintAt(id), 10), () => 0.5);
    assert.equal(f.units, 0, id); assert.equal(tris(f.mesh), 0, id);
  }
});

test('round 2 trusses: Mariniersbrug arched over one span, the Oosterdoksdraaibrug keeps its arch in the far ring', () => {
  const base = { ...input('bascule', 0), colour: KIT_COLOURS.green };
  const mar = buildKit({ ...base, id: 'BRU0272' });
  assert.equal(mar.info.piers, 0, 'one span, no bay piers');
  // The truss stands inside the water by TRUSS_SHAPE.inset: nothing over 1.5 m above the deck near the water's ends.
  const s = TRUSS_SHAPE.BRU0272, p = mar.mesh.positions;
  for (let i = 0; i < p.length; i += 3) if (p[i + 2] > 1.3 + 1.2 + 1.5) assert.ok(p[i] > 12 + (s.inset ?? 0) - 0.5 && p[i] < 28 - (s.inset ?? 0) + 0.5, `truss member at x ${p[i].toFixed(1)}`);
  // Far ring: the arch silhouette stays, within the far budget plus its allowance.
  const far = buildKit({ ...base, lod: 1, id: 'BRU2270', railColour: KIT_COLOURS.white });
  assert.ok(Math.max(...zOf(far.mesh)) > 1.3 + 1.2 + 4, 'far arch silhouette');
  assert.ok(far.info.triangles <= KIT_BUDGET.far + TRUSS_FAR_TRIS, `${far.info.triangles}`);
  assert.ok(Math.max(...zOf(buildKit({ ...base, lod: 1, id: 'T' }).mesh)) < 1.3 + 1.2 + 1, 'no silhouette off the list');
});
