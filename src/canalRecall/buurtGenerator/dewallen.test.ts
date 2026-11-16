import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buurtKitOf } from './kit/frontKit.ts';
import { buurtRoofKitFor, kitDrawsFront } from './kit/roofKit.ts';
import { resetRowFront, setRowFrontRecords, withRowFront, type RowFrontRecord } from '../houseLine/rowFront.ts';
import { roofPlanForFeature, roofTrianglesForOutline } from '../roofMesh.ts';
import { recordFor, stage, storeysFor, type DeWallenAudit } from '../../../scripts/buurt-generators/dewallen-window-fronts.ts';

const DIR = 'data/buurt-generators/dewallen';
const audit = JSON.parse(fs.readFileSync(`${DIR}/audit.json`, 'utf8')) as DeWallenAudit;
const recOf = (id: string) => recordFor(audit.fronts.find(f => f.pandId.endsWith(id))!, audit.generatedAt) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

test('De Wallen (rounds 17-18): every audited window front is a record; none is staged for publishing', () => {
  const c = audit.counts;
  assert.equal(c.tagged, c.windowRows + c.readNotDrawn + c.closedOrNotWindow + c.noView, 'every tagged pand has one verdict');
  assert.equal(c.windowRows, audit.fronts.length);
  assert.ok(audit.fronts.every(f => f.crown && f.bays), 'every front has its crown and bays read');
  // Round 18: the retail lane draws these fronts ground-only from the audit; publish.ts must find nothing to take here.
  assert.ok(!fs.existsSync(`${DIR}/row-front.json`), 'no staged copy for publish.ts --districts=dewallen');
  const { records, held } = stage(audit);
  assert.equal(records.length, audit.fronts.length); assert.equal(held.length, 0);
  for (const r of records as Array<Record<string, any>>) {
    const kit = buurtKitOf(r.buurtKit);
    assert.ok(kit?.windowFronts?.length === 1, `${r.pandId}: one window front`);
    const roof = buurtRoofKitFor(kit!, r.eavesM, r.storeys, 3.4)!;
    assert.ok(roof && kitDrawsFront(roof) && roof.footZ === -r.eavesM, `${r.pandId}: drawn from the pavement`);
  }
  assert.equal(storeysFor(9.33), 3);
  assert.equal(storeysFor(2.9), 2, 'never fewer than two (a lower annex is held in the audit)');
});

test('round 18 pins: bays as read on the crop, not one per 1.6 m (the blind judge: "4 instead of 2-3")', () => {
  for (const [id, want, rule] of [['177899', 2, 4], ['178478', 3, 4], ['182846', 1, 2], ['171947', 2, 3]] as const) {
    const r = recOf(id), f = audit.fronts.find(x => x.pandId.endsWith(id))!;
    assert.equal(Math.round(f.lenM / 1.6), rule, `${id}: what the width rule drew`);
    assert.equal(r.bays, want, `${id}: bays read`);
    assert.equal(r.series.look.bays, want);
  }
});

// A 10 m deep box behind the record's front line (the line left to right as seen from the street), at least 4 m wide
// (the roof planner's 3.6 m floor; 182846's BAG footprint is wider than its 3.55 m read front).
function boxBehind(line: readonly [readonly [number, number], readonly [number, number]], depthM = 10): number[][] {
  const [a0, b0] = line, kx = 111_320 * Math.cos(a0[1] * Math.PI / 180), ky = 110_540;
  const ux = (b0[0] - a0[0]) * kx, uy = (b0[1] - a0[1]) * ky, l = Math.hypot(ux, uy), nx = uy / l, ny = -ux / l, pad = Math.max(0, (4 - l) / 2);
  const a: [number, number] = [a0[0] - ux / l * pad / kx, a0[1] - uy / l * pad / ky], b: [number, number] = [b0[0] + ux / l * pad / kx, b0[1] + uy / l * pad / ky];
  const back = (p: [number, number]): number[] => [p[0] - nx * depthM / kx, p[1] - ny * depthM / ky];
  return [[...a], [...b], back(b), back(a), [...a]];
}
const feature = (id: string, ring: number[][]) => ({ type: 'Feature', properties: <Record<string, unknown>>{ id: `NL.IMBAG.Pand.${id}`, height: 11, minHeight: 0, constructionYear: 1700 },
  geometry: { type: 'Polygon', coordinates: [ring] } });

