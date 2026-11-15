// House rows, lane R (#387): lane D's row record to the renderer (rowSeries.ts), the series branch of withRowFront and
// the row roof storey (roofMesh.ts rowRoof), on the two round-1 rows solved from D's fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.ROW_D1_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../houseSpec/row/fixtures/d1');
const { loadRowDefs } = await import('../../../scripts/house-specs/rows/rowDefs.ts');
const { loadRow } = await import('../../../scripts/house-specs/rows/house-rows.ts');
const { solveRow } = await import('../houseSpec/row/solve.ts');
const { rowFrontsWithSeries, seriesDraw } = await import('./rowSeries.ts');
const { resetRowFront, setRowFrontRecords, withRowFront, mansardRise, MANSARD_RISE, rowDressOf, ROW_WALL_SUFFIX, ROW_WALL_SLAB, rowRaisedFronts, ROW_RAISED_FRONT_M } = await import('./rowFront.ts');
const { rowEdgeGrid } = await import('../threeBuildingMesh.ts');
const { roofPlanForFeature, rowRoofOf, ROW_SLATE_TONE, roofTriangles, roofTrianglesForOutline } = await import('../roofMesh.ts');
const { specCellCount } = await import('../streetFacadeRendering.ts');
const { isGardenShed } = await import('../gardenSheds.ts');
const { SegmentGrid } = await import('../streetFronts.ts');

const defs = loadRowDefs();
const recs = (id: string) => rowFrontsWithSeries(solveRow(loadRow(defs[id], '2026-11-14').input));
const K = recs('kinkerstraat-86-110'), W = recs('weteringschans-168096-171218');
const rec = (list: typeof K, id: string) => list.find(r => r.pandId === id)!;

const ring = (w: number, d: number) => [[[0, 0], [w / 111320 / 0.61, 0], [w / 111320 / 0.61, d / 111320], [0, d / 111320], [0, 0]].map(([x, y]) => [4.888 + x, 52.381 + y])];
const feature = (id: string, height: number, extra: Record<string, unknown> = {}) => ({ type: 'Feature', properties: <Record<string, unknown>>{ id: `NL.IMBAG.Pand.${id}`, height, minHeight: 0, facade: 'canal', facadeStyle: 'canal', constructionYear: 1893, ...extra }, geometry: { type: 'Polygon', coordinates: ring(6, 14) } });
function withFlag<T>(records: typeof K, fn: () => T): T {
  const env = process.env.ROW_FRONT;
  try { process.env.ROW_FRONT = '1'; resetRowFront(); setRowFrontRecords(records); return fn(); }
  finally { if (env === undefined) delete process.env.ROW_FRONT; else process.env.ROW_FRONT = env; resetRowFront(); setRowFrontRecords([]); }
}

