import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {GEOMETRY_THRESHOLDS, analyseRhythm, auditOpenings, auditZFight, coplanarOverlap, geometryAudit, materialSlotCoverage, nonOpeningShape, regressions, rhythmVerdict, RHYTHM_FAIL} from './geometryAudit';
import type {MaterialSoup, Opening} from './facadeCompare';
import {zFightArea} from '../blockFace/compile';

type V3 = [number, number, number];
const MATS = ['brick', 'glass', 'white', 'stone', 'slate'];

/** Soup of axis-aligned boxes (12 outward triangles each), one material per box. */
function boxes(...bs: {min: V3; max: V3; mat: string}[]): MaterialSoup {
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [];
  for (const b of bs) {
    const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
    const quads: V3[][] = [
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
    ];
    for (const q of quads) {
      const base = positions.length / 3;
      for (const p of q) positions.push(...p);
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      triMaterial.push(MATS.indexOf(b.mat), MATS.indexOf(b.mat));
    }
  }
  return {positions, indices, triMaterial, materials: MATS.map(name => ({name, rgb: [128, 128, 128] as [number, number, number]}))};
}

// A 12 x 9 x 8 m brick block whose south face is z = 8.
const block = {min: [0, 0, 0] as V3, max: [12, 9, 8] as V3, mat: 'brick'};
const pane = (x: number, z0: number, depth = 0.1) => ({min: [x, 3, z0] as V3, max: [x + 1.2, 5, z0 + depth] as V3, mat: 'glass'});

test('a window on its wall is not an issue', () => {
  const r = auditOpenings(boxes(block, pane(2, 8)));
  assert.equal(r.assemblies, 1);
  assert.deepEqual(r.issues, []);
});

test('a window 25 cm in front of its wall floats (fail)', () => {
  const [i] = auditOpenings(boxes(block, pane(2, 8.25))).issues;
  assert.equal(i.kind, 'floating');
  assert.equal(i.severity, 'fail');
  assert.ok(Math.abs(i.gap - 0.25) < 0.01, `gap ${i.gap}`);
});

test('a window hanging half past the wall end overhangs', () => {
  const [i] = auditOpenings(boxes(block, pane(11.4, 8))).issues;
  assert.equal(i.kind, 'overhang');
  assert.ok(i.outside > 0.25 && i.outside < 0.7, `outside ${i.outside}`);
});

/** Balcony on the south face (z = 8): stone slab + stone rail, white fascia plate on the slab's front edge (an opening-material part). */
function balcony(depth: number, off = 0, x = 4, w = 3) {
  const z0 = 8 + off, z1 = z0 + depth;
  return [
    {min: [x, 3, z0] as V3, max: [x + w, 3.15, z1] as V3, mat: 'stone'},
    {min: [x, 3.15, z1 - 0.05] as V3, max: [x + w, 4.15, z1] as V3, mat: 'stone'},
    {min: [x + 0.1, 2.85, z1] as V3, max: [x + w - 0.1, 3.1, z1 + 0.03] as V3, mat: 'white'},
  ];
}
const kinds = (r: {issues: {kind: string; severity: string}[]}) => JSON.stringify(r.issues.map(i => [i.kind, i.severity]));

test('a 1.5 m balcony on its wall is not an overhang', () => {
  assert.deepEqual(auditOpenings(boxes(block, ...balcony(1.5))).issues, []);
});

test('a solid-rail balcony floating 30 cm off the wall or 3 m deep is still flagged (bar-rail ones fail outright, below)', () => {
  const floating = auditOpenings(boxes(block, ...balcony(1.5, 0.3)));
  assert.ok(floating.issues.some(i => i.kind === 'overhang'), kinds(floating));
  const deep = auditOpenings(boxes(block, ...balcony(3)));
  assert.ok(deep.issues.some(i => i.kind === 'overhang'), kinds(deep));
});

/** Generator-style balcony: slab, thin rail bars (no solid front plane) and a dark fascia. */
function barBalcony(depth: number, off = 0, x = 4) {
  const z0 = 8 + off, z1 = z0 + depth, w = 3;
  const bars = [0, 1, 2, 3].map(i => ({min: [x + i * 0.9, 3.15, z1 - 0.04] as V3, max: [x + i * 0.9 + 0.04, 4.15, z1] as V3, mat: 'stone'}));
  return [{min: [x, 3, z0] as V3, max: [x + w, 3.15, z1] as V3, mat: 'stone'}, ...bars, {min: [x + 0.1, 2.85, z1] as V3, max: [x + w - 0.1, 3.1, z1 + 0.03] as V3, mat: 'white'}];
}
test('bar-rail balconies: 1.5 m on the wall passes; floating 0.3 m off, or 3 m deep, fails', () => {
  assert.deepEqual(auditOpenings(boxes(block, ...barBalcony(1.5))).issues, []);
  const floating = auditOpenings(boxes(block, ...barBalcony(1.5, 0.3)));
  assert.ok(floating.issues.some(i => i.kind === 'overhang' && i.severity === 'fail'), kinds(floating));
  const deep = auditOpenings(boxes(block, ...barBalcony(3)));
  assert.ok(deep.issues.some(i => i.kind === 'overhang' && i.severity === 'fail'), kinds(deep));
});

