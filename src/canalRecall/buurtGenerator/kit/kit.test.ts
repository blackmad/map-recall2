// Buurt generator kit (docs/handoffs/buurt-generators-20261115.md, round 2): erkers read from the BAG outline, the front
// straightened onto its line, the withRowFront gate (no kit or flag off: the same feature back), and the row roof hook
// (pitch band, erkers kept out of the outline cut, no kit: the roof as before).
import test from 'node:test';
import assert from 'node:assert/strict';
import { erkersOf, erkersOnCells, straightenRing, KIT_MULLION_SHARE, type BuurtKitFront, type LngLat } from './frontKit.js';
import { buurtRoofKitFor, drawKitFront, kitDrawsFront, EAVES_LOOK, ENTRY_LOOK, LOGGIA_LOOK, KIT_DORMER, PIER_LOOK, RIBBON_LOOK, pitchBandM, type BuurtRoofKit } from './roofKit.js';
import { RoofSink } from '../../roofSink.js';
import { kitWantsCoping } from './frontKit.js';
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
  // A 2.1 m base at 0.30-0.56 of a 7.95 m four-cell front, 0.66 m deep, canted: the middle two cells.
  const [e] = erkersOnCells([{ a0: 0.3, a1: 0.56, depthM: 0.66, faceM: 1.0 }], 4, 7.95);
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
  assert.equal(BAY_STYLES.school.length, process.env.BUURT_KIT === '0' ? 2 : 4);
});

// Round 4: the series pattern (rhythm), the block piers, the Rooseveltlaan eaves, all on the street end of the row roof.
// A sink in the identity frame: the front end is x = L/2, c (left to right as seen) is y, z up from the series line.
const L4 = 10, W4 = 8;
const sink = () => new RoofSink({ cx: 0, cy: 0, ux: 1, uy: 0 } as never, 0, { bayM: 2, storeyM: 3, cellM: 1 } as never);
const kit4 = (k: Partial<BuurtRoofKit>): BuurtRoofKit => ({ erkers: [], z0: -12.9, storeyM: 3.225, rows: 4, capM: 0.2, ...k });

test('roof kit for round 4: dormers:false drops the dormer, eavesM gives the eaves, sides only with a ribbon or rhythm', () => {
  const eaves = buurtRoofKitFor({ erkers: [], roof: { pitchDeg: 35, dormers: false, eavesM: 0.9 }, joins: { left: true, right: true } }, 13.1, 4, 3.2)!;
  assert.deepEqual([eaves.dormer, eaves.eaves, eaves.joins], [undefined, { overhangM: 0.9 }, { left: true, right: true }]);
  assert.ok(kitDrawsFront(eaves));
  const ribbon = buurtRoofKitFor({ erkers: [], ribbon: true, rhythm: true, sides: { left: 'pier', right: 'pair' } }, 16.4, 5, 3.5)!;
  assert.deepEqual([ribbon.rhythm, ribbon.sides], [true, { left: 'pier', right: 'pair' }]);
  // Rhythm is the plain wall's pattern: with erkers the erkers say the rhythm, and sides without a ribbon or rhythm are dropped.
  const erk = buurtRoofKitFor({ erkers: [{ a0: 0.4, a1: 0.6, depthM: 0.6, faceM: 1 }], rhythm: true }, 16.4, 5, 3.5)!;
  assert.equal(erk.rhythm, undefined);
  assert.equal(buurtRoofKitFor({ erkers: [], sides: { left: 'pier' } }, 16.4, 5, 3.5)!.sides, undefined);
  assert.ok(kitWantsCoping({ erkers: [], rhythm: true } as never) && !kitWantsCoping({ erkers: [] } as never));
});

test('rhythm: one pair light at the pair wall with its half panel, singles across the rest, all on the front', () => {
  const s = sink();
  drawKitFront(s, kit4({ rhythm: true, ribbon: true, sides: { right: 'pair' } }), L4, W4, 1);
  assert.ok(s.out.length > 0 && s.out.every(t => t.p.every(q => q[0] >= L4 / 2 - 1e-6)), 'nothing behind the wall plane');
  // The white panel at the pair wall: from W/2 - 0.45 to W/2 on every storey under the ribbon (3 of the 4 rows).
  const panels = s.out.filter(t => t.hex && t.p.some(q => Math.abs(q[1] - W4 / 2) < 1e-6) && t.p.some(q => Math.abs(q[1] - (W4 / 2 - 0.45)) < 1e-6) && t.part === 'trim');
  assert.ok(panels.length >= 6, `the pair panel on three storeys (${panels.length} tris)`);
  // No light crosses the pier side (left wall).
  assert.ok(s.out.filter(t => t.part === 'trim').every(t => t.p.every(q => q[1] >= -W4 / 2 - 1e-6)));
  // Off: no rhythm, no sides, no ribbon draws nothing.
  const none = sink(); drawKitFront(none, kit4({}), L4, W4, 1); assert.equal(none.out.length, 0);
});

test('piers: a pilaster over the line at a pier side; the ribbon stops short of it and runs on through a joined side', () => {
  const s = sink();
  drawKitFront(s, kit4({ ribbon: true, sides: { left: 'pier' }, joins: { left: true, right: true } }), L4, W4, 1);
  const top = Math.max(...s.out.flatMap(t => t.p.map(q => q[2])));
  assert.ok(Math.abs(top - PIER_LOOK.stackM) < 1e-6, 'the stack rises over the coping');
  const pier = s.out.filter(t => t.p.every(q => q[1] <= -W4 / 2 + PIER_LOOK.halfM + 1e-6) && t.p.some(q => q[2] > 0.5));
  assert.ok(pier.length >= 2);
  // The ribbon band (its glass, the series ribbon heights) starts at -W/2 + 1.6 and runs to the joined right wall.
  const z0 = -3.225 + RIBBON_LOOK.footM;
  const band = s.out.filter(t => t.part === 'trim' && t.p.every(q => q[2] >= z0 - 0.2 && q[2] <= z0 + RIBBON_LOOK.heightM + 0.2));
  const ys = band.flatMap(t => t.p.map(q => q[1]));
  assert.ok(Math.min(...ys) >= -W4 / 2 + PIER_LOOK.ribbonInsetM - 0.2, `ribbon stops short of the pier (${Math.min(...ys)})`);
  assert.ok(Math.max(...ys) > W4 / 2 - 0.05, 'and runs on through the joined right wall');
});

test('eaves: the lattice frieze on the line and the white slab over it, end caps only on free sides', () => {
  const joined = sink(); drawKitFront(joined, kit4({ eaves: { overhangM: 0.9 }, joins: { left: true, right: true } }), L4, W4, 1);
  const zs = joined.out.flatMap(t => t.p.map(q => q[2])), xs = joined.out.flatMap(t => t.p.map(q => q[0]));
  assert.ok(Math.abs(Math.max(...zs) - (EAVES_LOOK.friezeM + EAVES_LOOK.thickM)) < 1e-6);
  assert.ok(Math.abs(Math.max(...xs) - (L4 / 2 + 0.9)) < 1e-6, 'the overhang');
  const ys = joined.out.flatMap(t => t.p.map(q => q[1]));
  assert.deepEqual([Math.min(...ys), Math.max(...ys)], [-W4 / 2, W4 / 2], 'joined: wall to wall');
  const free = sink(); drawKitFront(free, kit4({ eaves: { overhangM: 0.9 } }), L4, W4, 1);
  const fy = free.out.flatMap(t => t.p.map(q => q[1]));
  assert.deepEqual([Math.min(...fy), Math.max(...fy)], [-W4 / 2 - 0.9, W4 / 2 + 0.9], 'free: returned round the ends');
  assert.equal(free.out.length - joined.out.length, 4, 'two end caps');
  assert.ok(joined.out.some(t => t.hex === EAVES_LOOK.dark), 'the frieze openings');
});

