// Shop runs (lane shop-band-ground, `?shopRun=1`): which wall runs keep a shop's ground storey, and the flag-off identity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CORNER_REACH_M, TIE_REACH_M, bagUnitAnchors, setShopAnchors, shopRunEnabled, shopRunsFor, upperFloorToevoeging, type ShopRunGeom } from './shopRun.ts';
import { buildFeatureChunk, meshBuildingFor } from './threeBuildingFeatures.ts';
import { decorateShopfront, setShopfronts } from './shopfronts.ts';

const g = globalThis as { __canalRecallShopRun?: boolean };
const withFlag = <T>(on: boolean | undefined, f: () => T): T => { const was = g.__canalRecallShopRun; if (on === undefined) delete g.__canalRecallShopRun; else g.__canalRecallShopRun = on; try { return f(); } finally { if (was === undefined) delete g.__canalRecallShopRun; else g.__canalRecallShopRun = was; } };

// A 40 x 12 m block, counter-clockwise from the south-west corner: south, east, north and west runs.
const run = (x0: number, y0: number, x1: number, y1: number, street = true): ShopRunGeom => ({ segs: [[x0, y0, x1, y1]], street });
const block = [run(0, 0, 40, 0), run(40, 0, 40, 12), run(40, 12, 0, 12), run(0, 12, 0, 0)];

test('flag parsing: default off, query beats env', () => {
  assert.equal(shopRunEnabled(null, null), false);
  assert.equal(shopRunEnabled('?shopRun=1', '0'), true);
  assert.equal(shopRunEnabled('?a=1&shopRun=0', '1'), false);
  assert.equal(shopRunEnabled(null, '1'), true);
});

test('BAG units: ground-floor non-residential uses anchor; homes, storage and upper floors do not', () => {
  assert.equal(bagUnitAnchors('winkelfunctie', null), true);
  assert.equal(bagUnitAnchors('bijeenkomstfunctie', 'H'), true);
  assert.equal(bagUnitAnchors('woonfunctie,winkelfunctie', null), true, 'a shop-home keeps round 2 behaviour');
  // Zakslootje / Brandewijnsteeg (0363100012182300): office and school units.
  assert.equal(bagUnitAnchors('kantoorfunctie', null), true);
  assert.equal(bagUnitAnchors('onderwijsfunctie', null), true);
  for (const u of ['gezondheidszorgfunctie', 'sportfunctie', 'celfunctie', 'industriefunctie', 'logiesfunctie']) assert.equal(bagUnitAnchors(u, 'H'), true, u);
  assert.equal(bagUnitAnchors('woonfunctie', null), false);
  assert.equal(bagUnitAnchors('overige gebruiksfunctie', 'H'), false);
  assert.equal(bagUnitAnchors('woonfunctie,kantoorfunctie', null), false, 'a home office');
  assert.equal(bagUnitAnchors('', null), false);
  // Storeys from the Amsterdam toevoeging.
  for (const add of ['1', '2', '3V', '1A', '01', '12']) { assert.equal(upperFloorToevoeging(add), true, add); assert.equal(bagUnitAnchors('kantoorfunctie', add), false, add); assert.equal(bagUnitAnchors('winkelfunctie', add), false, add); }
  for (const add of [null, undefined, '', 'H', 'O', 'HL', '0', 'A']) assert.equal(upperFloorToevoeging(add), false, String(add));
});

test('one shop mid-front keeps only its own run (Valkenburgerstraat 69-165, Roche Bobois)', () => {
  assert.deepEqual(shopRunsFor(block, [[20, 1]]), [true, false, false, false]);
});

test('a corner shop keeps both street faces', () => {
  assert.deepEqual(shopRunsFor(block, [[2, 1]]), [true, false, false, true]);
  // ... but not a face beyond the corner reach.
  assert.deepEqual(shopRunsFor(block, [[CORNER_REACH_M + 2, 1]]), [true, false, false, false]);
});

test('a point about as far from two street runs keeps both (Brasserie Keyzer, 0363100012164883)', () => {
  const tall = [run(0, 0, 40, 0), run(40, 0, 40, 30), run(40, 30, 0, 30), run(0, 30, 0, 0)];
  // 6.2 m from the south run, 7.0 m from the west run: past the corner reach, inside the tie margin.
  assert.deepEqual(shopRunsFor(tall, [[7, 6.2]]), [true, false, false, true]);
  // ... but not when the second street is clearly farther, nor past TIE_REACH_M.
  assert.deepEqual(shopRunsFor(tall, [[9.5, 6.5]]), [true, false, false, false]);
  assert.deepEqual(shopRunsFor(tall, [[TIE_REACH_M + 0.5, TIE_REACH_M + 0.2]]), [true, false, false, false]);
});

test('two shops on two streets keep both runs', () => {
  assert.deepEqual(shopRunsFor(block, [[20, 1], [20, 11]]), [true, false, true, false]);
});

