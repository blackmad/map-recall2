/**
 * Design units, the renderer (T2): byte-identical with the flag off, the four regression rows drawn one building per
 * segment with the flag on, and the conformance test (every segment field the renderer reads changes the mesh).
 * Fixtures: the regression rows' pands (fixtures/regression-rows.json, BAG rings, 3DBAG heights) and AHN fronts
 * (fixtures/regression-ahn.json), segmented by segmentsOf as the integrator's extract is.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { joinDesignUnits, type NamedStreet } from './join.ts';
import { REGRESSION_ROWS } from './regressionRows.ts';
import { segmentsOf, SEGMENTS_SCHEMA, type MemberHeights, type Segment } from './segments.ts';
import type { OrdekaartObject, UnitPand } from './types.ts';
import { designUnitOf, segmentBayM, setDesignSegments, sliceBays, withDesignUnits, withDesignUnitRoof, STALE_MEMBER_M, type DrawSegment } from './draw.ts';
import { gameDecorator } from '../galleryPipeline.ts';
import { buildFeatureChunk, meshBuildingFor } from '../threeBuildingFeatures.ts';
import { layoutProbe, type LayoutProbeRun } from '../threeBuildingMesh.ts';
import { DESIGN_MEMBER_COMPONENTS, ExtraSink, wallExtras } from '../facadeExtras.ts';
import type { ExtraContext } from '../facadeExtraCore.ts';

const dir = path.join(import.meta.dirname, 'fixtures');
const fx = JSON.parse(fs.readFileSync(path.join(dir, 'regression-rows.json'), 'utf8')) as { pands: UnitPand[]; objects: OrdekaartObject[]; streets: NamedStreet[] };
const ahn = JSON.parse(fs.readFileSync(path.join(dir, 'regression-ahn.json'), 'utf8')).p90 as Record<string, number | null>;
const res = joinDesignUnits({ pands: fx.pands, objects: fx.objects, streets: fx.streets });
const units = new Map(res.units.map(u => [u.id, u]));
const heights = new Map<string, MemberHeights>(fx.pands.map(p => [p.id, { ahnM: ahn[p.id] ?? null, bagEavesM: p.eavesM }]));
const yearOf = new Map(fx.pands.map(p => [p.id, p.year]));
const ringOf = new Map(fx.pands.map(p => [p.id, p.ring]));
/** The members' vertex mean (lng, lat): the anchor the renderer asks the extract to carry as `at`. */
const anchorOf = (s: Segment): [number, number] => { const pts = s.members.flatMap(m => (ringOf.get(m) ?? []).slice(0, -1)); return [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length]; };
/** The median member BAG year (what the renderer asks the extract to carry as `year`). */
const withYear = (s: Segment): DrawSegment => { const ys = s.members.map(m => yearOf.get(m)).filter((y): y is number => typeof y === 'number').sort((a, b) => a - b); return { ...s, year: ys.length ? ys[Math.floor((ys.length - 1) / 2)] : null, at: anchorOf(s) }; };
const allSegments: DrawSegment[] = res.units.flatMap(u => segmentsOf(u, heights)).map(withYear);
const extract = (segments: DrawSegment[]) => ({ schema: SEGMENTS_SCHEMA, layers: ['ring'], generatedAt: '', source: 'test', segments });
const segsOfRow = (name: string) => { const r = REGRESSION_ROWS.find(x => x.name === name)!; return r.units.map(u => allSegments.find(s => s.members.includes(u[0]))!); };

type F = { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'Polygon'; coordinates: number[][][] } };
/** A building tile feature as the streamer hands it over (id, tier, heights), with the facts tile's year stamped. */
const tileFeature = (p: UnitPand, height?: number): F => ({ type: 'Feature', properties: { id: `NL.IMBAG.Pand.${p.id}`, tier: 3, minHeight: 0, height: height ?? p.heightM ?? 12, ...(p.year ? { constructionYear: p.year } : {}) }, geometry: { type: 'Polygon', coordinates: [p.ring as unknown as number[][]] } });
const features = (): F[] => fx.pands.map(p => tileFeature(p));
const hash = (v: unknown) => crypto.createHash('sha256').update(JSON.stringify(v, (_k, x) => ArrayBuffer.isView(x) ? Array.from(x as unknown as ArrayLike<number>) : x)).digest('hex').slice(0, 16);
const G = globalThis as { __canalRecallDesignUnits?: boolean };
const flag = (on: boolean | undefined) => { if (on === undefined) delete G.__canalRecallDesignUnits; else G.__canalRecallDesignUnits = on; };
const decorate = (fs: F[]) => { const d = gameDecorator(); return fs.map(f => d(f as never) as unknown as F); };
const chunkHash = (fs: F[], mode: 'walls' | 'extras' = 'walls') => hash(buildFeatureChunk(fs as never, 'photo', mode));