// Round 5: a whole erker the cells would carry onto a party wall keeps BAG's span, and only the cells whose window it
// half covers are bricked; erkers under broad eaves rise to the slab; erker bands; loggias between the erkers.
test('erkersOnCells: a whole erker next to a party wall keeps BAG span; a half-covered window is bricked over', () => {
  // Rooseveltlaan 080196: BAG 0.64-3.59 m of a 9.38 m five-cell front; the cells would put it on the wall (a half erker).
  const [r] = erkersOnCells([{ a0: 0.0682, a1: 0.3829, depthM: 0.72, faceM: 1.97 }], 5, 9.38);
  assert.deepEqual([r.a0, r.a1, r.faceM], [0.0682, 0.3829, 1.97]);
  assert.deepEqual(r.plates, [[0, 0.0682]], 'cell 0 window (0.03-0.17) is half behind the erker; cell 1 window wholly');
  // Biesboschstraat 077118: 0.513-0.776 of four cells; both windows clear or wholly covered: no plates.
  const [b] = erkersOnCells([{ a0: 0.513, a1: 0.776, depthM: 0.66, faceM: 1.33 }], 4, 7.95);
  assert.deepEqual([b.a0, b.a1, b.plates], [0.513, 0.776, undefined]);
});

test('erkers under broad eaves rise to the slab; bands run corner to corner; loggias fill the runs between erkers', () => {
  const erk = { a0: 0.07, a1: 0.38, depthM: 0.72, faceM: 1.97, plates: [[0, 0.07]] as Array<[number, number]> };
  const plain = sink(); drawKitFront(plain, kit4({ erkers: [erk] }), L4, W4, 1);
  const eaves = sink(); drawKitFront(eaves, kit4({ erkers: [erk], eaves: { overhangM: 0.9 }, joins: { left: true, right: true } }), L4, W4, 1);
  const top = (o: typeof plain.out) => Math.max(...o.filter(t => t.p.some(q => q[0] > L4 / 2 + 0.5)).flatMap(t => t.p.map(q => q[2])));
  assert.ok(top(plain.out) < 0.6 && Math.abs(top(eaves.out) - (EAVES_LOOK.friezeM + EAVES_LOOK.thickM)) < 1e-6, 'the erker cap meets the eaves slab');
  // The plate: brick over the wall strip [0, 0.07] of the front (c from -W/2 to -W/2 + 0.07 W).
  assert.ok(plain.out.some(t => t.part === 'plate' && t.p.every(q => q[1] <= -W4 / 2 + 0.07 * W4 + 1e-6)));
  // Bands: glass reaches the face corners (no brick margin), so the glass covers more of each face.
  const glass = (o: typeof plain.out) => o.filter(t => t.hex === '#4f5f69').reduce((a, t) => a + Math.abs((t.p[1][1] - t.p[0][1]) * (t.p[2][2] - t.p[0][2]) - (t.p[2][1] - t.p[0][1]) * (t.p[1][2] - t.p[0][2])) + Math.abs((t.p[1][0] - t.p[0][0]) * (t.p[2][2] - t.p[0][2]) - (t.p[2][0] - t.p[0][0]) * (t.p[1][2] - t.p[0][2])), 0);
  const banded = sink(); drawKitFront(banded, kit4({ erkers: [erk], erkerBands: true }), L4, W4, 1);
  assert.ok(glass(banded.out) > glass(plain.out));
  // Loggias: dark openings on each of the 4 storeys, only right of the erker (the left strip is under 1.5 m).
  const lg = sink(); drawKitFront(lg, kit4({ erkers: [erk], loggias: true }), L4, W4, 1);
  const dark = lg.out.filter(t => t.hex === LOGGIA_LOOK.dark);
  assert.equal(dark.length, 2 * 4);
  assert.ok(dark.every(t => t.p.every(q => q[1] >= (0.38 - 0.5) * W4 + LOGGIA_LOOK.sideM - 1e-6)));
  assert.ok(kitDrawsFront(kit4({ loggias: true })));
});

test('round 7: a flat series takes its own broad eaves; entries draw the red door, the canopy and the portiek bay', () => {
  const flat = buurtRoofKitFor({ erkers: [], eaves: { overhangM: 1, frieze: false }, entries: [{ a: 0.4, kind: 'canopy' }] }, 15.4, 5, 3.1)!;
  assert.deepEqual([flat.pitchDeg, flat.eaves, flat.entries, flat.groundZ], [undefined, { overhangM: 1, frieze: false }, [{ a: 0.4, kind: 'canopy' }], -15.4]);
  assert.ok(kitDrawsFront(flat) && kitWantsCoping({ erkers: [], eaves: { overhangM: 1 } } as never) && kitWantsCoping({ erkers: [], entries: [{ a: 0.5, kind: 'door' }] } as never));
  // A pitched roof's eaves stay the roof's; the flat eaves are not drawn under a pitched roof.
  assert.equal(buurtRoofKitFor({ erkers: [], roof: { pitchDeg: 40 }, eaves: { overhangM: 1 } }, 9.5, 3, 3.1)!.eaves, undefined);
  const door = sink();
  drawKitFront(door, kit4({ entries: [{ a: 0.43, kind: 'door' }], groundZ: -16 }), L4, W4, 1);
  const red = door.out.filter(t => t.hex === ENTRY_LOOK.red);
  assert.ok(red.length === 2 && red.every(t => t.p.every(q => q[2] >= -16 - 1e-6 && q[2] <= -16 + ENTRY_LOOK.doorH + 1e-6)), 'one red leaf from the pavement');
  assert.ok(!door.out.some(t => t.p.some(q => q[2] > 0)), 'a door draws nothing over the line');
  // With the series' cells the ground is redrawn: a window in each of the 3 cells the door's plate leaves free (of 4).
  const ground = sink();
  drawKitFront(ground, kit4({ entries: [{ a: 0.4, kind: 'door', cells: 4 }], groundZ: -16 }), L4, W4, 1);
  assert.equal(ground.out.filter(t => t.hex === '#4f5f69').length, 2 * 3);
  const bay = sink();
  drawKitFront(bay, kit4({ entries: [{ a: 0.43, kind: 'gable-bay' }], groundZ: -16 }), L4, W4, 1);
  assert.ok(bay.out.some(t => t.hex === ERKER_LOOK_WHITE && t.p.some(q => q[2] >= ENTRY_LOOK.gableH - 1e-6)), 'the white gable over the line');
  assert.ok(bay.out.some(t => t.hex === ENTRY_LOOK.dark), 'its diamond');
  assert.ok(bay.out.filter(t => t.hex === '#4f5f69').length >= 2 * 4, 'a stair light per upper storey');
  assert.ok(bay.out.every(t => t.p.every(q => Math.abs(q[1]) <= W4 / 2 + 1e-6)), 'inside the member');
  // With the cells known no window pokes out at the bay's edge: every light on the upper storeys clears the bay by its gap.
  const cut = sink();
  drawKitFront(cut, kit4({ entries: [{ a: 0.43, kind: 'gable-bay', cells: 2 }], groundZ: -16 }), L4, W4, 1);
  const c = (0.43 - 0.5) * W4, half = ENTRY_LOOK.bayW / 2;
  const upper = cut.out.filter(t => t.hex === '#4f5f69' && t.p.every(q => q[2] > -12.9) && t.p.some(q => Math.abs(q[1]) > 0.01));
  assert.ok(upper.every(t => t.p.every(q => q[1] * 1 <= c - half - 0.2 || q[1] >= c + half + 0.2 || Math.abs(q[1] - c) <= ENTRY_LOOK.stairW / 2 + 1e-6)), 'lights clear the bay');
});
const ERKER_LOOK_WHITE = '#ece9e1';

test('an erker stands over the series line only under a pitched roof (round 10, Hunzestraat)', async () => {
  const { erkerCapOf, ERKER_LOOK } = await import('./roofKit.js');
  assert.equal(erkerCapOf({}), -ERKER_LOOK.capM, 'flat series: the cap tops out at the line');
  assert.equal(erkerCapOf({ roof: { pitchDeg: 62, riseM: 1.3 } }), ERKER_LOOK.capM);
});