test('balcony trim past the wall end, and a window past the side edge, still overhang', () => {
  const side = auditOpenings(boxes(block, ...barBalcony(1.5, 0, 10.5)));
  assert.ok(side.issues.some(i => i.kind === 'overhang' && i.severity === 'fail'), kinds(side));
  const win = auditOpenings(boxes(block, ...balcony(1.5), pane(11.4, 8)));
  assert.ok(win.issues.some(i => i.kind === 'overhang'), kinds(win));
});

test('a window sunk inside a solid wall is buried; a freestanding railing is ignored', () => {
  const buried = auditOpenings(boxes(block, pane(2, 7.7, 0.1))).issues;
  assert.equal(buried[0]?.kind, 'buried');
  // Thin white bar standing on the ground 3 m in front of the block: a railing, not an opening.
  assert.deepEqual(auditOpenings(boxes(block, {min: [2, 0, 11], max: [2.05, 1.2, 11.05], mat: 'white'})).issues, []);
});

test('coplanarOverlap matches the block-face zFightArea measure', () => {
  const A: V3[] = [[0, 2, 0], [4, 2, 0], [0, 2, 3]], B: V3[] = [[1, 2, 0], [5, 2, 0], [1, 2, 3]];
  const o = coplanarOverlap(A, B, [0, 1, 0], 0.005)!;
  const z = zFightArea([{p: A, n: [0, 1, 0], slot: '', surface: ''}], [{p: B, n: [0, 1, 0], slot: '', surface: ''}], 0.01, undefined, 0.005);
  assert.ok(Math.abs(o.area - z) < 1e-9, `${o.area} vs ${z}`);
  assert.ok(Math.abs(o.centroid[1] - 2) < 1e-9);
});

test('two slab tops at the same height z-fight; the same overlap buried inside a mass does not count', () => {
  // A stone cap whose top is flush with the brick block top (H'ART portico pattern): 2 x 8 m visible overlap.
  const capped = auditZFight(boxes(block, {min: [4, 8.5, 0], max: [6, 9, 8], mat: 'stone'}));
  assert.ok(capped.area > 10, `area ${capped.area}`);
  assert.equal(capped.patches[0].orientation, 'roof');
  // Two slabs flush with each other but buried inside a bigger slate mass are never drawn.
  const hidden = auditZFight(boxes({min: [-1, -1, -1], max: [13, 12, 9], mat: 'slate'}, {min: [0, 0, 0], max: [4, 5, 4], mat: 'brick'}, {min: [2, 0, 0], max: [6, 5, 4], mat: 'stone'}));
  assert.equal(hidden.area, 0, JSON.stringify(hidden.patches.map(p => [p.area, p.materials])));
  assert.ok(hidden.hiddenArea > 1);
});

test('rhythm: a skipped column and an odd-sized window are flagged', () => {
  const row = (y: number, ts: number[], w = 1.2): Opening[] => ts.map(t => ({t0: t, t1: t + w, y0: y, y1: y + 2, area: w * 2}));
  const regular = [...row(1, [1, 4, 7, 10, 13]), ...row(5, [1, 4, 7, 10, 13])];
  assert.deepEqual(analyseRhythm(regular).missing, []);
  const gap = [...row(1, [1, 4, 7, 10, 13]), ...row(5, [1, 4, 10, 13])];
  assert.deepEqual(analyseRhythm(gap).missing.map(m => m.t), [7.6]);
  const odd = [...row(1, [1, 4, 10, 13]), ...row(1, [7], 2.4)];
  assert.equal(analyseRhythm(odd).mismatched.length, 1);
});

test('baseline gate: only growth past the recorded counts fails', () => {
  assert.deepEqual(regressions({'opening-floating-fail': 2, 'zfight-m2': 30}, {'opening-floating-fail': 2, 'zfight-m2': 30}), []);
  assert.equal(regressions({'opening-floating-fail': 3, 'zfight-m2': 30}, {'opening-floating-fail': 2, 'zfight-m2': 30}).length, 1);
  assert.equal(regressions({'zfight-m2': 0.6}, undefined).length, 1, 'a new model with visible z-fighting fails');
  assert.deepEqual(regressions({'window-missing': 9, 'window-misaligned': 4}, undefined), [], 'warn-level counts are never gated');
});

test('baseline gate: every detached or sunk window is gated for new and recorded models, never for unrecorded legacy ones', () => {
  assert.equal(regressions({'opening-floating': 1}, undefined).length, 1, 'a new export may not float any window (not only the 10 cm fails)');
  assert.equal(regressions({'opening-buried': 1}, undefined).length, 1);
  assert.equal(regressions({'opening-floating': 5}, {'opening-floating': 5}).length, 0);
  assert.equal(regressions({'opening-floating': 6}, {'opening-floating': 5}).length, 1);
  assert.deepEqual(regressions({'opening-floating': 9}, {'zfight-m2': 0}), [], 'an entry without the key predates the gate');
});

test('baseline gate: a new export must carry materialSlot+tint on all visible surface; recorded models may not get worse', () => {
  assert.equal(regressions({'material-slot-untagged-permille': 0}, undefined).length, 0);
  assert.equal(regressions({'material-slot-untagged-permille': 1}, undefined).length, 1);
  assert.equal(regressions({'material-slot-untagged-permille': 400}, {'material-slot-untagged-permille': 400}).length, 0);
  assert.equal(regressions({'material-slot-untagged-permille': 401}, {'material-slot-untagged-permille': 400}).length, 1);
  assert.deepEqual(regressions({'material-slot-untagged-permille': 1000}, {'zfight-m2': 0}), [], 'legacy entry without the key: warning only');
});

