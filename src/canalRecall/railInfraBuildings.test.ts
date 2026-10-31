// railInfraBuildings.ts: railway infrastructure registered as buildings draws as that infrastructure (lane rail-look
// round 3; user at Amstel 2026-10-31: "that big flat white thing is weird", "the houses under the tracks here are
// probably wrong").
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRailInfra, classifyRailInfra, composeTileEnrichers, infraShares, railInfraEnricher, type RailInfraTable, type Vec2 } from './railInfraBuildings.ts';

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

test('infraShares: track corridor and platforms over a footprint', () => {
  const track: Vec2[] = [[-50, 0], [150, 0]];
  // A 100 × 4 m strip on the track: all of it under track.
  assert.ok(infraShares([rect(0, -2, 100, 2)], [track], []).cover > 0.99);
  // A 100 × 40 m hall beside it: mostly off the tracks.
  assert.ok(infraShares([rect(0, 5, 100, 45)], [track], []).cover < 0.05);
  // A platform under half of a canopy outline (a long platform whose vertices all lie far from the outline counts).
  const s = infraShares([rect(40, -10, 60, 10)], [], [rect(-200, 0, 300, 10)]);
  assert.ok(Math.abs(s.platform - 0.5) < 0.06, `platform ${s.platform}`);
});

test('classify: the Amstel cases and what must stay', () => {
  const on = { cover: 0.98, platform: 0.55, samples: 10000 };
  // The OSM roof over all the platforms: a canopy.
  assert.equal(classifyRailInfra({ id: 'w1302881959', minHeight: 8, height: 9, osmBuilding: 'roof' }, on).kind, 'canopy');
  // The station pand's part under the platforms, under that roof: the deck, dropped, whatever its pand's use.
  assert.equal(classifyRailInfra({ id: 'part:NL.IMBAG.Pand.0363100012145715:0', minHeight: 0, height: 13.79 }, { cover: 0.99, platform: 0.57, roofed: 1, samples: 614 }, null).kind, 'viaduct');
  // A low pand wholly under elevated track, no use: the viaduct.
  assert.equal(classifyRailInfra({ id: 'NL.IMBAG.Pand.x', minHeight: 0, height: 4.1 }, { cover: 1, platform: 0, samples: 70 }, { status: 'Pand in gebruik', vbos: 0, area: {} }, 70).kind, 'viaduct');
  // The same with an office in its arch (the Westerpark viaduct's workshops): kept.
  assert.equal(classifyRailInfra({ id: 'NL.IMBAG.Pand.y', minHeight: 0, height: 4.1 }, { cover: 1, platform: 0, samples: 70 }, { status: 'Pand in gebruik', vbos: 1, area: { kantoorfunctie: 63 } }, 70).kind, null);
  // A station hall: taller than a viaduct, or much of it off the tracks.
  assert.equal(classifyRailInfra({ id: 'h', minHeight: 0, height: 18 }, { cover: 0.9, platform: 0.2, samples: 3000 }).kind, null);
  assert.equal(classifyRailInfra({ id: 'h2', minHeight: 0, height: 8 }, { cover: 0.4, platform: 0.1, samples: 3000 }).kind, null);
  // Centraal's arched shed roofs and the hotel over the platforms: kept.
  assert.equal(classifyRailInfra({ id: 'w451533145', minHeight: 8, height: 9, osmPart: 'roof', roofShape: 'round' }, on).kind, null);
  assert.equal(classifyRailInfra({ id: 'w757595921', minHeight: 6, height: 9, osmPart: 'hotel' }, on).kind, null);
  // A floating building away from the tracks is not a canopy.
  assert.equal(classifyRailInfra({ id: 'f', minHeight: 6, height: 9 }, { cover: 0.3, platform: 0, samples: 400 }).kind, null);
  // A station's live use on a tiny share of a big standing pand on the platforms (the complex's VBO on every pand):
  // judged on its geometry, a platform canopy measured to its roof.
  const c = classifyRailInfra({ id: 'p', minHeight: 0, height: 10.3 }, { cover: 1, platform: 0.64, samples: 1000 }, { status: 'Pand in gebruik', vbos: 1, area: { bijeenkomstfunctie: 40 } }, 1000);
  assert.equal(c.kind, 'canopy'); assert.equal(c.top, true);
});

test('applyRailInfra: a viaduct goes, a canopy becomes its thin pieces over the platforms', () => {
  const table: RailInfraTable = { version: 1, source: 't', ids: { v: 'viaduct', c: 'canopy', s: 'canopy' }, canopies: { c: [{ ring: [[4.9, 52.3], [4.9001, 52.3], [4.9001, 52.3001]] }], s: [{ ring: [[4.9, 52.3], [4.9001, 52.3], [4.9001, 52.3001]] }] }, canopyBase: { s: 10.5 } };
  const g = { type: 'Polygon', coordinates: [[[4.9, 52.3], [4.9001, 52.3], [4.9001, 52.3001], [4.9, 52.3]]] };
  const features: { properties: Record<string, unknown>; geometry: typeof g }[] = [{ properties: { id: 'v', minHeight: 0, height: 4 }, geometry: g }, { properties: { id: 'keep', minHeight: 0, height: 9 }, geometry: g }, { properties: { id: 'c', minHeight: 8, height: 9, tier: 2 }, geometry: g }, { properties: { id: 's', minHeight: 0, height: 11, tier: 3 }, geometry: g }];
  const r = applyRailInfra(features, table);
  assert.deepEqual(r, { viaducts: 1, canopies: 2, pieces: 2 });
  const ids = features.map(f => f.properties.id);
  assert.deepEqual(ids.sort(), ['c:canopy:0', 'keep', 's:canopy:0']);
  const c = features.find(f => f.properties.id === 'c:canopy:0')!.properties, s = features.find(f => f.properties.id === 's:canopy:0')!.properties;
  assert.equal(c.minHeight, 8); assert.ok(Number(c.height) - 8 < 0.6); assert.equal(c.kitWall, 'flat');
  assert.equal(s.minHeight, 10.5);
});

test('railInfraEnricher: fetched once, a missing table changes nothing; composes after the facts enricher', async () => {
  let fetches = 0;
  const table: RailInfraTable = { version: 1, source: 't', ids: { v: 'viaduct' }, canopies: {} };
  const e = railInfraEnricher('/x', async () => { fetches++; return table; });
  const tile = { z: 14, x: 1, y: 1 }, signal = new AbortController().signal;
  const f1 = [{ properties: { id: 'v' }, geometry: null }, { properties: { id: 'k' }, geometry: null }];
  (await e(tile, signal))!(f1); (await e(tile, signal));
  assert.equal(fetches, 1); assert.deepEqual(f1.map(f => f.properties.id), ['k']);
  const none = railInfraEnricher('/x', async () => null);
  assert.equal(await none(tile, signal), undefined);
  // The facts enricher stamps by id before the table drops a feature.
  const order: string[] = [];
  const facts = async () => (fs: { properties: Record<string, unknown> }[]) => { order.push(`facts:${fs.length}`); };
  const both = composeTileEnrichers(facts as never, e);
  (await both(tile, signal))!([{ properties: { id: 'v' }, geometry: null }]);
  assert.deepEqual(order, ['facts:1']);
});
