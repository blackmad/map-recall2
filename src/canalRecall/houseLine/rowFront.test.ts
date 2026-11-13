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
  datum: 'street', streetGroundNAP: 1.042, groundNAP: 0.84, frontTopM: null, frontTopKind: null,
  threeDBag: { frontEavesM: null, roofMinM: null, dak50pM: null, dak70pM: null, roofMaxM: null },
  crown: { family: null, widthM: null, neckWidthM: null, shoulderM: null, topM: null, ornamentTopM: null, dormer: null, atticWindows: null, hoist: null, note: null },
  storeys: null, groundStoreyTopM: null, rows: [], bays: null, wall: { hex: null, word: null, ref: null, rawHex: null, gain: null, finish: null, finishFrom: null, source: null, confidence: 'low' }, trim: { hex: null, word: null, ref: null },
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

// Step d: the measured windows' height share and the nearest dressed preset (HD20 167818: rows 5.58-7.48 and 8.13-9.68).
import { windowShare } from './rowFront.ts';
import { BAY_STYLES, rowFrontStyle } from '../bayLook.ts';
test('row front step d: HD20 window share and preset', () => {
  const h = windowShare({ pandId: 'x', topM: 12.88, eavesM: 10.18, crown: { family: 'neck' }, confidence: 0.9, sources: {}, rows: [{ sillM: 5.58, headM: 7.48 }, { sillM: 8.13, headM: 9.68 }], groundTopM: 5.08 }, 10.18)!;
  assert.ok(h > 0.6 && h < 0.8, `share ${h}`);
  const i = rowFrontStyle('canal', h, false, 2)!, v = BAY_STYLES.canal[i];
  assert.ok(v.openingOccupancy! >= 0.55 && !v.paleAccents && 2 % v.windows === 0, JSON.stringify(v));
});

// Strip review 2026-11-13: the fascia keeps the photo's shopfront colour, muted (not one dark band for every shop);
// none read keeps the dark band.
import { rowFrontShopHex, skylineGable, levels } from './rowFront.ts';
import { hexToOklab } from '../houseSpec/wallColour.ts';
test('row front shop band: the photo colour muted, the dark band without one', () => {
  assert.equal(rowFrontShopHex(undefined), ROW_FRONT_SHOP_HEX);
  const red = hexToOklab('#c0392b'), muted = hexToOklab(rowFrontShopHex('#c0392b'));
  assert.ok(Math.hypot(muted[1], muted[2]) < 0.6 * Math.hypot(red[1], red[2]));
  const cream = hexToOklab(rowFrontShopHex('#e3dccb'));
  assert.ok(cream[0] <= 0.821 && cream[0] > 0.75);
  const base = { ...feature('0363100012167816', 11.84), properties: { ...feature('0363100012167816', 11.84).properties, shopKind: 'shopCafe', rowFront: 'cornice', houseSpec: { shopHex: '#242122' } } };
  assert.equal(meshBuildingFor(base as never, 'photo')!.accentHex, rowFrontShopHex('#242122'));
});

// Named regression 167820 (Haarlemmerdijk 26): a seam-cut front (no strip read) whose skyline shows a gable 2.2 m over
// the row line across 60 % of its width draws a neck gable from the skyline, not a flat cornice.
test('row front skyline gable: 167820 neck from its skyline, a flat skyline stays a cornice', () => {
  const rec: RowFrontRecord = { pandId: '0363100012167820', topM: 12.65, eavesM: 12.65, crown: { family: 'cornice' }, confidence: 0.4, fallback: 'row-line', sources: {},
    skyline: { frontTopM: 12.43, footM: 12.3, peakM: 14.65, crownShare: 0.6, readShare: 0.99 } };
  const g = skylineGable(rec)!;
  assert.equal(g.crown.family, 'neck'); assert.equal(g.eavesM, 12.3); assert.equal(g.topM, 14.65); assert.ok(g.crownFromSkyline);
  assert.equal(skylineGable({ ...rec, skyline: { ...rec.skyline, peakM: 12.8, crownShare: 0 } }), null);
  assert.equal(skylineGable({ ...rec, fallback: undefined }), null);
});

// Step d option c: a measured record hands the mesher its boxes, one per bay on each row (HD20 167818: 2 bays, 2 rows).
test('row front levels: window boxes per bay on each measured row', () => {
  const rec: RowFrontRecord = { pandId: '0363100012167818', topM: 12.88, eavesM: 10.18, crown: { family: 'neck' }, confidence: 1, sources: {}, storeys: 3, bays: 2,
    rows: [{ sillM: 5.58, headM: 7.48 }, { sillM: 8.13, headM: 9.68 }], groundTopM: 5.08 };
  const boxes = (levels(null, rec, 10.18, false).specRecipe as { windowBoxes: Array<{ a0: number; a1: number; sillM: number; headM: number }> }).windowBoxes;
  assert.equal(boxes.length, 4);
  assert.ok(Math.abs((boxes[0].a0 + boxes[0].a1) / 2 - 0.25) < 1e-9 && Math.abs(boxes[0].a1 - boxes[0].a0 - 0.32) < 1e-9);
  assert.equal(boxes[2].sillM, 8.13);
});