test('materialSlotCoverage: area-weighted share of visible surface whose material has slot and tint', () => {
  const soup = boxes(block, {min: [0, 9, 0], max: [12, 9.5, 8], mat: 'slate'});
  // Brick block 12 x 9 x 8 (visible: 4 walls + roof = 2*(12+8)*9 + 96 = 456 m2) plus a slate slab (visible: 4 sides + top = 2*20*0.5 + 96 = 116 m2).
  soup.materials[MATS.indexOf('brick')] = {...soup.materials[MATS.indexOf('brick')], slot: 'brick', tint: '#9a5240'};
  soup.materials[MATS.indexOf('slate')] = {...soup.materials[MATS.indexOf('slate')], slot: 'slate'}; // no tint: does not count
  const c = materialSlotCoverage(soup);
  assert.ok(Math.abs(c.tagged - 456) < 1, `tagged ${c.tagged}`);
  assert.ok(Math.abs(c.ratio - 456 / 572) < 0.01, `ratio ${c.ratio}`);
  assert.equal(c.untagged[0].material, 'slate');
  soup.materials[MATS.indexOf('slate')].tint = '#4a525d';
  assert.equal(materialSlotCoverage(soup).ratio, 1);
  assert.equal(geometryAudit(soup, {skipRhythm: true}).counts['material-slot-untagged-permille'], 0);
});

test('a window on a large diagonal wall is attached (the proximity grid used to drop the wall)', () => {
  // A 120 m long wall at 40 degrees to the axes: its two triangles span far more than the grid's cell cap.
  const a = 40 * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
  const rot = (x: number, y: number, z: number): V3 => [x * c - z * sn, y, x * sn + z * c];
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [];
  const quad = (q: V3[], m: string) => { const b = positions.length / 3; for (const p of q) positions.push(...p); indices.push(b, b + 1, b + 2, b, b + 2, b + 3); triMaterial.push(MATS.indexOf(m), MATS.indexOf(m)); };
  const L = 120, H = 30;
  // Wall slab 0.3 m thick, outward face at z = 0.3 (facing +z before the turn).
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: string) => {
    const f: V3[][] = [[[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]];
    for (const q of f) quad(q.map(p => rot(...p)), m);
  };
  box(0, 0, 0, L, H, 0.3, 'brick');
  box(60, 10, 0.3, 61.2, 12, 0.4, 'glass'); // pane standing on the wall's outer face
  box(61.7, 10, 0.3, 63, 12, 0.5, 'brick'); // a brick pilaster 50 cm beside it: the nearest host geometry once the wall is not found
  const soup: MaterialSoup = {positions, indices, triMaterial, materials: MATS.map(name => ({name, rgb: [128, 128, 128] as [number, number, number]}))};
  const r = auditOpenings(soup);
  assert.equal(r.assemblies, 1);
  assert.deepEqual(r.issues.map(i => `${i.kind} gap ${i.gap}`), []);
});

test('a large glazed skin is the wall, not a window overhanging it; a small window past a wall end still overhangs', () => {
  // 10 x 3.4 m glass band (34 m2) running 4 m past the end of the block (curtain wall continuing round a corner).
  const band = {min: [6, 3, 8] as V3, max: [16, 6.4, 8.15] as V3, mat: 'glass'};
  assert.deepEqual(auditOpenings(boxes(block, band)).issues, [], 'glazed skin');
  assert.equal(auditOpenings(boxes(block, band), {...GEOMETRY_THRESHOLDS, glazedSkinArea: 1e9}).issues[0]?.kind, 'overhang', 'the exemption is what clears it');
  const [i] = auditOpenings(boxes(block, pane(11.4, 8))).issues;
  assert.equal(i.kind, 'overhang');
});

test('rhythm verdict: photo-spec facades fail above the off-size fraction or on any predicted-missing window; inferred ones never fail', () => {
  const o = (t: number): Opening => ({t0: t, t1: t + 1, y0: 1, y1: 3, area: 2});
  const f = (n: number, odd: number, missing: number, fromSpec = true) => ({fromSpec, openings: n, mismatched: Array.from({length: odd}, (_, i) => o(i)), missing: Array.from({length: missing}, (_, i) => ({t: i, y0: 1, y1: 3}))});
  assert.equal(rhythmVerdict(f(20, 3, 0)).fail, false, '15% exactly passes');
  assert.equal(rhythmVerdict(f(20, 4, 0)).fail, true, '20% off-size fails');
  assert.equal(rhythmVerdict(f(69, 42, 2)).fail, true, 'the 2026-10-10 American Hotel canal side fails');
  assert.equal(rhythmVerdict(f(40, 0, 1)).fail, true, 'one predicted-missing window fails');
  assert.equal(rhythmVerdict(f(69, 42, 2, false)).fail, false, 'inferred facades stay warnings');
  assert.equal(RHYTHM_FAIL.oddFraction, 0.15);
});

