// Market-stall kit, placer and the measured market lines (lane markets-20261114).
//   node --import tsx --test src/canalRecall/markets/markets.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { GOODS_KINDS, MARKET_MODELS, MARKET_PART_IDS, MARKET_TRI_CAPS, STALL, STALL_TRI_CAP, VAN, goodsPart, isSlot, roofZ } from './stallKit.ts';
import {
  FRONT_SETBACK_M, MIN_DEPTH_M, PASSAGE_EVERY, PASSAGE_M, ROOF_CLEAR_M, STALL_GAP_M,
  localLine, marketOpenAt, placeAll, placeMarket, stallFootprint, stallSlots, type LngLat, type MarketLine, type MarketLinesFile,
} from './placer.ts';
import { marketsFlag, MARKETS_DEFAULT } from '../engine/marketLayer.ts';

const KX = (lat: number) => 111320 * Math.cos(lat * Math.PI / 180), KY = 110540;
const metres = (a: LngLat, b: LngLat) => Math.hypot((a[0] - b[0]) * KX(a[1]), (a[1] - b[1]) * KY);

test('every kit part stays under its triangle cap; a whole stall under STALL_TRI_CAP', () => {
  for (const id of MARKET_PART_IDS) {
    const m = MARKET_MODELS[id]();
    assert.equal(m.id, id);
    assert.ok(m.triangles > 0 && m.triangles <= MARKET_TRI_CAPS[id], `${id}: ${m.triangles} > ${MARKET_TRI_CAPS[id]}`);
    assert.equal(m.positions.length, m.triangles * 9);
    assert.equal(m.colours.length, m.positions.length);
    assert.ok([...m.positions].every(Number.isFinite), id);
  }
  const worstGoods = Math.max(...GOODS_KINDS.map(k => MARKET_MODELS[goodsPart(k)]().triangles));
  const stall = MARKET_MODELS['stall-frame']().triangles + MARKET_MODELS['roof-striped']().triangles + worstGoods;
  assert.ok(stall <= STALL_TRI_CAP, `stall ${stall} > ${STALL_TRI_CAP}`);
});

test('stall parts keep inside the frame footprint: nothing past the roof overhang toward the aisle, nothing past the ends', () => {
  for (const id of MARKET_PART_IDS.filter(i => i !== 'van')) {
    const p = MARKET_MODELS[id]().positions;
    for (let i = 0; i < p.length; i += 3) {
      assert.ok(Math.abs(p[i]) <= STALL.length / 2 + 1e-6, `${id} x ${p[i]}`);
      assert.ok(p[i + 1] <= STALL.overhang + 1e-6 && p[i + 1] >= -STALL.depth - 0.1 - 1e-6, `${id} y ${p[i + 1]}`);
    }
  }
  // Headroom under the roof's lowest edge (the valance) for shoppers.
  assert.ok(roofZ(STALL.overhang) - STALL.valance >= 1.95);
});

test('the canvas and the van paint take the instance colour (SLOT); striped roofs alternate with white', () => {
  const slotShare = (id: typeof MARKET_PART_IDS[number]) => { const c = MARKET_MODELS[id]().colours; let n = 0; for (let i = 0; i < c.length; i += 3) if (isSlot(c[i], c[i + 1], c[i + 2])) n++; return n / (c.length / 3); };
  assert.equal(slotShare('roof-plain'), 1);
  const striped = slotShare('roof-striped');
  assert.ok(striped > 0.45 && striped < 0.7, `striped slot share ${striped}`);
  assert.ok(slotShare('van') > 0.3);
  assert.equal(slotShare('stall-frame'), 0);
});

test('stallSlots: frames STALL_GAP_M apart, a passage after every PASSAGE_EVERY, all inside the run', () => {
  const slots = stallSlots(10, 100);
  assert.ok(slots.length >= 15);
  for (const s of slots) assert.ok(s - STALL.length / 2 >= 10 - 1e-9 && s + STALL.length / 2 <= 100 + 1e-9);
  for (let k = 1; k < slots.length; k++) {
    const d = slots[k] - slots[k - 1], passage = k % PASSAGE_EVERY === 0;
    assert.ok(Math.abs(d - (STALL.length + STALL_GAP_M + (passage ? PASSAGE_M : 0))) < 1e-9, `gap ${k}: ${d}`);
  }
  assert.deepEqual(stallSlots(0, 3.9), []);
  assert.equal(stallSlots(0, 4).length, 1);
});

