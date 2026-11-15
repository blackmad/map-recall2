// Buurt generator kit (docs/handoffs/buurt-generators-20261115.md, round 2): erkers read from the BAG outline, the front
// straightened onto its line, the withRowFront gate (no kit or flag off: the same feature back), and the row roof hook
// (pitch band, erkers kept out of the outline cut, no kit: the roof as before).
import test from 'node:test';
import assert from 'node:assert/strict';
import { erkersOf, erkersOnCells, straightenRing, KIT_MULLION_SHARE, type BuurtKitFront, type LngLat } from './frontKit.js';
import { buurtRoofKitFor, KIT_DORMER, pitchBandM } from './roofKit.js';
import { bayDoorGeometry, variantKey, type BayVariant } from '../../bayTextures.js';
import { BAY_STYLES } from '../../bayLook.js';
import { resetRowFront, setRowFrontRecords, withRowFront, type RowFrontRecord } from '../../houseLine/rowFront.js';
import { roofPlanForFeature, roofTrianglesForOutline } from '../../roofMesh.js';

// Local metres, y towards the street (outward normal +y). An 8 m front at y=0 with a canted erker 2.6 m wide, 0.7 m deep
// (face 1.3 m) from x=4 to x=6.6, and a half erker at the right party wall from x=7 to x=8. Counter-clockwise.
const XY = (x: number, y: number) => ({ x, y });
const ring = [XY(0, -10), XY(8, -10), XY(8, 0.7), XY(7, 0.7), XY(7, 0), XY(6.6, 0), XY(5.95, 0.7), XY(4.65, 0.7), XY(4, 0), XY(0, 0)];
// The same in lng/lat around Biesboschstraat.
const LAT0 = 52.345, LNG0 = 4.897, KX = 111_320 * Math.cos(LAT0 * Math.PI / 180), KY = 110_540;
const ll = (p: { x: number; y: number }): LngLat => [LNG0 + p.x / KX, LAT0 + p.y / KY];
// Seen from the street (looking -y) left is -x... the viewer faces -n = -y, so right = (-n.y, n.x) = (-1, 0): left to right runs -x.
const line: [LngLat, LngLat] = [ll(XY(8, 0)), ll(XY(0, 0))];

test('erkersOf: a canted erker between two runs of the front, and a half erker at the party wall', () => {
  const e = erkersOf(ring, XY(8, 0), XY(0, 0), XY(0, 1));
  assert.equal(e.length, 2);
  const [half, canted] = e;
  assert.deepEqual([half.a0, +half.a1.toFixed(3), half.depthM], [0, 0.125, 0.7]);
  assert.deepEqual([+canted.a0.toFixed(3), +canted.a1.toFixed(3), canted.depthM, canted.faceM], [0.175, 0.5, 0.7, 1.3]);
});

test('straightenRing: the erkers come back onto the line, the front is one edge; a deep wing stays', () => {
  const kit = erkersOf(ring, XY(8, 0), XY(0, 0), XY(0, 1));
  const out = straightenRing([...ring.map(ll), ll(ring[0])], line, kit);
  const pts = out.slice(0, -1).map(([lng, lat]) => XY(+((lng - LNG0) * KX).toFixed(2), +((lat - LAT0) * KY).toFixed(2)));
  assert.deepEqual(pts, [XY(0, -10), XY(8, -10), XY(8, 0), XY(0, 0)]);
  // A 2 m deep wing is no erker: left as BAG draws it.
  const wing = [XY(0, -10), XY(8, -10), XY(8, 2), XY(6, 2), XY(6, 0), XY(0, 0)];
  assert.equal(erkersOf(wing, XY(8, 0), XY(0, 0), XY(0, 1)).length, 0);
  assert.equal(straightenRing([...wing.map(ll), ll(wing[0])], line, []).length, 7);
});

const feature = (id: string) => ({ type: 'Feature', properties: <Record<string, unknown>>{ id: `NL.IMBAG.Pand.${id}`, height: 16, minHeight: 0, facade: 'school', facadeStyle: 'school', constructionYear: 1929 },
  geometry: { type: 'Polygon', coordinates: [[...ring.map(ll), ll(ring[0])].map(p => [...p])] } });
const series = { id: 'test-row:s0', cornice: 'simple' as const, roofStorey: { kind: 'mansard' as const, material: 'tile' as const, dormers: [{ a: 0.5, kind: 'plain' as const, hoist: true }] }, look: { bays: 4 } };
const rec = (pandId: string, kit?: BuurtKitFront): RowFrontRecord => ({ pandId, eavesM: 12.4, topM: 12.4, storeys: 4, crown: { family: 'cornice' }, confidence: 0.8, sources: {}, series, ...(kit ? { buurtKit: kit } : {}) });
const kit: BuurtKitFront = { frontLine: line, erkers: erkersOf(ring, XY(8, 0), XY(0, 0), XY(0, 1)), roof: { pitchDeg: 52, riseM: 5 } };