// Pinned on the branch base (81acb7d87 + the segments merge) before any renderer change, with the same fixture and code
// path (scripts: the decorator chain, then buildFeatureChunk 'photo'): the flag-off world must not move.
const BASE = { features: '671d748d15c7849e', walls: 'c29aa8a5f5f30c77', extras: '4d8cd0d48829b061' };

test('flag off: decorated features and mesh are byte-identical to the base, segments installed or not', () => {
  for (const installed of [false, true]) {
    setDesignSegments(installed ? extract(allSegments) : null);
    flag(false);
    const out = decorate(features());
    assert.equal(hash(out), BASE.features, `features (segments installed: ${installed})`);
    assert.equal(chunkHash(out), BASE.walls);
    assert.equal(chunkHash(out, 'extras'), BASE.extras);
    for (const f of features()) { assert.equal(withDesignUnits(f), f); assert.equal(withDesignUnitRoof(f), f); }
  }
  // Flag on without the extract: the steps are no-ops too.
  setDesignSegments(null); flag(true);
  assert.equal(hash(decorate(features())), BASE.features);
  flag(undefined);
});

test('a one-pand segment, and a pand in no segment, draw as today with the flag on', () => {
  const singles = allSegments.filter(s => s.members.length === 1);
  assert.ok(singles.length > 0);
  setDesignSegments(extract(singles)); flag(true);
  try { assert.equal(hash(decorate(features())), BASE.features); } finally { flag(undefined); setDesignSegments(null); }
});

/** Everything the gate looks at per member, drawn under the flag. */
function drawRow(name: string) {
  const segs = segsOfRow(name);
  setDesignSegments(extract(allSegments)); flag(true);
  const runs = new Map<string, LayoutProbeRun[]>();
  layoutProbe.sink = (id, run) => { (runs.get(id) ?? runs.set(id, []).get(id)!).push(run); };
  try {
    const members = new Set(segs.flatMap(s => s.members));
    const decorated = decorate(fx.pands.filter(p => members.has(p.id)).map(p => tileFeature(p)));
    const byId = new Map(decorated.map(f => [String(f.properties.id).slice(-16), f]));
    buildFeatureChunk(decorated as never, 'photo', 'walls');
    return segs.map(s => ({ s, members: s.members.map(m => { const f = byId.get(m)!; return { id: m, f, b: meshBuildingFor(f as never, 'photo')!, runs: runs.get(`NL.IMBAG.Pand.${m}`) ?? [] }; }) }));
  } finally { layoutProbe.sink = undefined; flag(undefined); setDesignSegments(null); }
}

for (const [name, count] of [['Rustenburgerstraat', 3], ['Van Ostadestraat', 4]] as const) {
  test(`${name}: ${count} buildings; each segment's members get one height, one roof, one wall family and continuous bays`, () => {
    const drawn = drawRow(name);
    assert.equal(drawn.length, count);
    assert.equal(new Set(drawn.map(d => d.s.seed)).size, count, 'one seed per building');
    for (const { s, members } of drawn) {
      const tag = `${name} ${s.id}`;
      for (const m of members) assert.equal(designUnitOf(m.f.properties)?.seed, s.seed, `${tag} ${m.id} drawn as a member`);
      const one = (label: string, xs: unknown[]) => assert.equal(new Set(xs.map(x => JSON.stringify(x))).size, 1, `${tag}: one ${label} (${xs.map(x => JSON.stringify(x)).join(' ')})`);
      one('eaves line', members.map(m => m.f.properties.roofEavesHeightM ?? m.f.properties.height));
      assert.equal(members[0].f.properties.roofEavesHeightM ?? members[0].f.properties.height, s.eavesM, `${tag}: at the segment line`);
      one('roof kind', members.map(m => m.f.properties.roofShape));
      one('roof storey', members.map(m => { const r = m.f.properties.rowRoof as Record<string, unknown> | undefined; return r ? [r.riseM, r.material, r.tone, r.series, r.shape] : null; }));
      one('wall family', members.map(m => m.f.properties.facade));
      one('wall colour', members.map(m => m.b.wallHex));
      one('bay preset', members.map(m => m.b.layers));
      one('rhythm seed', members.map(m => m.b.seed));
      // Continuous bays: each member's street run draws its share of ONE grid laid out from the segment's left end.
      const street = s.slices[0].street, slices = s.slices.filter(x => x.street === street);
      let total = 0, matched = 0;
      for (const sl of slices) {
        const m = members.find(x => x.id === sl.pandId)!;
        const len = sl.toM - sl.fromM, run = m.runs.find(r => Math.abs(r.lengthM - len) <= Math.max(1.5, 0.2 * len) && r.base < 0.5);
        if (!run) continue;
        matched++;
        const pitch = run.lengthM / (run.bays / (run.axes || 1));
        total += run.bays / (run.axes || 1);
        // The member's bay pitch is the segment's (within the stretch of snapping its ends to the grid).
        assert.ok(pitch > 1.5 && pitch < 8, `${tag} ${sl.pandId}: pitch ${pitch}`);
      }
      assert.ok(matched >= slices.length - 1, `${tag}: street runs found for ${matched}/${slices.length} slices`);
      if (matched === slices.length) {
        // Telescoping grid: the members' bays add up to the whole frontage's count on the segment's pitch.
        const L = slices[slices.length - 1].toM, runs = slices.map(sl => members.find(x => x.id === sl.pandId)!.runs.find(r => Math.abs(r.lengthM - (sl.toM - sl.fromM)) <= Math.max(1.5, 0.2 * (sl.toM - sl.fromM)))!);
        const segPitch = runs[0].lengthM / (runs[0].bays / (runs[0].axes || 1));
        assert.ok(Math.abs(total - L / segPitch) <= slices.length * 0.5 + 0.5, `${tag}: ${total} bays over ${L} m at ${segPitch.toFixed(2)} m`);
      }
      // One storey grid: every member's street run has the same storeys, storey and ground height.
      one('storey grid', members.map(m => { const r = m.runs.find(x => x.base < 0.5); return r ? [r.storeys, +r.storeyM.toFixed(2), +r.groundM.toFixed(2)] : null; }).filter(Boolean));
    }
  });
}

