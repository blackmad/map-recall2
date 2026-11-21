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
import { designUnitOf, memberDraw, EVIDENCE_HOIST_RISE_M, EVIDENCE_ROOF_RISE_M, segmentBayM, setDesignSegments, sliceBays, withDesignUnits, withDesignUnitRoof, PLOT_EAVES_M, PLOT_TONE_DL, STALE_MEMBER_M, type DrawSegment } from './draw.ts';
import { hexToOklab } from '../houseSpec/wallColour.ts';
import { plotBreakBoxes, PIER_HALF_M } from './plotBreak.ts';
import { plotTone } from './plotTone.ts';
import { gameDecorator } from '../galleryPipeline.ts';
import { buildFeatureChunk, meshBuildingFor } from '../threeBuildingFeatures.ts';
import { layoutProbe, type LayoutProbeRun } from '../threeBuildingMesh.ts';
import { DESIGN_MEMBER_COMPONENTS, PLOT_VARIED_COMPONENTS, ExtraSink, wallExtras } from '../facadeExtras.ts';
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
  // Round 2 (#399, 2026-11-20): the segment is a family; each plot is its own house on the family's eaves line (within
  // PLOT_EAVES_M), brick (within PLOT_TONE_DL in L), roof and bay preset, with its own plot seed.
  test(`${name}: ${count} buildings; each segment's members share one eaves line, roof, wall family and continuous bays`, () => {
    const drawn = drawRow(name);
    assert.equal(drawn.length, count);
    assert.equal(new Set(drawn.map(d => d.s.seed)).size, count, 'one seed per building');
    for (const { s, members } of drawn) {
      const tag = `${name} ${s.id}`;
      for (const m of members) assert.equal(designUnitOf(m.f.properties)?.seed, s.seed, `${tag} ${m.id} drawn as a member`);
      const one = (label: string, xs: unknown[]) => assert.equal(new Set(xs.map(x => JSON.stringify(x))).size, 1, `${tag}: one ${label} (${xs.map(x => JSON.stringify(x)).join(' ')})`);
      for (const m of members) {
        const h = Number(m.f.properties.roofEavesHeightM ?? m.f.properties.height);
        assert.ok(Math.abs(h - s.eavesM!) <= PLOT_EAVES_M + 1e-9, `${tag} ${m.id}: cornice ${h} within ${PLOT_EAVES_M} m of the line ${s.eavesM}`);
      }
      one('roof kind', members.map(m => m.f.properties.roofShape));
      one('roof storey', members.map(m => { const r = m.f.properties.rowRoof as Record<string, unknown> | undefined; return r ? [r.riseM, r.material, r.tone, r.series, r.shape] : null; }));
      one('wall family', members.map(m => m.f.properties.facade));
      const Ls = members.map(m => hexToOklab(m.b.wallHex)[0]);
      assert.ok(Math.max(...Ls) - Math.min(...Ls) <= 2 * PLOT_TONE_DL + 0.005, `${tag}: wall tones inside the family (L ${Ls.map(l => l.toFixed(3)).join(' ')})`);
      one('bay preset', members.map(m => m.b.layers));
      one('family seed', members.map(m => m.b.seed));
      assert.equal(new Set(members.map(m => m.b.plotSeed)).size, members.length, `${tag}: each plot its own seed`);
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
      // (Round 2: the storey pitch follows each plot's cornice, at most PLOT_EAVES_M off the line.)
      one('storey grid', members.map(m => { const r = m.runs.find(x => x.base < 0.5); return r ? [r.storeys, +r.groundM.toFixed(1)] : null; }).filter(Boolean));
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
  test(`${name}: every member of a segment draws the same upper column (preset, window, family brick, series)`, () => {
    for (const { s, members } of drawRow(name)) {
      const one = (label: string, xs: unknown[]) => assert.equal(new Set(xs.map(x => JSON.stringify(x))).size, 1, `${s.id}: one ${label} (${xs.map(x => JSON.stringify(x)).join(' ')})`);
      const rule = members.filter(m => !designUnitOf(m.f.properties)?.exception && !m.f.properties.painted);
      one('upper preset', rule.map(m => m.b.layers?.upper));
      one('upper window', rule.map(m => m.b.openings?.upper));
      const Ls = rule.map(m => hexToOklab(m.b.wallHex)[0]);
      assert.ok(Math.max(...Ls) - Math.min(...Ls) <= 2 * PLOT_TONE_DL + 0.005, `${s.id}: one brick family`);
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
  for (const id of ['iron-balconies', 'flower-boxes', 'wall-anchors', 'brick-bands', 'scaffolding', 'bay-window']) assert.ok(!DESIGN_MEMBER_COMPONENTS.has(id), id);
  // Round 2: each plot rolls its heads, door dressing and balcony row on its own series; the family's parts stay shared,
  // and a party-wall break draws the plot's crown (pier, cornice end block) in place of a crown component.
  const plot = (id: string, k: number): ExtraContext => ({ ...wall(id, 3), plotSeriesId: `du:ring:8275:plot:${k}`, plotBreak: { start: true, end: true } });
  const plots = [0, 1, 2, 3, 4, 5].map(k => wallExtras(plot(`NL.IMBAG.Pand.03631000121${k}`, k), new ExtraSink(5000)));
  for (const used of plots) {
    assert.ok(used.includes('plot-crown'), 'the plot draws its own crown');
    assert.deepEqual(used.filter(id => !PLOT_VARIED_COMPONENTS.has(id) && id !== 'plot-crown').sort(), [...narrow].filter(id => !PLOT_VARIED_COMPONENTS.has(id) && !['kroonlijst', 'console-cornice', 'white-fascia', 'cornice-brackets', 'gutter'].includes(id)).sort(), 'family parts shared');
  }
  assert.ok(new Set(plots.map(u => JSON.stringify(u.filter(id => PLOT_VARIED_COMPONENTS.has(id)).sort()))).size > 1, 'plots differ in their own parts');
});

test('round 2: a plot breaks at its party walls (pier, cornice stopped short, end block); none inside a one-facade group', () => {
  const both = plotBreakBoxes(5, 0, 15, true, true), none = plotBreakBoxes(5, 0, 15, false, false);
  assert.equal(both.filter(b => b.tone === 'pier').length, 2);
  assert.equal(both.filter(b => b.tone === 'end').length, 2);
  for (const b of both.filter(x => x.tone === 'cornice' || x.tone === 'lid')) { assert.equal(b.a0, PIER_HALF_M); assert.equal(b.a1, 5 - PIER_HALF_M); }
  assert.equal(none.filter(b => b.tone === 'pier' || b.tone === 'end').length, 0);
  for (const b of [...both, ...none]) assert.ok(b.z1 <= 15, 'nothing above the cornice line');
  // memberDraw: a one-facade group (photo evidence) draws one continuous front; every other plot breaks at both ends.
  const s = VO(), street = s.slices[0].street, on = s.slices.filter(x => x.street === street).sort((a, b) => a.fromM - b.fromM);
  if (on.length >= 3) {
    const g = { ...s, plotGroups: [[on[0].pandId, on[1].pandId]] };
    const d0 = memberDraw(g, on[0].pandId, false)!, d1 = memberDraw(g, on[1].pandId, false)!, d2 = memberDraw(g, on[2].pandId, false)!;
    assert.deepEqual([d0.plotBreak?.right, d1.plotBreak?.left], [false, false]);
    assert.equal(d0.plotSeed, d1.plotSeed);
    assert.deepEqual([d1.plotBreak?.right, d2.plotBreak?.left], [true, true]);
    assert.notEqual(d1.plotSeed, d2.plotSeed);
  }
  // Eaves: the plot's own AHN front, clamped to PLOT_EAVES_M of the line.
  const m = s.members[0], hi = memberDraw({ ...s, plotEavesM: { [m]: s.eavesM! + 2 } }, m, false)!, lo = memberDraw({ ...s, plotEavesM: { [m]: s.eavesM! - 0.12 } }, m, false)!;
  assert.equal(hi.plotEavesM, +(s.eavesM! + PLOT_EAVES_M).toFixed(2));
  assert.equal(lo.plotEavesM, +(s.eavesM! - 0.12).toFixed(2));
});

test('round 2: plot tones stay inside the family brick (hue and chroma kept, L within PLOT_TONE_DL)', () => {
  const fam = '#7a5a4c', [L, a, b] = hexToOklab(fam), seen = new Set<string>();
  for (let k = 0; k < 40; k++) {
    const t = plotTone(fam, `du:test:plot:${k}`), [l2, a2, b2] = hexToOklab(t);
    seen.add(t);
    assert.ok(Math.abs(l2 - L) <= PLOT_TONE_DL + 0.004, `${t}: dL ${(l2 - L).toFixed(3)}`);
    assert.ok(Math.abs(a2 - a) < 0.01 && Math.abs(b2 - b) < 0.01, `${t}: hue kept`);
  }
  assert.ok(seen.size >= 4, 'plots differ');
});

test('roof evidence: a photo-seen roof storey draws inside the measured top, the cornice under it, dormers per front', () => {
  const s = VO(), m = s.members[0];
  const top = (ev?: DrawSegment['roofEvidence']) => {
    setDesignSegments(extract([{ ...s, roofRiseM: 0, ...(ev ? { roofEvidence: ev } : {}) }])); flag(true);
    try { return decorate(fx.pands.filter(p => s.members.includes(p.id)).map(p => tileFeature(p))).find(f => String(f.properties.id).endsWith(m))!.properties; } finally { flag(undefined); setDesignSegments(null); }
  };
  const flat = top(), hoist = top({ storey: true, dormer: 'pediment', hoist: true, source: 'test' }), mans = top({ storey: true, dormer: 'gabled', source: 'test' }), no = top({ storey: false, source: 'test' });
  assert.equal(flat.roofShape, 'flat');
  assert.equal(no.roofShape, 'flat', 'evidence of no roof storey keeps the flat top');
  for (const [p, rise] of [[hoist, EVIDENCE_HOIST_RISE_M], [mans, EVIDENCE_ROOF_RISE_M]] as const) {
    assert.equal(p.height, flat.height, 'the measured top stays the top');
    assert.ok(Math.abs(Number(p.roofEavesHeightM) - (Number(flat.height) - rise)) < 1e-6, 'the cornice drops by the roof storey');
    const rr = p.rowRoof as { riseM: number; dormers: Array<{ kind: string; hoist?: boolean }> };
    assert.equal(rr.riseM, rise);
    assert.ok(rr.dormers.length >= 1);
  }
  assert.equal((hoist.rowRoof as { dormers: Array<{ kind: string; hoist?: boolean }> }).dormers[0].hoist, true);
  assert.equal((mans.rowRoof as { dormers: Array<{ kind: string }> }).dormers[0].kind, 'gabled');
});

test('roof evidence: an era default (roofSource default, dormer form) draws the short dormer slope with the era kind', () => {
  const s = VO(), m = s.members[0];
  const props = (ev?: DrawSegment['roofEvidence']) => {
    setDesignSegments(extract([{ ...s, roofRiseM: 0, ...(ev ? { roofEvidence: ev } : {}) }])); flag(true);
    try { return decorate(fx.pands.filter(p => s.members.includes(p.id)).map(p => tileFeature(p))).find(f => String(f.properties.id).endsWith(m))!.properties; } finally { flag(undefined); setDesignSegments(null); }
  };
  const flat = props(), def = props({ storey: true, dormer: 'gabled', form: 'dormers', source: 'era default', roofSource: 'default' });
  assert.equal(def.roofShape, 'mansardHip');
  assert.equal(def.height, flat.height, 'the measured top stays the top');
  assert.equal((def.rowRoof as { riseM: number }).riseM, EVIDENCE_HOIST_RISE_M, 'dormer form: the short slope');
  assert.equal((def.rowRoof as { dormers: Array<{ kind: string }> }).dormers[0].kind, 'gabled');
});
