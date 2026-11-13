// Lane 1 steps a and b (rowFront.ts): flag off is the same object; a cornice record draws its wall to the measured top
// with a flat lid; a gabled record puts the planner's eaves on the measured foot. Named regressions: Haarlemmerdijk 16
// (0363100012167816, cornice top 11.6 m against 3DBAG 8.7 m) and Haarlemmerdijk 20 (0363100012167818, neck foot 10.2 m).
import test from 'node:test';
import assert from 'node:assert/strict';
import { resetRowFront, setRowFrontRecords, withRowFront, type RowFrontRecord } from './rowFront.ts';

const ring = (w: number, d: number) => [[[0, 0], [w / 111320 / 0.61, 0], [w / 111320 / 0.61, d / 111320], [0, d / 111320], [0, 0]].map(([x, y]) => [4.888 + x, 52.381 + y])];
const feature = (id: string, height: number, extra: Record<string, unknown> = {}) => ({ type: 'Feature', properties: <Record<string, unknown>>{ id: `NL.IMBAG.Pand.${id}`, height, minHeight: 0, facade: 'canal', facadeStyle: 'canal', constructionYear: 1700, ...extra }, geometry: { type: 'Polygon', coordinates: ring(4, 14) } });
const rec = (pandId: string, eavesM: number, topM: number, family: RowFrontRecord['crown']['family']): RowFrontRecord => ({ pandId, eavesM, topM, crown: { family }, confidence: 0.85, sources: {} });

test('row front: flag off returns the same object', () => {
  const env = process.env.ROW_FRONT;
  try {
    delete process.env.ROW_FRONT; resetRowFront();
    setRowFrontRecords([rec('0363100012167816', 11.6, 11.6, 'cornice')]);
    const f = feature('0363100012167816', 10.29, { roofEavesHeightM: 8.7, roofPlanned: true, roofShape: 'gable', monumentGable: 'neck' });
    assert.equal(withRowFront(f), f);
  } finally { if (env === undefined) delete process.env.ROW_FRONT; else process.env.ROW_FRONT = env; resetRowFront(); }
});

test('row front: Haarlemmerdijk 16 cornice front rises to its measured 11.6 m top, flat lid, register gable held', () => {
  const env = process.env.ROW_FRONT;
  try {
    process.env.ROW_FRONT = '1'; resetRowFront();
    setRowFrontRecords([rec('0363100012167816', 11.6, 11.6, 'cornice')]);
    const out = withRowFront(feature('0363100012167816', 10.29, { roofEavesHeightM: 8.7, roofPlanned: true, roofShape: 'gable', monumentGable: 'neck', specRecipe: { storeys: 3, eavesM: 7.5 } }));
    const p = out.properties;
    assert.equal(p.height, 11.6); assert.equal(p.roofEavesHeightM, 11.6); assert.equal(p.roofPlanned, false); assert.equal(p.roofShape, 'flat');
    assert.equal(p.monumentGable, undefined); assert.equal(p.historicGable, 'neck');
    assert.deepEqual(p.specRecipe, { storeys: 3, eavesM: 11.6, corniceCrown: true });
    // A pand without a record is untouched.
    const other = feature('0363100012000001', 10);
    assert.equal(withRowFront(other), other);
  } finally { if (env === undefined) delete process.env.ROW_FRONT; else process.env.ROW_FRONT = env; resetRowFront(); }
});

test('row front: Haarlemmerdijk 20 neck front keeps its gable with the saddle eaves on the measured 10.2 m foot', () => {
  const env = process.env.ROW_FRONT;
  try {
    process.env.ROW_FRONT = '1'; resetRowFront();
    setRowFrontRecords([rec('0363100012167818', 10.2, 11.4, 'neck')]);
    const p = withRowFront(feature('0363100012167818', 9.29, { roofEavesHeightM: 7.7, roofPlanned: true, roofShape: 'gable' })).properties;
    assert.equal(p.monumentGable, 'neck'); assert.equal(p.roofPlanned, true);
    assert.ok(Math.abs(Number(p.roofEavesHeightM) - 10.2) < 0.02, `eaves ${p.roofEavesHeightM}`);
    assert.ok(Number(p.height) > 10.2);
  } finally { if (env === undefined) delete process.env.ROW_FRONT; else process.env.ROW_FRONT = env; resetRowFront(); }
});

// Lane 2's table through the adapter. DATUM: lane 2's heights are above the face's street ground; the renderer's are
// above the pand's own 3DBAG ground, so pand height = value + streetGroundNAP - groundNAP.
import { rowFrontFromRecord, rowFrontsFromTable, toPandDatum } from './rowFront.ts';
import type { FrontRecord } from './frontRecord.ts';
const lane2 = (pandId: string, extra: Partial<FrontRecord> = {}): FrontRecord => ({
  pandId, address: null, street: 'Haarlemmerdijk', face: 'haarlemmerdijk-117-143', side: 'odd', builtYear: 1700, bagWidthM: 5,
  streetGroundNAP: 1.042, groundNAP: 0.84, frontTopM: null, frontTopKind: null,
  threeDBag: { frontEavesM: null, roofMinM: null, dak50pM: null, dak70pM: null, roofMaxM: null },
  crown: { family: null, widthM: null, neckWidthM: null, shoulderM: null, topM: null, ornamentTopM: null, dormer: null, atticWindows: null, hoist: null, note: null },
  storeys: null, groundStoreyTopM: null, rows: [], bays: null, wall: { hex: null, word: null, ref: null }, trim: { hex: null, word: null, ref: null },
  sources: [], confidence: 'low', fallback: 'row-line', nothingLocal: false, conflicts: [], notes: [], ...extra,
});