test('every front record carries its series draw and the judged wall tone, one tone per series', () => {
  for (const r of [...K, ...W]) {
    assert.ok(r.series?.id, `${r.pandId} has a series`);
    assert.equal(r.wall?.source, 'judged');
    assert.match(r.wall!.hex, /^#[0-9a-f]{6}$/i);
  }
  const tones = new Map<string, Set<string>>();
  for (const r of K) (tones.get(r.series!.id) ?? tones.set(r.series!.id, new Set()).get(r.series!.id)!).add(r.wall!.hex);
  for (const [s, t] of tones) assert.equal(t.size, 1, `${s}: one wall tone`);
});

test('Kinkerstraat 106–108 (236027) draws one flat-topped hoist dormer per front, centred in each half (blind review 6)', () => {
  const s = rec(K, '0363100012236027').series!;
  assert.equal(s.roofStorey?.kind, 'mansard');
  assert.deepEqual(s.roofStorey!.dormers.map(d => [d.a, d.kind]), [[0.25, 'plain'], [0.75, 'plain']]);
  assert.equal(s.roofStorey!.riseM, undefined, 'the record states no rise: 3DBAG or the period default decides');
});

test('Kinkerstraat 92–94 (236213) wears its two series: keystones on the left front, tympana on the right', () => {
  const s = rec(K, '0363100012236213').series!;
  const hs = [...s.heads!].sort((p, q) => p.a0 - q.a0 || (p.storeys?.[0] ?? 0) - (q.storeys?.[0] ?? 0));
  // the right front: tympana on storeys 1-2, flat heads with a keystone on storey 3 (the face and D1; the round-6 review
  // reverted the "every storey" override)
  assert.deepEqual(hs.map(h => [h.a0, h.a1, h.dressing, h.storeys ?? null]), [[0, 0.5, 'keystone', null], [0.5, 1, 'segmental-tympanum', [1, 2]], [0.5, 1, 'keystone', [3]]]);
});

test('Kinkerstraat 86–88 (233580) is a member of 90\'s series: same heads, roof storey and window look (lane D, rule-10 pano)', () => {
  const s = rec(K, '0363100012233580').series!, s90 = rec(K, '0363100012155794').series!;
  assert.equal(s.id, s90.id);
  assert.deepEqual(s.heads, s90.heads);
  assert.equal(s.roofStorey?.kind, 'mansard');
  assert.deepEqual(s.roofStorey!.dormers, [{ a: 0.5, kind: 'pediment' }]);
});

test('Weteringschans 169016: souterrain, mansard, one pediment dormer with a hoist; 168096 a cornice front over basement windows, no roof storey', () => {
  const s = rec(W, '0363100012169016').series!;
  assert.equal(s.souterrain, true);
  assert.deepEqual(s.roofStorey!.dormers, [{ a: 0.5, kind: 'pediment', hoist: true }]);
  assert.equal(rec(W, '0363100012168096').series!.roofStorey!.kind, 'none');
  // A raised ground over low basement windows (basement: 'windows'): the low basement row, no stoop steps.
  assert.equal(rec(W, '0363100012168096').series!.souterrain, true);
  assert.equal(rec(W, '0363100012168096').series!.souterrainFactor, 0.35);
});

test('the series draws no extras beyond ROW_FRONT_EXTRAS unless the series states them (nothing rolled)', () => {
  for (const r of K) assert.equal(r.series!.extras, undefined, `${r.pandId}`);
  // Weteringschans: only the bands each house's reading states (lane D, integrator 2026-11-14: read and drawn, not dropped)
  // plus the kit parts its gaps name (balcony, porch, rusticated souterrain; lane R round 2)
  const wx = Object.fromEntries(W.map(r => [r.pandId.slice(-6), r.series!.extras ? [...r.series!.extras].sort() : undefined]));
  // 168042 states one shop unit, black-framed: the single shopfront, its door left as read (not a split by width).
  const shop = rowDressOf(rec(W, '0363100012168042').series!);
  assert.ok(shop.extras?.includes('row-shopfront'));
  assert.deepEqual(shop.shopFront, { frameHex: '#2c2824', side: 'left' });
  assert.deepEqual(wx, { 168096: ['floor-cornices'], 168042: undefined, 169016: ['floor-cornices', 'row-balcony', 'row-porch', 'speklagen', 'string-courses'], 171218: ['row-balcony', 'row-porch', 'row-rustication', 'speklagen'] });
  const none = seriesDraw([{ id: 'x', pandId: 'x', label: '', numbers: [], widthM: 5, seriesId: 's', ground: { use: 'dwelling' }, overrides: {}, topM: 12 }],
    [{ ...solveRow(loadRow(defs['kinkerstraat-86-110'], '2026-11-14').input).series[0].design, extras: { value: ['window-sills', 'speklagen'], source: 'face-intent', ref: 't' } }]);
  assert.deepEqual(none.extras, ['speklagen']);
});

test('a series member draws a mansard roof plan at its cornice line, never the hash roof', () => {
  const r = rec(K, '0363100012152925');
  const out = withFlag(K, () => withRowFront(feature(r.pandId, 17.1, { roofShape: 'gable', roofPlanned: true, specRecipe: { storeys: 4 } })));
  const p = out.properties;
  assert.equal(p.roofShape, 'mansardHip');
  assert.equal(p.roofEavesHeightM, r.eavesM);
  assert.equal(p.rowSeries, r.series!.id);
  const plan = roofPlanForFeature(out as never)!;
  assert.equal(plan.kind, 'mansardHip');
  assert.equal(plan.chimney, false);
  assert.equal(plan.rowDormers?.length, 1);
  assert.equal(plan.pieces?.length, 1);
});

test('the corner member (86–88) is wall-only: no roof of its own, the chunk keeps the mansard (lane D wall-only.json)', () => {
  const r = rec(K, '0363100012233580');
  const p = withFlag(K, () => withRowFront(feature(r.pandId, 16, { roofShape: 'gable', roofPlanned: true }))).properties;
  assert.equal(p.roofShape, 'flat');
  assert.equal(p.rowRoof, undefined);
});

test('the souterrain series draws one more storey with a souterrain ground cell (Weteringschans 171218)', () => {
  const r = rec(W, '0363100012171218');
  const sr = withFlag(W, () => withRowFront(feature(r.pandId, 17, { specRecipe: { storeys: 3 } }))).properties.specRecipe as Record<string, unknown>;
  assert.equal(sr.souterrain, true);
  assert.equal(sr.storeys, (r.storeys ?? 0) + 1);
  assert.ok(Number(sr.groundM) > 1.5 && Number(sr.groundM) < 3, `groundM ${sr.groundM}`);
});

test('mansard rise: stated wins, else one low series default (no per-pand 3DBAG rise: no saw-tooth)', () => {
  assert.equal(mansardRise(2.7), 2.7);
  assert.equal(mansardRise(undefined), MANSARD_RISE.period);
  assert.equal(MANSARD_RISE.period, 2.2);
});

test('the Kinkerstraat mansards join across party walls at one line; the row end (110) runs on to a plain end, no hip', () => {
  const j = (id: string) => rec(K, id).series!.roofStorey!.joins;
  assert.deepEqual(j('0363100012165799'), { left: true, right: true }, '110 is the row end: no hip without evidence');
  for (const id of ['0363100012236027', '0363100012159635', '0363100012152925', '0363100012160809', '0363100012158180', '0363100012156028', '0363100012236213'])
    assert.deepEqual(j(id), { left: true, right: true }, id);
  assert.deepEqual(j('0363100012155794'), { left: true, right: true }, '90 runs on into 86-88 at the same line (3DBAG 16.84 / 16.62 m)');
  assert.deepEqual(j('0363100012233580'), { left: true, right: true }, '86-88 continues the row mansard to the corner (rule-10 pano)');
});

test('one window look per series: bays per front, the series year and line, whatever the pand', () => {
  const looks = new Map<string, Set<string>>();
  // 86-88 (233580) states its own bay count (reviewed: 5 axes on the 7.7 m corner front, lane D); the rest of its look is 90's.
  for (const r of K) (looks.get(r.series!.id) ?? looks.set(r.series!.id, new Set()).get(r.series!.id)!).add(JSON.stringify({ ...r.series!.look, bays: r.pandId === '0363100012233580' ? 3 : r.series!.look!.bays }));
  for (const [sid, l] of looks) assert.equal(l.size, 1, `${sid}: one look`);
  assert.equal(rec(K, '0363100012233580').series!.look!.bays, 5, '86-88: the reviewed 5 axes');
  assert.equal(rec(K, '0363100012236027').series!.look!.bays, 3, 'a two-front pand still picks the 3-bay preset');
});

test('a row series front draws its stated bay count in narrow fronts (Kinkerstraat 102, 90: 3 axes in 4.2-4.3 m)', () => {
  assert.equal(specCellCount(3, 1, 4.2, 3.3, true), 3);
  assert.equal(specCellCount(6, 2, 8.8, 3.3, true), 3);
  assert.ok(specCellCount(3, 1, 4.2, 3.3) < 3, 'without the row flag the column cap holds (byte-identical)');
});

test('rowRoofOf refuses anything that is not a stated row roof', () => {
  assert.equal(rowRoofOf(undefined), null);
  assert.equal(rowRoofOf({ riseM: 'x', dormers: [] }), null);
  assert.ok(rowRoofOf({ riseM: 3, material: 'slate', series: 's', dormers: [{ a: 0.5, kind: 'pediment' }] }));
});

test('a pand without a record is returned untouched with the flag on (byte-identical upstream of the mesher)', () => {
  const f = feature('0363100012999999', 15, { roofShape: 'gable' });
  assert.equal(withFlag(K, () => withRowFront(f)), f);
});

test('a front may state several head dressings by storey; over a souterrain they shift one row up, storey-specific first', () => {
  const row = solveRow(loadRow(defs['weteringschans-168096-171218'], '2026-11-14').input);
  const f = row.fronts.find(x => x.pandId === '0363100012171218')!;
  f.overrides = { ...f.overrides, heads: { value: [{ shape: 'flat', dressing: 'stone-lintel', storeys: [1] }, { shape: 'round', dressing: 'arch-ring', storeys: [2] }] as never, source: 'single-read', ref: 'test' } };
  const s = rowFrontsWithSeries(row).find(r => r.pandId === f.pandId)!.series!;
  assert.deepEqual(s.heads!.map(h => [h.dressing, h.storeys]), [['stone-lintel', [2]], ['arch-ring', [3]]]);
});

test('every row mansard is the one dark slate, never a per-pand tone', () => {
  const plan = (id: string) => roofPlanForFeature(withFlag(W, () => withRowFront(feature(id, 17, { specRecipe: { storeys: 3 } }))) as never)!;
  assert.equal(plan('0363100012169016').tone, ROW_SLATE_TONE);
  assert.equal(plan('0363100012171218').tone, ROW_SLATE_TONE);
  assert.equal(plan('0363100012169016').rowDormers?.[0].hoist, true, '169016 carries the hoist');
  assert.equal(plan('0363100012171218').rowDormers?.[0].hoist, undefined, '171218 has none');
});

test('Weteringschans round 4: the record\'s door, shop, stoop, balcony and measured mansard rise reach the series draw', () => {
  const by = (id: string) => W.find(r => r.pandId === id)!.series!;
  // 168042's ground reads a shop; 168096's a dwelling with its door left.
  assert.equal(by('0363100012168042').shop, true);
  assert.equal(by('0363100012168096').shop, false);
  assert.equal(by('0363100012168096').door?.side, 'left');
  // 168096: basement windows under a raised ground, no stoop read: the door at the raised ground, no steps.
  assert.deepEqual(by('0363100012168096').stoop, { side: 'left', steps: false });
  assert.equal(by('0363100012168096').souterrain, true);
  assert.equal(by('0363100012168042').souterrain, undefined);
  // 169016 and 171218: a stoop to the left bel-etage door; the balcony one row over the bel-etage (D storey 1 + souterrain).
  for (const id of ['0363100012169016', '0363100012171218']) {
    assert.deepEqual(by(id).stoop, { side: 'left' });
    assert.deepEqual(by(id).balcony, { storeys: [2], axis: 'centre' });
  }
  // The low mansard measured on the photo, for this row only; Kinkerstraat keeps the period rise.
  assert.equal(by('0363100012169016').roofStorey?.riseM, 1.3);
  assert.equal(K.find(r => r.series?.roofStorey?.kind === 'mansard')!.series!.roofStorey!.riseM, undefined);
});

test('a stated dormer always draws, whatever the rise: on a low mansard it stands on the front slope and rises above it', () => {
  // Weteringschans review 4: the 1.3 m mansard culled both dormers (169016's hoist dormer, 171218's pediment).
  for (const id of ['0363100012169016', '0363100012171218']) {
    const r = rec(W, id);
    for (const riseM of [0.8, 1.3, 2.2]) {
      const rr = { ...r, series: { ...r.series!, roofStorey: { ...r.series!.roofStorey!, riseM } } };
      const out = withFlag([rr], () => withRowFront(feature(r.pandId, 17.1, { roofShape: 'gable', roofPlanned: true, specRecipe: { storeys: 4 } })));
      const plan = roofPlanForFeature(out as never)!;
      assert.ok(plan.rowDormers?.length, `${id} @${riseM}: dormers planned`);
      const tris = plan.pieces!.flatMap(p => roofTriangles(p.rect, p.plan, Number(out.properties.roofEavesHeightM), { bayM: 2, storeyM: 3, cellM: 1 }));
      const faces = tris.filter(t => t.part === 'dormerFace');
      assert.ok(faces.length >= 2, `${id} @${riseM}: a dormer face drawn (${faces.length})`);
      const top = Math.max(...tris.filter(t => t.part === 'dormerFace').flatMap(t => t.p.map(q => q[2])));
      if (riseM < 1.5) assert.ok(top > Math.max(...tris.filter(t => t.part === 'slope').flatMap(t => t.p.map(q => q[2]))) - 0.6, `${id} @${riseM}: the dormer rises to the roof top or above`);
    }
  }
});

test('series members draw identical storey lines: one ground height and count from the series line, whatever the front width', () => {
  // Kinkerstraat review 4: 102 (4.26 m front) drew its ground 3.59 m, 104 (4.83 m) 3.78 m, so 102's first storey sat low.
  const lines = ['0363100012152925', '0363100012159635', '0363100012160809', '0363100012165799'].map(id => {
    const out = withFlag(K, () => withRowFront(feature(id, 17.1, { roofShape: 'gable', roofPlanned: true, specRecipe: { storeys: 4 } })));
    const sr = out.properties.specRecipe as { groundM?: number; storeys?: number; eavesM?: number };
    return [sr.groundM, sr.storeys, out.properties.roofEavesHeightM];
  });
  assert.ok(Number(lines[0][0]) > 3);
  for (const l of lines) assert.deepEqual(l, lines[0]);
});

test('the record\'s window kind sets the series glazing: T-windows and toplit casements paint large panes under a transom', () => {
  for (const r of [...W, ...K]) assert.equal(r.series!.look!.sash, 'transom', r.pandId);
});

test('a row type states its window width: kinker-1890-plain-brick windows take 75 % of their axis pitch', () => {
  for (const r of K) assert.equal(r.series!.windowShare, 0.75, r.pandId);
  for (const r of W) assert.equal(r.series!.windowShare, undefined, r.pandId);
});

test('Kinkerstraat 110 (corner end): its slate mansard faces Kinkerstraat, not the nearer side street (no pyramid)', () => {
  const r = rec(K, '0363100012165799');
  const out = withFlag(K, () => withRowFront({ ...feature(r.pandId, 16, { roofShape: 'gable', roofPlanned: true }), geometry: { type: 'Polygon', coordinates: ring(5.2, 13) } }));
  const p = out.properties;
  assert.equal(p.roofShape, 'mansardHip');
  assert.equal((p.rowRoof as { frontM?: number }).frontM, 5.2, 'the member\'s front width reaches the roof');
  const plan = roofPlanForFeature(out as never)!;
  assert.equal(plan.kind, 'mansardHip');
  assert.equal(plan.material, 'slate');
  assert.equal(plan.pieces?.[0].plan.rowFrontM, 5.2);
  // 110's outline: a 5.2 m front on Kinkerstraat (y = 0, 8.0 m from the street), 13 m deep, its long side wall 6.9 m
  // from the cross street (the measured distances, tile 14/8413/5384). The nearest street wall is the side one.
  const lat0 = 52.381, kx = 111_320 * Math.cos(lat0 * Math.PI / 180), origin = { lng: 4.888, lat: lat0 };
  const outer = ((out as { geometry: { coordinates: number[][][] } }).geometry.coordinates[0]);
  const facing = (w: { nx: number; ny: number }) => w.ny < -0.9 ? 8.0 : w.nx > 0.9 ? 6.9 : Infinity;
  const h0 = Number(p.roofEavesHeightM), rise = Number(p.height) - h0;
  const deck = (pl: typeof plan) => {
    const top = roofTrianglesForOutline(outer, origin, pl, h0, { bayM: 2, storeyM: 3, cellM: 1 }, kx, facing).filter(t => t.part === 'plate' || t.part === undefined)
      .flatMap(t => t.p).filter(q => Math.abs(q[2] - (h0 + rise)) < 0.05);
    const ys = top.map(q => q[1]), xs = top.map(q => q[0]);
    return { along: Math.max(...ys) - Math.min(...ys), across: Math.max(...xs) - Math.min(...xs) };
  };
  const d = deck(plan);
  assert.ok(d.along > 8 && d.across < 5.3, `the mansard deck runs back from the front (${d.along.toFixed(1)} m deep, ${d.across.toFixed(1)} m wide)`);
  // Without the stated front the side wall wins: the box turns, its hips land on the front and party walls (in game, on
  // 110's kinked outline, a pyramid).
  const blind = { ...plan, pieces: plan.pieces!.map(pc => ({ ...pc, plan: { ...pc.plan, rowFrontM: undefined } })) };
  const old = deck(blind);
  assert.ok(old.across < d.across - 1, `no front width: the box faced the side street, its hips across the 5.2 m front (${old.along.toFixed(1)} x ${old.across.toFixed(1)})`);
});

test('a chunk-owned corner (86-88): the row draws its stated street wall as a slab under its own id, the chunk keeps the rest', () => {
  // Lane D states the chunk and the Kinkerstraat edge on the member; rowFrontsWithSeries carries it to the record.
  const solved = solveRow(loadRow(defs['kinkerstraat-86-110'], '2026-11-14').input);
  const lng = 4.888, lat = 52.381, kx = 111_320 * Math.cos(lat * Math.PI / 180);
  const edge: [[number, number], [number, number]] = [[lng, lat], [lng + 7.69 / kx, lat]];
  const member = solved.members.find(m => m.pandId === '0363100012233580')!;
  const withWall = { ...solved, members: solved.members.map(m => m === member ? { ...m, wallOnly: { chunk: 'chunk-face-bilder-233580-162444', edge } } : m) };
  const KW = rowFrontsWithSeries(withWall);
  const r = rec(KW, '0363100012233580');
  assert.deepEqual(r.wallOnly, { chunk: 'chunk-face-bilder-233580-162444', edge });
  // The staged row states it (scripts/house-specs/rows/wall-only.json, lane D): the BAG Kinkerstraat edge, left to right.
  assert.equal(rec(K, '0363100012233580').wallOnly?.chunk, 'chunk-face-bilder-233580-162444');
  assert.equal(rec(K, '0363100012155794').wallOnly, undefined, 'no stated wall: the record as before');
  // The pand's footprint behind the edge (y > 0): 7.69 m along Kinkerstraat, 10 m deep.
  const ll = (x: number, y: number) => [lng + x / kx, lat + y / 110_540];
  const f = { ...feature(r.pandId, 16, { roofShape: 'gable', roofPlanned: true }), geometry: { type: 'Polygon', coordinates: [[ll(0, 0), ll(7.69, 0), ll(7.69, 10), ll(0, 10), ll(0, 0)]] } };
  const out = withFlag(KW, () => withRowFront(f)) as typeof f;
  const p = out.properties;
  assert.equal(p.id, `NL.IMBAG.Pand.${r.pandId}${ROW_WALL_SUFFIX}`, 'its own mesh id: the chunk\'s suppression of the pand does not hide it');
  assert.equal(p.rowRoof, undefined, 'no row roof: the chunk\'s mansard stands over it');
  assert.equal(p.roofShape, 'flat');
  assert.equal(p.height, r.eavesM, 'the wall stands to the series line');
  assert.equal(p.rowSeries, r.series!.id);
  assert.ok(p.rowDress, 'the series dress');
  const ring = (out.geometry as { coordinates: number[][][] }).coordinates[0].map(([x, y]) => [(x - lng) * kx, (y - lat) * 110_540]);
  assert.equal(ring.length, 5);
  // Within the world cells' 1e-7 degree grid (about 1 cm): the compile bakes the slab as the pand's footprint.
  const near = (a: number, b: number) => Math.abs(a - b) < 0.012;
  assert.ok(near(ring[0][0], 0) && near(ring[0][1], 0) && near(ring[1][0], 7.69) && near(ring[1][1], 0), 'its face on the stated edge');
  for (const q of ring.slice(2, 4)) assert.ok(near(q[1], ROW_WALL_SLAB.depthM), 'its back inside the footprint');
  for (const [x, y] of (out.geometry as { coordinates: number[][][] }).coordinates[0]) for (const v of [x, y]) assert.equal(Math.round(v * 1e7) / 1e7, v, 'on the 1e-7 grid');
  assert.ok(ring[2][0] < 7.69 && ring[3][0] > 0, 'its ends slant inward, never in the plane of the chunk\'s side wall');
  // A 0.4 m slab is shed-sized: it must never fall to the garden-shed rule (bare walls; the game drew 86-88 blank).
  const far = new SegmentGrid(Float32Array.from([1e5, 1e5, 1e5 + 1, 1e5]));
  assert.equal(isGardenShed(out as never, far, { lng, lat }), false);
  assert.equal(isGardenShed({ ...out, properties: { ...p, rowWallOnly: undefined } } as never, far, { lng, lat }), true, 'without the mark it would be a shed');
  // Flag off: untouched.
  assert.equal(withRowFront(f), f);
});

// Round 2 (Kinkerstraat 126-138, pand 233461): one pand, seven fronts of two series, s2's two fronts (m3, m6) to 16.45 m
// over s1's 13.45 m line. Before: one wall to the line for all seven, and on its kinked street run (3.2 + 11.5 + 18.0 m,
// 19 axes) the glass on the run's grid while the frames took each edge's own, half a bay apart over the middle fronts.
test('a member whose fronts stand to two lines draws a raised front on each taller span; its kinked run paints one grid', () => {
  const base = rec(K, '0363100012165799'), line = base.eavesM!;
  const a = [0, 0.15, 0.3, 0.45, 0.56, 0.73, 0.89, 1], tall = new Set([3, 6]);
  const subFronts = a.slice(0, -1).map((a0, i) => ({ a0, a1: a[i + 1], eavesM: tall.has(i) ? line + 3 : line, topM: tall.has(i) ? line + 3 : line, crown: { family: 'cornice' as const } }));
  const r = { ...base, pandId: '0363100012233461', subFronts, spanM: 32.8 };
  const raised = rowRaisedFronts(r, line)!;
  assert.equal(raised.length, 7);
  raised.forEach((f, i) => {
    assert.equal(f.step.wallTopM, line, 'every wall stops at the series line');
    if (tall.has(i)) { assert.equal(f.step.crown?.shape, 'raised'); assert.equal(f.step.crown?.riseM, 3); assert.equal(f.step.crown?.bandM, 3, 'a full-width front to its own top'); }
    else assert.equal(f.step.crown, undefined);
  });
  const p = withFlag([r], () => withRowFront(feature(r.pandId, 16))).properties as any;
  assert.equal(p.rowSeries, base.series!.id);
  assert.equal(p.roofEavesHeightM, line, 'the series mansard stands on the line');
  assert.deepEqual(p.specRecipe.subFronts.map((f: any) => f.step.crown?.riseM ?? 0), [0, 0, 0, 3, 0, 0, 3]);
  // One line (every published round-1 member): nothing changes.
  assert.equal(rowRaisedFronts({ ...r, subFronts: subFronts.map(f => ({ ...f, eavesM: line, topM: line + ROW_RAISED_FRONT_M })) }, line), null);
  assert.equal(rowRaisedFronts({ ...r, spanM: undefined }, line), null, 'no width, no raised fronts');
  const plain = withFlag([base], () => withRowFront(feature(base.pandId, 16))).properties as any;
  assert.equal(plain.specRecipe?.subFronts, undefined);
  // The kinked run: each edge on its own whole bays, numbered on along the run (the extras' edgeLayout grid).
  const bw = 32.68 / 19, grid = rowEdgeGrid({ bays: 19, bayWidthM: bw, groundM: 3.6, storeys: 3, storeyM: 3.2, doorBays: [], lengthM: 32.68, edgeStartM: [0, 3.17, 14.7] }, [3.17, 11.53, 17.99]);
  assert.deepEqual(grid, [{ u0: 0, bays: 2 }, { u0: 2, bays: 7 }, { u0: 9, bays: 10 }]);
});

test('a stated gable (RowDesign.gable) draws the kit outline on the series line; absent, the record is unchanged', async () => {
  const { crownDims } = await import('./crownProfile.ts');
  const row = structuredClone(solveRow(loadRow(defs['kinkerstraat-86-110'], '2026-11-14').input));
  const m = row.members.find(x => x.fronts.length === 1 && x.widthM && !(x as { wallOnly?: unknown }).wallOnly)!;
  const f = row.fronts.find(x => x.id === m.fronts[0])!;
  const before = rec(K, m.pandId);
  f.overrides = { ...f.overrides, crown: { value: 'step', source: 'reviewed', ref: 'test' }, gable: { value: { riseM: 3, steps: 3, attic: 1 }, source: 'reviewed', ref: 'test' } };
  const r = rowFrontsWithSeries(row).find(x => x.pandId === m.pandId)!, line = before.eavesM!;
  assert.equal(r.eavesM, line, 'the gable stands on the series line');
  assert.equal(r.topM, +(line + 3).toFixed(2));
  assert.deepEqual(r.crown, { family: 'step', riseM: 3, steps: 3, atticWindows: 1 });
  assert.equal(r.spanM, m.widthM);
  const p = withFlag([r], () => withRowFront(feature(r.pandId, 16))).properties as any;
  assert.equal(p.rowSeries, before.series!.id, 'a gabled member keeps its series design');
  assert.equal(p.roofEavesHeightM, line, 'the wall stops at the line');
  assert.equal(p.specRecipe.subFronts.length, 1);
  const st = p.specRecipe.subFronts[0].step;
  assert.equal(st.wallTopM, line);
  assert.equal(st.gable, 'step');
  assert.deepEqual(st.crown, { shape: 'step', riseM: 3, steps: 3, attic: 1 });
  assert.equal(crownDims(st.crown, m.widthM!).steps, 3, 'the stated tread count');
  assert.equal(crownDims({ shape: 'step', riseM: 3 }, 6).steps, 4, 'unstated: one per 0.85 m as before');
  // A pointed gable on one sub-front of a two-front pand (Kinkerstraat 369): the kit's triangle on that span only.
  const subs = [{ a0: 0, a1: 0.53, eavesM: line, topM: line, crown: { family: 'cornice' as const } }, { a0: 0.53, a1: 1, eavesM: line, topM: line + 2.6, crown: { family: 'point' as const, riseM: 2.6, atticWindows: 1 } }];
  const two = rowRaisedFronts({ ...before, subFronts: subs, spanM: 8.3 }, line)!;
  assert.equal(two[0].step.crown, undefined);
  assert.equal(two[1].step.gable, 'plain');
  assert.deepEqual(two[1].step.crown, { shape: 'point', riseM: 2.6, attic: 1 });
  // The crown kind alone (no gable stated): the record and the drawing are today's.
  const row2 = structuredClone(solveRow(loadRow(defs['kinkerstraat-86-110'], '2026-11-14').input));
  row2.fronts.find(x => x.id === m.fronts[0])!.overrides.crown = { value: 'step', source: 'reviewed', ref: 'test' };
  const r2 = rowFrontsWithSeries(row2).find(x => x.pandId === m.pandId)!;
  assert.equal(r2.topM, line); assert.deepEqual(r2.crown, { family: 'step' }); assert.equal(r2.spanM, before.spanM);
});