test('round 12: timber erker fronts, one-storey oriels on an apron, corner oriels; absent fields draw as before', async () => {
  const { TIMBER_LOOK, ERKER_LOOK } = await import('./roofKit.js');
  const { erkerRowsOf } = await import('./frontKit.js');
  const erk = { a0: 0.3, a1: 0.7, depthM: 0.7, faceM: 1.9 };
  const draw = (k: Partial<BuurtRoofKit>) => { const s = sink(); drawKitFront(s, kit4(k), L4, W4, 1); return s.out; };
  // Absent: exactly the old draw (the same triangles whether or not the new fields are spelled out as undefined).
  assert.deepEqual(draw({ erkers: [{ ...erk, front: undefined, storeys: undefined, corner: undefined, apron: undefined }] }), draw({ erkers: [erk] }));
  // Timber: pale glass on every face and storey, no casement-blue glass; brick still between storeys (the plate).
  const tim = draw({ erkers: [{ ...erk, front: 'timber' }] });
  assert.ok(!tim.some(t => t.hex === ERKER_LOOK.glass) && tim.filter(t => t.hex === TIMBER_LOOK.glass).length === 2 * 3 * 4, 'pale glass: 3 faces x 4 storeys');
  assert.ok(tim.some(t => t.part === 'plate'), 'brick spandrels');
  // Toplight bars: more white than the stock erker.
  const white = (o: typeof tim) => o.filter(t => t.hex === ERKER_LOOK.white).length;
  assert.ok(white(tim) > white(draw({ erkers: [erk] })));
  // The glass runs corner to corner: on the face, its ends meet the plan's corners.
  const face = tim.filter(t => t.hex === TIMBER_LOOK.glass && t.p.every(q => Math.abs(q[0] - (L4 / 2 + 0.7 + 0.02)) < 1e-6));
  assert.ok(face.length > 0);
  // One storey: lights on the first floor only, the cap under the second floor; the apron white under the lights.
  const one = draw({ erkers: [{ ...erk, front: 'timber', storeys: 1, apron: true }] });
  assert.equal(one.filter(t => t.hex === TIMBER_LOOK.glass).length, 2 * 3);
  const topZ = Math.max(...one.flatMap(t => t.p.map(q => q[2])));
  assert.ok(Math.abs(topZ - (-12.9 + 3.225 - TIMBER_LOOK.partialCapGapM + ERKER_LOOK.capM)) < 1e-6, 'its cap under the next floor');
  assert.ok(one.some(t => t.hex === ERKER_LOOK.white && t.p.every(q => q[2] <= -12.9 + TIMBER_LOOK.footM + 1e-6) && t.p.some(q => q[2] < -12.9 + 0.3)), 'the apron');
  assert.equal(erkerRowsOf({ ...erk, storeys: 9 }, 4), 4);
  assert.equal(erkerRowsOf({ ...erk, storeys: 0 }, 4), 4);
  // A half erker at the party wall is open there; a corner oriel closes that side.
  const half = { a0: 0, a1: 0.35, depthM: 0.6, faceM: 1.6 };
  const faces = (o: typeof tim) => o.filter(t => t.part === 'plate' && t.p.some(q => q[0] > L4 / 2 + 0.1)).length;
  assert.equal(faces(draw({ erkers: [{ ...half, corner: true }] })), faces(draw({ erkers: [half] })) + 2, 'one more brick face, the closed side');
});

test('round 13: a thin eaves slab as the flat roof\'s lid; the attic band in the top storey', async () => {
  const { ATTIC_LOOK, ERKER_LOOK, eavesSlabOf, buurtRoofKitOf } = await import('./roofKit.js');
  const { KIT_FLAT_RISE_M, kitEavesOf, kitAtticOf, buurtKitOf } = await import('./frontKit.js');
  const draw = (k: Partial<BuurtRoofKit>) => { const s = sink(); drawKitFront(s, kit4(k), L4, W4, 1); return s.out; };
  // Parsing: stated fields only; old records parse as before.
  assert.deepEqual(kitEavesOf({ overhangM: 1, frieze: false }), { overhangM: 1, frieze: false });
  assert.deepEqual(kitEavesOf({ overhangM: 1.1, frieze: false, fasciaM: 0.2, lid: true, junk: 1 }), { overhangM: 1.1, frieze: false, fasciaM: 0.2, lid: true });
  assert.deepEqual(kitAtticOf({ heightM: 1.1, pitchM: 9 }), { heightM: 1.1 });
  assert.deepEqual(buurtKitOf({ frontLine: line, erkers: [], eaves: { overhangM: 1, lid: true }, attic: {} })?.attic, {});
  assert.deepEqual(buurtRoofKitOf({ ...kit4({}), attic: { pitchM: 1.4 }, eaves: { overhangM: 1, fasciaM: 0.2 } })?.eaves, { overhangM: 1, fasciaM: 0.2 });
  // Lid: the slab's top clears the coping, its fascia the stated thickness, nothing over it.
  const lid = kit4({ eaves: { overhangM: 1.1, frieze: false, fasciaM: 0.2, lid: true } });
  const slab = eavesSlabOf(lid);
  assert.ok(slab.z1 > KIT_FLAT_RISE_M && Math.abs(slab.z1 - slab.z0 - 0.2) < 1e-9);
  assert.deepEqual(eavesSlabOf(kit4({ eaves: { overhangM: 1, frieze: false } })), { z0: 0, z1: 0.4 }, 'absent: the slab on the line, 0.4 m');
  const out = draw({ ...lid, erkers: [{ a0: 0.3, a1: 0.7, depthM: 0.7, faceM: 1.9 }] });
  assert.ok(Math.abs(Math.max(...out.flatMap(t => t.p.map(q => q[2]))) - slab.z1) < 1e-6, 'the slab is the top');
  // The erker under a lid rises to the soffit and its cap is the slab's thickness.
  const erkTop = Math.max(...out.filter(t => t.p.some(q => q[0] > L4 / 2 + 0.5) && t.p.every(q => Math.abs(q[1]) < 2)).flatMap(t => t.p.map(q => q[2])));
  assert.ok(erkTop <= slab.z1 + 1e-6);
  // Attic: a white band from the line down its height, pairs of lights in it, a brick plate over the storey.
  const at = draw({ attic: { heightM: 1.2, pitchM: 1.6 } });
  const glass = at.filter(t => t.hex === ATTIC_LOOK.glass);
  assert.ok(glass.length >= 2 * 3 && glass.every(t => t.p.every(q => q[2] < 0 && q[2] > -1.2)));
  assert.ok(at.some(t => t.hex === ERKER_LOOK.white && t.p.some(q => Math.abs(q[2] + 1.2) < 1e-6)) && at.some(t => t.part === 'plate'));
  assert.ok(kitDrawsFront(kit4({ attic: {} })) && kitWantsCoping({ erkers: [], attic: {} } as never));
  // With a ribbon stated too, the attic draws in its place.
  assert.equal(draw({ attic: {}, ribbon: true }).length, draw({ attic: {} }).length);
});

test('round 13: raised brick parts over the line, flush or proud from the pavement', async () => {
  const { RAISED_LOOK } = await import('./roofKit.js');
  const { raisedOf, buurtKitOf } = await import('./frontKit.js');
  assert.deepEqual(raisedOf([{ a0: 0.1, a1: 0.4, riseM: 1.2 }, { a0: 0.5, a1: 0.4, riseM: 1 }, { a0: 0.6, a1: 0.7, riseM: 2, outM: 0.2 }]), [{ a0: 0.1, a1: 0.4, riseM: 1.2 }, { a0: 0.6, a1: 0.7, riseM: 2, outM: 0.2 }]);
  const front = buurtKitOf({ frontLine: line, erkers: [], raised: [{ a0: 0.6, a1: 0.9, riseM: 1.2 }, { a0: 0, a1: 0.05, riseM: 2, outM: 0.15 }] })!;
  assert.ok(kitWantsCoping(front));
  const kit = buurtRoofKitFor(front, 12, 4, 3)!;
  assert.equal(kit.footZ, -12);
  const s = sink(); drawKitFront(s, kit, L4, W4, 1);
  const zs = s.out.flatMap(t => t.p.map(q => q[2]));
  assert.ok(Math.abs(Math.max(...zs) - (2 + RAISED_LOOK.copingM)) < 1e-9 && Math.abs(Math.min(...zs) + 12) < 1e-9, 'the proud pier from the pavement to 2 m over the line');
  const flush = s.out.filter(t => t.p.every(q => q[1] >= (0.6 - 0.5) * W4 - 0.05 - 1e-9 && q[1] <= (0.9 - 0.5) * W4 + 0.05 + 1e-9));
  assert.ok(flush.length && flush.every(t => t.p.every(q => q[2] >= -0.05 - 1e-9)), 'a flush part stands on the line');
  assert.equal(buurtRoofKitFor({ erkers: [] }, 12, 4, 3)!.raised, undefined);
});

