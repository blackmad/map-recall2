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
const { roofPlanForFeature, rowRoofOf } = await import('../roofMesh.ts');

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
  assert.deepEqual(s.heads!.map(h => [h.a0, h.a1, h.dressing]), [[0, 0.5, 'keystone'], [0.5, 1, 'segmental-tympanum']]);
  assert.deepEqual(s.heads![1].storeys, [1, 2]);
});

test('Kinkerstraat 86–88 (233580) has no mansard evidence: a flat lid, no dormers', () => {
  const s = rec(K, '0363100012233580').series!;
  assert.equal(s.roofStorey?.kind, 'none');
  assert.equal(s.roofStorey!.dormers.length, 0);
});

test('Weteringschans 169016: souterrain, mansard, one pediment dormer with a hoist; 168096 a cornice front, no roof storey', () => {
  const s = rec(W, '0363100012169016').series!;
  assert.equal(s.souterrain, true);
  assert.deepEqual(s.roofStorey!.dormers, [{ a: 0.5, kind: 'pediment', hoist: true }]);
  assert.equal(rec(W, '0363100012168096').series!.roofStorey!.kind, 'none');
  assert.equal(rec(W, '0363100012168096').series!.souterrain, undefined);
});

test('the series draws no extras beyond ROW_FRONT_EXTRAS unless the series states them (nothing rolled)', () => {
  for (const r of K) assert.equal(r.series!.extras, undefined, `${r.pandId}`);
  // Weteringschans: only the bands each house's reading states (lane D, integrator 2026-11-14: read and drawn, not dropped)
  const wx = Object.fromEntries(W.map(r => [r.pandId.slice(-6), r.series!.extras]));
  assert.deepEqual(wx, { 168096: ['floor-cornices'], 168042: undefined, 169016: ['floor-cornices', 'string-courses'], 171218: ['speklagen'] });
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

test('mansard rise: stated wins, then 3DBAG over the line within range, else the period default', () => {
  assert.equal(mansardRise(2.7, 20, 14), 2.7);
  assert.equal(mansardRise(undefined, 17.1, 14.18), 2.92);
  assert.equal(mansardRise(undefined, 30, 14), MANSARD_RISE.max);
  assert.equal(mansardRise(undefined, 15, 14), MANSARD_RISE.period);
  assert.equal(mansardRise(undefined, undefined, 14), MANSARD_RISE.period);
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
