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
const { resetRowFront, setRowFrontRecords, withRowFront, mansardRise, MANSARD_RISE } = await import('./rowFront.ts');
const { roofPlanForFeature, rowRoofOf, ROW_SLATE_TONE, roofTriangles } = await import('../roofMesh.ts');
const { specCellCount } = await import('../streetFacadeRendering.ts');

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

test('Kinkerstraat 106–108 (236027) draws one pediment dormer per front, centred in each half', () => {
  const s = rec(K, '0363100012236027').series!;
  assert.equal(s.roofStorey?.kind, 'mansard');
  assert.deepEqual(s.roofStorey!.dormers.map(d => [d.a, d.kind]), [[0.25, 'pediment'], [0.75, 'pediment']]);
  assert.equal(s.roofStorey!.riseM, undefined, 'the record states no rise: 3DBAG or the period default decides');
});

test('Kinkerstraat 92–94 (236213) wears its two series: keystones on the left front, tympana on the right', () => {
  const s = rec(K, '0363100012236213').series!;
  const hs = [...s.heads!].sort((p, q) => p.a0 - q.a0 || (p.storeys?.[0] ?? 0) - (q.storeys?.[0] ?? 0));
  // the right front: tympana on storeys 1-2, flat heads with a keystone on storey 3 (the face and D1; the round-6 review
  // reverted the "every storey" override)
  assert.deepEqual(hs.map(h => [h.a0, h.a1, h.dressing, h.storeys ?? null]), [[0, 0.5, 'keystone', null], [0.5, 1, 'segmental-tympanum', [1, 2]], [0.5, 1, 'keystone', [3]]]);
});

test('Kinkerstraat 86–88 (233580) has no mansard evidence: a flat lid, no dormers', () => {
  const s = rec(K, '0363100012233580').series!;
  assert.equal(s.roofStorey?.kind, 'none');
  assert.equal(s.roofStorey!.dormers.length, 0);
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

test('the flat-lid series member (86–88) gets a flat roof at its top', () => {
  const r = rec(K, '0363100012233580');
  const p = withFlag(K, () => withRowFront(feature(r.pandId, 16, { roofShape: 'gable', roofPlanned: true }))).properties;
  assert.equal(p.roofShape, 'flat');
  assert.equal(p.height, r.eavesM);
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
  assert.equal(rec(K, '0363100012233580').series!.roofStorey!.joins, undefined);
});

test('one window look per series: bays per front, the series year and line, whatever the pand', () => {
  const looks = new Map<string, Set<string>>();
  for (const r of K) (looks.get(r.series!.id) ?? looks.set(r.series!.id, new Set()).get(r.series!.id)!).add(JSON.stringify(r.series!.look));
  for (const [sid, l] of looks) assert.equal(l.size, 1, `${sid}: one look`);
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
