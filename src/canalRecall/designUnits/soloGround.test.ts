/**
 * Kit-ground lane (2026-11-21): a read ground storey's own front and a flat crown, on Herengracht 2-90 even. Named
 * regressions: 2-4 (cream stucco pilastered ground, two windows and a door under a tall light), 12 (rusticated stucco,
 * the door under a round-barred light), 20 (tall windows over a street tier of doors under a black fascia; a white flat
 * eaves canopy), 34 (a slab on piers; glazed entrances, not a shop), 70 (two tall windows where the kit drew a door, the
 * doors in a street tier), 86 (white surrounds and pilasters on brick), doors of 10 (arched light), 58 (pair of leaves,
 * leaded light), 66 (oval light, oak leaf). Absent a read, nothing moves.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { archHead, diagonalIn, ORNAMENT_COMPONENTS, ROW_DOORCASE, SOLO_GROUND_TIER } from '../facadeOrnaments.ts';
import { ExtraSink, type ExtraContext } from '../facadeExtraCore.ts';
import { soloGroundBoxes } from '../threeBuildingMesh.ts';
import type { Openings } from '../facadeOpenings.ts';
import { beltPlotFacts } from '../beltReview/plotRead.ts';
import { readExtras } from '../beltReview/houseRead.ts';
import { soloDoorRead } from './draw.ts';
import { flatCrownOf, groundFrontBoxes, groundFrontOf, groundPilasters, PILASTER, type GroundFront } from './soloGround.ts';

/** Herengracht 2-4's read (shares measured on the crop: front 28-362 px, pavement 805, ground top 628). */
const H2: GroundFront = { openings: [{ kind: 'window', x0: 0.102, x1: 0.299, z0: 0.056, z1: 0.887 }, { kind: 'window', x0: 0.395, x1: 0.599, z0: 0.056, z1: 0.887 }, { kind: 'door', x0: 0.719, x1: 0.88, z0: 0.028, z1: 0.864 }],
  face: { hex: '#e5dfc6', fill: 'full', pilasters: true }, band: { hex: '#e0d9bd' }, door: { fanlight: 'plain', fanShare: 0.47, case: 'frame' } };
/** Herengracht 20's: three tall windows over a street tier (glazed double doors, a door) under a black fascia. */
const H20: GroundFront = { openings: [{ kind: 'window', x0: 0.094, x1: 0.305, z0: 0.455, z1: 0.918 }, { kind: 'window', x0: 0.387, x1: 0.598, z0: 0.455, z1: 0.918 }, { kind: 'window', x0: 0.684, x1: 0.891, z0: 0.455, z1: 0.918 }],
  tier: { top: 0.448, hex: '#4a4642', fascia: '#1e1d1d', openings: [{ kind: 'door', x0: 0.094, x1: 0.492, z0: 0.017, z1: 0.733, leaves: 2 }, { kind: 'door', x0: 0.68, x1: 0.891, z0: 0.017, z1: 0.683 }] } };

test('groundFrontOf: valid openings sorted left to right, bad ones dropped; ground windows over a tier; null when empty', () => {
  const g = groundFrontOf({ openings: [H2.openings![2], { kind: 'window', x0: 0.5, x1: 0.4, z0: 0, z1: 1 }, H2.openings![0], { kind: 'arch', x0: 0, x1: 1, z0: 0, z1: 1 }], face: { hex: '#E5DFC6', pilasters: true }, by: 'eye' })!;
  assert.deepEqual(g.openings!.map(o => o.kind), ['window', 'door']);
  assert.deepEqual(g.face, { hex: '#e5dfc6', fill: 'full', pilasters: true });
  assert.equal(g.by, 'eye');
  // A window under the tier's top is not a ground window (the tier draws its own openings).
  const t = groundFrontOf({ ...H20, openings: [...H20.openings!, { kind: 'window', x0: 0.1, x1: 0.2, z0: 0, z1: 0.3 }] })!;
  assert.equal(t.openings!.length, 3);
  assert.equal(t.tier!.openings[0].leaves, 2);
  assert.equal(groundFrontOf({ face: { hex: 'white' }, tier: { top: 0.9, hex: '#000000', openings: [] } }), null);
  assert.equal(groundFrontOf(null), null);
  assert.deepEqual(groundFrontOf({ door: { leaves: 2, fanlight: 'leaded', fanShare: 0.9, case: 'x', leaf: '#8A5832' } }), { door: { leaves: 2, fanlight: 'leaded', leaf: '#8a5832' } });
});