test('round 18 pins: a kit record keeps its stated gable (177899 point, 178478 neck, 182846 low point) with the window front under it', () => {
  process.env.ROW_FRONT = '1'; resetRowFront();
  const g = globalThis as { __canalRecallBuurtKit?: boolean };
  try {
    for (const [id, shape] of [['177899', 'point'], ['178478', 'neck'], ['182846', 'point']] as const) {
      const r = recOf(id), ring = boxBehind(r.buurtKit.frontLine);
      setRowFrontRecords([r]);
      g.__canalRecallBuurtKit = true;
      const on = withRowFront(feature(r.pandId, ring)), p = on.properties as Record<string, any>;
      assert.equal(p.roofShape, 'gable', `${id}: a gable, not a flat lid at the 3DBAG height`);
      assert.equal(p.rowCrown?.shape, shape, `${id}: the read crown`);
      assert.equal(p.roofEavesHeightM, r.eavesM, `${id}: the gable's foot as read`);
      assert.ok(p.rowKit?.kit?.windowFronts?.length === 1 && !p.rowKit.kit.roofHex, `${id}: the kit rides on the crown, without the flat series' coping hex`);
      const plan = roofPlanForFeature(on as never)!, o = (on.geometry as { coordinates: number[][][] }).coordinates[0];
      const tris = roofTrianglesForOutline(o, { lng: o[0][0], lat: o[0][1] }, plan, r.eavesM, { bayM: 2, storeyM: 3, cellM: 1 }, 111_320 * Math.cos(o[0][1] * Math.PI / 180));
      const kitZ = tris.filter(t => t.kit).flatMap(t => t.p.map(q => q[2])), crownZ = tris.filter(t => !t.kit).flatMap(t => t.p.map(q => q[2]));
      assert.ok(kitZ.length && Math.min(...kitZ) < 0.1, `${id}: the window front stands on the pavement`);
      assert.ok(Math.max(...kitZ) < r.eavesM, `${id}: under the gable's foot`);
      assert.ok(Math.max(...crownZ) > r.eavesM + 1, `${id}: the crown rises over its foot`);
      // The flag off: the record's crown as before, without the kit (lane 1's gabled records are untouched).
      g.__canalRecallBuurtKit = false;
      const off = withRowFront(feature(r.pandId, ring)).properties as Record<string, any>;
      assert.equal(off.rowKit, undefined, `${id}: no kit with the flag off`);
    }
  } finally { delete g.__canalRecallBuurtKit; process.env.ROW_FRONT = '0'; resetRowFront(); setRowFrontRecords([]); }
});

test('round 18: a gabled record without a kit draws exactly as before with the kit flag on', () => {
  process.env.ROW_FRONT = '1'; resetRowFront();
  const g = globalThis as { __canalRecallBuurtKit?: boolean };
  try {
    const r = recOf('177899'), { buurtKit: _k, ...plain } = r, ring = boxBehind(r.buurtKit.frontLine);
    setRowFrontRecords([plain as RowFrontRecord]);
    g.__canalRecallBuurtKit = true; const on = withRowFront(feature(r.pandId, ring));
    g.__canalRecallBuurtKit = false; const off = withRowFront(feature(r.pandId, ring));
    assert.deepEqual(on, off);
    assert.equal((on.properties as Record<string, unknown>).rowKit, undefined);
  } finally { delete g.__canalRecallBuurtKit; process.env.ROW_FRONT = '0'; resetRowFront(); setRowFrontRecords([]); }
});