test('rhythm fail is a fail finding on a photo-spec facade and a gated count; inferred facades only warn', () => {
  // Five windows in a row on the block's south face (z = 8), one twice as wide: 1 of 5 = 20% off-size.
  const win = (x: number, w = 1.2) => ({min: [x, 3, 8] as V3, max: [x + w, 5, 8.1] as V3, mat: 'glass'});
  const soup = boxes(block, win(0.5), win(2.7), win(4.9), win(7.1, 2.4), win(10.3, 1.2));
  const spec = geometryAudit(soup, {facades: [{name: 'south', bearing: 180}]});
  assert.equal(spec.findings.find(x => x.kind === 'window-rhythm')?.severity, 'fail');
  assert.equal(spec.counts['window-rhythm-fail'], 1);
  assert.ok(spec.counts['window-mismatch-spec'] >= 1);
  assert.ok(regressions(spec.counts, undefined).some(r => r.startsWith('window-rhythm-fail')), 'a model without allowance fails');
  assert.deepEqual(regressions(spec.counts, spec.counts), [], 'a baselined model at its recorded counts passes');
  assert.equal(regressions({...spec.counts, 'window-mismatch-spec': spec.counts['window-mismatch-spec'] + 1}, spec.counts).length, 1, 'and may not get worse');
  const inferred = geometryAudit(soup, {});
  assert.ok(inferred.findings.filter(x => x.kind === 'window-rhythm').every(x => x.severity === 'warn'));
  assert.equal(inferred.counts['window-rhythm-fail'], 0);
});

// ---------------------------------------------------------------------------------------------------------------
// Coplanar overlap (lane zfight-audit 2026-10-13): Centraal Station's glazing strips floating a few cm over the shed roof.

/** Quads (two triangles each, each its own part): corners in order, one material. */
function quads(...qs: {p: V3[]; mat: string}[]): MaterialSoup {
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [];
  for (const q of qs) {
    const base = positions.length / 3;
    for (const v of q.p) positions.push(...v);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    triMaterial.push(MATS.indexOf(q.mat), MATS.indexOf(q.mat));
  }
  return {positions, indices, triMaterial, materials: MATS.map(name => ({name, rgb: [128, 128, 128] as [number, number, number]}))};
}
/** Upward-facing horizontal quad (counter-clockwise seen from above: x east, z south). */
const flat = (x0: number, z0: number, x1: number, z1: number, y: number, mat: string) => ({p: [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]] as V3[], mat});

test('coplanarOverlap metric: a strip 1.5 cm over a roof is coplanar, 2.5 cm tight, 3 and 7 cm near, 12 cm clear', () => {
  // 20 x 10 m roof sheet at y = 20 with a 0.4 m wide, 10 m long glazing strip over it (4 m2, 3.8 after the 5 mm abutment shrink).
  for (const [lift, flush, near, tight] of [[0.03, 0, 3.8, 0], [0.025, 0, 3.8, 3.8], [0.015, 3.8, 0, 0], [0.12, 0, 0, 0], [0.07, 0, 3.8, 0]] as const) {
    const z = auditZFight(quads(flat(0, 0, 20, 10, 20, 'slate'), flat(5, 0, 5.4, 10, 20 + lift, 'glass')));
    assert.ok(Math.abs(z.area - flush) < 0.1, `lift ${lift}: flush ${z.area}`);
    assert.ok(Math.abs(z.nearArea - near) < 0.1, `lift ${lift}: near ${z.nearArea}`);
    assert.ok(Math.abs(z.tightArea - tight) < 0.1, `lift ${lift}: tight ${z.tightArea}`);
    if (near) {
      const p = z.patches[0];
      assert.deepEqual(p.materials, ['glass', 'slate']);
      assert.equal(p.orientation, 'roof');
      assert.ok(Math.abs(p.gap - lift) < 0.002, `gap ${p.gap}`);
      assert.ok(p.pairs >= 2 && z.nearPairs === p.pairs);
      assert.ok(Math.abs(p.centre[0] - 5.2) < 0.05 && Math.abs(p.centre[2] - 5) < 0.05, `worst spot ${p.centre}`);
    }
  }
});

test('coplanarOverlap metric: two near-parallel planes far from the origin still meet in the spatial hash', () => {
  // 1 degree apart, 300 m east of the origin: their origin offsets differ by ~5 m, the cell-centre offsets by millimetres.
  const tilt = Math.tan(Math.PI / 180), y = (x: number) => 20 + (x - 300) * tilt;
  const sheet = {p: [[290, 20, 10], [310, 20, 10], [310, 20, 0], [290, 20, 0]] as V3[], mat: 'slate'};
  const strip = {p: [[299.5, y(299.5) + 0.03, 6], [300.5, y(300.5) + 0.03, 6], [300.5, y(300.5) + 0.03, 4], [299.5, y(299.5) + 0.03, 4]] as V3[], mat: 'glass'};
  const z = auditZFight(quads(sheet, strip));
  assert.ok(z.nearArea > 1.5 && z.nearArea < 2.5, `near ${z.nearArea}`);
});

test('coplanarOverlap metric: a doubled face counts within one part and material; the two triangles of a quad do not', () => {
  assert.equal(auditZFight(quads(flat(0, 0, 4, 4, 10, 'slate'))).patches.length, 0, 'adjacent triangles share an edge, no overlap');
  const doubled = auditZFight(quads(flat(0, 0, 4, 4, 10, 'slate'), flat(0, 0, 4, 4, 10, 'slate')));
  assert.ok(doubled.sameArea > 15, `doubled ${doubled.sameArea}`);
  assert.equal(doubled.area, 0, 'a material overlapping itself draws one colour: reported as sameArea, not area');
  assert.ok(auditZFight(quads(flat(0, 0, 4, 4, 10, 'slate'), flat(0, 0, 4, 4, 10, 'stone'))).area > 15, 'two materials do fight');
});