test('flatCrownOf: a canopy or a slab on piers within its ranges; else null', () => {
  assert.deepEqual(flatCrownOf({ kind: 'canopy', depthM: 2.5, slabM: 0.6, outM: 1.2, hex: '#F2F1EC' }), { kind: 'canopy', depthM: 2.5, slabM: 0.6, outM: 1.2, hex: '#f2f1ec' });
  const slab = flatCrownOf({ kind: 'slab-on-piers', depthM: 1.1, slabM: 0.5, outM: 0.5, hex: '#cfcabb', piers: [0.8, 0.03, 2] })!;
  assert.deepEqual(slab.piers, [0.03, 0.8]);
  assert.equal(slab.pierW, 0.3);
  assert.equal(flatCrownOf({ kind: 'canopy', depthM: 0.4, slabM: 0.6, outM: 1, hex: '#ffffff' }), null, 'a slab taller than its zone');
  assert.equal(flatCrownOf({ kind: 'cornice', depthM: 1, slabM: 0.5, outM: 1, hex: '#ffffff' }), null);
});

test('groundFrontBoxes: the read openings in metres on the ground storey; windows widened by the unit margins; tier openings apart', () => {
  const b = groundFrontBoxes(H2, 4)!;
  assert.deepEqual(b.map(x => x.kind), ['window', 'window', 'door']);
  assert.deepEqual([b[2].a0, b[2].a1, b[2].sillM, b[2].headM], [0.719, 0.88, 0.112, 3.456]);
  const m = groundFrontBoxes(H2, 4, { l: 0.1, r: 0.1, t: 0.1, b: 0.1 })!;
  assert.ok(Math.abs(m[0].a0 - (0.102 - 0.197 * 0.1)) < 1e-9 && m[2].a0 === 0.719, 'a door keeps its read width');
  const t = groundFrontBoxes(H20, 5)!;
  assert.deepEqual(t.map(x => x.kind), ['window', 'window', 'window', 'tier-door', 'tier-door']);
  assert.equal(t[3].headM, +(0.733 * 0.448 * 5).toFixed(3));
  assert.equal(t[3].leaves, 2);
  assert.equal(groundFrontBoxes({ face: H2.face }, 4), undefined, 'no openings read: the axes as before');
});

test('soloGroundBoxes: a read front draws its own openings (70: two windows, no door), a measured basement keeps its low windows', () => {
  const OPEN = { upper: { axes: [0.5], width: 0.4, sill: 0.25, head: 0.8 }, door: { axis: 0.5, width: 0.3, bottom: 0, top: 0.8 } } as unknown as Openings;
  const layout = { bays: 2, bayWidthM: 2, groundM: 5, storeyM: 3.2, lengthM: 4 };
  const H70: GroundFront = { openings: [{ kind: 'window', x0: 0.07, x1: 0.32, z0: 0.37, z1: 0.84 }, { kind: 'window', x0: 0.37, x1: 0.61, z0: 0.37, z1: 0.84 }] };
  const b = soloGroundBoxes(layout, OPEN, { windowRatio: 0.35, doorRatio: 0.64, front: H70 }, 0, true)!;
  assert.deepEqual(b.map(x => x.kind), ['window', 'window'], 'no door where the photo has a window');
  // As seen either way: the read shares are already as seen.
  assert.deepEqual(soloGroundBoxes(layout, OPEN, { windowRatio: 0.35, doorRatio: 0.64, front: H70 }, 0, false), b);
  const base = soloGroundBoxes(layout, OPEN, { windowRatio: 1, doorRatio: 0.8, basementRatio: 0.36, front: H70 }, 0, true)!;
  assert.deepEqual(base.map(x => x.kind), ['basement', 'window', 'basement', 'window']);
  // No front: the axes as before.
  assert.deepEqual(soloGroundBoxes(layout, OPEN, { windowRatio: 1.5, doorRatio: 0.8 }, 0, true)!.map(x => x.kind), ['door', 'window']);
});

test('groundPilasters: one on every pier and at both ends, clear of the openings (2-4)', () => {
  const L = 8.09, p = groundPilasters(H2.openings!, L);
  assert.equal(p.length, 4);
  assert.equal(p[0][0], 0);
  assert.ok(Math.abs(p[3][1] - L) < 1e-9);
  for (const [a, b] of p) for (const o of H2.openings!) assert.ok(b <= o.x0 * L - PILASTER.gap + 1e-6 || a >= o.x1 * L + PILASTER.gap - 1e-6, `${a}-${b} clear of ${o.x0 * L}-${o.x1 * L}`);
  assert.deepEqual(groundPilasters([{ x0: 0.01, x1: 0.99 }], 5), [], 'no room on the piers');
});