test('a node by a non-street wall picks that wall when it is clearly nearer (a forecourt)', () => {
  const runs = [run(0, 0, 40, 0), run(40, 0, 40, 12, false), run(40, 12, 0, 12, false), run(0, 12, 0, 0, false)];
  assert.deepEqual(shopRunsFor(runs, [[39, 8]]), [false, true, false, false]);
  // Deep inside a large footprint (over FRONT_SNAP_M from every wall): the nearest street run.
  const deep = [run(0, 0, 40, 0), run(40, 0, 40, 30, false), run(40, 30, 0, 30, false), run(0, 30, 0, 0, false)];
  assert.deepEqual(shopRunsFor(deep, [[30, 20]]), [true, false, false, false]);
  // Within the margin the street run wins.
  assert.deepEqual(shopRunsFor(runs, [[38.5, 1.5]]), [true, false, false, false]);
});

test('no anchor: street runs keep the shop, back runs do not; one run or no street run: unchanged', () => {
  assert.deepEqual(shopRunsFor([run(0, 0, 40, 0), run(40, 0, 40, 12, false), run(40, 12, 0, 12), run(0, 12, 0, 0, false)], []), [true, false, true, false]);
  assert.deepEqual(shopRunsFor([block[0]], [[100, 100]]), [true]);
  assert.deepEqual(shopRunsFor(block.map(r => ({ ...r, street: false })), [[20, 1]]), [true, true, true, true]);
});

// A free-standing 40 x 12 m c19 shop block with its one shop 1 m inside the middle of the south front.
const kx = 111_320 * Math.cos(52.37 * Math.PI / 180), ky = 110_540;
const ll = (x: number, y: number) => [4.9 + x / kx, 52.37 + y / ky];
const ring = [ll(0, 0), ll(40, 0), ll(40, 12), ll(0, 12), ll(0, 0)];
const feature = { type: 'Feature' as const, properties: { id: 'NL.IMBAG.Pand.shoprun-block', height: 15, minHeight: 0, facade: 'c19-x', facadeStyle: 'c19', constructionYear: 1900, shopKind: 'shopWindow', shopColour: '#b8442c' } as Record<string, unknown>, geometry: { type: 'Polygon', coordinates: [ring] } };
const anchor = ll(20, 1) as [number, number];
const digest = (c: Record<string, unknown>) => { const h = createHash('sha1'); for (const [k, v] of Object.entries(c).sort()) if (ArrayBuffer.isView(v)) { h.update(k); h.update(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); } return h.digest('hex'); };
const layerCount = (c: { layers: ArrayLike<number>; vertexCount: number }, layer: number) => { let n = 0; for (let v = 0; v < c.vertexCount; v++) if (c.layers[v] === layer) n++; return n; };

test('flag off: anchors are neither stamped nor read, chunks byte-identical', () => {
  withFlag(false, () => {
    setShopAnchors({ version: 1, buildings: { [String(feature.properties.id)]: [anchor] } });
    setShopfronts(null);
    assert.equal(decorateShopfront(feature).properties.shopAnchors, undefined);
    setShopAnchors(null);
    assert.equal(meshBuildingFor(feature, 'photo')?.shopRun, undefined);
    const anchored = { ...feature, properties: { ...feature.properties, shopAnchors: [anchor] } };
    for (const mode of ['walls', 'extras'] as const) assert.equal(digest(buildFeatureChunk([anchored], 'photo', mode) as never), digest(buildFeatureChunk([feature], 'photo', mode) as never), mode);
  });
});

test('flag on: only the anchored run draws the shop ground; the rest draw the quiet ground', () => {
  withFlag(true, () => {
    setShopAnchors({ version: 1, buildings: { [String(feature.properties.id)]: [anchor] } });
    const decorated = decorateShopfront(feature);
    setShopAnchors(null);
    assert.deepEqual(decorated.properties.shopAnchors, [anchor]);
    const b = meshBuildingFor(decorated, 'photo')!;
    assert.ok(b.shopRun && b.shopRun.quiet.ground !== undefined && b.layers, 'a shop block carries its quiet ground');
    const shop = b.layers!.ground, quiet = b.shopRun!.quiet.ground!;
    assert.notEqual(shop, quiet);
    const on = buildFeatureChunk([decorated], 'photo') as never as { layers: ArrayLike<number>; vertexCount: number };
    const off = withFlag(false, () => buildFeatureChunk([feature], 'photo')) as never as { layers: ArrayLike<number>; vertexCount: number };
    assert.ok(layerCount(off, shop) > 0 && layerCount(off, quiet) === 0, 'off: the shop wraps the block');
    assert.ok(layerCount(on, shop) > 0 && layerCount(on, quiet) > 0, 'on: shop on the front, quiet elsewhere');
    // The south front is 40 of the 104 m perimeter: its share of the shop cells, give or take door bays.
    const share = layerCount(on, shop) / layerCount(off, shop);
    assert.ok(share > 0.25 && share < 0.55, `shop share ${share.toFixed(2)}`);
  });
});
