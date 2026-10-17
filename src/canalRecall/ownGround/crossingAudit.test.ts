// Zebra crossings: one per real crossing, stripes parallel and along the road, clipped, evenly spaced
// (surveyMarkings.ts planCrossings, RoadIndex.crossingStrips) and the audit that measures it (crossingAudit.ts):
//   node --import tsx --test src/canalRecall/ownGround/crossingAudit.test.ts
//
// Synthetic scenes first, then the named regressions on the published extracts (roadRegressions.ts CROSSINGS) and
// the city-wide audit totals (every crossing the renderer draws in the roads-v1 cells).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { encodeLine } from './parks';
import { kerbEdges, RoadIndex } from './roadSurfaces';
import { prepareWays, type LocalWay } from './streets';
import { buildSurveyMarkings, ZEBRA, type DrawnCrossing } from './surveyMarkings';
import { auditCrossings, AUDIT_CATEGORIES, CROSSING_AUDIT_MAX, lineAngle, type AuditCategory, type GroundAt } from './crossingAudit';
import { GroundStore, toLocal } from './groundStore';
import { auditCity, cellCrossings, exactGround, roadDirOf } from './crossingCells';
import { CROSSINGS } from './roadRegressions';
import type { RoadMark } from './roadMarks';
import type { RoadCell, RoadClass, RoadMesh } from './roadCells';
import type { Vec2 } from './surface';

type Poly = { c: RoadClass; k: RoadMesh; ring: Vec2[] };
const cellOf = (polys: Poly[]): RoadCell => ({ version: 1, key: '0_0', surfaces: polys.map(p => ({ k: p.k, c: p.c, h: 0, r: [encodeLine(p.ring)] })), kerbs: kerbEdges(polys.map(p => ({ c: p.c, h: 0, rings: [p.ring] }))).map(encodeLine), coverWays: [] });
const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
/** An 8 m N–S carriageway with pavements either side. */
const ROAD: Poly[] = [
  { c: 'carriage', k: 'asphalt', ring: rect(-4, -60, 4, 60) },
  { c: 'foot', k: 'paving', ring: rect(-10, -60, -4, 60) },
  { c: 'foot', k: 'paving', ring: rect(4, -60, 10, 60) },
];
const ways = (list: { id: number; tags: Record<string, string>; g: Vec2[] }[]) => prepareWays(list, p => p as Vec2);
const ROAD_WAY = { id: 1, tags: { highway: 'tertiary' }, g: [[0, -60], [0, 60]] as Vec2[] };
const FOOTWAY = { id: 2, tags: { highway: 'footway' }, g: [[-10, 20], [10, 20]] as Vec2[] };
const zebraAt = (p: Vec2): RoadMark => ({ p, kind: 'zebra', signalised: false, dir: 0 });

function build(polys: Poly[], w: LocalWay[], marks: RoadMark[], strips = false) {
  const index = new RoadIndex([cellOf(polys)]);
  if (strips) index.crossingStrips(marks.map(m => ({ p: m.p, r: [0, 1] as Vec2 })));
  const out = buildSurveyMarkings({ ways: w, marks, ownsWay: () => true, ownsPoint: () => true, index, height: () => 0, lift: { paint: 0.01, red: 0.01 } });
  return { ...out, index, audit: auditCrossings(out.crossings, exactGround(index), ZEBRA, () => true, roadDirOf(w)) };
}
const zero = (counts: Record<AuditCategory, number>, except: AuditCategory[] = ['cobbles']) => AUDIT_CATEGORIES.filter(k => !except.includes(k) && counts[k] > 0).map(k => `${k} ${counts[k]}`);

test('the nodes of one crossing on every way it crosses draw one zebra (Magna Plaza: a fan of five)', () => {
  // OSM: the footway crosses a cycle path (x = 6), the carriageway (x = 0), a bus lane way (x = 2.5) and the
  // pavement (x = -6); each crossing is a node. Only the carriageway and bus lane nodes are on the road.
  const w = ways([ROAD_WAY, FOOTWAY, { id: 3, tags: { highway: 'busway' }, g: [[2.5, -60], [2.5, 60]] }, { id: 4, tags: { highway: 'cycleway' }, g: [[6, -60], [6, 20], [6, 60]] }]);
  const r = build(ROAD, w, [zebraAt([0, 20]), zebraAt([2.5, 20.4]), zebraAt([6, 20]), zebraAt([-6, 20]), zebraAt([0.05, 21.3])]);
  assert.equal(r.crossings.length, 1, `one zebra, got ${r.crossings.length}`);
  assert.deepEqual(zero(r.audit.counts), []);
  const c = r.crossings[0];
  assert.ok(lineAngle(c.r, [0, 1]) < 1, 'stripes along the road');
  assert.ok(c.to - c.from > 7 && c.to - c.from <= 8.01, `kerb to kerb, row ${(c.to - c.from).toFixed(2)}`);
});

