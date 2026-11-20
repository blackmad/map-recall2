// Lane market-stalls-20261120: the Dappermarkt, Westerstraat, Noordermarkt and Lindenmarkt lines, the bare-frame
// (closed) stall, the ?marketDay= schedule, per-market triangle budgets and the rideable-corridor check against the
// routing graph.
//   node --import tsx --test src/canalRecall/markets/marketDays.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { MARKET_MODELS, MARKET_TRI_BUDGET, MARKET_TRI_CAPS, STALL, isSlot, roofZ } from './stallKit.ts';
import { marketState, parseMarketDay, placeAll, placeMarket, stallFootprint, SETUP_HOURS, type LngLat, type MarketLinesFile } from './placer.ts';
import { distToLine, routeConflicts, routedLinesNear, ROUTE_CLEAR_M, type RoutingStreet } from './clearance.ts';

const KX = (lat: number) => 111320 * Math.cos(lat * Math.PI / 180), KY = 110540;
const metres = (a: LngLat, b: LngLat) => Math.hypot((a[0] - b[0]) * KX(a[1]), (a[1] - b[1]) * KY);
const DATA = 'scripts/data/markets/market-lines.json';
const file = JSON.parse(fs.readFileSync(DATA, 'utf8')) as MarketLinesFile;
const placed = placeAll(file);
const STANDS = new Set(['stall-frame', 'stall-table', 'stall-bare']);
const frames = (market: string, inst = placed.instances) => inst.filter(i => STANDS.has(i.part) && i.stall.startsWith(`${market}/`));
const byId = (id: string) => file.markets.find(m => m.id === id)!;

test('bare frame: posts, rails, a flat sheet and bare boards; no slot faces, under its cap, inside the frame footprint', () => {
  const m = MARKET_MODELS['stall-bare']();
  assert.ok(m.triangles <= MARKET_TRI_CAPS['stall-bare'], `${m.triangles}`);
  for (let i = 0; i < m.colours.length; i += 3) assert.ok(!isSlot(m.colours[i], m.colours[i + 1], m.colours[i + 2]));
  for (let i = 0; i < m.positions.length; i += 3) {
    assert.ok(Math.abs(m.positions[i]) <= STALL.length / 2 + 1e-6);
    assert.ok(m.positions[i + 1] <= 0.03 && m.positions[i + 1] >= -STALL.depth - 0.1);
    assert.ok(m.positions[i + 2] <= roofZ(-STALL.depth) + 0.2);
  }
  // Cheaper than a dressed stall (frame + roof + goods).
  const dressed = MARKET_MODELS['stall-frame']().triangles + MARKET_MODELS['roof-plain']().triangles + MARKET_MODELS['goods-produce']().triangles;
  assert.ok(m.triangles < dressed, `${m.triangles} vs dressed ${dressed}`);
});

test('schedule: register hours decide open / bare frames / nothing', () => {
  const dapper = byId('dapper'), wester = byId('westerstraat'), linden = byId('lindengracht'), noord = byId('noordermarkt');
  assert.equal(marketState(dapper, 'We'), 'open');
  assert.equal(marketState(dapper, 'Su'), 'closed');
  assert.equal(marketState(dapper, 'We', 8.7), 'setup'); // the 2022-08-31 08:40 capture: bare frames
  assert.equal(marketState(dapper, 'We', 9 - SETUP_HOURS - 0.5), 'closed');
  assert.equal(marketState(dapper, 'We', 18.5), 'closed');
  assert.equal(marketState(wester, 'Mo', 12.5), 'open');
  assert.equal(marketState(wester, 'Mo', 13.5), 'closed'); // the Lapjesmarkt ends at 13.00
  assert.equal(marketState(wester, 'Tu'), 'closed');
  assert.equal(marketState(linden, 'Sa'), 'open');
  assert.equal(marketState(linden, 'Mo'), 'closed');
  assert.equal(marketState(noord, 'Mo'), 'open');
  assert.equal(marketState(noord, 'Sa'), 'open');
  assert.equal(marketState(noord, 'We'), 'closed');
});