test('round 14: stacked balconies with a dark railing, on the stated storeys', async () => {
  const { BALCONY_LOOK, buurtRoofKitOf } = await import('./roofKit.js');
  const { balconiesOf, buurtKitOf } = await import('./frontKit.js');
  assert.deepEqual(balconiesOf([{ a0: 0.2, a1: 0.6, from: 2, storeys: 2, depthM: 1.2, rail: 'dark', x: 1 }, { a0: 0.5, a1: 0.4 }, { a0: 0.1, a1: 0.3, rail: 'gold', depthM: 9 }]),
    [{ a0: 0.2, a1: 0.6, from: 2, storeys: 2, depthM: 1.2, rail: 'dark' }, { a0: 0.1, a1: 0.3 }]);
  const front = buurtKitOf({ frontLine: line, erkers: [], balconies: [{ a0: 0.3, a1: 0.7, from: 2 }] })!;
  assert.ok(kitWantsCoping(front));
  const kit = buurtRoofKitFor(front, 15, 5, 3)!;
  assert.deepEqual(kit.balconies, [{ a0: 0.3, a1: 0.7, from: 2 }]);
  assert.ok(kitDrawsFront(kit) && buurtRoofKitOf(kit)?.balconies?.length === 1);
  const s = sink(); drawKitFront(s, kit, L4, W4, 1);
  const slabs = s.out.filter(t => t.hex === BALCONY_LOOK.slab && t.n?.[2] === 1);
  // From the second upper storey to the top: three slabs (two triangles each), each at its floor, reaching 1.0 m out.
  assert.equal(slabs.length, 2 * 3);
  assert.ok(slabs.every(t => Math.max(...t.p.map(q => q[0])) > L4 / 2 + 1.0));
  const dark = s.out.filter(t => t.hex === BALCONY_LOOK.dark);
  assert.ok(dark.length > 3 * 30 && dark.every(t => t.p.every(q => Math.abs(q[1]) <= 0.2 * W4 + 1e-6)), 'the railing bars within the span');
  // An attic top storey keeps its balcony-free band; `solid` a white parapet with no bars.
  const s2 = sink(); drawKitFront(s2, { ...kit, attic: {}, balconies: [{ a0: 0.3, a1: 0.7, rail: 'solid' }] }, L4, W4, 1);
  assert.equal(s2.out.filter(t => t.hex === BALCONY_LOOK.slab && t.n?.[2] === 1).length, 2 * 3);
  assert.equal(s2.out.filter(t => t.hex === BALCONY_LOOK.dark).length, 0);
});

test('round 14: porch, portiek and arched doorways; old entries parse as before', async () => {
  const { ENTRY_KIND_LOOK, entryHalfM } = await import('./roofKit.js');
  const { entriesOf } = await import('./frontKit.js');
  assert.deepEqual(entriesOf([{ a: 0.5, kind: 'canopy', widthM: 2, doorHex: '#123456' }]), [{ a: 0.5, kind: 'canopy' }], 'old kinds take no new fields');
  assert.deepEqual(entriesOf([{ a: 0.5, kind: 'arched', widthM: 2.4, doorHex: '#7a2420', cells: 3 }, { a: 0.4, kind: 'tent' }]), [{ a: 0.5, kind: 'arched', cells: 3, widthM: 2.4, doorHex: '#7a2420' }]);
  assert.equal(entryHalfM({ a: 0.5, kind: 'door' }), ENTRY_LOOK.plateW / 2);
  const draw = (en: object, gz = -16) => { const s = sink(); drawKitFront(s, kit4({ entries: [en as never], groundZ: gz }), L4, W4, 1); return s.out; };
  const porch = draw({ a: 0.5, kind: 'porch' });
  assert.ok(porch.some(t => t.hex === ENTRY_KIND_LOOK.timber) && porch.some(t => t.hex === ENTRY_KIND_LOOK.stone && t.n?.[2] === 1));
  assert.ok(Math.max(...porch.flatMap(t => t.p.map(q => q[2]))) < -12.9, 'under the first floor');
  const portiek = draw({ a: 0.5, kind: 'portiek' });
  assert.equal(portiek.filter(t => t.hex === ENTRY_KIND_LOOK.step).length, 2 * ENTRY_KIND_LOOK.portiek.steps);
  assert.ok(portiek.some(t => t.hex === ENTRY_KIND_LOOK.recess));
  const arch = draw({ a: 0.5, kind: 'arched', widthM: 2.4, doorHex: '#7a2420' }, -17);
  const crown = Math.max(...arch.filter(t => t.hex === ENTRY_KIND_LOOK.recess).flatMap(t => t.p.map(q => q[2])));
  assert.ok(Math.abs(crown - (-17 + ENTRY_KIND_LOOK.arched.springM + 1.2)) < 1e-6, 'the round arch\'s crown');
  const low = draw({ a: 0.5, kind: 'arched', widthM: 2.4 });
  assert.ok(Math.max(...low.flatMap(t => t.p.map(q => q[2]))) <= -12.9 - 0.1 + 1e-9, 'a low ground storey lowers the springing, never the first floor');
  assert.ok(arch.some(t => t.hex === '#7a2420') && arch.filter(t => t.part === 'plate').length >= ENTRY_KIND_LOOK.arched.segs);
});

test('round 14: small-paned upper sashes on the stated cells, clear of the erkers', async () => {
  const { PANES_LOOK } = await import('./roofKit.js');
  const { kitPanesOf } = await import('./frontKit.js');
  assert.equal(kitPanesOf({ rows: 2 }), null);
  assert.deepEqual(kitPanesOf({ cells: 3, rows: 1, paneM: 2, share: 0.35 }), { cells: 3, rows: 1, share: 0.35 });
  const mullions = (k: Partial<BuurtRoofKit>) => { const s = sink(); drawKitFront(s, kit4(k), L4, W4, 1); return s.out.filter(t => t.hex === ERKER_LOOK_WHITE && Math.abs(Math.abs(t.p[1][1] - t.p[0][1]) - PANES_LOOK.mullionM) < 1e-9).length / 2; };
  assert.equal(mullions({ panes: { cells: 3 } }), 4 * 3);
  assert.equal(mullions({ panes: { cells: 3 }, attic: {} }), 3 * 3, 'not in the attic storey');
  assert.equal(mullions({ panes: { cells: 3 }, erkers: [{ a0: 0.35, a1: 0.65, depthM: 0.6, faceM: 1.6, storeys: 1 }] }), 4 * 3 - 1, 'the middle cell under a one-storey oriel');
});

// Round 15 (lane R): canted fronts. Named regressions: Europaplein 0363100012145394 and Patroclosstraat 0363100012133916,
// corner members whose row box faced the side street (no kit on their front); Amstelkade 0363100012105304 and
// 0363100012078745, block joints BAG draws as folds out of the front line.
test('round 15: cantsOf reads Amstelkade\'s folds; a box erker is no cant', async () => {
  const { cantsOf, cantsValid } = await import('./frontKit.js');
  // 105304's profile (BAG, front 12.9 m): flat to 11.5 m, out to 0.53 m at 12.4 m, back to the line at the party wall.
  const A = XY(12.9, 0), B = XY(0, 0), n = XY(0, 1), at = (t: number, o: number) => XY(12.9 - t, o);
  const fold = [at(0, 0), at(11.5, 0), at(11.9, 0.2), at(12.1, 0.37), at(12.4, 0.53), at(12.6, 0.47), at(12.8, 0.3), at(12.9, 0.09), at(12.9, -0.02), at(12.7, -7.3), at(-1.9, -6.6)];
  const [c] = cantsOf(fold, A, B, n);
  assert.deepEqual([c.a0, c.ap, c.a1, c.outM], [+(11.5 / 12.9).toFixed(4), +(12.4 / 12.9).toFixed(4), 1, 0.53]);
  // 078745: one cheek, rising to 0.46 m at the party wall (its neighbour carries the V on): the ridge at the end.
  const cheek = [at(0, 0), at(5.4, 0), at(5.7, 0.2), at(6.0, 0.37), at(6.4, 0.46), at(6.4, -10.2), at(0, -10.2)].map(p => XY(p.x - 6.5, p.y));
  const [h] = cantsOf(cheek, XY(6.4, 0), XY(0, 0), n);
  assert.deepEqual([h.ap, h.a1, h.outM], [1, 1, 0.46]);
  // A box erker (a face 1.3 m wide at its depth, steps at its sides) is not a cant.
  assert.equal(cantsOf(ring, XY(8, 0), XY(0, 0), XY(0, 1)).length, 0);
  assert.deepEqual(cantsValid([{ a0: 0.9, ap: 0.95, a1: 1, outM: 0.5, x: 1 }, { a0: 0.5, ap: 0.4, a1: 0.6, outM: 0.5 }]), [{ a0: 0.9, ap: 0.95, a1: 1, outM: 0.5 }]);
});