test('a crossing node beside the road (on the pavement) draws nothing', () => {
  const r = build(ROAD, ways([ROAD_WAY, FOOTWAY]), [zebraAt([-6, 20])]);
  assert.equal(r.crossings.length, 0);
});

test('stripes follow the kerbs where the road way kinks at the node', () => {
  // The way jogs 1.5 m sideways over 2 m at the crossing (a segment 37° off the road); the stripes stay along it.
  const w = ways([{ id: 1, tags: { highway: 'tertiary' }, g: [[0, -60], [0, 19], [1.5, 21], [1.5, 60]] }, FOOTWAY]);
  const r = build(ROAD, w, [zebraAt([0.75, 20])]);
  assert.equal(r.crossings.length, 1);
  assert.ok(lineAngle(r.crossings[0].r, [0, 1]) < 2, `stripes ${lineAngle(r.crossings[0].r, [0, 1]).toFixed(1)}° off the road`);
  assert.deepEqual(zero(r.audit.counts), []);
});

test('an oblique kerb: every stripe drawn, none dropped by the clipping (no alternate stripes)', () => {
  // The east kerb runs at 20° across the crossing: stripes end on it at different lengths, but every one is drawn.
  const polys: Poly[] = [{ c: 'carriage', k: 'asphalt', ring: [[-4, -60], [4, -60], [4, 14], [6.2, 26], [6.2, 60], [-4, 60]] }, { c: 'foot', k: 'paving', ring: [[4, -60], [12, -60], [12, 60], [6.2, 60], [6.2, 26], [4, 14]] }];
  const r = build(polys, ways([ROAD_WAY, FOOTWAY]), [zebraAt([0, 20])]);
  assert.equal(r.crossings.length, 1);
  const is = r.crossings[0].stripes.map(s => s.i);
  assert.deepEqual(is, is.map((_, k) => is[0] + k), `consecutive stripes, got ${is.join(' ')}`);
  assert.deepEqual(zero(r.audit.counts), []);
});

test('a BGT voetpad strip across the road at a crossing draws as carriageway with the zebra on it; an island along the road stays', () => {
  const strip: Poly[] = [
    { c: 'carriage', k: 'klinker', ring: rect(-4, -60, 4, 18) },
    { c: 'foot', k: 'paving', ring: rect(-4, 18, 4, 22) },
    { c: 'carriage', k: 'klinker', ring: rect(-4, 22, 4, 60) },
    { c: 'foot', k: 'paving', ring: rect(-10, -60, -4, 60) },
    { c: 'foot', k: 'paving', ring: rect(4, -60, 10, 60) },
  ];
  const r = build(strip, ways([ROAD_WAY, FOOTWAY]), [zebraAt([0, 20])], true);
  assert.equal(r.index.classAt(0, 20), 'carriage');
  assert.equal(r.index.meshAt(0, 20), 'klinker', 'the strip takes the road it crosses');
  assert.equal(r.crossings.length, 1);
  assert.deepEqual(zero(r.audit.counts), []);
  // A refuge island along the road (carriageway either side of it along x) is not a crossing strip.
  const island: Poly[] = [
    { c: 'carriage', k: 'asphalt', ring: rect(-6, -60, -1, 60) },
    { c: 'foot', k: 'paving', ring: rect(-1, 10, 1, 30) },
    { c: 'carriage', k: 'asphalt', ring: [[1, -60], [6, -60], [6, 60], [1, 60], [1, 30], [-1, 30], [-1, 10], [1, 10]] },
  ];
  const idx = new RoadIndex([cellOf(island)]);
  assert.equal(idx.crossingStrips([{ p: [0, 20], r: [0, 1] }]), 0);
  assert.equal(idx.classAt(0, 20), 'foot');
});