/** A straight east-west street at the Cuyp's latitude, kerbs 3 m either side of the centre, strips 4 m deep. */
function syntheticMarket(): MarketLine {
  const lat = 52.3555, lng0 = 4.89, len = 120, dLng = len / KX(lat), dLat = 3 / KY;
  return {
    id: 'test', name: 'Test', palette: 'cuyp', hours: {},
    sides: [
      { side: 'north', kerb: [[lng0, lat + dLat], [lng0 + dLng, lat + dLat]], aisle: -1, depthM: 4, runs: [[0, 50], [60, 120]], vans: ['start'] },
      { side: 'south', kerb: [[lng0, lat - dLat], [lng0 + dLng, lat - dLat]], aisle: 1, depthM: 4, runs: [[0, 120]] },
    ],
  };
}

test('placer: stalls stand behind the kerb with the roof edge ROOF_CLEAR_M short of it, facing the aisle', () => {
  const m = syntheticMarket(), { instances, stalls } = placeMarket(m), lat = 52.3555;
  assert.ok(stalls.length > 20);
  for (const i of instances.filter(x => x.part === 'stall-frame')) {
    const north = i.lat > lat, ys = stallFootprint(i).map(p => (p[1] - lat) * KY);
    // Aisle-side edge (the roof overhang) and back edge, metres from the centre line.
    const near = north ? Math.min(...ys) : -Math.max(...ys), far = north ? Math.max(...ys) : -Math.min(...ys);
    assert.ok(Math.abs(near - (3 + ROOF_CLEAR_M)) < 0.02, `roof edge ${near}`);
    assert.ok(Math.abs(far - (3 + FRONT_SETBACK_M + STALL.depth)) < 0.02, `back ${far}`);
    // Front (+y) points at the aisle: south for the north row, north for the south row.
    const front = [Math.round(-Math.sin(i.yaw)) + 0, Math.round(Math.cos(i.yaw)) + 0];
    assert.deepEqual(front, north ? [0, -1] : [0, 1]);
  }
  // The north row breaks at the 50-60 m gap; a van opens the north row.
  const northS = stalls.filter(s => s.side === 'north' && s.goods !== 'van').map(s => s.s);
  assert.ok(!northS.some(s => s + STALL.length / 2 > 50 && s - STALL.length / 2 < 60));
  assert.equal(stalls.filter(s => s.goods === 'van').length, 1);
  // Deterministic.
  assert.deepEqual(placeMarket(m), placeMarket(m));
});

test('placer skips a strip too shallow for the frame', () => {
  const m = syntheticMarket();
  m.sides[1].depthM = MIN_DEPTH_M - 0.1;
  assert.equal(placeMarket(m).stalls.filter(s => s.side === 'south').length, 0);
});

test('marketOpenAt reads the register hours in Amsterdam time (the game itself has no weekday or clock)', () => {
  const m = { hours: { Mo: [10, 17], Sa: [10, 17] } as MarketLine['hours'] };
  assert.equal(marketOpenAt(m, new Date('2026-11-16T11:00:00Z')), true); // Monday 12:00 CET
  assert.equal(marketOpenAt(m, new Date('2026-11-16T17:30:00Z')), false); // Monday 18:30
  assert.equal(marketOpenAt(m, new Date('2026-11-15T11:00:00Z')), false); // Sunday
});

test('flag: off by default, ?markets=1 on, ?markets=0 always off', () => {
  assert.equal(MARKETS_DEFAULT, false);
  assert.equal(marketsFlag(''), false);
  assert.equal(marketsFlag('?markets=1'), true);
  assert.equal(marketsFlag('?markets=0'), false);
});

// Named regressions on the measured lines (scripts/data/markets/market-lines.json, built by scripts/markets/build-lines.ts).
const DATA = 'scripts/data/markets/market-lines.json';
const file = JSON.parse(fs.readFileSync(DATA, 'utf8')) as MarketLinesFile;
const placed = placeAll(file);
const frames = (market: string) => placed.instances.filter(i => i.part === 'stall-frame' && i.stall.startsWith(`${market}/`));