test('withRowFront: a record without a kit, or the flag off, draws as before; with both, the kit is applied', () => {
  process.env.ROW_FRONT = '1'; resetRowFront();
  const g = globalThis as { __canalRecallBuurtKit?: boolean };
  try {
    setRowFrontRecords([rec('0363100012000001'), rec('0363100012000002', kit)]);
    g.__canalRecallBuurtKit = false;
    const plainOff = withRowFront(feature('0363100012000001')), kitOff = withRowFront(feature('0363100012000002'));
    g.__canalRecallBuurtKit = true;
    const plainOn = withRowFront(feature('0363100012000001')), kitOn = withRowFront(feature('0363100012000002'));
    assert.deepEqual(plainOn, plainOff, 'no kit on the record: the flag changes nothing');
    assert.deepEqual({ ...kitOff, properties: { ...kitOff.properties, id: 'x' } }, { ...plainOff, properties: { ...plainOff.properties, id: 'x' } }, 'flag off: the kit is ignored');
    assert.equal((kitOn.geometry as { coordinates: number[][][] }).coordinates[0].length, 5, 'the front straightened');
    const roof = kitOn.properties.rowRoof as { riseM: number; kit: { pitchDeg: number; erkers: unknown[]; rows: number } };
    assert.equal(roof.riseM, 5);
    assert.deepEqual([roof.kit.pitchDeg, roof.kit.erkers.length, roof.kit.rows], [52, 2, 3]);
  } finally { delete g.__canalRecallBuurtKit; process.env.ROW_FRONT = '0'; resetRowFront(); setRowFrontRecords([]); }
});

test('row roof hook: the pitch sets the street band, erkers stand past the walls uncut; no kit, no change', () => {
  process.env.ROW_FRONT = '1'; resetRowFront();
  const g = globalThis as { __canalRecallBuurtKit?: boolean };
  try {
    setRowFrontRecords([rec('0363100012000002', kit)]);
    g.__canalRecallBuurtKit = true;
    const on = withRowFront(feature('0363100012000002'));
    g.__canalRecallBuurtKit = false;
    const off = withRowFront(feature('0363100012000002'));
    const dims = { bayM: 2, storeyM: 3, cellM: 1 }, outer = (f: typeof on) => (f.geometry as { coordinates: number[][][] }).coordinates[0];
    const tris = (f: typeof on) => { const plan = roofPlanForFeature(f as never)!; const o = outer(f); return roofTrianglesForOutline(o, { lng: o[0][0], lat: o[0][1] }, plan, 12.4, dims, KX); };
    const kitTris = tris(on), plainTris = tris(off);
    assert.ok(kitTris.some(t => t.kit), 'erker triangles drawn');
    assert.ok(!plainTris.some(t => t.kit));
    // The erkers reach 0.7 m + the cap past the front wall, from the first floor up.
    const ys = kitTris.filter(t => t.kit).flatMap(t => t.p.map(p => p[2]));
    assert.ok(Math.min(...ys) < 12.4 - 8 && Math.max(...ys) > 12.4, 'first floor to over the cornice');
    assert.equal(pitchBandM(5, 10, 52), 5 / Math.tan(52 * Math.PI / 180));
    assert.equal(pitchBandM(5, 6, 52), 2.6, 'a shallow box keeps a ridge strip');
  } finally { delete g.__canalRecallBuurtKit; process.env.ROW_FRONT = '0'; resetRowFront(); setRowFrontRecords([]); }
});

// Round 3 (docs/handoffs/buurt-generators-20261115.md): erkers on the series' cells, the roof hex and dormer, the attic
// ribbon, the paired mullion and the portiek door. Everything is behind the kit; existing variants keep their keys.

test('erkersOnCells: a whole erker takes the cells it reaches into, a half one at a party wall one cell', () => {
  // Biesboschstraat 077118: BAG's 2.1 m base at 0.47-0.73 of a 7.95 m four-cell front, 0.66 m deep, canted.
  const [e] = erkersOnCells([{ a0: 0.47, a1: 0.73, depthM: 0.66, faceM: 1.0 }], 4, 7.95);
  assert.equal(+(e.a1 - e.a0).toFixed(2), 0.5, 'two cells');
  assert.equal(e.faceM, 2.19, 'canted: 55 % of the 4 m base, near the photo 2.0 m');
  const [h] = erkersOnCells([{ a0: 0, a1: 0.3, depthM: 0.8, faceM: 1.4 }], 4, 8);
  assert.deepEqual([h.a0, h.a1], [0, 0.25]);
  // A box erker keeps its face the whole base; no bays: unchanged.
  assert.equal(erkersOnCells([{ a0: 0.3, a1: 0.45, depthM: 0.5, faceM: 1.2 }], 4, 8)[0].faceM, 2);
  assert.deepEqual(erkersOnCells([{ a0: 0.3, a1: 0.45, depthM: 0.5, faceM: 1.2 }], 0, 8), [{ a0: 0.3, a1: 0.45, depthM: 0.5, faceM: 1.2 }]);
});

