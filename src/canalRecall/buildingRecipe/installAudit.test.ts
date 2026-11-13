import test from 'node:test';
import assert from 'node:assert/strict';
import {auditInstall, crownSurvival, flatCrownAllowance, frontProfile, placementU, readCrown, type FrameTri, type Ring, type StatedParts, type XY} from './installAudit.ts';
import {frontFrame, placementFor} from './instances.ts';
import {lngLatToRd, rdToLngLat} from '../rdCoordinates.ts';

/** A closed box in the frontage frame: x in [x0, x1], z in [-depth, zFront], y in [0, h] (walls + roof), material `brick`. */
function box(x0: number, x1: number, depth: number, h: number, zFront = 0, material = 'aaaaaa_brick'): FrameTri[] {
  const c = (x: number, y: number, z: number) => [x, y, z], out: FrameTri[] = [];
  const quad = (a: number[], b: number[], cc: number[], d: number[]) => { out.push({a, b, c: cc, material}, {a, b: cc, c: d, material}); };
  const z0 = zFront - depth;
  quad(c(x0, 0, zFront), c(x1, 0, zFront), c(x1, h, zFront), c(x0, h, zFront));
  quad(c(x0, 0, z0), c(x1, 0, z0), c(x1, h, z0), c(x0, h, z0));
  quad(c(x0, 0, z0), c(x0, 0, zFront), c(x0, h, zFront), c(x0, h, z0));
  quad(c(x1, 0, z0), c(x1, 0, zFront), c(x1, h, zFront), c(x1, h, z0));
  quad(c(x0, h, z0), c(x1, h, z0), c(x1, h, zFront), c(x0, h, zFront));
  return out;
}
// A street along RD x (front from (0,0) to (5,0)), the house behind it to the south: outward normal +y.
// Frame +X runs along the front left to right seen from the street (looking south): towards -x... keep it simple and
// place +X on RD +x with the outward normal -y? No: +Z is +X turned clockwise, so +X = RD (1,0) gives +Z = (0,-1).
// The house therefore lies at y in [0, 10] behind a front at y = 0 whose outward normal is (0,-1).
const placement = {anchorRD: [2.5, 0] as XY, uRD: [1, 0] as XY, mirror: false};
const own: Ring[] = [[[0, 0], [5, 0], [5, 10], [0, 10]]];
const neighbours = [{id: 'left', rings: [[[-5, 0], [0, 0], [0, 10], [-5, 10]]] as Ring[]}, {id: 'right', rings: [[[5, 0], [10, 0], [10, 10], [5, 10]]] as Ring[]}];
const fronts = [{street: 'Teststraat', chainRD: [[0, 0], [5, 0]] as XY[], outwardNormalRD: [0, -1] as XY}];
const stated: StatedParts = {storeyHeights: [4, 3, 3], eavesM: 10};
const run = (tris: FrameTri[], s: StatedParts = stated, rings = own) => auditInstall({tris, placement, own: rings, neighbours, fronts, stated: s});
const gate = (a: ReturnType<typeof run>, id: string) => a.gates.find(g => g.id === id)!;

test('a box on its own plot passes every plan gate, IoU ~1', () => {
  const a = run(box(-2.5, 2.5, 10, 10));
  for (const g of a.gates) assert.ok(g.pass, `${g.id} ${g.valueM}`);
  assert.ok(a.meshIoU > 0.95, String(a.meshIoU));
});

test('a model 0.6 m forward of the wall line fails protrusion; a stated hoist at the top does not', () => {
  assert.equal(gate(run(box(-2.5, 2.5, 10, 10, 0.6)), 'protrusion').pass, false);
  const hoist = [...box(-2.5, 2.5, 10, 10), ...box(-0.07, 0.07, 1.1, 0.2, 1.1, '2a2a28_door').map(t => ({...t, a: [t.a[0], t.a[1] + 9, t.a[2]], b: [t.b[0], t.b[1] + 9, t.b[2]], c: [t.c[0], t.c[1] + 9, t.c[2]]}))];
  assert.equal(gate(run(hoist), 'protrusion').pass, false, 'unstated hoist');
  const a = run(hoist, {...stated, hoist: true});
  assert.equal(gate(a, 'protrusion').pass, true);
  assert.equal(a.protrusions[0].explainedBy, 'hoist');
});