test('round 15: the kit draws a cant as a brick prism from the pavement to the line; the straightened wall takes its span', async () => {
  const { buurtKitOf } = await import('./frontKit.js');
  const front = buurtKitOf({ frontLine: line, erkers: [], cants: [{ a0: 0.8, ap: 0.9, a1: 1, outM: 0.5 }] })!;
  assert.ok(kitWantsCoping(front));
  const k = buurtRoofKitFor(front, 12.4, 4, 3.2)!;
  assert.deepEqual([k.cants?.length, k.footZ], [1, -12.4]);
  const s = sink(); drawKitFront(s, k, L4, W4, 1);
  const zs = s.out.flatMap(t => t.p.map(q => q[2])), os = s.out.flatMap(t => t.p.map(q => q[0] - L4 / 2));
  assert.ok(Math.abs(Math.min(...zs) + 12.4) < 1e-9 && Math.max(...zs) <= 0, 'pavement to the line');
  assert.ok(Math.abs(Math.max(...os) - 0.5) < 1e-9, 'its ridge 0.5 m out');
  // Its vertices in front of the line straighten as an erker's do.
  const bump = [XY(0, -10), XY(8, -10), XY(8, 0), XY(1.6, 0), XY(0.8, 0.5), XY(0, 0)];
  const st = straightenRing([...bump.map(ll), ll(bump[0])], line, [{ a0: 0.8, a1: 1, depthM: 0.5, faceM: 0 }]);
  assert.equal(st.length, 5, 'one front run');
});

test('round 15: a row box squared to the kit\'s street normal when it faces a side street (corner members); otherwise untouched', async () => {
  const { frontNormalOf } = await import('./frontKit.js');
  process.env.ROW_FRONT = '1'; resetRowFront();
  const g = globalThis as { __canalRecallBuurtKit?: boolean };
  const flat = { ...series, roofStorey: { kind: 'none' as const, dormers: [] } };
  const make = (pandId: string, pts: Array<{ x: number; y: number }>, fl: [LngLat, LngLat]) => ({
    rec: { ...rec(pandId, { frontLine: fl, erkers: [], ribbon: true, copingHex: '#5b504a' }), series: flat } as RowFrontRecord,
    feat: { type: 'Feature', properties: <Record<string, unknown>>{ id: `NL.IMBAG.Pand.${pandId}`, height: 16, minHeight: 0, facade: 'school', facadeStyle: 'school', constructionYear: 1929 },
      geometry: { type: 'Polygon', coordinates: [[...pts.map(ll), ll(pts[0])].map(p => [...p])] } } });
  // Europaplein 145394's shape: 12 m of front (y = 0, street +y), 8 m deep, so the fitted box's long axis runs along it.
  const wide = make('0363100012145394', [XY(0, -8), XY(12, -8), XY(12, 0), XY(0, 0)], [ll(XY(12, 0)), ll(XY(0, 0))]);
  // Patroclosstraat 133916's: a skewed quadrilateral, 9 m of front, its party walls off square, the back wider.
  const skew = make('0363100012133916', [XY(0, 0), XY(-2.5, -11), XY(10.5, -9), XY(9, 0)], [ll(XY(9, 0)), ll(XY(0, 0))]);
  // A deep member (6 m front, 12 deep): its box faces the street already.
  const deep = make('0363100012000003', [XY(0, -12), XY(6, -12), XY(6, 0), XY(0, 0)], [ll(XY(6, 0)), ll(XY(0, 0))]);
  try {
    setRowFrontRecords([wide.rec, skew.rec, deep.rec]);
    g.__canalRecallBuurtKit = true;
    const dims = { bayM: 2, storeyM: 3, cellM: 1 };
    // A corner: the side street (west, -x) is nearer than the front street (north, +y), so the facing box picks the side.
    const corner = (w: { nx: number; ny: number }) => w.nx < -0.7 ? 2 : w.ny > 0.7 ? 5 : Infinity;
    const frontOnly = (w: { nx: number; ny: number }) => w.ny > 0.7 ? 5 : Infinity;
    const tris = (f: any, keepN = true, facing: typeof corner | null = corner) => {
      const on = withRowFront(f) as any;
      if (!keepN) delete on.properties.rowRoof.frontN;
      const o = on.geometry.coordinates[0];
      return roofTrianglesForOutline(o, { lng: o[0][0], lat: o[0][1] }, roofPlanForFeature(on)!, 12.4, dims, KX, facing ?? undefined);
    };
    const frontSide = (ts: ReturnType<typeof tris>, o: number[]) => {
      // The kit's triangles in metres from the feature's first vertex: their mean must stand on the front (y ≈ 0).
      const k = ts.filter(t => t.kit), ps = k.flatMap(t => t.p);
      const y = ps.reduce((a, p) => a + p[1], 0) / ps.length + (o[1] - LAT0) * KY;
      return { n: k.length, y };
    };
    assert.deepEqual(frontNormalOf([ll(XY(12, 0)), ll(XY(0, 0))]), [0, 1]);
    for (const m of [wide, skew]) {
      const o = (m.feat.geometry.coordinates[0][0]) as number[];
      const turned = frontSide(tris(m.feat), o);
      assert.ok(turned.n > 0 && Math.abs(turned.y) < 1, `${m.rec.pandId}: the kit on its front (y ${turned.y.toFixed(2)})`);
      // (Main's kitFrontM match, 3ca2827e3, picks the front wall on its own now; the normal is the second guard.)
    }
    assert.equal(JSON.stringify(tris(deep.feat, true, frontOnly)), JSON.stringify(tris(deep.feat, false, frontOnly)), 'a box facing the street: byte-identical');
    for (const m of [wide, skew, deep]) assert.equal(JSON.stringify(tris(m.feat, true, null)), JSON.stringify(tris(m.feat, false, null)), `${m.rec.pandId}: no street facing, byte-identical`);
  } finally { delete g.__canalRecallBuurtKit; process.env.ROW_FRONT = '0'; resetRowFront(); setRowFrontRecords([]); }
});

test('round 16: a cant bricks over the window it half covers; window fronts draw from the pavement; absent, as before', async () => {
  const { cantsOnCells } = await import('./frontKit.js');
  const { buurtRoofKitFor, drawKitFront, kitDrawsFront } = await import('./roofKit.js');
  // 091497: three cells, the cant over 0.79-1 of the front: the third window (0.71 of its cell glazed) is bricked from the cell's edge.
  const [c] = cantsOnCells([{ a0: 0.7892, ap: 0.9549, a1: 1, outM: 0.46 }], 3);
  assert.deepEqual(c.plates, [[0.6667, 0.7892]]);
  // A cant clear of every window keeps no plates (byte-identical record).
  assert.deepEqual(cantsOnCells([{ a0: 0.97, ap: 1, a1: 1, outM: 0.3 }], 3), [{ a0: 0.97, ap: 1, a1: 1, outM: 0.3 }]);
  const base = { erkers: [] as never[] };
  const plain = buurtRoofKitFor(base, 9.3, 3, 3.3)!;
  const front = buurtRoofKitFor({ ...base, windowFronts: [{ a0: 0.05, a1: 0.95, doors: 3 }] }, 9.3, 3, 3.3)!;
  assert.equal(kitDrawsFront(plain), false);
  assert.equal(kitDrawsFront(front), true);
  assert.equal(front.footZ, -9.3);
  const { RoofSink } = await import('../../roofSink.js');
  const s = new RoofSink({ cx: 0, cy: 0, ux: 1, uy: 0, len: 10, wid: 4, coverage: 1, maxDev: 0 } as never, 0, { bayM: 2, storeyM: 3, cellM: 1 } as never);
  drawKitFront(s, front, 10, 4, 1);
  const zs = s.out.flatMap(t => t.p.map(p => p[2]));
  assert.ok(Math.abs(Math.min(...zs) + 9.3) < 1e-6, 'from the pavement');
  assert.ok(Math.max(...zs) <= front.z0 + 1e-6, 'the ground storey only (its brick infill to the storey top)');
  assert.ok(s.out.some(t => t.hex === '#ff2a3a'), 'the tube');
});