const wall = (over: Partial<ExtraContext> = {}): ExtraContext => ({
  id: 'h', style: 'canal', period: 'canal', wallKey: 'front', f: { x0: 0, y0: 0, ux: 1, uy: 0, nx: 0, ny: -1, len: 8 }, base: 0, top: 12.75,
  layout: { bays: 3, bayWidthM: 8 / 3, groundM: 4.6, storeys: 3, storeyM: 3.2, doorBays: [] },
  wallHex: '#4e4a4c', accentHex: '#ffffff', groundLevel: true, streetSide: true,
  openings: { upper: { axes: [0.5], width: 0.45, sill: 0.25, head: 0.85 }, ground: { axes: [0.5], width: 0.45, sill: 0.3, head: 0.8 }, doorWindow: null, door: { axis: 0.5, width: 0.4, bottom: 0, top: 0.8, fanlight: false } },
  ...over,
} as ExtraContext);
const build = (id: string, c: ExtraContext) => { const s = new ExtraSink(100000); ORNAMENT_COMPONENTS.find(x => x.id === id)!.build(c, s, 0); return s.tris; };

test('solo-ground-face: a full stucco facing with pilasters and a band (2-4), surrounds only on brick (86); absent: nothing', () => {
  const g = { groundWindows: [{ x: 1.6, hw: 0.8, z0: 0.3, z1: 4 }, { x: 4, hw: 0.8, z0: 0.3, z1: 4 }], groundDoor: { x: 6.5, hw: 0.6, z0: 0.1, z1: 4 } };
  assert.equal(build('solo-ground-face', wall(g)).length, 0);
  const full = build('solo-ground-face', wall({ ...g, groundFace: { face: H2.face, band: H2.band!.hex, z0: 0 } }));
  assert.ok(full.some(t => t.hex === '#e5dfc6') && full.some(t => t.hex === '#e0d9bd'));
  // Nothing of the facing covers a window's glass.
  for (const t of full.filter(t => t.hex === '#e5dfc6')) {
    const xs = t.p.map(p => p[0]), zs = t.p.map(p => p[2]), x = (Math.min(...xs) + Math.max(...xs)) / 2, z = (Math.min(...zs) + Math.max(...zs)) / 2;
    assert.ok(!(Math.abs(x - 1.6) < 0.7 && z > 0.4 && z < 3.9), `facing over the window at ${x}, ${z}`);
  }
  const frames = build('solo-ground-face', wall({ ...g, groundFace: { face: { hex: '#e6e3da', fill: 'frames', pilasters: true }, z0: 0 } }));
  assert.ok(frames.length > 0 && frames.length < full.length + 200);
  const rust = build('solo-ground-face', wall({ ...g, groundFace: { face: { ...H2.face!, rusticated: true }, z0: 0 } }));
  assert.ok(rust.length > build('solo-ground-face', wall({ ...g, groundFace: { face: H2.face, z0: 0 } })).length, 'rustication joints');
});

test('solo-ground-tier: the street tier faced, its fascia, a glazed pair of leaves (20); absent: nothing', () => {
  assert.equal(build('solo-ground-tier', wall()).length, 0);
  const t = build('solo-ground-tier', wall({ groundTier: { z1: 2.2, hex: '#4a4642', fascia: '#1e1d1d', openings: [{ x: 2.3, hw: 1.6, z0: 0.08, z1: 1.6, kind: 'door', leaves: 2 }, { x: 6.5, hw: 0.8, z0: 0.08, z1: 1.5, kind: 'door' }] } }));
  assert.ok(t.some(x => x.hex === '#1e1d1d') && t.some(x => x.hex === SOLO_GROUND_TIER.leaf) && t.filter(x => x.hex === SOLO_GROUND_TIER.glass).length >= 6);
});