test('coplanarOverlap metric: slivers under 0.05 m2 are dropped', () => {
  // 0.2 x 0.2 m = 0.04 m2 tile flush on a roof.
  assert.equal(auditZFight(quads(flat(0, 0, 10, 10, 5, 'slate'), flat(3, 3, 3.2, 3.2, 5, 'stone'))).area, 0);
  assert.ok(auditZFight(quads(flat(0, 0, 10, 10, 5, 'slate'), flat(3, 3, 3.3, 3.3, 5, 'stone'))).area > 0.05);
});

test('coplanarOverlap metric: a down-facing double-sided roof sheet fights where it is seen from above', () => {
  // Centraal's shed cells face down (ShapeGeometry mapped from XY to XZ flips the winding) on double-sided materials.
  const down = (x0: number, z0: number, x1: number, z1: number, y: number, mat: string) => ({p: [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]] as V3[], mat});
  const soup = quads(down(0, 0, 20, 10, 20, 'slate'), down(5, 0, 5.4, 10, 20.022, 'glass'));
  // Single-sided: the pair is only drawn from below, where every probe reaches the ground first. Never seen.
  assert.equal(auditZFight(soup).nearArea, 0);
  soup.materials = soup.materials.map(m => ({...m, doubleSided: true}));
  const z = auditZFight(soup);
  assert.ok(Math.abs(z.nearArea - 3.8) < 0.1, `double-sided near ${z.nearArea}`);
  assert.equal(z.patches[0].orientation, 'underside');
});

test('coplanarOverlap gate: new exports fail above 0.5 m2 under 3 cm apart; recorded models may not grow', () => {
  assert.deepEqual(regressions({'zfight-m2': 0.2, 'zfight-tight-m2': 0.3, 'zfight-near-m2': 40}, undefined), [], '3-8 cm is reported, not failed, on a new export');
  assert.equal(regressions({'zfight-m2': 0.2, 'zfight-tight-m2': 0.4, 'zfight-near-m2': 0.4}, undefined).length, 1, 'combined 0.6 m2 on a new export');
  assert.equal(regressions({'zfight-tight-m2': 3}, {'zfight-tight-m2': 2}).length, 1, 'tight overlap grew past the entry');
  assert.deepEqual(regressions({'zfight-near-m2': 40}, {'zfight-near-m2': 40}), []);
  assert.equal(regressions({'zfight-near-m2': 42}, {'zfight-near-m2': 40}).length, 1, 'near overlap grew past the entry');
  assert.deepEqual(regressions({'zfight-near-m2': 42}, {'zfight-m2': 0}), [], 'an entry recorded before the near gate');
});

test('coplanarOverlap metric: 200k-triangle models finish in seconds', () => {
  // A 150 x 100 m roof in 0.5 m cells (60k triangles) with 2,000 strips over it, plus 120k triangles of facade grid.
  const qs: {p: V3[]; mat: string}[] = [];
  for (let i = 0; i < 300; i++) for (let j = 0; j < 100; j++) qs.push(flat(i * 0.5, j, i * 0.5 + 0.5, j + 1, 20, 'slate'));
  for (let i = 0; i < 2000; i++) qs.push(flat((i % 100) * 1.5, Math.floor(i / 100) * 5, (i % 100) * 1.5 + 0.2, Math.floor(i / 100) * 5 + 4, 20.03, 'glass'));
  for (let i = 0; i < 300; i++) for (let j = 0; j < 200; j++) qs.push({p: [[i * 0.5, j * 0.1, 0], [i * 0.5 + 0.5, j * 0.1, 0], [i * 0.5 + 0.5, j * 0.1 + 0.1, 0], [i * 0.5, j * 0.1 + 0.1, 0]] as V3[], mat: 'brick'});
  const soup = quads(...qs), t0 = Date.now();
  const z = auditZFight(soup);
  const ms = Date.now() - t0;
  assert.ok(soup.indices.length / 3 > 180000);
  assert.ok(z.nearArea > 1300, `near ${z.nearArea}`);
  assert.ok(ms < 30000, `${ms} ms`);
});

// ---------------------------------------------------------------------------------------------------------------
// Named regressions on real models (scripts/landmarks/geometry-audit-pins.json).

