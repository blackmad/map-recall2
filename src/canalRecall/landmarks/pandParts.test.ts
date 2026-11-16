import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPandParts, fullPand, isPartFeatureId, partFeatureId, splitPand, splitPandOwners, splitPandsOf, type TileFeature } from './pandParts';
import { multiPolygonAreaM2 } from '../buildingPassages';

// A 40 m x 20 m pand at Amsterdam's latitude; the model owns the eastern half.
const LAT = 52.37, KX = 111_320 * Math.cos((LAT * Math.PI) / 180), KY = 111_320;
const at = (x: number, y: number): [number, number] => [4.89 + x / KX, LAT + y / KY];
const PAND = 'NL.IMBAG.Pand.0363100012167627';
const feature = (): TileFeature => ({
  type: 'Feature',
  properties: { id: PAND, tier: 3, minHeight: 0, height: 22.5, roof: 3, year: 1912 },
  geometry: { type: 'Polygon', coordinates: [[at(0, 0), at(40, 0), at(40, 20), at(0, 20), at(0, 0)]] },
});
// Overshoots the pand on three sides; only the line x = 20 matters.
const ring = [at(20, -5), at(50, -5), at(50, 25), at(20, 25)];
const area = (f: TileFeature | null) => multiPolygonAreaM2(f?.geometry.type === 'Polygon' ? [f.geometry.coordinates as never] : (f?.geometry.coordinates ?? []) as never);

test('ids: the part id names the model and the pand, and never collides with bagGaps/passage parts', () => {
  assert.equal(fullPand('0363100012167627'), PAND);
  assert.equal(fullPand(PAND), PAND);
  assert.throws(() => fullPand('w123'));
  assert.equal(partFeatureId('handelsbank-singel-250', PAND), 'landmark-part:handelsbank-singel-250:0363100012167627');
  assert.ok(isPartFeatureId('landmark-part:x:0363100012167627'));
  assert.ok(!isPartFeatureId('part:NL.IMBAG.Pand.0363100012145715:0'));
  assert.ok(!isPartFeatureId('passage:NL.IMBAG.Pand.0363100012145715:0'));
});

test('splitPand: the part is the ring inside the pand, the rest keeps the id and every property', () => {
  const f = feature();
  const before = JSON.stringify(f);
  const r = splitPand(f, 'bank', ring);
  assert.equal(JSON.stringify(f), before, 'input untouched');
  assert.ok(Math.abs(r.partM2 - 400) < 1, `part ${r.partM2}`);
  assert.ok(Math.abs(r.restM2 - 400) < 1, `rest ${r.restM2}`);
  assert.ok(Math.abs(area(r.part) - 400) < 1 && Math.abs(area(r.rest) - 400) < 1);
  assert.deepEqual(r.rest!.properties, f.properties);
  assert.equal(r.part!.properties.id, 'landmark-part:bank:0363100012167627');
  assert.equal(r.part!.properties.pand, PAND);
  assert.equal(r.part!.properties.landmark, 'bank');
  assert.equal(r.part!.properties.height, 22.5);
  // Every rest vertex lies west of the cut line (x <= 20 m), every part vertex east of it (1e-7 deg rounding: < 1 cm).
  const xs = (g: TileFeature) => (g.geometry.coordinates as number[][][]).flat().map(p => (p[0] - 4.89) * KX);
  assert.ok(xs(r.rest!).every(x => x <= 20.01));
  assert.ok(xs(r.part!).every(x => x >= 19.99));
});

test('splitPand: slivers under 2 m2 are dropped, a ring covering the pand leaves no rest', () => {
  const sliver = splitPand(feature(), 'bank', [at(-5, -5), at(39.95, -5), at(39.95, 25), at(-5, 25)]);
  assert.equal(sliver.rest, null, 'a 0.05 m x 20 m strip is not drawn');
  const miss = splitPand(feature(), 'bank', [at(100, 100), at(110, 100), at(110, 110)]);
  assert.equal(miss.part, null);
  assert.ok(Math.abs(miss.restM2 - 800) < 1);
});

test('applyPandParts: byte-identical without declarations; other features pass through as the same objects', () => {
  const other: TileFeature = { type: 'Feature', properties: { id: 'NL.IMBAG.Pand.0363100012000001', height: 9 }, geometry: { type: 'Polygon', coordinates: [[at(50, 0), at(60, 0), at(60, 10), at(50, 0)]] } };
  const tile = [feature(), other];
  const none = applyPandParts(tile, [{ id: 'bank' }, { id: 'tower', pandParts: [] }]);
  assert.equal(JSON.stringify(none.features), JSON.stringify(tile));
  assert.deepEqual(none.split, []);
  const cut = applyPandParts(tile, [{ id: 'bank', pandParts: [{ pand: '0363100012167627', ring }] }]);
  assert.equal(cut.features.length, 3);
  assert.equal(cut.features[1].properties.id, 'landmark-part:bank:0363100012167627');
  assert.strictEqual(cut.features[2], other);
});

test('applyPandParts: re-runs cut the original again; a removed declaration restores it', () => {
  const tile = [feature()];
  const first = applyPandParts(tile, [{ id: 'bank', pandParts: [{ pand: PAND, ring }] }]);
  const originals = new Map(first.split.map(s => [s.pand, s.original] as const));
  const moved = [at(30, -5), at(50, -5), at(50, 25), at(30, 25)];
  const again = applyPandParts(first.features, [{ id: 'bank', pandParts: [{ pand: PAND, ring: moved }] }], originals);
  assert.equal(again.features.length, 2);
  assert.ok(Math.abs(again.split[0].partM2 - 200) < 1, 'cut from the 800 m2 original, not the 400 m2 rest');
  const removed = applyPandParts(again.features, [], originals);
  assert.equal(JSON.stringify(removed.features), JSON.stringify(tile));
});

test('splitPandOwners: one owner per pand', () => {
  assert.deepEqual(splitPandsOf({ id: 'bank', pandParts: [{ pand: '0363100012167627', ring }] }), [PAND]);
  assert.equal(splitPandOwners([{ id: 'bank', pandParts: [{ pand: PAND, ring }] }]).get(PAND), 'bank');
  assert.throws(() => splitPandOwners([{ id: 'a', pandParts: [{ pand: PAND, ring }] }, { id: 'b', pandParts: [{ pand: PAND, ring }] }]));
});

test('splitPand: declared rest heights replace the pand height on the rest only, for keys the tile carries', () => {
  const r = splitPand(feature(), 'bank', ring, { height: 14.2, eaves: 11, ridge: 16 });
  assert.equal(r.rest!.properties.height, 14.2);
  assert.equal(r.rest!.properties.eaves, undefined, 'no eaves key on this feature, none added');
  assert.equal(r.part!.properties.height, 22.5);
  const bag = feature(); bag.properties.eaves = 4.7; bag.properties.ridge = 24;
  const r2 = splitPand(bag, 'bank', ring, { height: 14.2, eaves: 11, ridge: 16 });
  assert.deepEqual([r2.rest!.properties.eaves, r2.rest!.properties.ridge, r2.part!.properties.ridge], [11, 16, 24]);
});