test('round 19: a stated stair axis draws one narrow light per upper storey beside the wide windows; absent, nothing changes', async () => {
  const { stairAxisOf, buurtKitOf } = await import('./frontKit.js');
  const { buurtRoofKitOf, drawStairAxis, STAIR_LOOK, RHYTHM_LOOK } = await import('./roofKit.js');
  assert.deepEqual(stairAxisOf({ a: 0.12, wide: 2 }), { a: 0.12, wide: 2 });
  for (const bad of [{ a: 0, wide: 2 }, { a: 0.5, wide: 0 }, { a: 0.5, wide: 1.5 }, { a: 1.2, wide: 2 }, null]) assert.equal(stairAxisOf(bad), null);
  const front = buurtKitOf({ frontLine: line, erkers: [], stairAxis: { a: 0.12, wide: 2 } })!;
  assert.deepEqual(front.stairAxis, { a: 0.12, wide: 2 });
  assert.equal(buurtKitOf({ frontLine: line, erkers: [], rhythm: true, stairAxis: { a: 0.12, wide: 2 } })!.stairAxis, undefined, 'the rhythm wins');
  assert.equal(buurtKitOf({ frontLine: line, erkers: [] })!.stairAxis, undefined);
  const rk = buurtRoofKitFor(front, 12.4, 4, 3.4)!;
  assert.ok(kitDrawsFront(rk) && rk.stairAxis);
  assert.deepEqual(buurtRoofKitOf(JSON.parse(JSON.stringify(rk))), rk, 'survives the feature properties');
  const s = sink(); drawStairAxis(s, rk, 10, 9.8, 1);
  const lights = s.out.filter(t => t.part !== 'plate');
  const ws = new Set(lights.flatMap(t => t.p.map(p => +p[1].toFixed(2))));
  assert.ok(ws.size > 0);
  // Its lights: the stair light's edges at 0.12 of the front (left as seen) and two wide windows of at most 2.2 m.
  const c = -9.8 / 2 + 0.12 * 9.8, half = STAIR_LOOK.lightM / 2;
  assert.ok([...ws].some(y => Math.abs(Math.abs(y) - Math.abs(c - half)) < 0.02 || Math.abs(Math.abs(y) - Math.abs(c + half)) < 0.02), 'the stair light where stated');
  assert.ok(RHYTHM_LOOK.singleM === 2.2);
  // Plain kits keep drawing nothing extra.
  const plain = buurtRoofKitFor({ erkers: [] }, 12.4, 4, 3.4)!;
  assert.equal(plain.stairAxis, undefined); assert.equal(kitDrawsFront(plain), false);
});

// Round 21 (lane R): the photo-counted windows. Named regressions: Olympiaplein 0363100012103838 (round r: the counted
// bays stretched over wider painted cells lost blind to the width rule) and Parnassusweg 0363100012131387 (a 9.3 m run read "1").
test('round 21: counted windows draw n lights of the measured width over a plate; absent or beside an erker, nothing changes', async () => {
  const { countedOf, buurtKitOf } = await import('./frontKit.js');
  const { buurtRoofKitOf, drawCounted, COUNTED_LOOK, ERKER_LOOK } = await import('./roofKit.js');
  assert.deepEqual(countedOf({ n: 2, widthM: 1.15 }), { n: 2, widthM: 1.15 });
  for (const bad of [{ n: 0, widthM: 1 }, { n: 2.5, widthM: 1 }, { n: 9, widthM: 1 }, { n: 2, widthM: 0.3 }, { n: 2, widthM: 2.4 }, null]) assert.equal(countedOf(bad), null);
  const front = buurtKitOf({ frontLine: line, erkers: [], counted: { n: 2, widthM: 1.15 } })!;
  assert.deepEqual(front.counted, { n: 2, widthM: 1.15 });
  assert.ok(kitWantsCoping(front));
  assert.equal(buurtKitOf({ frontLine: line, erkers: [], rhythm: true, counted: { n: 2, widthM: 1.15 } })!.counted, undefined, 'the rhythm wins');
  const rk = buurtRoofKitFor(front, 12.4, 4, 3.4)!;
  assert.ok(kitDrawsFront(rk) && rk.counted);
  assert.deepEqual(buurtRoofKitOf(JSON.parse(JSON.stringify(rk))), rk, 'survives the feature properties');
  assert.equal(buurtRoofKitFor({ ...front, erkers: [{ a0: 0.3, a1: 0.6, depthM: 0.6, faceM: 1.6 }] }, 12.4, 4, 3.4)!.counted, undefined, 'not beside an erker');
  const s = sink(); drawCounted(s, rk, 10, 7, 1);
  const glass = s.out.filter(t => t.part === 'trim' && t.hex === ERKER_LOOK.glass);
  // Two lights per upper storey (3 upper storeys of 4), each 1.15 m wide, centred in 3.5 m cells.
  assert.equal(glass.length, 2 * 3 * 2);
  const ys = [...new Set(glass.flatMap(t => t.p.map(p => +p[1].toFixed(3))))].sort((a, b) => a - b);
  assert.deepEqual(ys, [-1.75 - 0.575, -1.75 + 0.575, 1.75 - 0.575, 1.75 + 0.575].map(v => +v.toFixed(3)));
  // Cells narrower than the width plus the gap: the light narrows.
  const t = sink(); drawCounted(t, { ...rk, counted: { n: 6, widthM: 1.15 } }, 10, 7, 1);
  const w = Math.max(...t.out.filter(x => x.part === 'trim' && x.hex === ERKER_LOOK.glass).map(x => Math.max(...x.p.map(p => p[1])) - Math.min(...x.p.map(p => p[1]))));
  assert.ok(Math.abs(w - (7 / 6 - COUNTED_LOOK.minGapM)) < 1e-9);
  const plain = buurtRoofKitFor({ erkers: [] }, 12.4, 4, 3.4)!;
  assert.equal(plain.counted, undefined); assert.equal(kitDrawsFront(plain), false);
});
// Named regressions (coordinator 2026-11-15, lane R round 14): the corner members Europaplein 0363100012145394 and
// Patroclosstraat 0363100012133916 drew no kit on their front. The row roof box faced the nearer side street, so the
// whole kit (attic, eaves lid, piers, entries, panes, dormer) drew on the side wall. The kit's front line now states
// the front width (kitFrontM) and the box matches it within 0.5 m.
test('corner members (Europaplein 145394, Patroclosstraat 133916): the kit draws on the stated front, not the nearer side street', () => {
  process.env.ROW_FRONT = '1'; resetRowFront();
  const g = globalThis as { __canalRecallBuurtKit?: boolean };
  try {
    // Patroclosstraat 133916's proportions: a 9.01 m front at y=0 (street at -y, 8.5 m off), 8.0 m deep, its side wall
    // at x=9.01 6.0 m from the cross street. Counter-clockwise, outward normals: front -y, side +x.
    const corner = [XY(0, 0), XY(9.01, 0), XY(9.01, 8), XY(0, 8)];
    const front: [LngLat, LngLat] = [ll(XY(0, 0)), ll(XY(9.01, 0))];
    const f = { ...feature('0363100012133916'), geometry: { type: 'Polygon', coordinates: [[...corner.map(ll), ll(corner[0])].map(p => [...p])] } };
    const cornerSeries = { ...series, roofStorey: { ...series.roofStorey, frontM: 9.01 } };
    const r: RowFrontRecord = { ...rec('0363100012133916'), series: cornerSeries, buurtKit: { frontLine: front, erkers: [], roof: { pitchDeg: 62, riseM: 1.3 }, panes: { cells: 3, rows: 1 } } as BuurtKitFront };
    setRowFrontRecords([r]);
    g.__canalRecallBuurtKit = true;
    const out = withRowFront(f);
    assert.equal((out.properties.rowRoof as { frontM?: number }).frontM, 9.01, 'the kit front width reaches the roof');
    const o = (out.geometry as { coordinates: number[][][] }).coordinates[0];
    const facing = (w: { nx: number; ny: number }) => w.ny < -0.9 ? 8.5 : w.nx > 0.9 ? 6.0 : Infinity;
    const tris = roofTrianglesForOutline(o, { lng: o[0][0], lat: o[0][1] }, roofPlanForFeature(out as never)!, 12.4, { bayM: 2, storeyM: 3, cellM: 1 }, KX, facing).filter(t => t.kit);
    assert.ok(tris.length > 0, 'kit triangles drawn');
    // Local frame of roofTrianglesForOutline: metres from the ring's first vertex (0, 0). The front face is y ~ 0.
    const ys = tris.flatMap(t => t.p.map(p => p[1])), xs = tris.flatMap(t => t.p.map(p => p[0]));
    assert.ok(Math.max(...ys) < 1.5, `the kit stands on the front (y ${Math.min(...ys).toFixed(1)}..${Math.max(...ys).toFixed(1)})`);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 6, 'and spans the front, not the 8 m side');
  } finally { delete g.__canalRecallBuurtKit; process.env.ROW_FRONT = '0'; resetRowFront(); setRowFrontRecords([]); }
});