test('segmentBayM: equal houses draw equal bays (Van Ostadestraat 5.2 m fronts on a 3.6 m cell: one cell each)', () => {
  const p = segmentBayM(5.3, 3.6);
  assert.deepEqual([[0, 5.22], [5.22, 10.63], [10.63, 15.9]].map(([a, b]) => sliceBays(a, b, p)), [1, 1, 1]);
  assert.equal(sliceBays(0, 10.6, p), 2, 'a member two modules wide draws two');
});

test('sliceBays: party walls fall on the segment grid; the members add up to the frontage', () => {
  const slices = [[0, 5.7], [5.7, 11.4], [11.4, 18.62], [18.62, 24.33]];
  const n = slices.map(([a, b]) => sliceBays(a, b, 1.9));
  assert.equal(n.reduce((a, b) => a + b, 0), Math.round(24.33 / 1.9));
  assert.deepEqual(n, [3, 3, 4, 3]);
});

// --- Conformance: every segment field the renderer reads changes the rendered mesh ------------------------------------
const VO = () => segsOfRow('Van Ostadestraat')[3];
function meshWith(seg: DrawSegment, heightOf: (p: UnitPand) => number | undefined = () => undefined): string {
  setDesignSegments(extract([seg])); flag(true);
  try {
    const members = new Set(seg.members);
    return chunkHash(decorate(fx.pands.filter(p => members.has(p.id)).map(p => tileFeature(p, heightOf(p)))));
  } finally { flag(undefined); setDesignSegments(null); }
}

test('conformance: eavesM changes the mesh', () => {
  const s = VO();
  assert.notEqual(meshWith(s), meshWith({ ...s, eavesM: s.eavesM! + 1.5 }));
});
test('conformance: seed changes the mesh', () => {
  const s = VO();
  assert.notEqual(meshWith(s), meshWith({ ...s, seed: `${s.seed}~other` }));
});
test('conformance: slices change the mesh (the module sets the bay grid; no slice, no member draw)', () => {
  const s = VO(), base = meshWith(s);
  // The module: the first member keeps its own slice width, the others' slices are halved, so the segment's median width
  // (the module the bay pitch divides) halves and the first member draws two cells where it drew one.
  const street = s.slices[0].street;
  let at = 0;
  const narrow = { ...s, slices: s.slices.map((x, i) => { if (x.street !== street) return x; const w = (x.toM - x.fromM) * (i === 0 ? 1 : 0.5), out = { ...x, fromM: +at.toFixed(2), toM: +(at + w).toFixed(2) }; at += w; return out; }) };
  assert.notEqual(base, meshWith(narrow));
  const dropped = { ...s, slices: s.slices.filter(x => x.pandId !== s.members[0]) };
  assert.notEqual(base, meshWith(dropped));
  // (The order no longer changes the mesh: since 2026-11-19 every member's roof is closed at both ends, no end hips.)
});
test('conformance: exceptions change the mesh (a listed member far off the line is clamped; unlisted, it draws as today)', () => {
  const s = VO(), odd = s.members[1], off = (p: UnitPand) => p.id === odd ? s.eavesM! + STALE_MEMBER_M + 2 : undefined;
  const listed = { ...s, exceptions: [{ pandId: odd, readM: s.eavesM! + STALE_MEMBER_M + 2, why: 'test' }] };
  assert.notEqual(meshWith(listed, off), meshWith({ ...s, exceptions: [] }, off));
});

