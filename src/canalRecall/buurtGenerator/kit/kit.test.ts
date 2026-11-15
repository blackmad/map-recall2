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
  assert.equal(BAY_STYLES.school.length, process.env.BUURT_KIT === '1' ? 4 : 2);
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