test('measured lines: stall counts in the register\'s range (Cuyp ~260 standplaatsen; Ten Kate a pedestrian block)', () => {
  assert.deepEqual(file.markets.map(m => m.id), ['albert-cuyp', 'ten-kate']);
  const cuyp = frames('albert-cuyp').length, kate = frames('ten-kate').length;
  assert.ok(cuyp >= 230 && cuyp <= 280, `cuyp ${cuyp}`);
  assert.ok(kate >= 45 && kate <= 75, `ten kate ${kate}`);
  for (const m of file.markets) for (const s of m.sides) {
    assert.ok(s.depthM >= MIN_DEPTH_M, `${m.id} ${s.side} depth ${s.depthM}`);
    const total = localLine(s.kerb).cum.at(-1)!;
    for (const [a, b] of s.runs) assert.ok(a >= 0 && b <= total + 1e-6 && b - a >= STALL.length, `${m.id} ${s.side} run ${a}-${b}`);
  }
});

/** Crossings the rows must break at (OSM junction nodes on the market centrelines). */
const CROSSINGS: { market: string; name: string; at: LngLat; clearM: number }[] = [
  { market: 'albert-cuyp', name: 'Eerste van der Helststraat (node on way 7371794)', at: [4.893143, 52.355484], clearM: 6 },
  { market: 'albert-cuyp', name: 'Ferdinand Bolstraat (west end)', at: [4.890347, 52.354966], clearM: 10 },
  { market: 'albert-cuyp', name: 'Van Woustraat (east end)', at: [4.899544, 52.357162], clearM: 10 },
  { market: 'ten-kate', name: 'Kinkerstraat crossing (way 1239242863, its north end)', at: [4.867508, 52.366011], clearM: 4 },
  { market: 'ten-kate', name: 'Bellamystraat crossing', at: [4.866662, 52.367251], clearM: 4 },
];
for (const c of CROSSINGS) test(`named regression: no stall stands in the ${c.name} crossing`, () => {
  for (const i of frames(c.market)) {
    const d = Math.min(...stallFootprint(i).map(p => metres(p, c.at)), metres([i.lng, i.lat], c.at));
    assert.ok(d >= c.clearM, `${i.stall} ${d.toFixed(1)} m from ${c.name}`);
  }
});

test('named regression: the rider\'s corridor down the Albert Cuypstraat stays clear of every stall and van', () => {
  // Way 7371794 nodes, Ferdinand Bolstraat to Van Woustraat: the routed line. It is not the carriageway's middle: at the
  // west end BGT's rijbaan is 4 m wide and runs 0.5 m south to 3.5 m north of it, so the south row's roof edges come
  // within ~1.1 m of the line (s 72 m along the south kerb). 1.0 m is the floor: a rider on the line never meets canvas.
  const centre: LngLat[] = [[4.890347, 52.354966], [4.8909, 52.355068], [4.893071, 52.355471], [4.893226, 52.355502], [4.894329, 52.35572], [4.895293, 52.355939], [4.895995, 52.356116], [4.897376, 52.356515], [4.898809, 52.35694], [4.899428, 52.35713], [4.899544, 52.357162]];
  const l = localLine(centre), kx = KX(l.lat0);
  const dist = (p: LngLat) => {
    const x = (p[0] - l.lng0) * kx, y = (p[1] - l.lat0) * KY; let best = Infinity;
    for (let k = 1; k < l.pts.length; k++) {
      const a = l.pts[k - 1], b = l.pts[k], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy));
    }
    return best;
  };
  for (const i of frames('albert-cuyp')) for (const p of stallFootprint(i)) assert.ok(dist(p) >= 1.0, `${i.stall} ${dist(p).toFixed(2)} m`);
  for (const i of placed.instances.filter(x => x.part === 'van')) assert.ok(dist([i.lng, i.lat]) >= 1.0 + VAN.width / 2);
  // The two kerb lines leave the carriageway open: at least 3.5 m between facing rows wherever both stand.
  const m = file.markets.find(x => x.id === 'albert-cuyp')!;
  const [left, right] = m.sides;
  for (let k = 0; k < left.kerb.length; k += 10) {
    const d = Math.min(...right.kerb.map(p => metres(p, left.kerb[k])));
    assert.ok(d >= 3.5, `kerbs ${d.toFixed(2)} m apart at ${left.kerb[k]}`);
  }
});

test('named regression: Ten Kate keeps a clear centre aisle of at least 4 m', () => {
  const m = file.markets.find(x => x.id === 'ten-kate')!;
  const [left, right] = m.sides;
  // Facing kerbs: the gap between the two kerb lines' midpoints.
  const mid = (s: typeof left) => s.kerb[s.kerb.length >> 1];
  assert.ok(metres(mid(left), mid(right)) >= 4.0);
});