// Round 20 (lane R): Amsterdam School massing. Named regressions: Uithoornstraat 0363100012067867/0363100012125303 (the
// corner tower flattened to the series line), Amsteldijk 0363100012101914 (the 1.3 m wings rise over the court).
test('round 20: raised parts stand on a wing\'s face, carry a tower\'s storey lights and reach back as a mass; absent, as before', async () => {
  const { raisedOf, buurtKitOf } = await import('./frontKit.js');
  const { drawRaised, RAISED_LOOK, ERKER_LOOK } = await import('./roofKit.js');
  assert.deepEqual(raisedOf([{ a0: 0.19, a1: 0.99, riseM: 3.05, lights: 1, depthM: 4 }]), [{ a0: 0.19, a1: 0.99, riseM: 3.05, lights: 1, depthM: 4 }]);
  assert.deepEqual(raisedOf([{ a0: 0, a1: 0.4, riseM: 2.6, faceM: 1.3 }]), [{ a0: 0, a1: 0.4, riseM: 2.6, faceM: 1.3 }]);
  assert.deepEqual(raisedOf([{ a0: 0, a1: 0.4, riseM: 2, outM: 0.4, faceM: 1.3, lights: 0, depthM: 0.2 }]), [{ a0: 0, a1: 0.4, riseM: 2, outM: 0.4 }], 'a proud pier takes no face; bad lights and depth drop');
  const kitWith = (raised: unknown[]) => buurtRoofKitFor(buurtKitOf({ frontLine: line, erkers: [], raised })!, 12.4, 4, 3.4)!;
  const draw = (raised: unknown[]) => { const s = sink(); drawRaised(s, kitWith(raised), 10, 8, 1); return s.out; };
  // Absent fields: the round-13 box exactly (0.35 m back, flush).
  const plain = draw([{ a0: 0.2, a1: 0.8, riseM: 2 }]), xs = (o: typeof plain) => o.flatMap(t => t.p.map(p => +(p[0] - 5).toFixed(3)));
  assert.equal(Math.min(...xs(plain)), +(-RAISED_LOOK.backM - RAISED_LOOK.copingOutM).toFixed(3));
  assert.equal(plain.filter(t => t.hex === ERKER_LOOK.glass).length, 0);
  const deep = draw([{ a0: 0.2, a1: 0.8, riseM: 2, depthM: 4 }]);
  assert.equal(Math.min(...xs(deep)), +(-4 - RAISED_LOOK.copingOutM).toFixed(3), 'a tower reaches back');
  const face = draw([{ a0: 0.2, a1: 0.8, riseM: 2, faceM: 1.3 }]);
  assert.equal(Math.max(...xs(face)), +(1.3 + RAISED_LOOK.copingOutM).toFixed(3), 'the wing\'s face');
  // A 3.05 m tower over 3.4 m storeys: one storey of lights, one light each.
  assert.equal(draw([{ a0: 0.19, a1: 0.99, riseM: 3.05, lights: 1 }]).filter(t => t.hex === ERKER_LOOK.glass).length, 2);
  assert.equal(draw([{ a0: 0.19, a1: 0.99, riseM: 1.2, lights: 1 }]).filter(t => t.hex === ERKER_LOOK.glass).length, 0, 'a parapet has no storey');
});

// Round 22 (lane R): round towers and white caps. Named regressions: Vechtstraat 0363100012084587/0363100012107886 (the
// round stair towers drawn as boxes), Haringvlietstraat 0363100012062635 (the tower's white cap slab missing).
test('round 22: a round raised part is a cylinder, a capped one wears a white lid; absent, the box and brick coping', async () => {
  const { raisedOf, buurtKitOf } = await import('./frontKit.js');
  const { drawRaised, RAISED_LOOK, RAISED_CAP_LOOK, ERKER_LOOK } = await import('./roofKit.js');
  assert.deepEqual(raisedOf([{ a0: 0.7, a1: 0.9, riseM: 2, round: true, cap: true }]), [{ a0: 0.7, a1: 0.9, riseM: 2, round: true, cap: true }]);
  assert.deepEqual(raisedOf([{ a0: 0.7, a1: 0.9, riseM: 2, outM: 0.3, round: true, cap: 1 }]), [{ a0: 0.7, a1: 0.9, riseM: 2, outM: 0.3 }], 'a proud pier is not round; cap must be true');
  const kitWith = (raised: unknown[]) => buurtRoofKitFor(buurtKitOf({ frontLine: line, erkers: [], raised })!, 12.4, 4, 3.4)!;
  const draw = (raised: unknown[]) => { const s = sink(); drawRaised(s, kitWith(raised), 10, 8, 1); return s.out; };
  const base = { a0: 0.25, a1: 0.75, riseM: 2 }; // 4 m across: radius 2 m, centred on the wall
  const xs = (o: ReturnType<typeof draw>) => o.flatMap(t => t.p.map(p => +(p[0] - 5).toFixed(3)));
  const ys = (o: ReturnType<typeof draw>) => o.flatMap(t => t.p.map(p => +p[1].toFixed(3)));
  const round = draw([{ ...base, round: true }]);
  assert.equal(Math.max(...xs(round)), +(0.01 + 2 + RAISED_LOOK.copingOutM).toFixed(3), 'its front is the circle\'s');
  assert.equal(Math.min(...ys(round)), +(-2 - RAISED_LOOK.copingOutM).toFixed(3));
  assert.ok(round.every(t => t.hex !== ERKER_LOOK.white), 'brick coping without cap');
  const cap = draw([{ ...base, cap: true }]), capped = cap.filter(t => t.hex === ERKER_LOOK.white);
  assert.ok(capped.length >= 6, 'a white lid box');
  assert.equal(Math.max(...capped.flatMap(t => t.p.map(p => +p[2].toFixed(3)))), +(2 + RAISED_CAP_LOOK.heightM).toFixed(3));
  const plain = draw([base]);
  assert.ok(plain.every(t => t.hex !== ERKER_LOOK.white) && Math.max(...xs(plain)) === +(0.01 + RAISED_LOOK.copingOutM).toFixed(3), 'absent: the box, flush');
});