// Step d proper: lane 2's traced openings become the mesher's boxes (HD20 167818: 2 + 3 upper windows; the attic light
// over the gable foot stays with the crown), in the pand datum, with the fascia colour; and boxes too close for their
// frames share the gap instead of falling back to the grid.
import { readFileSync } from 'node:fs';
import { placeOnBoxes } from './boxPlacement.ts';
test('row front traces: HD20 traced windows to boxes, attic left to the crown, fascia carried', () => {
  const table = JSON.parse(readFileSync(new URL('../../../data/front-records/haarlemmerdijk-block.json', import.meta.url), 'utf8'));
  const recs = rowFrontsFromTable(table);
  const r = recs.find(x => x.pandId.endsWith('167818'))!;
  assert.equal(r.windows!.length, 5);
  assert.ok(r.windows!.every(w => w.kind !== 'attic' && w.a0 >= 0 && w.a1 <= 1 && w.a1 > w.a0));
  const fr = table.records.find((x: FrontRecord) => x.pandId.endsWith('167818'));
  assert.equal(r.windows![0].sillM, toPandDatum(fr, 5.6));
  assert.match(r.fasciaHex!, /^#[0-9a-f]{6}$/);
  const unit = { aspect: 0.7, margin: { l: 0.15, r: 0.15, t: 0.1, b: 0.2 }, uv: { u0: 0.1, u1: 0.4, v0: 0.2, v1: 0.8 } };
  const p = placeOnBoxes([{ a0: 0.45, a1: 1.45, sillM: 4, headM: 5.45 }, { a0: 1.55, a1: 2.5, sillM: 4, headM: 5.45 }], unit, { lengthM: 3.77, z0: 3.5, z1: 8 })!;
  assert.ok(p && Math.abs(p.windows[0].a1 - 1.5) < 1e-9 && Math.abs(p.windows[1].a0 - 1.5) < 1e-9);
});

// Sub-fronts, named regression HD22/24 (167819: one BAG pand, two houses 3.95 + 3.77 m): one record for the mesh with the
// taller front's top, both fronts' traced windows, and each front's span and wall colour for the tint and party break.
test('row front sub-fronts: HD22/24 merged for the mesh, spans and colours per front', () => {
  const table = JSON.parse(readFileSync(new URL('../../../data/front-records/haarlemmerdijk-block.json', import.meta.url), 'utf8'));
  const fr = table.records.find((x: FrontRecord) => x.pandId.endsWith('167819'));
  const r = rowFrontsFromTable(table).find(x => x.pandId.endsWith('167819'))!;
  assert.equal(r.fallback, undefined);
  assert.equal(r.eavesM, toPandDatum(fr, Math.max(...fr.fronts.map((f: { frontTopM: number }) => f.frontTopM))));
  assert.equal(r.subFronts!.length, 2);
  assert.ok(Math.abs(r.subFronts![0].a1 - 3.95 / fr.bagWidthM) < 0.002 && r.subFronts![0].wallHex !== r.subFronts![1].wallHex);
  assert.ok(r.windows!.some(w => w.a1 <= r.subFronts![0].a1) && r.windows!.some(w => w.a0 >= r.subFronts![1].a0));
});

// Ground floors from the trace, named regression HD2 (167821: shop 0.2-0.85, door 0.85-2.3, shop 2.3-3.7 on 4.33 m):
// the ground openings keep their order and kinds as fractions of the front, and levels() hands them to the mesher.
test('row front ground: HD2 traced door and shop windows become the ground boxes', () => {
  const table = JSON.parse(readFileSync(new URL('../../../data/front-records/haarlemmerdijk-block.json', import.meta.url), 'utf8'));
  const r = rowFrontsFromTable(table).find(x => x.pandId.endsWith('167821'))!;
  assert.deepEqual(r.ground!.map(g => g.kind), ['shop', 'door', 'shop']);
  assert.ok(Math.abs(r.ground![1].a0 - 0.85 / 4.33) < 0.002 && Math.abs(r.ground![1].a1 - 2.3 / 4.33) < 0.002);
  const sr = levels(null, { ...r, storeys: r.storeys ?? 4 }, r.eavesM ?? 15.9, false).specRecipe as { groundBoxes?: unknown[] };
  assert.equal(sr.groundBoxes?.length, 3);
});

// Stepped wall top, named regression HD22/24 (167819): each sub-front keeps its own top and crown. HD24 (left as seen,
// 3.95 m): a raised white attic 3.6 m wide on a cornice at 12.3 m; HD22 (3.77 m): a crowned dormer on 13.25 m.
import { stepCrown } from './rowFront.ts';
test('row front steps: HD22/24 sub-fronts stand to their own tops with their own crowns', () => {
  const table = JSON.parse(readFileSync(new URL('../../../data/front-records/haarlemmerdijk-block.json', import.meta.url), 'utf8'));
  const r = rowFrontsFromTable(table).find(x => x.pandId.endsWith('167819'))!;
  const [left, right] = r.subFronts!.map(f => stepCrown(f, (f.a1 - f.a0) * r.spanM!)!);
  assert.ok(left.wallTopM < right.wallTopM - 0.5, `${left.wallTopM} ${right.wallTopM}`);
  assert.equal(left.crown?.shape, 'raised'); assert.equal(left.crown?.neckW, 3.6);
  assert.equal(right.crown?.shape, 'raised'); assert.ok(right.crown!.neckW === undefined);
  const prev = process.env.ROW_FRONT;
  process.env.ROW_FRONT = '1';
  try {
    setRowFrontRecords([r]);
    const f = withRowFront({ properties: { id: `NL.IMBAG.Pand.${r.pandId}`, height: 14 } as Record<string, unknown>, geometry: null });
    assert.equal(f.properties.rowFrontSteps, true);
    assert.equal(f.properties.height, right.wallTopM);
    assert.equal((f.properties.specRecipe as { subFronts: Array<{ step: unknown }> }).subFronts.length, 2);
  } finally { if (prev === undefined) delete process.env.ROW_FRONT; else process.env.ROW_FRONT = prev; setRowFrontRecords([]); }
});
