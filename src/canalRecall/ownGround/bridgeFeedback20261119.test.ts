// Lane fb-bridges-20261119 (feedback round #396): rails centred in their carriageway (Vijzelstraat 62d5a35f), the
// survey's deck polygons seeding wetGround (Torensluis c16d3403, Doelensluis 4c1344ce), ground polygons split across a
// deck's lateral blend (De Clercqstraat 3b8ca68b), a covered deck's top in the survey's edge material (Oost-Indische
// Huisbrug 935a6807). Pure, synthetic; the named places are pinned in scripts/own-ground/bridge-feedback-pins.ts.
//   node --import tsx --test src/canalRecall/ownGround/bridgeFeedback20261119.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { carriagewaySpan, planRailCentres, shiftAt, shiftedLine, RAIL_CENTRE_TOL_M, type CarriageIndex } from './railCentre';
import { coveredTopLayer, type DeckLevelIndex } from './coveredTop';
import { wetGroundRings } from './wetGround';
import { drapeAdaptive, DECK_SIDE_MIN_EDGE_M } from './roadSurfaces';
import { emptyMesh } from './drape';
import type { RoadSurface } from './roadCells';

type Box = { x0: number; y0: number; x1: number; y1: number; c: string; k: string; h: number };
/** An index of axis-aligned boxes (the first hit wins; `bridge` prefers h ≥ 1 as RoadIndex.findAtLevel does). */
const boxIndex = (boxes: Box[]): CarriageIndex & DeckLevelIndex => ({
  records: boxes.map(b => ({ h: b.h })),
  findAtLevel(x: number, y: number, bridge = false) {
    const hits = boxes.map((b, i) => ({ b, i })).filter(({ b }) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
    const want = hits.find(({ b }) => (bridge ? b.h >= 1 : b.h === 0)) ?? hits[0];
    return want ? want.i : -1;
  },
  drawClass: (k: number) => boxes[k].c,
  mesh: (k: number) => boxes[k].k,
});

test('carriagewaySpan: the run of carriage across the way, red strips left out, to 5 cm', () => {
  // A way along +x at y = 0; left normal +y. Dark carriageway y in [-3.5, 2.3], a red strip y in [2.3, 4].
  const index = boxIndex([{ x0: -50, y0: -3.5, x1: 50, y1: 2.3, c: 'carriage', k: 'asphalt', h: 0 }, { x0: -50, y0: 2.3, x1: 50, y1: 4, c: 'carriage', k: 'cycle', h: 0 }]);
  const span = carriagewaySpan(index, 0, 0, 0, 1, 0, false, false)!;
  assert.ok(Math.abs(span[0] + 3.5) <= 0.05 && Math.abs(span[1] - 2.3) <= 0.05, `${span}`);
  const red = carriagewaySpan(index, 0, 0, 0, 1, 0, false, true)!;
  assert.ok(Math.abs(red[1] - 4) <= 0.05, `${red}`);
  assert.equal(carriagewaySpan(index, 0, 10, 0, 1, 0, false, false), null);
});

test('planRailCentres: a single track 0.6 m off centre moves onto it; measured offsets only within 0.5 m; far off stays', () => {
  const index = boxIndex([{ x0: -100, y0: -3.5, x1: 100, y1: 2.3, c: 'carriage', k: 'asphalt', h: 0 }]);
  const line = [[-40, 0], [40, 0]] as const;
  const plan = planRailCentres(index, [{ id: 1, points: line, rails: [0], bridge: false, measured: false }]);
  const sh = plan.get(1)!;
  assert.ok(Math.abs(sh.mid + 0.6) < 0.06, `mid ${sh.mid}`);
  // The moved line: 0.6 m to the right (−y) all along (a lone way's ends keep its own near-end shift).
  for (const [x, y] of shiftedLine(line, sh)) assert.ok(Math.abs(y + 0.6) < 0.06, `${x},${y}`);
  assert.equal(planRailCentres(index, [{ id: 2, points: line, rails: [0], bridge: false, measured: true }]).size, 0, 'measured 0.6 m > 0.5 m: kept');
  const far = boxIndex([{ x0: -100, y0: -6, x1: 100, y1: 1, c: 'carriage', k: 'asphalt', h: 0 }]);
  assert.ok(2.5 > RAIL_CENTRE_TOL_M);
  assert.equal(planRailCentres(far, [{ id: 3, points: line, rails: [0], bridge: false, measured: false }]).size, 0, '2.5 m off: a lane of its own, kept');
});

test('planRailCentres: two ways with the same tracks meet at one shift (no step at the node)', () => {
  // The carriageway's centre steps from −0.6 (x < 0) to −0.2 (x > 0).
  const index = boxIndex([{ x0: -100, y0: -4.6, x1: 0, y1: 3.4, c: 'carriage', k: 'asphalt', h: 0 }, { x0: 0, y0: -4.2, x1: 100, y1: 3.8, c: 'carriage', k: 'asphalt', h: 0 }]);
  const a = [[-60, 0], [0, 0]] as const, b = [[0, 0], [60, 0]] as const;
  const plan = planRailCentres(index, [{ id: 1, points: a, rails: [1.5, -1.5], bridge: false, measured: false }, { id: 2, points: b, rails: [1.5, -1.5], bridge: false, measured: false }]);
  const sa = plan.get(1)!, sb = plan.get(2)!;
  assert.ok(Math.abs(shiftAt(sa, sa.length) - shiftAt(sb, 0)) < 1e-9, `${shiftAt(sa, sa.length)} vs ${shiftAt(sb, 0)}`);
  assert.ok(Math.abs(sa.mid + 0.6) < 0.06 && Math.abs(sb.mid + 0.2) < 0.06, `${sa.mid} ${sb.mid}`);
  // The moved lines meet.
  const la = shiftedLine(a, sa), lb = shiftedLine(b, sb);
  assert.ok(Math.hypot(la[la.length - 1][0] - lb[0][0], la[la.length - 1][1] - lb[0][1]) < 1e-9);
});

test('coveredTopLayer: the survey material at the deck edges, one verdict; a top past the footprint keeps the deck grey', () => {
  const n = 41, s = Float64Array.from({ length: n }, (_, i) => i), x = Float64Array.from(s), y = new Float64Array(n), hw = new Float64Array(n).fill(3);
  const p = { s, x, y, halfWidth: hw, deck: [5, 35] as const };
  // A skewed asphalt deck polygon (as BRU0223): covers y in [-2.5, 2.5] along the span.
  const asphalt = boxIndex([{ x0: 0, y0: -2.5, x1: 40, y1: 2.5, c: 'carriage', k: 'asphalt', h: 1 }]);
  const widths = { left: new Float64Array(n).fill(3), right: new Float64Array(n).fill(3) };
  assert.equal(coveredTopLayer(p, widths, asphalt, (_c, m) => m), 'asphalt');
  assert.equal(coveredTopLayer(p, { left: new Float64Array(n).fill(4), right: widths.right }, asphalt, (_c, m) => m), null, 'wider than the footprint: no road layer');
  // Paving footways at both edges, asphalt between: a paving top (offset 3) would cover the asphalt (offset 2): grey.
  const footways = boxIndex([{ x0: 0, y0: 1.5, x1: 40, y1: 3, c: 'foot', k: 'paving', h: 1 }, { x0: 0, y0: -3, x1: 40, y1: -1.5, c: 'foot', k: 'paving', h: 1 }, { x0: 0, y0: -1.5, x1: 40, y1: 1.5, c: 'carriage', k: 'asphalt', h: 1 }]);
  assert.equal(coveredTopLayer(p, widths, footways, (_c, m) => m), null);
  // Klinker edges over an asphalt middle: two offset-2 layers would z-fight: grey.
  const klinker = boxIndex([{ x0: 0, y0: 1.5, x1: 40, y1: 3, c: 'carriage', k: 'klinker', h: 1 }, { x0: 0, y0: -3, x1: 40, y1: -1.5, c: 'carriage', k: 'klinker', h: 1 }, { x0: 0, y0: -1.5, x1: 40, y1: 1.5, c: 'carriage', k: 'asphalt', h: 1 }]);
  assert.equal(coveredTopLayer(p, widths, klinker, (_c, m) => m), null);
  // Asphalt edges, a paving strip in the middle (offset 3, drawn over the top anyway): asphalt.
  const strip = boxIndex([{ x0: 0, y0: -0.5, x1: 40, y1: 0.5, c: 'foot', k: 'paving', h: 1 }, { x0: 0, y0: -3, x1: 40, y1: 3, c: 'carriage', k: 'asphalt', h: 1 }]);
  assert.equal(coveredTopLayer(p, widths, strip, (_c, m) => m), 'asphalt');
  assert.equal(coveredTopLayer(p, widths, boxIndex([]), (_c, m) => m), null, 'no survey: no verdict');
});

test('wetGroundRings: a quay polygon reaching 2 m over the water beside a surveyed deck polygon joins (decks seed the rounds)', () => {
  const enc = (ring: [number, number][]) => { const out: number[] = []; let px = 0, py = 0; for (const [x, y] of ring) { out.push(Math.round(x * 10) - px, Math.round(y * 10) - py); px = Math.round(x * 10); py = Math.round(y * 10); } return out; };
  // Water x in [0, 20]; a quay paving polygon x in [18, 40] (2 m over the water); the bridge deck polygon x in [0, 18].
  const quay: RoadSurface = { k: 'paving', c: 'foot', h: 0, r: [enc([[18, -5], [40, -5], [40, 5], [18, 5]])] } as RoadSurface;
  const deck: [number, number][] = [[0, -5], [18, -5], [18, 5], [0, 5]];
  const input = { wet: (x: number) => x >= 0 && x <= 20, ground: () => 1.6, waterZ: () => -1.77, waterBox: [0, -50, 20, 50] as [number, number, number, number] };
  assert.equal(wetGroundRings([quay], input).length, 0, 'before: too narrow for the inset, nothing to grow from');
  assert.equal(wetGroundRings([quay], { ...input, decks: [deck] }).length, 1);
  // Not at canal level (the relief within WET_CLEAR_M of the water): stays cut.
  assert.equal(wetGroundRings([quay], { ...input, ground: () => -0.5, decks: [deck] }).length, 0);
});

test('drapeAdaptive deckSideFine: a ground polygon across a deck side follows the 0.75 m blend', () => {
  // The surface steps 0.6 m over x in [0, 0.75] (smoothstep), a deck at x > 0.75; weight 0 → 1 over the blend.
  const sm = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
  const h = (x: number) => 1 + 0.6 * sm(x / 0.75), w = (x: number) => sm(x / 0.75);
  const coords = [-3, -3, 3, -3, 3, 3, -3, 3], tris = [0, 1, 2, 0, 2, 3];
  const worst = (m: ReturnType<typeof emptyMesh>) => {
    let e = 0;
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]].map(i => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]]);
      for (const [u, v] of [[1 / 3, 1 / 3], [0.5, 0], [0, 0.5], [0.5, 0.5]]) {
        const x = a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * v, z = a[2] + (b[2] - a[2]) * u + (c[2] - a[2]) * v;
        e = Math.max(e, h(x) - z);
      }
    }
    return e;
  };
  const before = emptyMesh(), after = emptyMesh();
  drapeAdaptive(before, coords, tris, (x) => h(x), 0, 24, 0.022, 3);
  drapeAdaptive(after, coords, tris, (x) => h(x), 0, 24, 0.022, 3, 0.02, 0, Infinity, { minEdge: DECK_SIDE_MIN_EDGE_M, at: (x) => w(x) });
  assert.ok(worst(before) > 0.1, `before ${worst(before)}`);
  assert.ok(worst(after) < 0.03, `after ${worst(after)}`);
  // Away from any deck (weight 0 everywhere) nothing changes.
  const flatA = emptyMesh(), flatB = emptyMesh();
  drapeAdaptive(flatA, coords, tris, () => 1, 0, 24, 0.022, 3);
  drapeAdaptive(flatB, coords, tris, () => 1, 0, 24, 0.022, 3, 0.022, 0, Infinity, { minEdge: DECK_SIDE_MIN_EDGE_M, at: () => 0 });
  assert.deepEqual(flatA, flatB);
});

test('isPandAbutment: a small footprint over the water beside a deck polygon, on relief at street height', async () => {
  const { isPandAbutment, ringArea } = await import('./pandAbutments');
  const house: [number, number][] = [[0, 0], [5, 0], [5, 5], [0, 5]], deck: [number, number][] = [[-10, -1], [-1, -1], [-1, 6], [-10, 6]];
  const wet = (x: number) => x < 2, street = () => 1.3, bed = () => -2.5;
  assert.equal(ringArea(house), 25);
  assert.equal(isPandAbutment(house, wet, street, -1.77, [deck], 2), true);
  assert.equal(isPandAbutment(house, wet, bed, -1.77, [deck], 2), false, 'relief at the canal bed: on piles over the water');
  assert.equal(isPandAbutment(house, wet, street, -1.77, [], 2), false, 'no deck near');
  assert.equal(isPandAbutment(house, () => false, street, -1.77, [deck], 2), false, 'dry');
  assert.equal(isPandAbutment([[0, 0], [12, 0], [12, 12], [0, 12]], wet, street, -1.77, [deck], 2), false, 'a canal house');
});