test('the audit catches fans, duplicates, alternate stripes, paint off the road and implausible rows', () => {
  const groundAt: GroundAt = (x, y) => (Math.abs(x) <= 4 ? { cls: 'carriage', mesh: y > 40 ? 'klinker' : 'asphalt' } : { cls: 'foot', mesh: 'paving' });
  const row = (cy: number, r: Vec2, is: number[], from = -3.5, to = 3.5, splay = 0): DrawnCrossing => {
    const n: Vec2 = [-r[1], r[0]];
    return { kind: 'zebra', source: 'node', ref: [0, cy], centre: [0, cy], r, from, to, stripes: is.map(i => { const v = from + 0.25 + i, a = i === 1 ? splay : 0, rr: Vec2 = [r[0] * Math.cos(a) - r[1] * Math.sin(a), r[0] * Math.sin(a) + r[1] * Math.cos(a)]; const c: Vec2 = [n[0] * v, cy + n[1] * v]; return { i, pieces: [[[c[0] - rr[0] * 1.5, c[1] - rr[1] * 1.5], [c[0] + rr[0] * 1.5, c[1] + rr[1] * 1.5]]] }; }) };
  };
  const good = row(0, [0, 1], [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(zero(auditCrossings([good], groundAt, ZEBRA).counts), []);
  const a = auditCrossings([row(-20, [0, 1], [0, 1, 2, 3, 4, 5, 6], -3.5, 3.5, 0.2)], groundAt, ZEBRA).counts;
  assert.equal(a.splay, 1, 'a stripe 11° off its neighbours');
  const fan = auditCrossings([row(20, [0, 1], [0, 1, 2, 3, 4, 5, 6]), row(21.3, [Math.sin(0.5), Math.cos(0.5)], [0, 1, 2, 3, 4, 5, 6])], groundAt, ZEBRA).counts;
  assert.equal(fan.overlap, 2, 'two zebras of one crossing');
  assert.equal(fan.skew, 1, 'the second is 29° off the road');
  assert.equal(auditCrossings([row(-30, [0, 1], [0, 2, 4, 6])], groundAt, ZEBRA).counts.gaps, 1, 'alternate stripes');
  assert.equal(auditCrossings([row(-40, [0, 1], [0, 1, 2, 3, 4, 5, 6, 7, 8], -5.5, 3.5)], groundAt, ZEBRA).counts.off, 1, 'stripes on the pavement');
  assert.equal(auditCrossings([row(-50, [0, 1], [0, 1])], groundAt, ZEBRA).counts.length, 1, 'a 1.5 m row');
  assert.equal(auditCrossings([row(50, [0, 1], [0, 1, 2, 3, 4, 5, 6])], groundAt, ZEBRA).counts.cobbles, 1, 'on klinker');
});

// ------------------------------------------------------------- named regressions on the published extracts
const haveCells = existsSync('public/data/extracts/amsterdam/roads-v1/cells.json') && existsSync('public/data/extracts/amsterdam/road-marks-v1/cells.json');
const fsStore = () => new GroundStore(async path => {
  const bytes = readFileSync(`public/data/extracts/amsterdam/${path}`);
  return new Uint8Array(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes);
}, { roads: true });

for (const reg of CROSSINGS) {
  test(`regression: ${reg.id} — ${reg.label}`, { skip: !haveCells }, async () => {
    const store = fsStore();
    await store.init();
    const [x, y] = toLocal(reg.at[0], reg.at[1]);
    const keys = new Set<string>();
    for (const dx of [-reg.radiusM, reg.radiusM]) for (const dy of [-reg.radiusM, reg.radiusM]) keys.add(store.cellAt(x + dx, y + dy));
    const near: DrawnCrossing[] = [];
    let ref: Awaited<ReturnType<typeof cellCrossings>> = null;
    for (const k of keys) {
      const c = await cellCrossings(store, k);
      if (!c) continue;
      if (k === store.cellAt(x, y)) ref = c;
      near.push(...c.crossings.filter(q => Math.hypot(q.centre[0] - x, q.centre[1] - y) <= reg.radiusM));
    }
    assert.ok(ref, 'the cell is in roads-v1');
    const r = auditCrossings(near, exactGround(ref!.index), ZEBRA, () => true, roadDirOf(ref!.ways));
    assert.ok(near.length >= reg.count[0] && near.length <= reg.count[1], `${near.length} zebras within ${reg.radiusM} m (want ${reg.count.join('–')})`);
    assert.deepEqual(zero(r.counts), [], r.flagged.map(f => f.notes.join('; ')).join(' | '));
  });
}

// The city-wide audit (every roads-v1 cell, ~70 s): within the pinned ceilings. Before the cleanup (2026-10-17):
// 3,467 zebras drawn, 2,149 overlapping another (681 of them fanned over 5°), 1,339 gapped, 331 of implausible length,
// 16 off the road. After: 2,347 drawn, 0 overlapping, 2 gapped, 3 skewed (listed in the lane notes).
test('city-wide crossing audit: within CROSSING_AUDIT_MAX', { skip: !haveCells || process.env.CROSSING_AUDIT_CITY === '0' }, async () => {
  const store = fsStore();
  await store.init();
  const r = await auditCity(store, [...store.roadCells].sort().filter(k => store.covers(k)));
  const over = Object.entries(CROSSING_AUDIT_MAX).filter(([k, max]) => r.counts[k as AuditCategory] > max!);
  assert.deepEqual(over.map(([k, max]) => `${k} ${r.counts[k as AuditCategory]} > ${max}`), [], JSON.stringify(r.counts));
  assert.ok(r.crossings > 2000, `${r.crossings} zebras drawn city-wide`);
});
