/**
 * Landmark discovery by street front: the rule on synthetic streets, the term list, the group merge, queue ingestion,
 * and the regression pins on the real register + BAG extract (the Winkelgalerij Raadhuisstraat and three look-alikes
 * checked on panoramas, 2026-11-13).
 *
 *   node --import tsx --test scripts/landmarks/discovery-front.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorld, measureFront, ornamentClasses, reasons, score, DEFAULT_THRESHOLDS, type Pand, type RouteSeg, type XY} from './discovery-front-core.ts';
import {discover, mergeSharedPands, type MonumentGroup} from './discovery-front.ts';
import {ingestDiscovery, type DiscoveryNomination, type Queue} from './factory-queue.ts';

const rect = (id: string, x0: number, y0: number, x1: number, y1: number): Pand => ({id, ring: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]});
const street = (pts: XY[], name = 'Teststraat'): RouteSeg[] => pts.slice(1).map((b, i) => ({a: pts[i], b, name}));

test('a straight row of eight 6 m houses is one 48 m front, not curved; party walls do not count', () => {
  const houses = Array.from({length: 8}, (_, i) => rect(`h${i}`, i * 6, 4, i * 6 + 6, 16));
  const world = buildWorld(houses, street([[-20, 0], [80, 0]]));
  const m = measureFront(world, houses);
  assert.ok(Math.abs(m.frontM - 48) < 0.5, `frontM ${m.frontM}`);
  assert.ok(Math.abs(m.streetFrontM - 48) < 0.5, `streetFrontM ${m.streetFrontM} (side walls of the row ends face no street)`);
  assert.equal(m.curveDeg, 0);
  assert.equal(m.street, 'Teststraat');
  // one house of the row alone: its party walls are hidden by the neighbours
  const one = measureFront(world, [houses[3]]);
  assert.ok(Math.abs(one.frontM - 6) < 0.5, `one house ${one.frontM}`);
  assert.deepEqual(reasons({frontM: one.frontM, streetFrontM: one.streetFrontM, curveDeg: 0, ornament: ['sculpture', 'tower', 'ornament']}), [], 'a 6 m house is not an ornamented landmark front');
  assert.deepEqual(reasons({frontM: m.frontM, streetFrontM: m.streetFrontM, curveDeg: 0, ornament: []}), ['long-front']);
});

test('a row of houses along a 60 deg arc is a curved front; a single kink is not', () => {
  const R = 60, houses: Pand[] = [], road: XY[] = [];
  for (let i = 0; i <= 12; i++) { const t = (-30 + i * 5) * Math.PI / 180; road.push([Math.sin(t) * (R - 6), -Math.cos(t) * (R - 6)]); }
  for (let i = 0; i < 12; i++) {
    const t0 = (-30 + i * 5) * Math.PI / 180, t1 = (-30 + (i + 1) * 5) * Math.PI / 180;
    const p = (t: number, r: number): XY => [Math.sin(t) * r, -Math.cos(t) * r];
    houses.push({id: `a${i}`, ring: [p(t0, R), p(t0, R + 12), p(t1, R + 12), p(t1, R)].reverse()});
  }
  const m = measureFront(buildWorld(houses, street(road)), houses);
  assert.ok(m.curveDeg > 50 && m.curveDeg < 62, `curveDeg ${m.curveDeg}`);
  assert.ok(reasons({frontM: m.frontM, streetFrontM: m.streetFrontM, curveDeg: m.curveDeg, ornament: []}).includes('curved-front'));
  // two straight rows meeting at a 25 deg kink: the range is 25 deg but one turn carries all of it
  const k = 25 * Math.PI / 180, left = Array.from({length: 4}, (_, i) => rect(`l${i}`, -24 + i * 6, 4, -18 + i * 6, 16));
  const rot = ([x, y]: XY): XY => [x * Math.cos(k) - y * Math.sin(k), x * Math.sin(k) + y * Math.cos(k)];
  const right = Array.from({length: 4}, (_, i) => ({id: `r${i}`, ring: rect('', i * 6, 4, i * 6 + 6, 16).ring.map(rot)}));
  const kinked = measureFront(buildWorld([...left, ...right], street([[-40, 0], [0, 0], rot([40, 0])])), [...left, ...right]);
  assert.equal(kinked.curveDeg, 0, `kink read as curve ${kinked.curveDeg}`);
});

test('a corner block breaks its front at the corner; the longest street side is the front', () => {
  const block = [rect('c', 0, 4, 30, 16), rect('d', 18, 16, 30, 40)];
  const world = buildWorld(block, [...street([[-10, 0], [50, 0]], 'Zuidzijde'), ...street([[34, -10], [34, 60]], 'Oostzijde')]);
  const m = measureFront(world, block);
  assert.ok(Math.abs(m.frontM - 36) < 1, `frontM ${m.frontM} (east side 12 + 24 m, unbroken)`);
  assert.ok(m.streetFrontM > 65, `both sides count as street front: ${m.streetFrontM}`);
  assert.deepEqual(new Set(m.streets), new Set(['Zuidzijde', 'Oostzijde']));
});

test('ornament terms: the Winkelgalerij description names every class; a plain house none', () => {
  const galerij = 'met veelvuldig gebruik van natuurstenen decoraties ... topgevels met insteekkappen ... natuurstenen beelden van fabeldieren - ontleend aan gotische waterspuwers en al dan niet van wapenschilden voorzien ... in Jugendstilvormen gebeeldhouwde omlijsting ... reliëfnissen ... torentje';
  assert.deepEqual(ornamentClasses(galerij).classes, ['sculpture', 'relief', 'tower', 'gables', 'ornament']);
  assert.deepEqual(ornamentClasses('Pand met lijstgevel en schuifvensters (plm 1800).').classes, []);
  assert.deepEqual(ornamentClasses('Pand met halsgevel met gelobde afdekking (plm 1750).').classes, ['gables']);
});

test('score: ride visibility as the base when present, front metres otherwise; outside the ride-priority gebieden weighs less', () => {
  const g = {frontM: 100, streetFrontM: 120, curveDeg: 40, ornament: ['sculpture', 'relief']};
  assert.equal(score(g, true), 230);
  assert.equal(score(g, false), Math.round(100 * 2.3 * DEFAULT_THRESHOLDS.outsideRideWeight * 10) / 10);
  assert.equal(score(g, true, DEFAULT_THRESHOLDS, 500000), 1150);
});

test('register records sharing a BAG pand merge into one group', () => {
  const g = (key: string, pands: string[], text = key): MonumentGroup => ({key, kind: 'national', nr: key, title: key, url: '', pands, text, point: null});
  const out = mergeSharedPands([g('a', ['1', '2']), g('b', ['2', '3']), g('c', ['9']), g('d', ['3'])]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].keys, ['a', 'b', 'd']);
  assert.deepEqual(out[0].pands.sort(), ['1', '2', '3']);
});

test('ingestDiscovery appends accepted nominations as discovery-front rows and skips queued or drawn pands', () => {
  const queue: Queue = {version: 1, generatedAt: '', method: '', items: [{id: '111', pand: '111', name: 'x', source: 'dominant', rideVisibility: null, center: null, status: 'queued'}]};
  const n = (pand: string, rank: number, pands = [pand]): DiscoveryNomination => ({id: pand, pand, pands, key: `rce:${rank}`, name: `n${rank}`, reasons: ['curved-front'], score: 10, rank, measures: {frontM: 50}, center: [4.9, 52.37], rideVisibility: {score: 1000, routes: 3}});
  const r = ingestDiscovery(queue, [n('222', 1), n('333', 2, ['333', '111']), n('444', 3), n('555', 4)], x => x.pand === '555' ? null : {verdict: 'landmark'}, new Set(['444']), 'disc.json');
  assert.deepEqual(r.added.map(i => i.pand), ['222']);
  assert.deepEqual(r.skipped, [{pand: '333', why: 'already a queue row'}, {pand: '444', why: 'drawn by a model'}]);
  assert.equal(queue.items.at(-1)!.source, 'discovery-front');
  assert.equal(queue.items.at(-1)!.discovery!.verdict, 'landmark');
});

// The regression the rule exists for: the Winkelgalerij Raadhuisstraat (Rijksmonument 46505, modelled by hand since
// 2026-11-12, so the "already modelled" exclusion is off here), plus three look-alikes checked on panoramas 2026-11-13.
test('regression: the Winkelgalerij Raadhuisstraat and its look-alikes are nominated (real register + BAG extract)', () => {
  const r = discover({only: new Set(['rce:46505', 'rce:1768', 'gm:222058', 'rce:5922']), exclude: false, ride: null});
  const by = new Map(r.nominations.flatMap(n => n.keys.map(k => [k, n] as const)));
  const galerij = by.get('rce:46505');
  assert.ok(galerij, 'Winkelgalerij Raadhuisstraat not nominated');
  assert.deepEqual(galerij.reasons, ['long-front', 'curved-front', 'ornamented-front']);
  assert.ok(galerij.measures.frontM > 100, `front ${galerij.measures.frontM}`);
  assert.ok(galerij.measures.curveDeg >= 25, `curve ${galerij.measures.curveDeg}`);
  assert.equal(galerij.street, 'Raadhuisstraat');
  assert.equal(galerij.pands.length, 13);
  for (const [key, why] of [['rce:1768', 'curved-front'], ['gm:222058', 'curved-front'], ['rce:5922', 'curved-front']] as const) {
    assert.ok(by.get(key)?.reasons.includes(why), `${key} should be nominated with ${why}: ${JSON.stringify(by.get(key)?.reasons)}`);
  }
});
