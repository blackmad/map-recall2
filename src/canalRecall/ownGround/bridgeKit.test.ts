// Bridge kit tests (lane bridge-kit 2026-10-13); imported by ownGround.test.ts so `npm run test:own-ground` runs them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { basculeColour, basculeStyle, KIT_COLOURS, TRUSS, trussTriangles, basementEnd, MAST, bridgeFacts, buildKit, buildKitAtLevel, decodeFacts, encodeFacts, FAMILY_PALETTE, flatHintAt, flatKind, measuredKind, registerHint, KIT_BUDGET, COPE_M, FRAME, type BridgeFacts, type BridgeKind, type KitRow } from './bridgeKit';
import { FLAT_HINTS } from './bridgeHints';
import { ABUTMENT_DEPTH_M, deckReach, flatDeckBody, floatingEnds, measuredDeckTop, movableFrame, underDeck } from './decks';
import { decodeProfile, sideWidths } from '../elevation/bridgeDeck';
import type { DeckSurface } from './surface';

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
  const green = KIT_COLOURS.green, plain = { ...input('bascule', 0), colour: green };
  const t = buildKit({ ...plain, id: 'BRU0272' }), p = buildKit(plain);
  const top = (m: typeof t.mesh) => Math.max(...m.positions.filter((_, i) => i % 3 === 2));
  assert.ok(top(t.mesh) > top(p.mesh) + 0.4, 'the truss stands over a railing');
  assert.ok(Math.abs(top(t.mesh) - (1.3 + 1.2 + 0.14 + TRUSS.height + TRUSS.chord)) < 0.15, 'truss height over the plinth at the crown');
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