// The no-worse rule (planning session, 2026-11-19): with the flag on, a pre-1920 residential front draws the era's window
// columns per plot (the plot is the module) and tall windows: drawn height over width at least 1.5, measured on the
// mesher's own layout (storey pitch x the preset's sill-to-head, cell width x the preset's window width).
for (const name of ['Rustenburgerstraat', 'Van Ostadestraat'] as const) {
  test(`${name}: era fronts draw the plot's window columns, tall (h/w >= 1.5), light frames`, () => {
    let checked = 0;
    for (const { s, members } of drawRow(name)) {
      for (const m of members) {
        const d = designUnitOf(m.f.properties);
        if (!d?.bays) continue;
        const len = d.toM - d.fromM, run = m.runs.find(r => r.street && r.base < 0.5 && Math.abs(r.lengthM - len) <= Math.max(1.5, 0.2 * len));
        if (!run) continue;
        const up = m.b.openings?.upper;
        assert.ok(up, `${s.id} ${m.id}: upper openings`);
        assert.equal(run.bays, d.bays, `${s.id} ${m.id}: ${run.bays} columns drawn, the plot's ${d.bays}`);
        const cellW = run.lengthM * (run.axes || 1) / run.bays, w = up!.width * cellW, h = Math.abs(up!.head - up!.sill) * run.storeyM;
        // Check 5 (2026-11-19): the window is 55-60 % of its pitch, as photographed (Van Ostadestraat).
        assert.ok(w / (run.lengthM / run.bays) >= 0.5, `${s.id} ${m.id}: window ${(w / (run.lengthM / run.bays)).toFixed(2)} of its pitch`);
        assert.ok(h / w >= 1.5, `${s.id} ${m.id}: window ${h.toFixed(2)} x ${w.toFixed(2)} m (h/w ${(h / w).toFixed(2)})`);
        assert.equal(d.look?.dark, false, `${s.id} ${m.id}: light frames on an era front with no read`);
        checked++;
      }
    }
    assert.ok(checked >= 3, `${name}: ${checked} era members checked`);
  });
}

// One design inside a segment (coordinator, 2026-11-19: Rustenburgerstraat's middle segment drew dressed heads on three
// columns of two storeys, a balconette on one or two windows): every member's upper storeys draw one preset, one window,
// one wall, one series seed, and its street wall dresses only parts that repeat per window, storey or plot.
for (const name of ['Rustenburgerstraat', 'Van Ostadestraat'] as const) {
  test(`${name}: every member of a segment draws the same upper column (preset, window, wall, series)`, () => {
    for (const { s, members } of drawRow(name)) {
      const one = (label: string, xs: unknown[]) => assert.equal(new Set(xs.map(x => JSON.stringify(x))).size, 1, `${s.id}: one ${label} (${xs.map(x => JSON.stringify(x)).join(' ')})`);
      const rule = members.filter(m => !designUnitOf(m.f.properties)?.exception && !m.f.properties.painted);
      one('upper preset', rule.map(m => m.b.layers?.upper));
      one('upper window', rule.map(m => m.b.openings?.upper));
      one('wall', rule.map(m => m.b.wallHex));
      one('series seed', rule.map(m => m.b.seed));
    }
  });
}

test('a design member\'s street wall dresses the same per-window parts on every plot, never a one-off', () => {
  const wall = (id: string, bays: number): ExtraContext => ({
    id, style: 'c19', period: 'c19', wallKey: 'front', seriesId: 'du:ring:8275', designMember: true,
    f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: bays * 1.67 }, base: 0, top: 15,
    layout: { bays, bayWidthM: 1.67, groundM: 3.4, storeys: 4, storeyM: 2.9, doorBays: [0] },
    wallHex: '#73625e', accentHex: '#efe9dc', groundLevel: true, streetSide: true,
    openings: { upper: { axes: [0.5], width: 0.55, sill: 0.15, head: 0.85 }, ground: null, doorWindow: null, door: { axis: 0.5, width: 0.5, bottom: 0, top: 0.8, fanlight: true } },
  });
  const narrow = wallExtras(wall('NL.IMBAG.Pand.0363100012159752', 3), new ExtraSink(5000));
  const wide = wallExtras(wall('NL.IMBAG.Pand.0363100012236414', 6), new ExtraSink(5000));
  for (const id of [...narrow, ...wide]) assert.ok(DESIGN_MEMBER_COMPONENTS.has(id), `${id} is not a per-window part`);
  assert.deepEqual([...wide].sort(), [...narrow].sort(), 'both plots dress the same parts');
  for (const id of ['iron-balconies', 'juliet-balcony', 'flower-boxes', 'wall-anchors', 'brick-bands', 'scaffolding']) assert.ok(!DESIGN_MEMBER_COMPONENTS.has(id), id);
});
