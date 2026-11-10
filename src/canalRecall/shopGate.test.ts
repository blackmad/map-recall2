import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bagAllowsShop, hostForPoi, inferBusyStretch, isTradeBusiness, useClassOf, type PandUses } from './shopGate.js';
import { decorateShopfront, setShopfronts, type ShopfrontExtract } from './shopfronts.js';
import { meshBuildingFor, type Feature } from './threeBuildingFeatures.js';

const uses = (area: Record<string, number>): PandUses => ({ vbos: 1, area });

test('BAG retail and horeca allow a shop; industry, office and housing do not', () => {
  assert.equal(bagAllowsShop(uses({ winkelfunctie: 80 })), true);
  assert.equal(bagAllowsShop(uses({ bijeenkomstfunctie: 200, kantoorfunctie: 40 })), true);
  assert.equal(bagAllowsShop(uses({ industriefunctie: 900 })), false);
  assert.equal(bagAllowsShop(uses({ kantoorfunctie: 300, onderwijsfunctie: 50 })), false);
  assert.equal(bagAllowsShop(undefined), false, 'absent from the table: housing only, or no unit');
  assert.equal(useClassOf(undefined), 'woonfunctie');
  assert.equal(useClassOf(uses({ industriefunctie: 900, kantoorfunctie: 100 })), 'industriefunctie');
  assert.equal(useClassOf(uses({ industriefunctie: 900, winkelfunctie: 5 })), 'winkelfunctie');
  assert.equal(useClassOf(uses({ sportfunctie: 10 })), 'other');
});

test('busy-stretch inference borrows a neighbour only for BAG-registered shops', () => {
  const b = (id: string, cx: number) => ({ id, cx, cy: 0 });
  const points = Array.from({ length: 5 }, (_, i) => ({ x: 10 + i * 4, y: 6, kind: i === 0 ? 'shopCafe' : 'shopWindow' }));
  const table: Record<string, PandUses> = { shop: uses({ winkelfunctie: 90 }), pub: uses({ bijeenkomstfunctie: 90 }), shed: uses({ industriefunctie: 900 }), office: uses({ kantoorfunctie: 400 }) };
  const run = (gate: boolean) => inferBusyStretch([b('shop', 12), b('pub', 14), b('shed', 16), b('office', 18), b('flats', 20), b('far', 500)], () => false, () => points, id => table[id], { gate });
  const gated = run(true);
  assert.deepEqual([...gated.given.keys()].sort(), ['pub', 'shop']);
  assert.deepEqual([...gated.refused.keys()].sort(), ['flats', 'office', 'shed']);
  assert.equal(gated.given.get('shop'), 'shopCafe', 'nearest business lends its kind');
  const old = run(false);
  assert.deepEqual([...old.given.keys()].sort(), ['flats', 'office', 'pub', 'shed', 'shop'], 'gate off: the old behaviour');
  assert.equal(old.refused.size, 0);
});

test('a building with a POI is never touched, and fewer than 5 businesses lend nothing', () => {
  const pts = Array.from({ length: 4 }, (_, i) => ({ x: i, y: 0, kind: 'shopWindow' }));
  const r = inferBusyStretch([{ id: 'a', cx: 0, cy: 0 }], () => false, () => pts, () => uses({ winkelfunctie: 1 }));
  assert.equal(r.given.size + r.refused.size, 0);
  const many = Array.from({ length: 6 }, (_, i) => ({ x: i, y: 0, kind: 'shopWindow' }));
  assert.equal(inferBusyStretch([{ id: 'a', cx: 0, cy: 0 }], () => true, () => many, () => uses({ winkelfunctie: 1 })).given.size, 0);
});

test('without the extract no shop is guessed: no random third, no hashed shopfront', () => {
  setShopfronts(null);
  const ring = [[4.9, 52.37], [4.9002, 52.37], [4.9002, 52.3701], [4.9, 52.3701], [4.9, 52.37]];
  let shops = 0;
  for (let i = 0; i < 200; i++) {
    const f: Feature = { type: 'Feature', properties: { id: `NL.IMBAG.Pand.99${i}`, height: 9, constructionYear: 1900 }, geometry: { type: 'Polygon', coordinates: [ring] } };
    for (const look of ['procedural', 'photo'] as const) {
      const m = meshBuildingFor(f, look);
      if (m?.shop || m?.shopfront) shops++;
    }
  }
  assert.equal(shops, 0);
});

