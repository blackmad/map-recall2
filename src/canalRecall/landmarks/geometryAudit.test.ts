import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {analyseRhythm, auditOpenings, auditZFight, coplanarOverlap, geometryAudit, regressions, rhythmVerdict, RHYTHM_FAIL} from './geometryAudit';
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
  assert.equal(regressions({'zfight-m2': 0.5}, undefined).length, 1, 'a new model with visible z-fighting fails');
  assert.deepEqual(regressions({'window-missing': 9, 'opening-buried': 4}, undefined), [], 'warn-level counts are never gated');
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