test('row front adapter: the street datum moves to the pand ground (Haarlemmerdijk 143, 169539: bell foot 8.7 m street = 8.9 m own)', () => {
  assert.equal(toPandDatum({ streetGroundNAP: 1.042, groundNAP: 0.84 }, 8.7), 8.9);
  assert.equal(toPandDatum({ streetGroundNAP: 2.258, groundNAP: 2.28 }, 10.2), 10.18);
  assert.equal(toPandDatum({ streetGroundNAP: 2.0, groundNAP: null }, 10), 10);
  const r = rowFrontFromRecord(lane2('0363100012169539', {
    frontTopM: 8.7, frontTopKind: 'gable-foot', confidence: 'medium', fallback: undefined, storeys: 2, groundStoreyTopM: 4.4, rows: [{ sillM: 5.4, headM: 7 }],
    crown: { family: 'bell', widthM: 4.5, neckWidthM: 2.3, shoulderM: 8.7, topM: 10.9, ornamentTopM: 11.6, dormer: null, atticWindows: 1, hoist: null, note: null },
  }));
  assert.equal(r.eavesM, 8.9); assert.equal(r.topM, 11.1); assert.equal(r.crown.family, 'bell'); assert.equal(r.crown.riseM, 2.2);
  assert.equal(r.crown.widthM, 4.5); assert.equal(r.crown.neckWidthM, 2.3); assert.deepEqual(r.rows, [{ sillM: 5.6, headM: 7.2 }]); assert.equal(r.groundTopM, 4.6);
});

test('row front adapter: a row-line record takes its measured neighbours median in the street datum, then its own ground', () => {
  const a = lane2('0363100012000001', { frontTopM: 10, frontTopKind: 'cornice-top', confidence: 'high', fallback: undefined, groundNAP: 1.0 });
  const b = lane2('0363100012000002', { groundNAP: 0.5 });
  const c = lane2('0363100012000003', { frontTopM: 12, frontTopKind: 'cornice-top', confidence: 'high', fallback: undefined, groundNAP: 1.5 });
  const [, rb] = rowFrontsFromTable({ records: [a, b, c] });
  assert.equal(rb.fallback, 'row-line'); assert.equal(rb.crown.family, 'cornice');
  // median of 10 and 12 (index floor(2/2) = 12) in the street datum, + 1.042 - 0.5
  assert.equal(rb.eavesM, 12.54); assert.equal(rb.topM, 12.54);
  // No measured neighbour: the interim read, else null.
  const lone = rowFrontFromRecord(b, [b], { pandId: b.pandId, eavesM: 9.5, topM: 9.5, crown: { family: 'cornice' }, confidence: 0.6, sources: { eaves: 'skyline' } });
  assert.equal(lone.eavesM, 9.5);
  assert.equal(rowFrontFromRecord(b, [b]).eavesM, null);
});

// Step e (subtract before adding): a front record's house draws only the plain extras, a dark plain shop window, no
// block surrounds; without `rowFront` the same feature builds as before. Regression: Haarlemmerdijk 16 (167816).
import { meshBuildingFor } from '../threeBuildingFeatures.ts';
import { ROW_FRONT_EXTRAS, ROW_FRONT_SHOP_HEX } from './rowFront.ts';
test('row front step e: plain extras, a dark plain shopfront, the plain preset; untouched without rowFront', () => {
  const base = { ...feature('0363100012167816', 11.84), properties: { ...feature('0363100012167816', 11.84).properties, shopKind: 'shopCafe', shopColour: '#c0392b', shopSignature: [0.2, 0.8] } };
  const plain = meshBuildingFor(base as never, 'photo')!;
  const rf = meshBuildingFor({ ...base, properties: { ...base.properties, rowFront: 'cornice' } } as never, 'photo')!;
  assert.equal(plain.onlyExtras, undefined); assert.equal(plain.accentHex, '#c0392b'); assert.ok(plain.signature);
  assert.deepEqual(rf.onlyExtras, [...ROW_FRONT_EXTRAS]);
  assert.equal(rf.accentHex, ROW_FRONT_SHOP_HEX); assert.equal(rf.signature, undefined);
  for (const id of ['flower-boxes', 'iron-balconies', 'juliet-balcony', 'cornice-vases', 'corner-pilasters', 'door-canopy']) assert.ok(!rf.onlyExtras!.includes(id), id);
});
