// Bridge railings along the water-side edges only (user 2026-10-16, "why do the gates dip into the road?"); imported by
// ownGround.test.ts so `npm run test:own-ground` runs them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crossingWays, parapetCrossings, railRuns, waterOutside, CROSSING_INSET_M, RAIL_PAST_WATER_M, TURN_M, type ParapetPoint, type RunRow } from './railingRuns';
import { buildKit, parapetTrace, type KitRow } from './bridgeKit';

/**
 * A deck along +x over stations [0, 30] at 0.5 m, water under (wet) stations [10, 20]. Over the water the edges run at
 * `outline` m (the bridge outline), past it they step in to the road's half-width `road` (decks.ts deckWidths): BRU0063.
 */
function deck(outline = 7, road = 3, wet = (s: number) => s >= 10 && s <= 20, widen = 1): KitRow[] {
  const out: KitRow[] = [];
  for (let i = 0; i <= 60; i++) {
    const s = i * 0.5, w = wet(s), hw = s >= 10 - widen && s <= 20 + widen ? outline : road;
    out.push({ s, c: [s, 0], n: [0, 1], L: [s, hw], R: [s, -hw], z: 1, zL: 1, zR: 1, water: w, wL: w, wR: w, gL: 1, gR: 1 });
  }
  return out;
}

test('railRuns: over the water and onto the abutment, never through a gate onto the street', () => {
  // No gate: the water reaches RAIL_PAST_WATER_M further onto each bank.
  assert.deepEqual(railRuns(deck(4, 4), 0, 30, 1), [[10 - RAIL_PAST_WATER_M, 20 + RAIL_PAST_WATER_M]]);
  // The outline steps in to the road's edge 1 m past the water: the railing stops at the last station before the gate.
  assert.deepEqual(railRuns(deck(7, 3), 0, 30, -1), [[9, 21]]);
  // A parapet range inside the water's reach is kept exactly (byte-identical kit output there).
  assert.deepEqual(railRuns(deck(), 9.2, 20.7, 1), [[9.2, 20.7]]);
  // No water anywhere across the deck: unchanged.
  assert.deepEqual(railRuns(deck(4, 4, () => false), 0, 30, 1), [[0, 30]]);
  // A jog of the edge along the water (under JOG_MAX_M) is not a gate.
  const jog = deck(4, 4).map(r => (r.s >= 15 ? { ...r, L: [r.s, 5.5] as [number, number] } : r));
  assert.deepEqual(railRuns(jog, 0, 30, 1), [[10 - RAIL_PAST_WATER_M, 20 + RAIL_PAST_WATER_M]]);
  // The water polygon stops at the faces: only the probe outside the edge sees it (oL/oR), and it outranks the
  // cleaned flags (cleanWater marks the whole water span wet across the deck).
  const faces = deck(4, 4, s => s >= 8 && s <= 22).map(r => ({ ...r, ...waterOutside(r.L, r.R, r.n, (x, y) => x >= 12 && x <= 18 && Math.abs(y) > 4.5) }));
  assert.deepEqual(railRuns(faces, 0, 30, 1), [[12 - RAIL_PAST_WATER_M, 18 + RAIL_PAST_WATER_M]]);
  // A skewed span: one side meets the water, the other follows it.
  const skew: RunRow[] = deck(4, 4, () => false).map(r => ({ ...r, wL: r.s >= 14 && r.s <= 24 }));
  assert.deepEqual(railRuns(skew, 0, 30, 1), [[14 - RAIL_PAST_WATER_M, 24 + RAIL_PAST_WATER_M]]);
  assert.deepEqual(railRuns(skew, 0, 30, -1), [[14 - RAIL_PAST_WATER_M, 24 + RAIL_PAST_WATER_M]]);
});

test('parapetCrossings: a parapet turning across the deck is a gate; one along the edge is not', () => {
  const along: ParapetPoint[] = [0, 5, 10].map(s => ({ s, p: [s, 4], out: [0, 1] }));
  assert.equal(parapetCrossings(along, () => false).turns, 0);
  const gate: ParapetPoint[] = [...along, { s: 10.5, p: [10.5, 1], out: [0, 1] }, { s: 15, p: [15, 1], out: [0, 1] }];
  const g = parapetCrossings(gate, (x, y) => x > 10 && y < 3.5);
  assert.equal(g.turns, 1);
  assert.ok(g.turnM > TURN_M && g.insideM > 4, JSON.stringify(g));
});

test('bridge kit: no parapet turns across the street past the water (BRU0063 shape)', () => {
  const lines: { side: number; line: ParapetPoint[] }[] = [];
  parapetTrace.fn = (_id, side, line) => { lines.push({ side, line }); };
  try {
    for (const kind of ['girder', 'arch', 'footbridge'] as const) {
      lines.length = 0;
      const { info } = buildKit({ id: 'T', kind, material: kind === 'arch' ? 'masonry' : 'steel', rows: deck(7, 3), parapet: [0, 30], spans: [[10, 20]], waterZ: -1, lod: 0 });
      const last = lines.slice(-2);
      assert.equal(last.length, 2, `${kind}: both sides drawn`);
      for (const { side, line } of last) {
        const m = parapetCrossings(line, () => false);
        assert.equal(m.turns, 0, `${kind} side ${side}: no gate`);
        for (const q of line) assert.ok(Math.abs(q.p[1]) > 6.5, `${kind} side ${side}: parapet at the outline (y ${q.p[1]})`);
      }
      assert.ok(info.railingPosts >= 4, `${kind}: ${info.railingPosts} posts`);
    }
  } finally { parapetTrace.fn = null; }
});

test('railRuns: no parapet on a street crossing its line (a deck measured along the canal, BRU0173)', () => {
  // Water under the stations [10, 20] (the water span marks the whole width wet), a street across the middle (x = 15,
  // 8 m wide) on the deck's L/R edges.
  const street = crossingWays([{ points: [[15, -20], [15, 20]], half: 4 }]);
  const runs = railRuns(deck(4, 4), 0, 30, 1, street);
  for (const [a, b] of runs) assert.ok(b <= 15 - (4 - CROSSING_INSET_M) || a >= 15 + (4 - CROSSING_INSET_M), JSON.stringify(runs));
  assert.deepEqual(runs, [[10 - RAIL_PAST_WATER_M, 11], [19, 20 + RAIL_PAST_WATER_M]]);
  // A street along the deck, wider than it, is not a crossing: unchanged.
  const wide = crossingWays([{ points: [[-10, 0], [40, 0]], half: 9 }]);
  assert.deepEqual(railRuns(deck(4, 4), 0, 30, 1, wide), railRuns(deck(4, 4), 0, 30, 1));
  // A side that never meets the water stands on no street, along it or across (BRU0347: a culvert under a wide road).
  const culvert: RunRow[] = deck(4, 4, () => false).map(r => ({ ...r, oL: r.s >= 12 && r.s <= 18, oR: false }));
  assert.deepEqual(railRuns(culvert, 0, 30, 1, wide), [[12 - RAIL_PAST_WATER_M, 18 + RAIL_PAST_WATER_M]]);
  assert.deepEqual(railRuns(culvert, 0, 30, -1, wide), []);
  assert.deepEqual(railRuns(culvert, 0, 30, -1), [[12 - RAIL_PAST_WATER_M, 18 + RAIL_PAST_WATER_M]], 'no street: the dry side follows the water');
});
