// Bridge kit tests (lane bridge-kit 2026-10-13); imported by ownGround.test.ts so `npm run test:own-ground` runs them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKit, buildKitAtLevel, flatHintAt, flatKind, measuredKind, registerHint, KIT_BUDGET, COPE_M, FRAME, type BridgeKind, type KitRow } from './bridgeKit';
import { FLAT_HINTS } from './bridgeHints';
import { flatDeckBody, movableFrame } from './decks';

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