// Named regression pands (BAG ids, addresses from the BAG WFS). Before the gate the busy-stretch pass gave the first four
// a shop window from their neighbours; docs/reports/storefront-gate-20261110.md has the census.
const extract: ShopfrontExtract = JSON.parse(fs.readFileSync(new URL('../../public/data/extracts/amsterdam/shopfronts.json', import.meta.url), 'utf8'));
const pand = (n: string) => `NL.IMBAG.Pand.${n}`;
const NO_SHOP: Array<[string, string]> = [
  ['0363100012167781', 'Brouwersgracht 222-H, industriefunctie 1956 (pakhuis row, Centrum)'],
  ['0363100012167782', 'Binnen Oranjestraat 28-H, industriefunctie 1852 (pakhuis, Centrum)'],
  ['0363100012236031', 'Pazzanistraat 37, industriefunctie 1885 (warehouse beside Houthaven)'],
  ['0363100012177281', 'Keizersgracht 99-H, kantoorfunctie 1905 (office, Centrum)'],
  ['0363100012167815', 'housing-only pand beside Haarlemmerdijk 14 (no non-housing unit in BAG)'],
];
const KEEPS_SHOP: Array<[string, string]> = [
  ['0363100012176764', 'Kalverstraat 152, winkelfunctie (OSM POI)'],
  ['0363100012165204', 'Haarlemmerdijk 1, winkelfunctie (OSM POI)'],
  ['0363100012176104', 'Haarlemmerdijk 14, winkelfunctie (busy stretch, BAG retail)'],
  ['0363100012178875', 'Utrechtsestraat 54, winkelfunctie (OSM POI)'],
  ['0363100012233666', 'Ferdinand Bolstraat 93A, winkelfunctie (OSM POI)'],
];

test('regression pands: warehouses, offices and flats lose the guessed shop, real shops keep theirs', () => {
  setShopfronts(extract);
  const stamp = (id: string): Record<string, unknown> => decorateShopfront({ type: 'Feature', properties: { id: pand(id) } as Record<string, unknown>, geometry: null }).properties;
  for (const [id, why] of NO_SHOP) {
    assert.equal(extract.buildings[pand(id)], undefined, `${why} must not carry a shopfront`);
    assert.equal(stamp(id).shopQuiet, true, why);
  }
  for (const [id, why] of KEEPS_SHOP) {
    assert.notEqual(extract.buildings[pand(id)], undefined, `${why} keeps its shopfront`);
    assert.equal(typeof stamp(id).shopKind, 'string', why);
  }
  setShopfronts(null);
});

test('the shopping streets keep their shops: the extract is not emptied by the gate', () => {
  const n = Object.keys(extract.buildings).length;
  assert.ok(n > 9000 && n < 12000, `shop buildings ${n}`);
});

// Round 2 (2026-11-10): where a POI node snaps. Inside a footprint it belongs there; on the pavement it snaps 8 m to a pand
// BAG lists as shop/horeca and only 2 m to any other.
const square = (x0: number, y0: number, w = 10, h = 10): [number, number][] => [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0]];
test('a pavement node snaps 8 m to a BAG shop, 2 m to a warehouse; inside always counts', () => {
  const shed = { id: 'shed', ring: square(0, 0) }, shop = { id: 'shop', ring: square(20, 0) };
  const table: Record<string, PandUses> = { shop: uses({ winkelfunctie: 80 }), shed: uses({ industriefunctie: 900 }) };
  const u = (id: string) => table[id];
  assert.deepEqual(hostForPoi([shed, shop], 5, 5, u), { id: 'shed', inside: true, distanceM: 0 }, 'inside a warehouse footprint: kept');
  assert.equal(hostForPoi([shed], 13.5, 5, u), null, '3.5 m off a warehouse: not its shop');
  assert.equal(hostForPoi([shed], 11.5, 5, u)?.id, 'shed', '1.5 m off a warehouse: a pavement node');
  assert.equal(hostForPoi([shop], 14, 5, u)?.id, 'shop', '6 m off a BAG shop: its shop');
  assert.equal(hostForPoi([shed, shop], 14.5, 5, u)?.id, 'shop', 'the BAG shop wins over the nearer-but-closer warehouse when the warehouse is out of its 2 m');
  assert.equal(hostForPoi([shed], 13.5, 5, u, false)?.id, 'shed', 'gate off: the old 8 m');
});

test('trade businesses are workshops, not shopfronts', () => {
  assert.equal(isTradeBusiness({ shop: 'car_repair' }), true);
  assert.equal(isTradeBusiness({ shop: 'wholesale' }), true);
  assert.equal(isTradeBusiness({ shop: 'bakery' }), false);
  assert.equal(isTradeBusiness({ amenity: 'restaurant' }), false);
});

test('round 2 pins: a warehouse loses a nearby POI, a pavement-node shop keeps it, a garage is not a shopfront', () => {
  const has = (id: string) => extract.buildings[pand(id)] !== undefined;
  assert.equal(has('0363100012162643'), false, 'Joris van den Bergweg 109, industriefunctie 1982: POI node 3.9 m off the footprint');
  assert.equal(has('0363100012098752'), false, 'Langsom 8, industriefunctie: Hulsebos Autoschade (shop=car_repair)');
  assert.equal(has('0363100012172704'), false, 'Lindengracht 227, industriefunctie: De Linde (shop=car_repair)');
  assert.equal(has('0363100012236030'), true, 'Albert Cuypstraat 271, winkelfunctie: node 5.0 m off the footprint (pavement)');
  assert.equal(has('0363100012109960'), true, 'Beethovenstraat 42, winkelfunctie: node 5.0 m off the footprint (pavement)');
});