const ROOT = path.resolve(import.meta.dirname, '../../..');
interface Pin {id: string; kind: string; status: 'open' | 'fixed'; orientation?: string; box?: number[]; facade?: string; t?: number[]; min?: number; minArea?: number; evidence: string}
const pins = (JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/landmarks/geometry-audit-pins.json'), 'utf8')) as {pins: Pin[]}).pins;
const inBox = (c: number[], b: number[]) => c[0] >= b[0] && c[1] >= b[1] && c[2] >= b[2] && c[0] <= b[3] && c[1] <= b[4] && c[2] <= b[5];

for (const id of [...new Set(pins.map(p => p.id))]) {
  test(`geometry pins: ${id}`, async () => {
    const {loadMaterialSoup} = await import('../../../scripts/landmarks/material-soup');
    const specFile = path.join(ROOT, 'scripts/landmarks', `${id}-elevations.json`);
    const facades = fs.existsSync(specFile) ? JSON.parse(fs.readFileSync(specFile, 'utf8')).facades : undefined;
    const r = geometryAudit(await loadMaterialSoup(path.join(ROOT, 'public/canal-drive/models', `${id}.glb`)), {facades});
    for (const pin of pins.filter(p => p.id === id)) {
      let found: boolean;
      if (pin.kind.startsWith('opening-')) found = r.openings.issues.some(i => `opening-${i.kind}` === pin.kind && (i.kind === 'buried' || i.severity === 'fail') && inBox(i.centre, pin.box!));
      else if (pin.kind === 'zfight') found = r.zfight.patches.filter(p => !p.near && (!pin.orientation || p.orientation === pin.orientation) && inBox(p.centre, pin.box!)).reduce((t, p) => t + p.area, 0) >= (pin.minArea ?? 0.25);
      else {
        const f = r.rhythm.find(x => x.name === pin.facade);
        assert.ok(f, `facade ${pin.facade} measured`);
        found = pin.kind === 'window-missing' ? f!.missing.some(m => m.t >= pin.t![0] && m.t <= pin.t![1])
          : pin.kind === 'window-rhythm-fail' ? rhythmVerdict(f!).fail : f!.mismatched.length >= (pin.min ?? 1);
      }
      assert.equal(found, pin.status === 'open', `${id} ${pin.kind} (${pin.status}): ${pin.evidence}`);
    }
  });
}

test('geometry baseline: every recorded reason belongs to a baselined model and says why', () => {
  const file = path.join(process.cwd(), 'scripts/landmarks/geometry-audit-baseline.json');
  const b = JSON.parse(fs.readFileSync(file, 'utf8')) as {reasons?: Record<string, string>; models: Record<string, Record<string, number>>};
  for (const [id, why] of Object.entries(b.reasons ?? {})) {
    assert.ok(b.models[id], `reason for ${id} but no baseline entry`);
    assert.ok(why.trim().length > 20, `reason for ${id} is too short to explain a new entry`);
  }
});

// A glass balustrade with a frame rail standing on the roof edge of the block (wall top y = 9) is a guard rail, not an overhanging opening.
const rail = (y0: number, x = 2, w = 6) => [
  {min: [x, y0, 7.8] as V3, max: [x + w, y0 + 1.1, 7.9] as V3, mat: 'glass'},
  {min: [x, y0 + 1.1, 7.8] as V3, max: [x + w, y0 + 1.2, 7.95] as V3, mat: 'white'},
];
test('a glazed balustrade standing on the wall top is a guard rail, not an overhang', () => {
  assert.deepEqual(auditOpenings(boxes(block, ...rail(8.95))).issues, []);
});
test('a window-sized pane floating above the wall top, or a rail hanging past the wall end, is still flagged', () => {
  const high = auditOpenings(boxes(block, ...rail(9.5))).issues;
  assert.ok(high.length > 0, 'a rail 50 cm above the wall top is not resting on it');
  const past = auditOpenings(boxes(block, ...rail(8.95, 9, 6))).issues;
  assert.equal(past.length, 1);
  assert.equal(past[0].kind, 'overhang');
  const tall = auditOpenings(boxes(block, {min: [2, 8.95, 7.8] as V3, max: [6, 11.5, 7.9] as V3, mat: 'glass'})).issues;
  assert.ok(tall.length > 0, 'a 2.5 m glass screen is not a rail');
});

const DMATS = ['brick', 'dark'];
/** Closed n-gon prism (outward faces) with a window box centred on each facet, `depth` proud (negative = sunk). */
function drumSoup(n: number, R: number, H: number, depth: number, wallThickness = 0) {
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [];
  const quad = (q: V3[], m: string) => { const b = positions.length / 3; for (const p of q) positions.push(...p); indices.push(b, b + 1, b + 2, b, b + 2, b + 3); triMaterial.push(DMATS.indexOf(m), DMATS.indexOf(m)); };
  const ring = (r: number) => Array.from({length: n}, (_, i) => [r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n)] as [number, number]);
  const P = ring(R);
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    quad([[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], H, b[1]], [a[0], H, a[1]]].reverse() as V3[], 'brick');
    quad([[a[0], 0, a[1]], [a[0], H, a[1]], [b[0], H, b[1]], [b[0], 0, b[1]]] as V3[], 'brick');
  }
  void wallThickness;
  // top and bottom fans
  for (let i = 1; i < n - 1; i++) { quad([[P[0][0], H, P[0][1]], [P[i + 1][0], H, P[i + 1][1]], [P[i][0], H, P[i][1]], [P[0][0], H, P[0][1]]] as V3[], 'brick'); }
  // windows
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const L = Math.hypot(mx, mz), nx = mx / L, nz = mz / L, tx = -nz, tz = nx, hw = 0.6;
    const o = (u: number, y: number, d: number): V3 => [mx + tx * u + nx * d, y, mz + tz * u + nz * d];
    const d0 = depth >= 0 ? 0 : depth, d1 = depth >= 0 ? depth : 0;
    // front face of the window (the visible one) plus back/sides as a closed box
    const f = (d: number) => [o(-hw, 3, d), o(hw, 3, d), o(hw, 6, d), o(-hw, 6, d)];
    quad(f(d1), 'dark'); quad([...f(d0)].reverse(), 'dark');
    for (const [u0, u1] of [[-hw, hw]]) { quad([o(u0, 3, d0), o(u1, 3, d0), o(u1, 3, d1), o(u0, 3, d1)], 'dark'); quad([o(u0, 6, d1), o(u1, 6, d1), o(u1, 6, d0), o(u0, 6, d0)], 'dark'); }
    quad([o(-hw, 3, d1), o(-hw, 3, d0), o(-hw, 6, d0), o(-hw, 6, d1)], 'dark'); quad([o(hw, 3, d0), o(hw, 3, d1), o(hw, 6, d1), o(hw, 6, d0)], 'dark');
  }
  return {positions, indices, triMaterial, materials: DMATS.map(name => ({name, rgb: [1, 1, 1] as [number, number, number]}))};
}