test('parseMarketDay: weekday, weekday@hour, now; junk is no schedule', () => {
  assert.equal(parseMarketDay(null), null);
  assert.equal(parseMarketDay(''), null);
  assert.equal(parseMarketDay('saturday'), null);
  assert.deepEqual(parseMarketDay('Sa'), { day: 'Sa' });
  assert.deepEqual(parseMarketDay('Mo@8.5'), { day: 'Mo', hour: 8.5 });
  assert.deepEqual(parseMarketDay('Mo@30'), { day: 'Mo' });
  // Sunday 2026-11-15 12:00 UTC = 13:00 in Amsterdam.
  assert.deepEqual(parseMarketDay('now', () => new Date('2026-11-15T12:00:00Z')), { day: 'Su', hour: 13 });
});

test('schedule in placeAll: no schedule = every market open (Cuyp and Ten Kate unchanged); Sunday = nothing; Monday 08:30 = bare frames', () => {
  // The default keeps the 2026-11-14 behaviour exactly for the first two markets.
  for (const id of ['albert-cuyp', 'ten-kate']) assert.deepEqual(placeMarket(byId(id)).instances, placed.instances.filter(i => i.stall.startsWith(`${id}/`)));
  assert.equal(placeAll(file, { day: 'Su' }).instances.length, 0);
  const sat = placeAll(file, { day: 'Sa' }), satMarkets = new Set(sat.stalls.map(s => s.market));
  assert.deepEqual([...satMarkets].sort(), ['albert-cuyp', 'dapper', 'lindengracht', 'noordermarkt', 'ten-kate']);
  const early = placeAll(file, { day: 'Mo', hour: 8.5 });
  assert.ok(early.instances.length > 0);
  for (const i of early.instances) assert.ok(i.part === 'stall-bare' || i.part === 'van', i.part);
  // Bare frames stand exactly where the dressed ones do.
  const open = new Map(placed.instances.filter(i => i.part === 'stall-frame' || i.part === 'stall-table').map(i => [i.stall, i]));
  for (const i of early.instances.filter(x => x.part === 'stall-bare')) {
    const o = open.get(i.stall)!;
    assert.ok(o && o.lng === i.lng && o.lat === i.lat && o.yaw === i.yaw, i.stall);
  }
});

const triangles = (instances: typeof placed.instances) => instances.reduce((a, i) => a + MARKET_MODELS[i.part]().triangles, 0);
const TRI = new Map<string, number>();
for (const m of file.markets) TRI.set(m.id, triangles(placed.instances.filter(i => i.stall.startsWith(`${m.id}/`))));

test('triangle budget: every market under MARKET_TRI_BUDGET (all instances, before culling)', () => {
  for (const [id, t] of TRI) assert.ok(t <= MARKET_TRI_BUDGET, `${id}: ${t}`);
});

/**
 * Stall counts per market (dressed frames and tables). Ranges are the measured lines' counts give or take a run's
 * slack; the register gives standplaatsen only for the Cuyp.
 */
const COUNTS: Record<string, [number, number]> = {
  dapper: [150, 260], westerstraat: [70, 170], noordermarkt: [8, 30], lindengracht: [40, 120],
};
for (const [id, [lo, hi]] of Object.entries(COUNTS)) test(`measured lines: ${id} places ${lo}-${hi} stalls`, () => {
  const n = frames(id).length;
  assert.ok(n >= lo && n <= hi, `${id} ${n}`);
});

const streets = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as RoutingStreet[];
for (const m of file.markets) test(`rideable corridor: no ${m.id} stall or van within ${ROUTE_CLEAR_M} m of a routed line`, () => {
  const pts = m.sides.flatMap(s => s.kerb);
  const box = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))] as const;
  const lines = routedLinesNear(streets, box);
  assert.ok(lines.length > 0);
  const hits = routeConflicts(placed.instances.filter(i => i.stall.startsWith(`${m.id}/`)), lines);
  assert.deepEqual(hits, []);
});