test('flat-crown: a canopy prism with a raked soffit (20), a slab on piers over a dark recess (34); absent: nothing', () => {
  assert.equal(build('flat-crown', wall()).length, 0);
  const can = build('flat-crown', wall({ flatCrown: flatCrownOf({ kind: 'canopy', depthM: 2.5, slabM: 0.6, outM: 1.2, hex: '#f2f1ec' })! }));
  assert.ok(can.length >= 8);
  // The soffit faces down and out.
  assert.ok(can.some(t => t.n[2] < -0.3 && t.n[1] < -0.3));
  const slab = build('flat-crown', wall({ flatCrown: flatCrownOf({ kind: 'slab-on-piers', depthM: 1.1, slabM: 0.5, outM: 0.5, hex: '#cfcabb', piers: [0.03, 0.32, 0.58, 0.84, 0.97], pierW: 0.4, recessHex: '#3e3f3e' })! }));
  assert.ok(slab.some(t => t.hex === '#3e3f3e'));
  assert.ok(Math.max(...slab.flatMap(t => t.p.map(p => p[2]))) <= 12.75 + 1e-9, 'inside the wall top');
});

test('row-doorcase: a pair of leaves, a leaded or an arched light at the read share, a bare frame; the stated door unchanged', () => {
  const comp = ORNAMENT_COMPONENTS.find(x => x.id === 'row-doorcase')!;
  const run = (doorcase: NonNullable<ExtraContext['rowDress']>['doorcase']) => { const s = new ExtraSink(100000); comp.build(wall({ layout: { bays: 3, bayWidthM: 2, groundM: 3.2, storeys: 3, storeyM: 3.2, doorBays: [2] } as ExtraContext['layout'], rowDress: { doorcase } }), s, 0); return s.tris; };
  const plain = run({ material: 'stone' });
  assert.deepEqual(run({ material: 'stone', leaves: undefined, fanShare: undefined, bare: undefined }), plain, 'absent parts: the same door');
  assert.ok(run({ material: 'stone', leaves: 2 }).length > plain.length);
  const glassZ = (t: ReturnType<typeof run>) => Math.min(...t.filter(x => x.hex === ROW_DOORCASE.glass).flatMap(x => x.p.map(p => p[2])));
  assert.ok(glassZ(run({ material: 'stone', fanShare: 0.45 })) < glassZ(plain) - 0.4, 'a taller light');
  assert.ok(run({ material: 'stone', fanlight: 'leaded' }).some(x => x.hex === '#3a3d3f'));
  assert.ok(run({ material: 'stone', fanlight: 'arched' }).length > plain.length);
  assert.ok(run({ material: 'stone', bare: true }).length < plain.length, 'no pilasters or entablature');
});

test('diagonalIn and archHead: lattice lines clipped to the light; a round head inside it', () => {
  assert.deepEqual(diagonalIn(0, 1, 0, 1, 0, 1), [[0, 0], [1, 1]]);
  assert.deepEqual(diagonalIn(1, -1, 0, 1, 0, 0.5), [[0.5, 0.5], [1, 0]]);
  assert.equal(diagonalIn(5, 1, 0, 1, 0, 1), null);
  const a = archHead(0, 1, 2, 2.8);
  assert.deepEqual(a[0], [0, 2.3]);
  assert.ok(Math.abs(a[6][1] - 2.8) < 1e-9 && a.every(([, z]) => z >= 2 && z <= 2.8 + 1e-9));
});

test('the read reaches the plot: a dwelling takes its ground front, a shop does not; a flat crown takes the cornice\'s place', () => {
  const fields = { storeys: 5, bays: 3, crown: 'flat', cornice: 'heavy', roofStorey: 'none', ground: 'dwelling', door: { bay: 1, surround: true }, eavesM: 18.95 };
  const read = readExtras({ readable: true, groundFront: H20, flatCrown: { kind: 'canopy', depthM: 2.5, slabM: 0.6, outM: 1.2, hex: '#f2f1ec' }, corniceRatio: 0.106 } as never)!;
  const p = beltPlotFacts(fields, read)!;
  assert.equal(p.facts.groundFront!.tier!.openings.length, 2);
  assert.equal(p.facts.flatCrown!.kind, 'canopy');
  assert.equal(p.facts.cornice, undefined);
  assert.equal(p.facts.corniceDepthM, undefined);
  assert.equal(beltPlotFacts({ ...fields, ground: 'shop' }, read)!.facts.groundFront, undefined);
  const none = beltPlotFacts(fields, readExtras({ readable: true } as never))!;
  assert.equal(none.facts.groundFront, undefined);
  assert.equal(none.facts.cornice, 'heavy');
  assert.deepEqual(soloDoorRead({ fanlight: 'none', case: 'frame', leaf: '#8a5832' }), { fanlight: false, bare: true, door: '#8a5832' });
  assert.deepEqual(soloDoorRead({ fanlight: 'plain', leaves: 2, fanShare: 0.3 }), { fanlight: true, leaves: 2, fanShare: 0.3 });
});
