import assert from 'node:assert/strict';
import test from 'node:test';
import {circleRing, DECK_ROLES, deckProfile, openDeckStack, triangleCount, type DeckStackGeometry, type DeckStackOptions, type PlanPoint} from './openDeckStack';

const all = (g: DeckStackGeometry) => DECK_ROLES.filter(r => r !== 'rail').flatMap(r => g[r]);

/** Undirected edges used by exactly one triangle (vertices keyed at 0.1 mm). */
function openEdges(pos: number[]) {
  const key = (i: number) => `${Math.round(pos[i] * 1e4)},${Math.round(pos[i + 1] * 1e4)},${Math.round(pos[i + 2] * 1e4)}`;
  const count = new Map<string, number>();
  for (let t = 0; t < pos.length; t += 9) for (const [a, b] of [[0, 3], [3, 6], [6, 0]]) {
    const ka = key(t + a), kb = key(t + b), k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return [...count.values()].filter(c => c !== 2).length;
}
/** Signed volume (divergence theorem): positive when every face is wound outward. */
function volume(pos: number[]) {
  let v = 0;
  for (let t = 0; t < pos.length; t += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = pos.slice(t, t + 9);
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return v;
}

const bands = [{bottom: 4.6, top: 6.4}, {bottom: 7.5, top: 9.1}, {bottom: 10.2, top: 11.6}];
const drum: DeckStackOptions = {ring: circleRing([0, 0], 9.3, 48), bands, slotDepth: 2.2, nose: 0.3, underside: 0.8, parapet: 0.3, holes: [circleRing([0, 0], 3.85, 24)]};

test('a drum with a core well is a closed solid wound outward', () => {
  const g = openDeckStack(drum), pos = all(g);
  assert.equal(openEdges(pos), 0);
  assert.ok(volume(pos) > 0);
  // Under the outer cylinder's volume, over the core's: slots and the core are carved out.
  const full = Math.PI * 9.3 ** 2 * (11.6 - 4.6), core = Math.PI * 3.85 ** 2 * (11.6 - 4.6);
  assert.ok(volume(pos) < full - core && volume(pos) > 0.5 * (full - core), `volume ${volume(pos)}`);
});

test('either winding gives the same solid; square rings and square noses close too', () => {
  const rect: PlanPoint[] = [[0, 0], [70, 0], [70, 38], [0, 38]];
  for (const ring of [rect, rect.slice().reverse()]) {
    const g = openDeckStack({ring, bands, slotDepth: 0.4, parapet: 0.25});
    assert.equal(openEdges(all(g)), 0);
    assert.ok(volume(all(g)) > 0);
  }
});

test('band faces stand at the ring, slot back walls at the slot depth, the deck inside the parapet', () => {
  const g = openDeckStack({...drum, holes: []});
  const radii = (pos: number[]) => { const r: number[] = []; for (let i = 0; i < pos.length; i += 3) r.push(Math.hypot(pos[i], pos[i + 2])); return r; };
  assert.ok(Math.max(...radii(g.parapet)) <= 9.3 + 1e-6);
  const back = radii(g.slot);
  assert.ok(back.every(r => r < 9.3 - 2.2 + 1e-6 && r > (9.3 - 2.2) * Math.cos(Math.PI / 48) - 1e-6));
  const ys = g.deck.filter((_, i) => i % 3 === 1);
  assert.ok(ys.every(y => Math.abs(y - (11.6 - 1.1)) < 1e-9));
  assert.ok(Math.max(...radii(g.deck)) <= 9.3 - 0.3 + 1e-6);
  // Every face points the way its role says.
  const normalY = (pos: number[]) => { const out: number[] = []; for (let t = 0; t < pos.length; t += 9) { const [ax, ay, az, bx, by, bz, cx, cy, cz] = pos.slice(t, t + 9); const ux = bx - ax, uz = bz - az, vx = cx - ax, vz = cz - az; out.push(uz * vx - ux * vz); } return out; };
  assert.ok(normalY(g.deck).every(n => n > 0));
  assert.ok(normalY(g.soffit).every(n => n < 0));
  assert.ok(normalY(g.slotFloor).every(n => n > 0));
  assert.ok(normalY(g.slotCeiling).every(n => n < 0));
});

test('the section walks bands and slots in order', () => {
  const p = deckProfile(drum);
  assert.equal(p[0].role, 'soffit');
  assert.equal(p.filter(q => q.role === 'slot').length, bands.length - 1);
  assert.equal(p.at(-1)!.role, 'parapetInner');
  for (let i = 1; i < p.length - 1; i++) assert.ok(p[i].y >= p[i - 1].y - 1e-9, 'never runs down before the parapet\'s inner face');
  assert.ok(p.at(-1)!.y < p.at(-2)!.y, 'the inner face drops to the deck');
  assert.throws(() => deckProfile({...drum, bands: [{bottom: 0, top: 3}, {bottom: 2, top: 4}]}), /overlaps/);
  assert.throws(() => deckProfile({...drum, nose: 2.5}), /slot depth|noses/);
});

test('clipping keeps one side of the radical line', () => {
  const g = openDeckStack({...drum, clip: [{point: [9.1, 0], normal: [1, 0]}]});
  for (const r of DECK_ROLES) for (let i = 0; i < g[r].length; i += 3) assert.ok(g[r][i] <= 9.1 + 1e-6);
  assert.ok(triangleCount(g) > 0);
});

test('unexposed edges get no faces; rails stand on the band tops', () => {
  const ring: PlanPoint[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const open = openDeckStack({ring, bands, slotDepth: 0.4, parapet: 0.25, exposed: [true, false, true, true]});
  const shut = openDeckStack({ring, bands, slotDepth: 0.4, parapet: 0.25});
  assert.ok(triangleCount(open) < triangleCount(shut));
  for (let i = 0; i < open.parapet.length; i += 3) if (Math.abs(open.parapet[i] - 10) < 1e-9 && open.parapet[i + 2] > 1e-6 && open.parapet[i + 2] < 10 - 1e-6) assert.fail('face on the hidden edge x = 10');
  const railed = openDeckStack({...drum, rail: [0.1, 0.08, 0.12]});
  const ys = railed.rail.filter((_, i) => i % 3 === 1);
  assert.equal(railed.rail.length / 9, 2 * 3 * 48 * (bands.length - 1));
  assert.ok(ys.every(y => bands.slice(0, -1).some(b => y >= b.top - 1e-9 && y <= b.top + 0.12 + 1e-9)));
});

test('slabs add one floor and one ceiling plate per slot', () => {
  const ring: PlanPoint[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const plain = openDeckStack({ring, bands, slotDepth: 0.4, parapet: 0.25}), slabbed = openDeckStack({ring, bands, slotDepth: 0.4, parapet: 0.25, slabs: true});
  assert.equal(slabbed.slotFloor.length - plain.slotFloor.length, 9 * 2 * (bands.length - 1));
  assert.equal(slabbed.slotCeiling.length - plain.slotCeiling.length, 9 * 2 * (bands.length - 1));
});