// Round 22 named regression (Stadionweg 0363100012067736, Michelangelostraat 0363100012122157): a pitched member with a
// raised block drew its eaves and windows ~0.7 m low on the sheet. The game's member is unchanged by the part (this
// test); the sheet squeezed the taller render into its band (scripts/buurt-generators/sheetFit.ts).
test('round 22: a raised part on a pitched member keeps its eaves, height and roof at the series line', () => {
  process.env.ROW_FRONT = '1'; resetRowFront();
  const g = globalThis as { __canalRecallBuurtKit?: boolean };
  try {
    const ring = [XY(0, 0), XY(17.5, 0), XY(17.5, 10), XY(0, 10)];
    const front: [LngLat, LngLat] = [ll(XY(0, 0)), ll(XY(17.5, 0))];
    const f = { ...feature('0363100012067736'), geometry: { type: 'Polygon', coordinates: [[...ring.map(ll), ll(ring[0])].map(p => [...p])] } };
    const s = { ...series, roofStorey: { ...series.roofStorey, frontM: 17.5 } };
    const kit = (raised?: unknown[]) => ({ frontLine: front, erkers: [], roof: { pitchDeg: 62, riseM: 1.3 }, ...(raised ? { raised } : {}) }) as BuurtKitFront;
    g.__canalRecallBuurtKit = true;
    const run = (raised?: unknown[]) => {
      setRowFrontRecords([{ ...rec('0363100012067736'), series: s, buurtKit: kit(raised) }]); resetRowFront();
      const out = withRowFront(f), p = out.properties as Record<string, unknown>;
      const o = (out.geometry as { coordinates: number[][][] }).coordinates[0];
      const tris = roofTrianglesForOutline(o, { lng: o[0][0], lat: o[0][1] }, roofPlanForFeature(out as never)!, 12.4, { bayM: 2, storeyM: 3, cellM: 1 }, KX, (w: { ny: number }) => w.ny < -0.9 ? 8 : Infinity);
      const roof = tris.filter(t => !t.kit).flatMap(t => t.p.map(q => q[2]));
      return { height: p.height, eaves: p.roofEavesHeightM, rise: (p.rowRoof as { riseM: number }).riseM, lo: Math.min(...roof), hi: Math.max(...roof), kitTop: Math.max(...tris.filter(t => t.kit).flatMap(t => t.p.map(q => q[2])), -Infinity) };
    };
    const plain = run(), block = run([{ a0: 0.49, a1: 1, riseM: 3.6, depthM: 8 }]);
    assert.equal(block.eaves, plain.eaves); assert.equal(block.height, plain.height); assert.equal(block.rise, plain.rise);
    assert.ok(Math.abs(block.lo - plain.lo) < 0.05 && Math.abs(block.hi - plain.hi) < 0.05, `the mansard stays (${plain.lo}-${plain.hi} vs ${block.lo}-${block.hi})`);
    assert.ok(block.kitTop > plain.hi + 1, 'and the block stands over it');
  } finally { delete g.__canalRecallBuurtKit; process.env.ROW_FRONT = '0'; resetRowFront(); setRowFrontRecords([]); }
});

// Hoofddorpplein pilot (2026-11-16): the chequer frieze, a brick band on the series line under the eaves slab with the
// attic lights in it and a two-tone pattern; stated only, absent nothing changes.
test('chequer frieze: parses stated fields, draws its band, lights and cells under the eaves; absent, as before', async () => {
  const { kitChequerOf, buurtKitOf } = await import('./frontKit.js');
  const { buurtRoofKitOf, eavesSlabOf, friezeOf, CHEQUER_LOOK, ATTIC_LOOK, ERKER_LOOK } = await import('./roofKit.js');
  const ch = { heightM: 1.05, pattern: 'chequer' as const, cellM: 0.14, rows: 3, lightHex: '#c9b37f', darkHex: '#2e2522', lights: { widthM: 0.75, heightM: 0.62, pitchM: 1.22 } };
  // Parsing: stated fields only, malformed ones dropped, a malformed frieze is none.
  assert.deepEqual(kitChequerOf({ ...ch, junk: 1 }), ch);
  assert.deepEqual(kitChequerOf({ ...ch, rows: 0.5, darkHex: 'red', lights: { widthM: 0.75, heightM: 2, pitchM: 1.2 } }), { heightM: 1.05, pattern: 'chequer', cellM: 0.14, lightHex: '#c9b37f' });
  for (const bad of [null, {}, { ...ch, pattern: 'dots' }, { ...ch, heightM: 0.1 }, { ...ch, lightHex: 'cream' }]) assert.equal(kitChequerOf(bad), null);
  assert.deepEqual(buurtKitOf({ frontLine: line, erkers: [], chequer: ch })?.chequer, ch);
  assert.equal(buurtKitOf({ frontLine: line, erkers: [] })!.chequer, undefined);
  assert.deepEqual(buurtRoofKitOf({ ...kit4({}), chequer: ch })?.chequer, ch);
  assert.ok(!('chequer' in buurtRoofKitOf(kit4({}))!), 'absent: no key');
  const kf = buurtRoofKitFor({ erkers: [], eaves: { overhangM: 0.9 }, chequer: ch } as unknown as BuurtKitFront, 12, 4, 3.1)!;
  assert.deepEqual(kf.chequer, ch); assert.ok(kitDrawsFront(kf) && kitWantsCoping({ erkers: [], chequer: ch } as never));
  assert.ok(!('chequer' in buurtRoofKitFor({ erkers: [], eaves: { overhangM: 0.9 } } as unknown as BuurtKitFront, 12, 4, 3.1)!));
  // The slab stands on the band, not on the lattice frieze; without the band the lattice is as before.
  const eaves = { eaves: { overhangM: 0.9, frieze: false as const } };
  assert.equal(friezeOf(kit4({ ...eaves, chequer: ch })), 1.05);
  { const sl = eavesSlabOf(kit4({ ...eaves, chequer: ch })); assert.ok(sl.z0 === 1.05 && Math.abs(sl.z1 - 1.45) < 1e-9); }
  assert.equal(friezeOf(kit4({ eaves: { overhangM: 0.9 } })), EAVES_LOOK.friezeM);
  const draw = (k: Partial<BuurtRoofKit>) => { const s = sink(); drawKitFront(s, kit4(k), L4, W4, 1); return s.out; };
  const out = draw({ ...eaves, chequer: ch });
  for (const t of out) { assert.ok(t.p.flat().every(Number.isFinite)); assert.ok(Math.abs(Math.hypot(...t.n) - 1) < 1e-6); }
  assert.ok(!out.some(t => t.hex === EAVES_LOOK.dark), 'no lattice openings under the band');
  const glass = out.filter(t => t.hex === ATTIC_LOOK.glass), cells = (hex: string) => out.filter(t => t.hex === hex);
  // Lights across the 8 m member at 1.22 m: five, centred; each one glass quad.
  assert.equal(glass.length, 2 * Math.floor((W4 - 2 * ATTIC_LOOK.endM - 0.75) / 1.22 + 1));
  assert.ok(glass.every(t => t.p.every(q => q[2] > 0 && q[2] < 1.05)));
  // Cells: three courses from the band's top, the two tones, none over a light's column, all inside the band.
  assert.ok(cells(ch.lightHex).length > 0 && cells(ch.darkHex).length > 0);
  for (const t of [...cells(ch.lightHex), ...cells(ch.darkHex)]) assert.ok(t.p.every(q => q[2] >= 1.05 - 3 * 0.14 - 1e-6 && q[2] <= 1.05 + 1e-6 && Math.abs(q[1]) <= W4 / 2 + 1e-6));
  const lightCols = glass.flatMap(t => t.p.map(q => q[1]));
  for (const t of cells(ch.lightHex)) { const ys = t.p.map(q => q[1]); assert.ok(!lightCols.some(y => y > Math.min(...ys) + 0.01 && y < Math.max(...ys) - 0.01)); }
  // An erker under the band stops at the line.
  const erk = draw({ ...eaves, chequer: ch, erkers: [{ a0: 0.3, a1: 0.7, depthM: 0.7, faceM: 1.9 }] }).filter(t => t.p.some(q => q[0] > L4 / 2 + 0.3) && t.p.every(q => q[0] < L4 / 2 + 0.85));
  assert.ok(erk.length && Math.max(...erk.flatMap(t => t.p.map(q => q[2]))) <= ERKER_LOOK.capM + 1e-6, 'erker capped at the line, under the band');
  // Stripes: every other course across the band in the light tone, broken round a group of lights.
  const st = draw({ ...eaves, chequer: { heightM: 1.2, pattern: 'stripes', cellM: 0.1, lightHex: '#b9a27e', lights: { widthM: 0.55, heightM: 0.55, pitchM: 0.8, group: 4, footM: 0.3 } } });
  assert.equal(st.filter(t => t.hex === ATTIC_LOOK.glass).length, 2 * 4);
  assert.ok(st.filter(t => t.hex === '#b9a27e').length >= 2 * 6);
  // No eaves: a white cap over the band.
  const cap = draw({ chequer: ch });
  assert.ok(Math.abs(Math.max(...cap.flatMap(t => t.p.map(q => q[2]))) - (1.05 + CHEQUER_LOOK.capM)) < 1e-6 && cap.some(t => t.hex === ERKER_LOOK.white));
  // Absent: the same triangles as a kit that never heard of it.
  const base = { ...eaves, erkers: [{ a0: 0.3, a1: 0.7, depthM: 0.7, faceM: 1.9 }] };
  assert.equal(JSON.stringify(draw(base)), JSON.stringify(draw({ ...base, chequer: undefined })));
});