test('a model 0.5 m wide of its plot intrudes into the neighbour; a narrow one leaves a frontage gap', () => {
  const wide = run(box(-2.5, 3.0, 10, 10));
  assert.equal(gate(wide, 'intrusion').pass, false);
  assert.equal(gate(wide, 'intrusion').detail, 'right');
  const narrow = run(box(-2.5, 2.0, 10, 10));
  assert.equal(gate(narrow, 'frontage').pass, false);
  assert.ok(Math.abs(narrow.frontage[0].uncoveredM - 0.5) < 0.02, String(narrow.frontage[0].uncoveredM));
});

test('a box over an L-shaped plot is outside the polygon', () => {
  const L: Ring[] = [[[0, 0], [5, 0], [5, 5], [2.5, 5], [2.5, 10], [0, 10]]];
  const a = run(box(-2.5, 2.5, 10, 10), stated, L);
  assert.equal(gate(a, 'outside').pass, false);
  assert.ok(gate(a, 'outside').valueM > 10, String(gate(a, 'outside').valueM));
  assert.ok(a.meshIoU < 0.8);
});

test('a neighbour BAG overlapping the pand by 0.35 m is not an intrusion of a mesh on the pand outline', () => {
  const overlap = [{id: 'right', rings: [[[4.65, 0], [10, 0], [10, 10], [4.65, 10]]] as Ring[]}];
  const a = auditInstall({tris: box(-2.5, 2.5, 10, 10), placement, own, neighbours: overlap, fronts, stated});
  assert.equal(gate(a, 'intrusion').pass, true, String(gate(a, 'intrusion').valueM));
});

test('placementU inverts instances.placementFor (RD -> catalogue -> RD)', () => {
  const front = {endpointsRD: [[120858.55, 488512.131], [120854.4975, 488515.845]] as [number[], number[]], outwardNormalRD: [0.6756, 0.7373]};
  const frame = frontFrame(front);
  const p = placementFor(frame, false, q => rdToLngLat(q[0], q[1]));
  const u = placementU(p.anchor, p.northOffsetDegrees, lngLatToRd);
  assert.ok(Math.hypot(u[0] - frame.uRD[0], u[1] - frame.uRD[1]) < 1e-4, JSON.stringify([u, frame.uRD]));
  const a = lngLatToRd(p.anchor[0], p.anchor[1]);
  assert.ok(Math.hypot(a[0] - frame.midRD[0], a[1] - frame.midRD[1]) < 0.01);
});

test('crown: a flat front reads flat, a 3 m triangle raised; a dropped or unstated crown fails', () => {
  const flat = readCrown(frontProfile(box(-2.5, 2.5, 0.3, 10)));
  assert.equal(flat.family, 'flat');
  const tri: FrameTri[] = [...box(-2.5, 2.5, 0.3, 10), {a: [-2.5, 10, 0], b: [2.5, 10, 0], c: [0, 13, 0], material: 'aaaaaa_brick'}];
  const raised = readCrown(frontProfile(tri));
  assert.equal(raised.family, 'raised');
  assert.ok(raised.riseM > 2, String(raised.riseM));
  assert.equal(crownSurvival('neck', 'neck', raised).pass, true);
  assert.equal(crownSurvival('neck', 'neck', flat).pass, false);
  assert.equal(crownSurvival('cornice', 'cornice', raised).pass, false);
  assert.equal(crownSurvival('bell', 'cornice', raised).pass, false, 'spec -> intent change');
  // A 1.3 m gablet crest on a cornice front is stated, so a 1.3 m rise passes.
  const crest: FrameTri[] = [...box(-2.5, 2.5, 0.3, 10), {a: [-1.75, 10, 0], b: [1.75, 10, 0], c: [0, 11.3, 0], material: 'aaaaaa_stone'}];
  assert.equal(crownSurvival('cornice', 'cornice', readCrown(frontProfile(crest)), flatCrownAllowance({gableOrnament: {gabletSize: {rise: 1.3}}})).pass, true);
  // A chimney spike 0.3 m wide is not a crown; the roof is not read as the wall's crown.
  const spike: FrameTri[] = [...box(-2.5, 2.5, 0.3, 10), ...box(-0.15, 0.15, 0.3, 13)];
  assert.equal(readCrown(frontProfile(spike)).family, 'flat');
  const roof: FrameTri[] = [...box(-2.5, 2.5, 0.3, 10), {a: [-2.5, 10, 0], b: [2.5, 10, 0], c: [0, 13, 0], material: '6a6664_roofTile'}];
  assert.equal(readCrown(frontProfile(roof)).family, 'flat');
});