test('windows flush on a polygonal drum (12-32 facets, curved wall) are attached; sunk ones are buried', () => {
  for (const n of [12, 16, 24, 32]) {
    const flush = auditOpenings(drumSoup(n, 8, 10, 0.1));
    assert.equal(flush.assemblies, n);
    assert.deepEqual(flush.issues.map(i => i.kind), [], `${n}-gon drum, flush windows`);
  }
  const sunk = auditOpenings(drumSoup(16, 8, 10, -0.3));
  assert.ok(sunk.issues.length >= 12 && sunk.issues.every(i => i.kind === 'buried'), JSON.stringify(sunk.issues.map(i => i.kind)));
});

// ----------------------------------------------------------------------------------------------------------
// Detached-opening false-positive classes (precision sweep 2026-10-13: 22 of 30 sampled fail-grade issues were these).

/** Rotate a soup about the vertical axis through (cx, cz). */
function rotY(s: MaterialSoup, deg: number, cx = 6, cz = 4): MaterialSoup {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a), p = [...s.positions];
  for (let i = 0; i < p.length; i += 3) { const x = p[i] - cx, z = p[i + 2] - cz; p[i] = cx + x * c - z * sn; p[i + 2] = cz + x * sn + z * c; }
  return {...s, positions: p};
}

test('railing posts on a parapet, a fence past the wall end and a frame-clad column are not openings', () => {
  // Posts fixed to the face of the 9 m wall and standing 1.1 m above its top (not resting on the top edge: guard-rail rule does not apply).
  const posts = [1, 3, 5, 7].map(x => ({min: [x, 8.7, 8] as V3, max: [x + 0.06, 10.1, 8.06] as V3, mat: 'white'}));
  assert.deepEqual(auditOpenings(boxes(block, ...posts)).issues, []);
  // Pickets on a plinth that runs on past the block's east end (x = 12).
  const plinth = {min: [0, 0, 8] as V3, max: [16, 0.4, 8.3] as V3, mat: 'stone'};
  const pickets = [12.5, 12.8, 13.1, 13.4].map(x => ({min: [x, 0.4, 8.1] as V3, max: [x + 0.05, 3.2, 8.15] as V3, mat: 'white'}));
  assert.deepEqual(auditOpenings(boxes(block, plinth, ...pickets)).issues, []);
  // A 0.5 m square frame-clad column past the wall end, carrying a deck that oversails it.
  const deck = {min: [0, 3.3, 8] as V3, max: [14, 3.6, 10] as V3, mat: 'stone'};
  assert.deepEqual(auditOpenings(boxes(block, deck, {min: [12.2, 0.01, 8], max: [12.7, 3.3, 8.5], mat: 'white'})).issues, []);
});

test('shape classes: a handrail or beam is not an opening, a loose sill or a window is', () => {
  const tris = (s: MaterialSoup) => Array.from({length: s.indices.length / 3}, (_, i) => i);
  const beam = boxes({min: [0, 9, 7.85], max: [8, 9.08, 7.95], mat: 'frame'});
  assert.equal(nonOpeningShape(beam, tris(beam), [0, 1]), 'post');
  // Treehouse NDSM: the same beam rotated 11 degrees (its axis-aligned box is 1.1 x 4.9 m) is still a beam.
  const skew = rotY(boxes({min: [0, 6.34, 0], max: [0.1, 6.42, 4.9], mat: 'frame'}), 11, 0, 0);
  assert.equal(nonOpeningShape(skew, tris(skew), [Math.cos(11 * Math.PI / 180), Math.sin(11 * Math.PI / 180)]), 'post');
  const sill = boxes({min: [0, 3, 8], max: [1.2, 3.1, 8.15], mat: 'white'});
  assert.equal(nonOpeningShape(sill, tris(sill), [0, 1]), undefined);
  const win = boxes({min: [0, 3, 8], max: [1.2, 5, 8.1], mat: 'glass'});
  assert.equal(nonOpeningShape(win, tris(win), [0, 1]), undefined);
});

test('a window on a 45-degree wall is not mistaken for a column; one floating off it still fails', () => {
  const ok = auditOpenings(rotY(boxes(block, {min: [5, 3, 8], max: [6, 5, 8.1], mat: 'glass'}), 45));
  assert.deepEqual(ok.issues, []);
  const off = auditOpenings(rotY(boxes(block, {min: [5, 3, 8.25], max: [6, 5, 8.35], mat: 'glass'}), 45)).issues;
  assert.equal(off[0]?.kind, 'floating');
  assert.equal(off[0]?.severity, 'fail');
});

test('a glass canopy and a frame floor plate are not wall openings', () => {
  const canopy = {min: [3, 3, 8] as V3, max: [7, 3.08, 9.6] as V3, mat: 'glass'};
  assert.deepEqual(auditOpenings(boxes(block, canopy)).issues, []);
  const plate = {min: [-1, 6, -1] as V3, max: [13, 6.1, 9] as V3, mat: 'white'};
  assert.deepEqual(auditOpenings(boxes(block, plate)).issues, []);
});