test('roof kit: the measured tile hex and the photo dormer on a pitched kit; a flat kit takes its coping hex and ribbon', () => {
  const pitched = buurtRoofKitFor({ erkers: [], roof: { pitchDeg: 62, roofHex: '#a15a30' } }, 12.4, 4, 3.3)!;
  assert.equal(pitched.roofHex, '#a15a30');
  assert.deepEqual(pitched.dormer, { ...KIT_DORMER });
  const flat = buurtRoofKitFor({ erkers: [], ribbon: true, copingHex: '#5b504a', joins: { left: true } }, 16.4, 5, 3.5)!;
  assert.deepEqual([flat.roofHex, flat.ribbon, flat.joins, flat.dormer], ['#5b504a', true, { left: true }, undefined]);
  assert.equal(buurtRoofKitFor({ erkers: [] }, 12.4, 4, 3.3)!.roofHex, undefined);
});

test('ribbon: drawn on the flat coping, kit triangles past the wall; paired sash reaches rowLook and rowDress', () => {
  process.env.ROW_FRONT = '1'; resetRowFront();
  const g = globalThis as { __canalRecallBuurtKit?: boolean };
  const flatSeries = { ...series, id: 'test-row:s1', roofStorey: { kind: 'none' as const, dormers: [] }, look: { bays: 4, sash: 'transom' as const } };
  const r: RowFrontRecord = { ...rec('0363100012000003', { frontLine: line, erkers: [], ribbon: true, sash: 'paired-transom', copingHex: '#5b504a' }), series: flatSeries };
  try {
    setRowFrontRecords([r]);
    g.__canalRecallBuurtKit = true;
    const on = withRowFront(feature('0363100012000003'));
    const p = on.properties as Record<string, any>;
    assert.equal(p.rowLook.sash, 'paired-transom');
    assert.equal(p.rowDress.mullionShare, KIT_MULLION_SHARE);
    assert.equal(p.rowRoof.kit.ribbon, true);
    const plan = roofPlanForFeature(on as never)!;
    assert.equal(plan.buurtKit?.roofHex, '#5b504a');
    const o = (on.geometry as { coordinates: number[][][] }).coordinates[0];
    const tris = roofTrianglesForOutline(o, { lng: o[0][0], lat: o[0][1] }, plan, 12.4, { bayM: 2, storeyM: 3, cellM: 1 }, KX);
    const zs = tris.filter(t => t.kit).flatMap(t => t.p.map(q => q[2]));
    assert.ok(zs.length && Math.min(...zs) < 12.4 - 2.5 && Math.max(...zs) < 12.4, 'the top storey, under the line');
    g.__canalRecallBuurtKit = false;
    const off = withRowFront(feature('0363100012000003')).properties as Record<string, any>;
    assert.equal(off.rowLook.sash, 'transom'); assert.equal(off.rowDress.mullionShare, undefined); assert.equal(off.rowRoof, undefined);
  } finally { delete g.__canalRecallBuurtKit; process.env.ROW_FRONT = '0'; resetRowFront(); setRowFrontRecords([]); }
});

test('painter: existing variants keep their keys and doors; the kit presets exist only under the flag', () => {
  const v: BayVariant = { archetype: 'school', kind: 'groundDoor', windows: 2, shape: 'rect', shutters: false, paintedFrames: false, family: 'masonry', proportions: 'wide', openingOccupancy: .71, openingHeight: .56, sash: 'transom', trimDensity: 'restrained', lintel: 'none', wallMaterial: 'brick' };
  // The key format before round 3, literally: a variant without the new fields keys (and so paints and caches) as before.
  assert.equal(variantKey(v, 'photo'), 'photo|school|groundDoor|2|rect|false|false|masonry|wide|pale|none|false|0.71|0.56|transom|restrained|brick|none|none|none|none');
  assert.deepEqual(bayDoorGeometry(v), { x: 520 * .14, width: 98, height: 214, bottom: 24, fanlight: false });
  const pair: BayVariant = { ...v, door: 'portiek-pair', sash: 'paired-transom', mullionShare: KIT_MULLION_SHARE };
  assert.ok(variantKey(pair, 'photo').endsWith(`|m${KIT_MULLION_SHARE}|portiek-pair`));
  assert.equal(bayDoorGeometry(pair).width, 200);
  // Flag off (the module was loaded without BUURT_KIT): the school presets are the stock two.
  assert.equal(BAY_STYLES.school.length, process.env.BUURT_KIT === '1' ? 4 : 2);
});