/** Crossings the rows must break at: OSM junction nodes (the routing graph's) on the market streets. */
const CROSSINGS: { market: string; name: string; at: LngLat; clearM: number }[] = [
  { market: 'dapper', name: 'Commelinstraat crossing (routing_20669 x Commelinstraat)', at: [4.926808, 52.363826], clearM: 4 },
  { market: 'dapper', name: 'Wagenaarstraat crossing', at: [4.927127, 52.363255], clearM: 4 },
  { market: 'dapper', name: 'Eerste Van Swindenstraat crossing', at: [4.927468, 52.36267], clearM: 4 },
  { market: 'westerstraat', name: 'Eerste Anjeliersdwarsstraat / Tweede Boomdwarsstraat crossing', at: [4.883247, 52.378443], clearM: 4 },
  { market: 'westerstraat', name: 'Eerste Boomdwarsstraat / Violettenstraat crossing', at: [4.884884, 52.378741], clearM: 4 },
  { market: 'lindengracht', name: 'Eerste Lindendwarsstraat / Tweede Goudsbloemdwarsstraat crossing', at: [4.884248, 52.380231], clearM: 4 },
  { market: 'lindengracht', name: 'Eerste Goudsbloemdwarsstraat / Noorderkerkstraat crossing', at: [4.885778, 52.380461], clearM: 4 },
];
for (const c of CROSSINGS) test(`named regression: no ${c.market} stall stands in the ${c.name}`, () => {
  for (const i of frames(c.market)) {
    const d = Math.min(...stallFootprint(i).map(p => metres(p, c.at)), metres([i.lng, i.lat], c.at));
    assert.ok(d >= c.clearM, `${i.stall} ${d.toFixed(1)} m from ${c.name}`);
  }
});

test('named regression: Westerstraat and Lindengracht rows stand back to back on the median, facing their carriageways', () => {
  for (const id of ['westerstraat', 'lindengracht']) {
    const m = byId(id), rows = m.sides.map(s => s.side).sort();
    assert.deepEqual(rows, ['north', 'south'], id);
    const north = frames(id).filter(i => i.stall.includes('/north/')), south = frames(id).filter(i => i.stall.includes('/south/'));
    assert.ok(north.length > 5 && south.length > 5, `${id} ${north.length} ${south.length}`);
    // Facing: the north row's front (+y) points roughly north, the south row's south.
    const frontN = (i: typeof north[number]) => Math.cos(i.yaw);
    for (const i of north) assert.ok(frontN(i) > 0.5, `${i.stall} faces ${frontN(i)}`);
    for (const i of south) assert.ok(frontN(i) < -0.5, `${i.stall} faces ${frontN(i)}`);
    // Back to back without overlap: no two footprints of opposite rows share ground (centres >= depth apart across).
    for (const a of north) for (const b of south) if (metres([a.lng, a.lat], [b.lng, b.lat]) < STALL.length) {
      const across = Math.abs((a.lat - b.lat) * KY * Math.cos(a.yaw) - (a.lng - b.lng) * KX(a.lat) * Math.sin(a.yaw));
      assert.ok(across >= 2 * STALL.depth, `${a.stall} / ${b.stall} ${across.toFixed(2)} m`);
    }
  }
});

test('named regression: the Dapperstraat aisle stays open (facing kerbs at least 4 m apart; the routed line between them)', () => {
  const m = byId('dapper'), [left, right] = m.sides;
  for (let k = 0; k < left.kerb.length; k += 8) {
    const d = Math.min(...right.kerb.map(p => metres(p, left.kerb[k])));
    assert.ok(d >= 4, `kerbs ${d.toFixed(2)} m apart at ${left.kerb[k]}`);
  }
  const route = streets.find(s => s.id === 'routing_20669')!; // Dapperstraat (pedestrian), the lines the rider takes
  const lines = (route.paths ?? [route.path!]).map(p => p.map(([lat, lng]) => [lng, lat] as LngLat));
  for (const i of frames('dapper')) for (const p of stallFootprint(i)) {
    const d = Math.min(...lines.map(l => distToLine(p, l)));
    assert.ok(d >= ROUTE_CLEAR_M, `${i.stall} ${d.toFixed(2)} m from the Dapperstraat line`);
  }
});

test('report: per-market stalls and triangles (printed for the hand-back)', () => {
  const rows = file.markets.map(m => ({ id: m.id, stalls: frames(m.id).length, vans: placed.instances.filter(i => i.part === 'van' && i.stall.startsWith(`${m.id}/`)).length, triangles: TRI.get(m.id), perStall: Math.round(TRI.get(m.id)! / Math.max(1, frames(m.id).length)) }));
  console.log(JSON.stringify(rows));
  assert.ok(rows.length >= 6);
});