/** Tilt a soup about the horizontal x axis through (y0, z0) (positive deg leans +z faces upward). */
function rotX(s: MaterialSoup, deg: number, y0: number, z0: number): MaterialSoup {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a), p = [...s.positions];
  for (let i = 0; i < p.length; i += 3) { const y = p[i + 1] - y0, z = p[i + 2] - z0; p[i + 1] = y0 + y * c - z * sn; p[i + 2] = z0 + y * sn + z * c; }
  return {...s, positions: p};
}
test('sawtooth roof glazing leaning 25 degrees is not a wall opening; a roof-only floater is a warning', () => {
  // A 2.5 m frame-and-glass light standing on the block roof (y = 9) near the south edge, leaning back 25 degrees.
  const light = rotX(boxes({min: [3, 9, 6] as V3, max: [6, 11.5, 6.08] as V3, mat: 'glass'}), -25, 9, 6);
  assert.deepEqual(auditOpenings(merge(boxes(block), light)).issues.filter(i => i.severity === 'fail'), []);
  // A rib 15 cm above the roof, nowhere near a wall plane: reported, not failed.
  const rib = auditOpenings(boxes(block, {min: [3, 9.15, 2] as V3, max: [3.08, 9.6, 5] as V3, mat: 'white'})).issues;
  assert.deepEqual(rib.map(i => [i.kind, i.severity]), [['floating', 'warn']]);
});

test('a window beside a projecting band is judged against the wall it stands on, not the band\'s back face', () => {
  // A 1.2 m stone band 13-33 cm proud of the south face; its back face (z = 8.13, facing north) is a wall-sized plane the
  // window straddles. The window (z 8.01-8.2) stands on the brick face below the band.
  const band = {min: [0, 6, 8.13] as V3, max: [12, 7.2, 8.33] as V3, mat: 'stone'};
  const win = [{min: [2, 3.7, 8.01] as V3, max: [3.5, 6.0, 8.15] as V3, mat: 'white'}, {min: [2.1, 3.8, 8.15] as V3, max: [3.4, 5.9, 8.2] as V3, mat: 'glass'}];
  assert.deepEqual(auditOpenings(boxes(block, band, ...win)).issues.filter(i => i.severity === 'fail'), []);
});

/** U-shaped plan: two brick masses 6 m apart, a recessed brick mass between them, glass spanning the gap flush with the front. */
const uMasses = [
  {min: [0, 0, 0] as V3, max: [2, 9, 8.5] as V3, mat: 'brick'}, {min: [8, 0, 0] as V3, max: [10, 9, 8.5] as V3, mat: 'brick'},
  {min: [2, 0, 0] as V3, max: [8, 9, 6] as V3, mat: 'brick'},
];
test('curtain-wall glazing spanning between two masses is the envelope, not an overhang', () => {
  const panels = [0.5, 3, 5.5].map(y => ({min: [2, y, 8.45] as V3, max: [8, y + 2.4, 8.5] as V3, mat: 'glass'}));
  assert.deepEqual(auditOpenings(boxes(...uMasses, ...panels)).issues, []);
  // Without the right-hand mass the same panel hangs into the air past the left mass's edge.
  const free = auditOpenings(boxes(uMasses[0], uMasses[2], {min: [2, 0.5, 8.45], max: [8, 2.9, 8.5], mat: 'glass'})).issues;
  assert.equal(free[0]?.kind, 'overhang');
});

/** Regular n-gon prism (a drum) of radius r around (cx, cz), outward faces, brick. */
function drum(n: number, r: number, h: number, cx = 0, cz = 0): MaterialSoup {
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [];
  const at = (k: number) => [cx + r * Math.cos((2 * Math.PI * k) / n), cz + r * Math.sin((2 * Math.PI * k) / n)];
  for (let k = 0; k < n; k++) {
    const [x0, z0] = at(k), [x1, z1] = at(k + 1), b = positions.length / 3;
    positions.push(x0, 0, z0, x1, 0, z1, x1, h, z1, x0, h, z0);
    indices.push(b, b + 2, b + 1, b, b + 3, b + 2);
    triMaterial.push(0, 0);
    const c = positions.length / 3;
    positions.push(cx, h, cz, x0, h, z0, x1, h, z1);
    indices.push(c, c + 1, c + 2);
    triMaterial.push(0);
  }
  return {positions, indices, triMaterial, materials: MATS.map(name => ({name, rgb: [128, 128, 128] as [number, number, number]}))};
}
function merge(a: MaterialSoup, b: MaterialSoup): MaterialSoup {
  const off = a.positions.length / 3;
  return {...a, positions: [...a.positions, ...b.positions], indices: [...a.indices, ...b.indices.map(i => i + off)], triMaterial: [...a.triMaterial, ...b.triMaterial]};
}
test('a window across two facets of a curved drum is on the wall', () => {
  // 24-gon drum r = 10 (facets 2.6 m wide, 15 degrees apart); a 1.6 m pane across the vertex at angle 0, touching it (its ends stand 10 cm off the facets).
  const r = auditOpenings(merge(drum(24, 10, 9), boxes({min: [9.99, 3, -0.8] as V3, max: [10.05, 5, 0.8] as V3, mat: 'glass'})));
  assert.deepEqual(r.issues.filter(i => i.kind === 'overhang'), []);
});
